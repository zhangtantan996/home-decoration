import React, { useEffect, useMemo, useState } from 'react';
import { Text, View } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Empty } from '@/components/Empty';
import { Input } from '@/components/Input';
import { Skeleton } from '@/components/Skeleton';
import { Tag } from '@/components/Tag';
import { submitProjectDispute, getProjectDetail, type ProjectDetail } from '@/services/projects';
import { uploadFile } from '@/services/uploads';
import { useAuthStore } from '@/store/auth';
import { showErrorToast } from '@/utils/error';
import { formatServerDateTime } from '@/utils/serverTime';

const ProjectDisputePage: React.FC = () => {
  const auth = useAuthStore();
  const [projectId, setProjectId] = useState(0);
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [reason, setReason] = useState('');
  const [evidence, setEvidence] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  useLoad((options) => {
    if (options.id) {
      setProjectId(Number(options.id));
    }
  });

  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      return;
    }
    if (!auth.token) {
      setProject(null);
      setLoading(false);
      return;
    }

    const fetchDetail = async () => {
      setLoading(true);
      try {
        const detail = await getProjectDetail(projectId);
        setProject(detail);
        setEvidence(detail.riskSummary?.disputeEvidence || []);
      } catch (error) {
        showErrorToast(error, '加载失败');
      } finally {
        setLoading(false);
      }
    };

    void fetchDetail();
  }, [auth.token, projectId]);

  const disputed = !!project?.riskSummary?.disputedAt;
  const canSubmit = useMemo(() => reason.trim().length >= 6 && !disputed, [disputed, reason]);

  const handleChooseEvidence = async () => {
    if (uploading || disputed) return;
    try {
      const res = await Taro.chooseImage({ count: 6, sizeType: ['compressed'], sourceType: ['album', 'camera'] });
      if (!res.tempFilePaths?.length) return;
      setUploading(true);
      const uploaded = await Promise.all(res.tempFilePaths.map((filePath) => uploadFile(filePath)));
      setEvidence((prev) => [...prev, ...uploaded.map((item) => item.url)].slice(0, 6));
      Taro.showToast({ title: '证据已上传', icon: 'success' });
    } catch (error) {
      showErrorToast(error, '上传失败');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!projectId || !canSubmit || submitting) return;
    setSubmitting(true);
    try {
      await submitProjectDispute(projectId, { reason: reason.trim(), evidence });
      Taro.showToast({ title: '已提交争议', icon: 'success' });
      setTimeout(() => {
        Taro.redirectTo({ url: `/pages/projects/detail/index?id=${projectId}` });
      }, 800);
    } catch (error) {
      showErrorToast(error, '提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (!auth.token) {
    return (
      <View className="page bg-gray-50 min-h-screen p-md">
        <Empty description="登录后可发起争议" action={{ text: '去登录', onClick: () => Taro.switchTab({ url: '/pages/profile/index' }) }} />
      </View>
    );
  }

  if (loading) {
    return (
      <View className="page bg-gray-50 min-h-screen p-md">
        <Skeleton height={180} className="mb-md" />
        <Skeleton height={260} />
      </View>
    );
  }

  if (!project) {
    return <View className="page bg-gray-50 min-h-screen p-md"><Empty description="未找到项目信息" /></View>;
  }

  return (
    <View className="page bg-gray-50 min-h-screen p-md pb-xl">
      <Card title={project.name || '项目争议'} className="mb-md">
        <View className="flex flex-col gap-sm">
          <View className="flex justify-between items-center">
            <Text className="text-gray-500 text-sm">处理状态</Text>
            <Tag variant={disputed ? 'error' : 'brand'}>{disputed ? '平台处理中' : '可提交'}</Tag>
          </View>
          <View className="text-sm text-gray-600">{project.address || '地址待补充'}</View>
          {disputed ? (
            <View className="text-sm text-red-500">
              争议已于 {formatServerDateTime(project.riskSummary?.disputedAt)} 提交，原因：{project.riskSummary?.disputeReason || '未填写'}
            </View>
          ) : (
            <View className="text-sm text-gray-600">提交后平台会自动生成审计单，并冻结相关托管金额。</View>
          )}
        </View>
      </Card>

      <Card title="争议内容" className="mb-md">
        <Input
          label="争议原因 *"
          value={reason}
          onChange={setReason}
          placeholder="请说明问题经过、涉及节点和你的诉求"
        />
        <View className="text-xs text-gray-400 mt-sm">建议至少填写 6 个字，便于平台快速判断。</View>
      </Card>

      <Card title="证据材料">
        <View className="text-sm text-gray-600 mb-sm">可上传现场照片、对话截图等，最多 6 张。</View>
        <Button variant="outline" disabled={uploading || disputed || evidence.length >= 6} loading={uploading} onClick={handleChooseEvidence}>
          上传证据
        </Button>
        <View className="mt-md flex flex-col gap-sm">
          {evidence.length === 0 ? (
            <Text className="text-sm text-gray-400">暂无已上传证据</Text>
          ) : (
            evidence.map((item, index) => (
              <View key={`${item}-${index}`} className="text-sm text-gray-600" style={{ wordBreak: 'break-all' }}>
                证据 {index + 1}：{item}
              </View>
            ))
          )}
        </View>
        <View className="mt-md">
          <Button block disabled={!canSubmit || submitting} loading={submitting} onClick={handleSubmit}>
            提交争议
          </Button>
        </View>
      </Card>
    </View>
  );
};

export default ProjectDisputePage;
