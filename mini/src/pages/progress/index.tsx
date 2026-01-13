import { Text, View } from '@tarojs/components';
import SectionCard from '@/components/SectionCard';

const timeline = [
  { title: '选定服务商', status: '完成', date: '待接入' },
  { title: '设计沟通', status: '待开始', date: '待接入' },
  { title: '施工阶段', status: '待开始', date: '待接入' }
];

export default function Progress() {
  return (
    <View className="page">
      <View className="page__title">项目进度</View>
      <SectionCard title="最近项目">
        {timeline.map((item) => (
          <View key={item.title} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <View>
              <Text style={{ display: 'block', fontSize: '26px', color: '#1f2430', fontWeight: 600 }}>{item.title}</Text>
              <Text className="text-dim">{item.status}</Text>
            </View>
            <Text className="text-dim">{item.date}</Text>
          </View>
        ))}
      </SectionCard>
      <SectionCard title="下一步提示">
        <Text className="text-dim">登录后展示最近待办、预约与验收节点</Text>
      </SectionCard>
    </View>
  );
}
