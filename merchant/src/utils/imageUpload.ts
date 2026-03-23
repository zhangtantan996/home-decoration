import { Upload, message } from 'antd';

export interface ImageUploadSpec {
    maxSizeMB: number;
    allowedTypes: string[];
    allowedLabel: string;
    minShortEdge?: number;
}

export const IMAGE_UPLOAD_SPECS = {
    avatar: {
        maxSizeMB: 2,
        allowedTypes: ['image/jpeg', 'image/png'],
        allowedLabel: 'JPG/PNG',
        minShortEdge: 300,
    },
    onboardingDoc: {
        maxSizeMB: 5,
        allowedTypes: ['image/jpeg', 'image/png'],
        allowedLabel: 'JPG/PNG',
        minShortEdge: 600,
    },
    showcase: {
        maxSizeMB: 5,
        allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
        allowedLabel: 'JPG/PNG/WEBP',
        minShortEdge: 600,
    },
    product: {
        maxSizeMB: 5,
        allowedTypes: ['image/jpeg', 'image/png'],
        allowedLabel: 'JPG/PNG',
        minShortEdge: 600,
    },
} satisfies Record<string, ImageUploadSpec>;

const readImageDimensions = (file: File): Promise<{ width: number; height: number }> =>
    new Promise((resolve, reject) => {
        const objectUrl = URL.createObjectURL(file);
        const image = new Image();
        image.onload = () => {
            URL.revokeObjectURL(objectUrl);
            resolve({
                width: image.naturalWidth,
                height: image.naturalHeight,
            });
        };
        image.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error('读取图片尺寸失败'));
        };
        image.src = objectUrl;
    });

export const validateImageUploadBeforeSend = async (file: File, spec: ImageUploadSpec) => {
    const isAllowedType = spec.allowedTypes.includes(file.type);
    if (!isAllowedType) {
        message.error(`只支持上传 ${spec.allowedLabel} 格式的图片`);
        return Upload.LIST_IGNORE;
    }

    if (file.size / 1024 / 1024 >= spec.maxSizeMB) {
        message.error(`图片大小不能超过 ${spec.maxSizeMB}MB`);
        return Upload.LIST_IGNORE;
    }

    if (spec.minShortEdge) {
        try {
            const dimensions = await readImageDimensions(file);
            if (Math.min(dimensions.width, dimensions.height) < spec.minShortEdge) {
                message.error(`图片分辨率过低，最短边至少 ${spec.minShortEdge}px`);
                return Upload.LIST_IGNORE;
            }
        } catch {
            message.error('图片解析失败，请重新选择文件');
            return Upload.LIST_IGNORE;
        }
    }

    return true;
};
