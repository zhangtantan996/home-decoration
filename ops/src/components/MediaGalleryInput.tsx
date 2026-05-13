import { DeleteOutlined, EyeOutlined, PictureOutlined } from '@ant-design/icons';
import { Button, Image, Upload, message } from 'antd';
import type { UploadFile } from 'antd';
import type { UploadRequestOption } from 'rc-upload/lib/interface';
import { useState } from 'react';
import { showApiError, uploadImage } from '../services/api';

interface MediaGalleryInputProps {
  value?: string;
  onChange?: (value?: string) => void;
  placeholder?: string;
  maxCount?: number;
  maxSizeMB?: number;
}

const splitText = (value?: string) => String(value || '').split(/[,，\n]/).map((item) => item.trim()).filter(Boolean);

const MediaGalleryInput = ({ value, onChange, placeholder, maxCount = 9, maxSizeMB = 5 }: MediaGalleryInputProps) => {
  const items = splitText(value);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  const emit = (nextItems: string[]) => {
    onChange?.(nextItems.filter(Boolean).join('，'));
  };

  const handleUpload = async (options: UploadRequestOption) => {
    try {
      const result = await uploadImage(options.file as File);
      const nextPath = result.path || result.url || '';
      if (nextPath) emit([...items, nextPath]);
      options.onSuccess?.(result);
    } catch (error) {
      showApiError(error, '图片上传失败');
      options.onError?.(error as Error);
    }
  };

  const beforeUpload = (file: UploadFile) => {
    if (items.length >= maxCount) {
      message.error(`最多上传 ${maxCount} 张图片`);
      return Upload.LIST_IGNORE;
    }
    const rawFile = file as unknown as File;
    const isImage = rawFile.type?.startsWith('image/');
    if (!isImage) {
      message.error('只能上传图片文件');
      return Upload.LIST_IGNORE;
    }
    const withinSize = rawFile.size / 1024 / 1024 <= maxSizeMB;
    if (!withinSize) {
      message.error(`图片大小不能超过 ${maxSizeMB}MB`);
      return Upload.LIST_IGNORE;
    }
    return true;
  };

  return (
    <div className="ops-media-gallery">
      <div className="ops-media-gallery__grid">
        {items.map((item, index) => (
          <div className="ops-media-gallery__item" key={`${item}-${index}`}>
            <Image
              src={item}
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
                  emit(items.filter((_, currentIndex) => currentIndex !== index));
                }}
              />
            </div>
          </div>
        ))}
        {items.length < maxCount ? (
          <Upload showUploadList={false} customRequest={(options) => void handleUpload(options)} beforeUpload={beforeUpload} accept="image/*">
            <button type="button" className="ops-media-gallery__empty" aria-label={placeholder ? `上传${placeholder}` : '上传图片'}>
              <PictureOutlined />
              <span>上传图片</span>
            </button>
          </Upload>
        ) : null}
      </div>
    </div>
  );
};

export default MediaGalleryInput;
