import { Text, View } from '@tarojs/components';
import SectionCard from '@/components/SectionCard';
import { EmptyState } from '@/components/EmptyState';

export default function Home() {
  return (
    <View className="page">
      <View className="page__title">精选推荐</View>
      <SectionCard title="今日灵感">
        <EmptyState title="敬请期待" description="接入后展示精选案例与风格卡片" />
      </SectionCard>
      <SectionCard title="我的项目">
        <Text className="text-dim">登录后可查看项目进度与最近更新</Text>
      </SectionCard>
    </View>
  );
}
