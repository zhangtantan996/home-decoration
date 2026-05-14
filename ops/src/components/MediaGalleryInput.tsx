import { DeleteOutlined, EyeOutlined, PictureOutlined } from '@ant-design/icons';
import { Button, Image, Modal, message } from 'antd';
import { useRef, useState } from 'react';
import { showApiError, uploadImage } from '../services/api';
import { getAssetPreviewUrl, getAssetStoredPath, joinStoredAssetText, splitStoredAssetText } from '../utils/asset';
import { hashFileContent } from '../utils/fileHash';

interface MediaGalleryInputProps {
  value?: string;
  onChange?: (value?: string) => void;
  placeholder?: string;
  maxCount?: number;
  maxSizeMB?: number;
}

const MediaGalleryInput = ({ value, onChange, placeholder, maxCount = 9, maxSizeMB = 5 }: MediaGalleryInputProps) => {
  const items = splitStoredAssetText(value);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const existingHashCacheRef = useRef<Map<string, string>>(new Map());

  const emit = (nextItems: string[]) => {
    onChange?.(joinStoredAssetText(nextItems));
  };

  const validateImageFile = (file: File) => {
    const isImage = file.type?.startsWith('image/');
    if (!isImage) {
      message.error('只能上传图片文件');
      return false;
    }
    const withinSize = file.size / 1024 / 1024 <= maxSizeMB;
    if (!withinSize) {
      message.error(`图片大小不能超过 ${maxSizeMB}MB`);
      return false;
    }
    return true;
  };

  const ensureExistingHashes = async () => {
    const missingItems = items.filter((item) => item && !existingHashCacheRef.current.has(item));
    if (!missingItems.length) return [] as string[];

    const unresolved: string[] = [];

    await Promise.all(missingItems.map(async (item) => {
      const previewUrl = getAssetPreviewUrl(item);
      if (!previewUrl) {
        unresolved.push(item);
        return;
      }
      try {
        const response = await fetch(previewUrl);
        if (!response.ok) {
          unresolved.push(item);
          return;
        }
        const blob = await response.blob();
        const hash = await hashFileContent(blob);
        if (hash) {
          existingHashCacheRef.current.set(item, hash);
          return;
        }
        unresolved.push(item);
      } catch {
        unresolved.push(item);
      }
    }));

    return unresolved;
  };

  const confirmSkipDuplicates = (duplicateCount: number) =>
    new Promise<boolean>((resolve) => {
      Modal.confirm({
        title: '检测到重复照片',
        content: `检测到 ${duplicateCount} 张重复照片。继续上传将自动跳过重复项，只保留新照片。`,
        okText: '继续上传',
        cancelText: '取消',
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });

  const handleFileSelection = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (!selectedFiles.length || uploading) return;

    if (items.length >= maxCount) {
      message.error(`最多上传 ${maxCount} 张图片`);
      return;
    }

    const validFiles = selectedFiles.filter(validateImageFile);
    if (!validFiles.length) return;

    const availableSlots = Math.max(maxCount - items.length, 0);
    if (!availableSlots) {
      message.error(`最多上传 ${maxCount} 张图片`);
      return;
    }

    let nextBatch = validFiles;
    if (validFiles.length > availableSlots) {
      message.warning(`最多还能上传 ${availableSlots} 张图片，其余图片将被忽略`);
      nextBatch = validFiles.slice(0, availableSlots);
    }

    setUploading(true);
    try {
      const unresolvedExisting = await ensureExistingHashes();
      if (unresolvedExisting.length) {
        message.error('现有图片校验失败，请刷新页面后重试，避免重复图片被误上传');
        return;
      }
      const existingHashes = new Set(existingHashCacheRef.current.values());
      const seenBatchHashes = new Set<string>();
      const uniqueFiles: File[] = [];
      let duplicateCount = 0;

      for (const file of nextBatch) {
        const hash = await hashFileContent(file);
        const duplicateInBatch = seenBatchHashes.has(hash);
        const duplicateInExisting = existingHashes.has(hash);
        if (duplicateInBatch || duplicateInExisting) {
          duplicateCount += 1;
          continue;
        }
        seenBatchHashes.add(hash);
        uniqueFiles.push(file);
      }

      if (!uniqueFiles.length) {
        message.warning(duplicateCount > 0 ? '所选图片均已存在，未重复上传' : '没有可上传的新图片');
        return;
      }

      if (duplicateCount > 0) {
        const shouldContinue = await confirmSkipDuplicates(duplicateCount);
        if (!shouldContinue) return;
      }

      const uploadedPaths: string[] = [];
      for (const file of uniqueFiles) {
        try {
          const result = await uploadImage(file);
          const nextPath = getAssetStoredPath(result);
          if (nextPath) {
            uploadedPaths.push(nextPath);
            const previewUrl = getAssetPreviewUrl(result, nextPath);
            try {
              const response = await fetch(previewUrl);
              if (response.ok) {
                const blob = await response.blob();
                const hash = await hashFileContent(blob);
                if (hash) {
                  existingHashCacheRef.current.set(nextPath, hash);
                }
              }
            } catch {
              // 上传成功即可，不因为哈希缓存失败阻断流程。
            }
          }
        } catch (error) {
          showApiError(error, '图片上传失败');
        }
      }

      if (uploadedPaths.length) {
        emit([...items, ...uploadedPaths]);
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="ops-media-gallery">
      <div className="ops-media-gallery__grid">
        {items.map((item, index) => (
          <div className="ops-media-gallery__item" key={`${item}-${index}`}>
            <Image
              src={getAssetPreviewUrl(item)}
              alt={`图片 ${index + 1}`}
              rootClassName="ops-media-image"
              preview={{
                visible: previewIndex === index,
                onVisibleChange: (visible) => setPreviewIndex(visible ? index : null),
                mask: null,
              }}
            />
            <div className="ops-media-gallery__actions">
              <Button
                size="small"
                type="text"
                icon={<EyeOutlined />}
                aria-label={`预览图片 ${index + 1}`}
                onClick={(event) => {
                  event.stopPropagation();
                  setPreviewIndex(index);
                }}
              />
              <Button
                size="small"
                type="text"
                danger
                icon={<DeleteOutlined />}
                aria-label={`删除图片 ${index + 1}`}
                onClick={(event) => {
                  event.stopPropagation();
                  existingHashCacheRef.current.delete(item);
                  emit(items.filter((_, currentIndex) => currentIndex !== index));
                }}
              />
            </div>
          </div>
        ))}
        {items.length < maxCount ? (
          <>
            <input
              className="ops-media-gallery__input"
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              aria-hidden="true"
              tabIndex={-1}
              onChange={(event) => void handleFileSelection(event)}
            />
            <button
              type="button"
              className="ops-media-gallery__empty"
              aria-label={placeholder ? `上传${placeholder}` : '上传图片'}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <PictureOutlined />
              <span>{uploading ? '上传中...' : '上传图片'}</span>
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default MediaGalleryInput;
