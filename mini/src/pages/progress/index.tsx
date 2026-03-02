import Taro from '@tarojs/taro';
import { View } from '@tarojs/components';
import React, { useEffect, useState } from 'react';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Empty } from '@/components/Empty';
import { ListItem } from '@/components/ListItem';
import { Skeleton } from '@/components/Skeleton';
import { Tag } from '@/components/Tag';
import { getProjectPhaseStatus, getProjectStatus } from '@/constants/status';
import { getProjectPhases, listProjects, type ProjectItem, type ProjectPhase } from '@/services/projects';
import { useAuthStore } from '@/store/auth';
import { showErrorToast } from '@/utils/error';

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
      setLoading(true);
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
        showErrorToast(err, '加载失败');
      } finally {
        setLoading(false);
      }
    };

    fetchProject();
  }, [auth.token]);

  const projectStatus = getProjectStatus(project?.status);

  return (
    <View className="page">
      <View className="m-md">
        <View className="text-primary font-bold" style={{ fontSize: '40rpx', marginBottom: '24rpx' }}>
          项目进度
        </View>

        <Card
          title={project ? `当前项目: ${project.name}` : '当前项目'}
          extra={project ? <Tag variant={projectStatus.variant}>{projectStatus.label}</Tag> : undefined}
        >
          {!auth.token ? (
            <Empty
              description="登录后查看项目进度"
              action={{ text: '去登录', onClick: () => Taro.navigateTo({ url: '/pages/profile/index' }) }}
            />
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
              const status = getProjectPhaseStatus(phase.status);
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

        {project ? (
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
        ) : null}

        <Card title="待办事项">
          {!auth.token ? (
            <Empty description="登录后查看待办事项" />
          ) : phases.length > 0 ? (
            phases
              .flatMap((phase) =>
                (phase.tasks || [])
                  .filter((task) => !task.isCompleted)
                  .slice(0, 3)
                  .map((task) => ({
                    id: `${phase.id}-${task.id}`,
                    title: task.name,
                    phaseName: phase.name,
                  })),
              )
              .slice(0, 3)
              .map((task) => (
                <ListItem key={task.id} title={task.title} description={`所属阶段：${task.phaseName}`} />
              ))
          ) : (
            <Empty description="当前暂无待办事项" />
          )}
        </Card>
      </View>
    </View>
  );
}
