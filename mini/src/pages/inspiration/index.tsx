import { ScrollView, Text, View } from '@tarojs/components';
import SectionCard from '@/components/SectionCard';
import { EmptyState } from '@/components/EmptyState';

export default function Inspiration() {
  return (
    <View className="page">
      <View className="page__title">灵感合集</View>
      <SectionCard title="热门风格">
        <ScrollView scrollX style={{ whiteSpace: 'nowrap' }}>
          {['现代', '原木', '极简', '侘寂'].map((style) => (
            <View
              key={style}
              style={{
                display: 'inline-block',
                padding: '10px 14px',
                background: '#fff',
                borderRadius: '12px',
                marginRight: '10px',
                boxShadow: '0 6px 20px rgba(0,0,0,0.04)'
              }}
            >
              <Text style={{ fontSize: '24px', color: '#2f3845' }}>{style}</Text>
            </View>
          ))}
        </ScrollView>
      </SectionCard>

      <SectionCard title="案例列表">
        <EmptyState title="暂无案例" description="接入后展示案例缩略图与点赞量" />
      </SectionCard>
    </View>
  );
}
