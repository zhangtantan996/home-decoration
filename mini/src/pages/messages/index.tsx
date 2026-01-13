import { Text, View } from '@tarojs/components';
import SectionCard from '@/components/SectionCard';
import { EmptyState } from '@/components/EmptyState';

export default function Messages() {
  return (
    <View className="page">
      <View className="page__title">消息中心</View>
      <SectionCard title="系统通知">
        <EmptyState title="暂时没有新消息" description="接入后展示 IM 未读、订单、验收提醒" />
      </SectionCard>
      <SectionCard title="快捷操作">
        <Text className="text-dim">后续可放置“联系设计师”“查看订单”等入口</Text>
      </SectionCard>
    </View>
  );
}
