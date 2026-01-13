import { View } from '@tarojs/components';
import { PropsWithChildren } from 'react';

interface Props extends PropsWithChildren {
  title?: string;
  rightSlot?: React.ReactNode;
}

export default function SectionCard({ title, rightSlot, children }: Props) {
  return (
    <View className="section-card">
      {(title || rightSlot) && (
        <View className="section-card__title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>{title}</View>
          {rightSlot}
        </View>
      )}
      {children}
    </View>
  );
}
