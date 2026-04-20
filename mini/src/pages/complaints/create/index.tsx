import { useState } from 'react';
import { Image, Text, Textarea, View } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Empty } from '@/components/Empty';
import { Input } from '@/components/Input';
import { Tag } from '@/components/Tag';
import { createComplaint } from '@/services/complaints';
import { uploadFile } from '@/services/uploads';
import { useAuthStore } from '@/store/auth';
import { openAuthLoginPage } from '@/utils/authRedirect';
import { showErrorToast } from '@/utils/error';

const CATEGORY_OPTIONS = [
  { value: 'quality', label: '施工质量' },
  { value: 'delay', label: '工期延期' },
  { value: 'price', label: '价格争议' },
  { value: 'attitude', label: '服务态度' },
  { value: 'safety', label: '安全风险' },
  { value: 'other', label: '其他' },
] as const;

const chipStyle = (active: boolean) => ({
  borderRadius: '999px',
  padding: '10px 14px',
  border: active ? '1px solid #2563eb' : '1px solid #E5E7EB',
  background: active ? '#EFF6FF' : '#FFFFFF',
});

const ComplaintCreatePage: React.FC = () => {
  const auth = useAuthStore();
  const [projectId, setProjectId] = useState('');
  const [category, setCategory] = useState<(typeof CATEGORY_OPTIONS)[number]['value']>('quality');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  useLoad((options) => {
    if (options.projectId) {
      setProjectId(String(options.projectId));
    }
  });

  const handleUploadEvidence = async () => {
    if (uploading) return;

    try {
      const remain = Math.max(0, 6 - evidenceUrls.length);
      if (remain <= 0) {
        Taro.showToast({ title: '最多上传 6 张证据图', icon: 'none' });
        return;
      }

      const result = await Taro.chooseImage({
        count: remain,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
      });
      if (!result.tempFilePaths?.length) return;

      setUploading(true);
      const uploaded = await Promise.all(result.tempFilePaths.map((filePath) => uploadFile(filePath)));
      setEvidenceUrls((prev) => [
        ...prev,
        ...uploaded.map((item) => item.path || item.url),
      ].slice(0, 6));
    } catch (error) {
      showErrorToast(error, '证据上传失败');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (submitting || uploading) return;

    setSubmitting(true);
    try {
      await createComplaint({
        projectId: Number(projectId || 0),
        category,
        title: title.trim(),
        description: description.trim(),
        evidenceUrls,
      });
      Taro.showToast({ title: '投诉已提交', icon: 'success' });
      setTimeout(() => {
        Taro.redirectTo({ url: '/pages/complaints/list/index' });
      }, 500);
    } catch (error) {
      showErrorToast(error, '投诉提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (!auth.token) {
    return (
      <View className="page bg-gray-50 min-h-screen p-md flex items-center justify-center">
        <Empty
          description="登录后发起投诉"
          action={{ text: '去登录', onClick: () => void openAuthLoginPage('/pages/complaints/create/index') }}
        />
      </View>
    );
  }

  return (
    <View className="page bg-gray-50 min-h-screen p-md pb-xl">
      <Card className="mb-md">
        <View className="flex items-start justify-between gap-sm mb-sm">
          <View>
            <Text className="font-bold text-base">把争议沉淀成可处理记录</Text>
            <View className="text-sm text-gray-500 mt-xs">先把项目、问题类别、证据和诉求说明清楚，平台才有介入依据。</View>
          </View>
          <Tag variant="brand">投诉中心</Tag>
        </View>
      </Card>

      <Card title="投诉信息" className="mb-md">
        <Input label="项目 ID" type="number" value={projectId} onChange={(value) => setProjectId(value.replace(/\D/g, '').slice(0, 12))} placeholder="例如：99140，可留空" />
        <View className="mb-md">
          <Text className="block text-sm text-gray-500 mb-sm">投诉类别</Text>
          <View className="flex flex-wrap gap-sm">
            {CATEGORY_OPTIONS.map((item) => {
              const active = item.value === category;
              return (
                <View key={item.value} onClick={() => setCategory(item.value)} style={chipStyle(active)}>
                  <Text className={active ? 'text-brand text-sm' : 'text-sm text-gray-600'}>{item.label}</Text>
                </View>
              );
            })}
          </View>
        </View>
        <Input label="投诉标题" value={title} onChange={setTitle} placeholder="例如：泥木阶段质量问题，需要平台介入" />
        <View className="mb-sm">
          <Text className="block text-sm text-gray-500 mb-xs">详细说明</Text>
          <Textarea
            value={description}
            onInput={(event) => setDescription(event.detail.value.slice(0, 600))}
            placeholder="描述问题经过、已沟通内容、当前诉求和希望平台怎么处理。"
            maxlength={600}
            style={{ minHeight: '200px', width: '100%', padding: '12px', background: '#F8FAFC', borderRadius: '12px', fontSize: '14px', lineHeight: '1.6', color: '#111827', boxSizing: 'border-box' }}
          />
          <View className="text-xs text-gray-400 mt-xs">{description.length}/600</View>
        </View>
      </Card>

      <Card title="证据材料" className="mb-md">
        <View className="text-sm text-gray-500 mb-sm">可上传现场照片、沟通截图等，最多 6 张。</View>
        <Button size="small" variant="outline" loading={uploading} onClick={() => void handleUploadEvidence()}>
          {uploading ? '上传中...' : '上传证据'}
        </Button>
        {evidenceUrls.length > 0 ? (
          <View className="mt-md flex flex-col gap-sm">
            {evidenceUrls.map((item, index) => (
              <View key={`${item}-${index}`} className="flex items-center justify-between gap-sm border border-gray-100 rounded p-sm">
                <View className="flex items-center gap-sm min-w-0 flex-1">
                  <Image src={item} mode="aspectFill" style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#F3F4F6' }} />
                  <Text className="text-sm text-gray-600 line-clamp-1">证据 {index + 1}</Text>
                </View>
                <Text className="text-sm text-red-500" onClick={() => setEvidenceUrls((prev) => prev.filter((_, currentIndex) => currentIndex !== index))}>删除</Text>
              </View>
            ))}
          </View>
        ) : null}
      </Card>

      <Button block variant="primary" loading={submitting} disabled={submitting || uploading} onClick={() => void handleSubmit()}>
        提交投诉
      </Button>
    </View>
  );
};

export default ComplaintCreatePage;
