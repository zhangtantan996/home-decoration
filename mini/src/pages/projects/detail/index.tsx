import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';
import { Skeleton } from '@/components/Skeleton';
import { getProjectDetail, getProjectPhases, type ProjectDetail as ProjectDetailType, type ProjectPhase } from '@/services/projects';
import { useAuthStore } from '@/store/auth';

const ProjectDetailPage: React.FC = () => {
  const auth = useAuthStore();
  const [detail, setDetail] = useState<ProjectDetailType | null>(null);
  const [phases, setPhases] = useState<ProjectPhase[]>([]);
  const [loading, setLoading] = useState(true);
  const [id, setId] = useState<number>(0);

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
      setLoading(false);
      return;
    }
    const fetch = async () => {
      setLoading(true);
      try {
        const [detailRes, phasesRes] = await Promise.all([
          getProjectDetail(id),
          getProjectPhases(id)
        ]);
        setDetail(detailRes);
        if (phasesRes && phasesRes.phases) {
          setPhases(phasesRes.phases);
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

        <View className="px-md">
          <View className="text-base font-bold mb-md pl-xs border-l-4 border-brand">施工进度</View>
          
          <View className="pl-md relative">
            {phases.map((phase, index) => {
              const isActive = phase.status === 'in_progress';
              const isCompleted = phase.status === 'completed';
              
              return (
                <View key={phase.id} className="mb-lg relative z-10">
                  {/* Vertical Line */}
                  {index < phases.length - 1 && (
                    <View 
                      className={`absolute left-0 top-md bottom-0 w-px -ml-px h-full bg-gray-200 z-0`}
                      style={{ top: '20rpx', height: 'calc(100% + 40rpx)' }}
                    />
                  )}
                  
                  <View className="flex items-start">
                    {/* Dot */}
                    <View 
                      className={`w-3 h-3 rounded-full border-2 bg-white flex-shrink-0 z-10 ${
                        isCompleted ? 'border-success bg-success' : 
                        isActive ? 'border-brand bg-brand' : 'border-gray-300'
                      }`}
                      style={{ width: '24rpx', height: '24rpx', transform: 'translateX(-50%)' }}
                    />
                    
                    <View className="ml-md flex-1 bg-white p-md rounded shadow-sm">
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
      </ScrollView>
    </View>
  );
};

export default ProjectDetailPage;
