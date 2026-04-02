import React, { useEffect, useMemo, useState } from 'react';
import { Text, View } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Empty } from '@/components/Empty';
import { Input } from '@/components/Input';
import { Skeleton } from '@/components/Skeleton';
import { Tag } from '@/components/Tag';
import { getProjectDetail, pauseProject, type ProjectDetail } from '@/services/projects';
import { useAuthStore } from '@/store/auth';
import { showErrorToast } from '@/utils/error';
import { formatServerDateTime } from '@/utils/serverTime';

const ProjectPausePage: React.FC = () => {
  const auth = useAuthStore();
  const [projectId, setProjectId] = useState(0);
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

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
      } catch (error) {
        showErrorToast(error, '加载失败');
      } finally {
        setLoading(false);
      }
    };

    void fetchDetail();
  }, [auth.token, projectId]);

  const paused = !!project?.riskSummary?.pausedAt;
  const disputed = !!project?.riskSummary?.disputedAt;
  const canSubmit = useMemo(() => reason.trim().length >= 4 && !paused && !disputed, [disputed, paused, reason]);

  const handleSubmit = async () => {
    if (!projectId || !canSubmit || submitting) {
      return;
    }
    setSubmitting(true);
    try {
      await pauseProject(projectId, { reason: reason.trim(), initiator: 'user' });
      Taro.showToast({ title: '项目已暂停', icon: 'success' });
      setTimeout(() => {
        Taro.redirectTo({ url: `/pages/projects/detail/index?id=${projectId}` });
      }, 800);
    } catch (error) {
      showErrorToast(error, '暂停失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (!auth.token) {
    return (
      <View className="page bg-gray-50 min-h-screen p-md">
        <Empty description="登录后可暂停项目" action={{ text: '去登录', onClick: () => Taro.switchTab({ url: '/pages/profile/index' }) }} />
      </View>
    );
  }

  if (loading) {
    return (
      <View className="page bg-gray-50 min-h-screen p-md">
        <Skeleton height={180} className="mb-md" />
        <Skeleton height={220} />
      </View>
    );
  }

  if (!project) {
    return <View className="page bg-gray-50 min-h-screen p-md"><Empty description="未找到项目信息" /></View>;
  }

  return (
    <View className="page bg-gray-50 min-h-screen p-md pb-xl">
      <Card title={project.name || '项目暂停'} className="mb-md">
        <View className="flex flex-col gap-sm">
          <View className="flex justify-between items-center">
            <Text className="text-gray-500 text-sm">当前状态</Text>
            <Tag variant={paused ? 'warning' : disputed ? 'error' : 'brand'}>
              {paused ? '已暂停' : disputed ? '争议处理中' : '施工中'}
            </Tag>
          </View>
          <View className="text-sm text-gray-600">{project.address || '地址待补充'}</View>
          {paused ? (
            <View className="text-sm text-gray-600">
              已于 {formatServerDateTime(project.riskSummary?.pausedAt)} 暂停，原因：{project.riskSummary?.pauseReason || '未填写'}
            </View>
          ) : null}
          {!paused && disputed ? (
            <View className="text-sm text-red-500">
              当前项目已进入争议流程，请等待平台仲裁结果后再决定是否暂停或恢复。
            </View>
          ) : null}
        </View>
      </Card>

      <Card title="暂停说明" className="mb-md">
        <View className="text-sm text-gray-600" style={{ lineHeight: 1.8 }}>
          暂停后将冻结项目推进，期间不能继续节点提交、验收与完工流转。恢复后可继续当前阶段。
        </View>
      </Card>

      <Card title="暂停原因">
        <Input
          label="原因说明 *"
          value={reason}
          onChange={setReason}
          placeholder="例如：现场临时停工、方案需调整、业主出差等"
        />
        <View className="text-xs text-gray-400 mt-sm">至少填写 4 个字，平台会将原因同步给服务商。</View>
        <View className="mt-md">
          <Button disabled={!canSubmit || submitting} loading={submitting} block onClick={handleSubmit}>
            提交暂停
          </Button>
        </View>
      </Card>
    </View>
  );
};

export default ProjectPausePage;
