import Taro from '@tarojs/taro';
import { View } from '@tarojs/components';
import React, { useEffect, useState } from 'react';
import { Card } from '@/components/Card';
import { ListItem } from '@/components/ListItem';
import { Tag } from '@/components/Tag';
import { Skeleton } from '@/components/Skeleton';
import { useAuthStore } from '@/store/auth';
import { listProjects, getProjectPhases, type ProjectItem, type ProjectPhase } from '@/services/projects';

export default function Progress() {
  const auth = useAuthStore();
  const [project, setProject] = useState<ProjectItem | null>(null);
  const [phases, setPhases] = useState<ProjectPhase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.token) {
      setProject(null);
      setPhases([]);
      setLoading(false);
      return;
    }

    const fetchProject = async () => {
      try {
        const data = await listProjects(1, 1);
        const current = data.list?.[0];
        if (!current) {
          setProject(null);
          setPhases([]);
          return;
        }
        setProject(current);
        const phaseData = await getProjectPhases(current.id);
        setPhases(phaseData.phases || []);
      } catch (err) {
        Taro.showToast({ title: err instanceof Error ? err.message : '加载失败', icon: 'none' });
      } finally {
        setLoading(false);
      }
    };

    fetchProject();
  }, [auth.token]);

  const renderPhaseStatus = (phase: ProjectPhase) => {
    if (phase.status === 'completed') return { label: '完成', variant: 'success' as const };
    if (phase.status === 'in_progress') return { label: '进行中', variant: 'brand' as const };
    return { label: '待开始', variant: 'default' as const };
  };

  return (
    <View className="page">
      <View className="m-md">
        <View className="text-primary font-bold" style={{ fontSize: '40rpx', marginBottom: '24rpx' }}>
          项目进度
        </View>

        <Card title={project ? `当前项目: ${project.name}` : '当前项目'}>
          {!auth.token ? (
            <ListItem title="您还未登录" description="登录后查看项目进度" />
          ) : loading ? (
            <View className="p-sm">
              <View className="mb-sm"><Skeleton width="60%" /></View>
              <View className="mb-sm"><Skeleton width="80%" /></View>
              <View><Skeleton width="40%" /></View>
            </View>
          ) : phases.length === 0 ? (
            <ListItem title="暂无进度" description="项目进度将在开工后显示" />
          ) : (
            phases.map((phase) => {
              const status = renderPhaseStatus(phase);
              return (
                <ListItem
                  key={phase.id}
                  title={phase.name}
                  description={phase.startDate || '待更新'}
                  extra={<Tag variant={status.variant}>{status.label}</Tag>}
                />
              );
            })
          )}
        </Card>

        {project && (
          <View className="mt-md">
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              onClick={() => Taro.navigateTo({ url: `/pages/projects/detail/index?id=${project.id}` })}
            >
              查看项目详情
            </Button>
          </View>
        )}

        <Card title="待办事项">
          <View className="p-sm">
            <View className="mb-sm"><Skeleton width="60%" /></View>
            <View className="mb-sm"><Skeleton width="80%" /></View>
            <View><Skeleton width="40%" /></View>
          </View>
        </Card>
      </View>
    </View>
  );
}
