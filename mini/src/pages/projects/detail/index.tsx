import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';
import { Tabs, Button, Dialog, Toast } from '@nutui/nutui-react-taro';
import { Success } from '@nutui/icons-react-taro';
import { Skeleton } from '@/components/Skeleton';
import { getProjectDetail, getProjectPhases, getProjectMilestones, acceptMilestone, type ProjectDetail as ProjectDetailType, type ProjectPhase, type Milestone } from '@/services/projects';
import { useAuthStore } from '@/store/auth';

const ProjectDetailPage: React.FC = () => {
  const auth = useAuthStore();
  const [detail, setDetail] = useState<ProjectDetailType | null>(null);
  const [phases, setPhases] = useState<ProjectPhase[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [id, setId] = useState<number>(0);
  const [activeTab, setActiveTab] = useState('0');

  useLoad((options) => {
    if (options.id) {
      setId(Number(options.id));
    }
  });

  useEffect(() => {
    if (!id) return;
    if (!auth.token) {
      setDetail(null);
      setPhases([]);
      setMilestones([]);
      setLoading(false);
      return;
    }
    const fetch = async () => {
      setLoading(true);
      try {
        const [detailRes, phasesRes, milestonesRes] = await Promise.all([
          getProjectDetail(id),
          getProjectPhases(id),
          getProjectMilestones(id)
        ]);
        setDetail(detailRes);
        if (phasesRes && phasesRes.phases) {
          setPhases(phasesRes.phases);
        }
        if (milestonesRes && milestonesRes.milestones) {
          setMilestones(milestonesRes.milestones);
        }
      } catch (error) {
        console.error(error);
        Taro.showToast({ title: '加载失败', icon: 'none' });
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [id, auth.token]);

  if (!auth.token) {
    return <View className="p-md text-center text-gray-500">登录后查看项目详情</View>;
  }

  if (loading) return (
    <View className="p-md bg-gray-50 min-h-screen">
      <Skeleton height={200} className="mb-md" />
      <Skeleton height={400} />
    </View>
  );

  if (!detail) return <View className="p-md text-center text-gray-500">未找到项目</View>;

  const getPhaseStatusText = (status: string) => {
    switch(status) {
      case 'completed': return '已完成';
      case 'in_progress': return '进行中';
      default: return '未开始';
    }
  };

  const getPhaseColorClass = (status: string) => {
    switch(status) {
      case 'completed': return 'text-success border-success';
      case 'in_progress': return 'text-brand border-brand';
      default: return 'text-gray-400 border-gray-300';
    }
  };

  const getMilestoneStatusText = (status: string) => {
    switch(status) {
      case 'completed': return '已验收';
      case 'rejected': return '已拒绝';
      default: return '待验收';
    }
  };

  const handleAcceptMilestone = async (milestoneId: number) => {
    Dialog.confirm({
      title: '确认验收',
      content: '确认该节点已完成并验收通过？',
      onConfirm: async () => {
        try {
          await acceptMilestone(id, milestoneId);
          Toast.show({ content: '验收成功', icon: 'success' });
          // 重新加载milestones
          const milestonesRes = await getProjectMilestones(id);
          if (milestonesRes && milestonesRes.milestones) {
            setMilestones(milestonesRes.milestones);
          }
        } catch (error) {
          Toast.show({ content: '验收失败', icon: 'fail' });
        }
      }
    });
  };

  return (
    <View className="page bg-gray-50 min-h-screen pb-md">
      <ScrollView scrollY className="h-full">
        <View className="bg-white p-md mb-md">
          <View className="text-xl font-bold mb-xs">{detail.name}</View>
          <View className="text-gray-500 text-sm mb-md">{detail.address}</View>

          <View className="flex justify-between border-t border-gray-100 pt-md">
             <View>
               <View className="text-xs text-gray-400">面积</View>
               <View className="font-medium">{detail.area || '-'} m²</View>
             </View>
             <View>
               <View className="text-xs text-gray-400">预算</View>
               <View className="font-medium">¥{detail.budget ? detail.budget.toLocaleString() : '-'}</View>
             </View>
             <View>
               <View className="text-xs text-gray-400">开工时间</View>
               <View className="font-medium">{detail.createdAt ? new Date(detail.createdAt).toLocaleDateString() : '-'}</View>
             </View>
          </View>
        </View>

        <View className="bg-white">
          <Tabs value={activeTab} onChange={(value) => setActiveTab(value)}>
            <Tabs.TabPane title="施工进度" value="0">
              <View className="px-md py-md">
                <View className="pl-md relative">
                  {phases.map((phase, index) => {
                    const isActive = phase.status === 'in_progress';
                    const isCompleted = phase.status === 'completed';

                    return (
                      <View key={phase.id} className="mb-lg relative z-10">
                        {index < phases.length - 1 && (
                          <View
                            className="absolute left-0 top-md bottom-0 w-px -ml-px h-full bg-gray-200 z-0"
                            style={{ top: '20rpx', height: 'calc(100% + 40rpx)' }}
                          />
                        )}

                        <View className="flex items-start">
                          <View
                            className={`w-3 h-3 rounded-full border-2 bg-white flex-shrink-0 z-10 ${
                              isCompleted ? 'border-success bg-success' :
                              isActive ? 'border-brand bg-brand' : 'border-gray-300'
                            }`}
                            style={{ width: '24rpx', height: '24rpx', transform: 'translateX(-50%)' }}
                          />

                          <View className="ml-md flex-1 bg-white p-md rounded shadow-sm border border-gray-100">
                            <View className="flex justify-between items-center mb-sm">
                              <Text className={`font-bold ${isActive ? 'text-brand' : ''}`}>{phase.name}</Text>
                              <Text className={`text-xs px-xs py-xxs rounded ${
                                isCompleted ? 'bg-green-50 text-success' :
                                isActive ? 'bg-yellow-50 text-brand' : 'bg-gray-100 text-gray-500'
                              }`}>
                                {getPhaseStatusText(phase.status)}
                              </Text>
                            </View>

                            {phase.tasks && phase.tasks.length > 0 && (
                              <View className="space-y-xs">
                                {phase.tasks.map(task => (
                                  <View key={task.id} className="flex items-center text-sm">
                                    <Text className={`mr-xs ${task.isCompleted ? 'text-success' : 'text-gray-300'}`}>
                                      {task.isCompleted ? '✓' : '○'}
                                    </Text>
                                    <Text className={task.isCompleted ? 'text-gray-500 line-through' : 'text-gray-700'}>
                                      {task.name}
                                    </Text>
                                  </View>
                                ))}
                              </View>
                            )}
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            </Tabs.TabPane>

            <Tabs.TabPane title="验收节点" value="1">
              <View className="px-md py-md">
                {milestones.length === 0 ? (
                  <View className="text-center text-gray-400 py-lg">暂无验收节点</View>
                ) : (
                  <View className="space-y-md">
                    {milestones.map((milestone) => {
                      const isCompleted = milestone.status === 'completed';
                      const isRejected = milestone.status === 'rejected';
                      const isPending = milestone.status === 'pending';

                      return (
                        <View key={milestone.id} className="bg-white p-md rounded shadow-sm border border-gray-100">
                          <View className="flex justify-between items-start mb-sm">
                            <View className="flex-1">
                              <View className="flex items-center mb-xs">
                                <Text className="text-xs text-gray-400 mr-xs">节点 {milestone.seq}</Text>
                                <Text className="font-bold">{milestone.name}</Text>
                              </View>
                              {milestone.description && (
                                <Text className="text-sm text-gray-500">{milestone.description}</Text>
                              )}
                            </View>
                            <Text className={`text-xs px-xs py-xxs rounded ml-xs ${
                              isCompleted ? 'bg-green-50 text-success' :
                              isRejected ? 'bg-red-50 text-danger' :
                              'bg-yellow-50 text-warning'
                            }`}>
                              {getMilestoneStatusText(milestone.status)}
                            </Text>
                          </View>

                          <View className="flex justify-between items-center pt-sm border-t border-gray-100">
                            <View className="flex items-center">
                              <Text className="text-sm text-gray-400 mr-xs">金额:</Text>
                              <Text className="text-base font-bold text-brand">¥{milestone.amount.toLocaleString()}</Text>
                            </View>

                            {isPending && (
                              <Button
                                type="primary"
                                size="small"
                                onClick={() => handleAcceptMilestone(milestone.id)}
                              >
                                <View className="flex items-center">
                                  <Success size={14} className="mr-xs" />
                                  <Text>确认验收</Text>
                                </View>
                              </Button>
                            )}

                            {isCompleted && milestone.acceptedAt && (
                              <Text className="text-xs text-gray-400">
                                验收时间: {new Date(milestone.acceptedAt).toLocaleDateString()}
                              </Text>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            </Tabs.TabPane>
          </Tabs>
        </View>
      </ScrollView>
    </View>
  );
};

export default ProjectDetailPage;
