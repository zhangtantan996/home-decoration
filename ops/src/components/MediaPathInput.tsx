import { useState } from 'react';
import { Button, Image, Upload, message } from 'antd';
import type { UploadFile } from 'antd';
import type { UploadRequestOption } from 'rc-upload/lib/interface';
import { DeleteOutlined, EyeOutlined, PictureOutlined } from '@ant-design/icons';
import { showApiError, uploadImage } from '../services/api';
import { getAssetPreviewUrl, getAssetStoredPath } from '../utils/asset';

interface MediaPathInputProps {
  value?: string;
  onChange?: (value?: string) => void;
  placeholder?: string;
  maxSizeMB?: number;
}

const MediaPathInput = ({ value, onChange, placeholder, maxSizeMB = 5 }: MediaPathInputProps) => {
  const [previewOpen, setPreviewOpen] = useState(false);
  const uploadLabel = /头像/.test(placeholder || '') ? '上传头像' : '上传图片';
  const previewUrl = getAssetPreviewUrl(value);

  const beforeUpload = (file: UploadFile) => {
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

  const handleUpload = async (options: UploadRequestOption) => {
    try {
      const result = await uploadImage(options.file as File);
      const nextPath = getAssetStoredPath(result);
      onChange?.(nextPath);
      options.onSuccess?.(result);
    } catch (error) {
      showApiError(error, '图片上传失败');
      options.onError?.(error as Error);
    }
  };

  return (
    <div className="ops-media-input">
      <div className="ops-media-input__content">
        {value ? (
          <div className="ops-media-input__preview ops-media-input__preview--has-image">
            <Image
              src={previewUrl}
              alt={placeholder || '图片预览'}
              rootClassName="ops-media-image"
              preview={{ visible: previewOpen, onVisibleChange: (visible) => setPreviewOpen(visible), mask: null }}
            />
            <div className="ops-media-input__actions">
              <Button size="small" type="text" icon={<EyeOutlined />} aria-label="预览图片" onClick={() => setPreviewOpen(true)} />
              <Button size="small" type="text" danger icon={<DeleteOutlined />} aria-label="删除图片" onClick={() => onChange?.(undefined)} />
            </div>
          </div>
        ) : null}
        <Upload showUploadList={false} customRequest={(options) => void handleUpload(options)} beforeUpload={beforeUpload} accept="image/*">
          <Button type="text" className="ops-media-upload-tile ops-media-upload-tile--button" aria-label={placeholder ? `上传${placeholder}` : '上传图片'}>
            <PictureOutlined />
            <span>{uploadLabel}</span>
          </Button>
        </Upload>
      </div>
    </div>
  );
};

export default MediaPathInput;
