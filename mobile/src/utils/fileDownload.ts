import { Platform, PermissionsAndroid } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';

/**
 * 请求 Android 存储权限
 */
export const requestStoragePermission = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;

    try {
        const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
            {
                title: '存储权限',
                message: '需要存储权限来保存文件到您的设备',
                buttonNeutral: '稍后询问',
                buttonNegative: '取消',
                buttonPositive: '确定',
            }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
        console.warn('Storage permission error:', err);
        return false;
    }
};

/**
 * 从 URL 中提取文件名
 */
export const getFileNameFromUrl = (url: string): string => {
    try {
        const urlParts = url.split('/');
        let fileName = urlParts[urlParts.length - 1] || 'download';
        // 移除查询参数
        if (fileName.includes('?')) {
            fileName = fileName.split('?')[0];
        }
        // 如果没有扩展名，添加默认扩展名
        if (!fileName.includes('.')) {
            fileName += '.jpg';
        }
        return fileName;
    } catch {
        return `download_${Date.now()}.jpg`;
    }
};

/**
 * 下载文件到设备
 * @param url 文件 URL
 * @param onProgress 进度回调 (0-100)
 * @returns 下载后的本地路径
 */
export const downloadFile = async (
    url: string,
    onProgress?: (progress: number) => void
): Promise<{ success: boolean; path?: string; error?: string }> => {
    try {
        // Android 需要请求权限
        if (Platform.OS === 'android') {
            const hasPermission = await requestStoragePermission();
            if (!hasPermission) {
                return { success: false, error: '未获得存储权限' };
            }
        }

        const fileName = getFileNameFromUrl(url);

        // 确定下载目录
        const downloadDir = Platform.OS === 'android'
            ? ReactNativeBlobUtil.fs.dirs.DownloadDir
            : ReactNativeBlobUtil.fs.dirs.DocumentDir;

        const filePath = `${downloadDir}/${fileName}`;

        // 开始下载
        const res = await ReactNativeBlobUtil
            .config({
                fileCache: true,
                path: filePath,
                addAndroidDownloads: {
                    useDownloadManager: true,
                    notification: true,
                    title: fileName,
                    description: '正在下载设计图纸...',
                    path: filePath,
                    mime: getMimeType(fileName),
                },
            })
            .fetch('GET', url)
            .progress((received, total) => {
                const numReceived = Number(received);
                const numTotal = Number(total);
                if (onProgress && numTotal > 0) {
                    const progress = Math.round((numReceived / numTotal) * 100);
                    onProgress(progress);
                }
            });

        return { success: true, path: res.path() };
    } catch (error: any) {
        console.error('Download error:', error);
        return { success: false, error: error.message || '下载失败' };
    }
};

/**
 * 根据文件名获取 MIME 类型
 */
const getMimeType = (fileName: string): string => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    const mimeTypes: Record<string, string> = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'pdf': 'application/pdf',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'dwg': 'application/acad',
        'dxf': 'application/dxf',
    };
    return mimeTypes[ext] || 'application/octet-stream';
};
