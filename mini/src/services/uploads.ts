import Taro from '@tarojs/taro';

const API_BASE = process.env.TARO_APP_API_BASE || 'http://localhost:8080/api/v1';

export async function uploadFile(filePath: string, formData?: Record<string, string>) {
  const res = await Taro.uploadFile({
    url: `${API_BASE}/upload`,
    filePath,
    name: 'file',
    formData
  });
  if (res.statusCode !== 200) {
    throw new Error('上传失败');
  }
  const payload = JSON.parse(res.data);
  if (payload?.code !== 0) {
    throw new Error(payload?.message || '上传失败');
  }
  return payload.data as { url: string; filename: string; size: number; type: string };
}
