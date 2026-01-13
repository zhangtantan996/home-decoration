import { Image, Text, View } from '@tarojs/components';

interface Props {
  title: string;
  description?: string;
}

export function EmptyState({ title, description }: Props) {
  return (
    <View style={{ padding: '32px 0', textAlign: 'center' }}>
      <Image
        src="https://dummyimage.com/120x120/f7f4ef/d4af37&text=HD"
        style={{ width: '120px', height: '120px', marginBottom: '12px', borderRadius: '60px' }}
      />
      <Text style={{ display: 'block', fontSize: '26px', color: '#2f3845', fontWeight: 600 }}>{title}</Text>
      {description && <Text style={{ display: 'block', fontSize: '24px', color: '#697586', marginTop: '6px' }}>{description}</Text>}
    </View>
  );
}
