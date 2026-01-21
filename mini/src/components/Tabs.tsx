import { View } from '@tarojs/components';
import React from 'react';
import './Tabs.scss';

interface TabOption {
  value: string | number;
  label: string;
}

interface TabsProps {
  options: TabOption[];
  value: string | number;
  onChange: (value: string | number) => void;
  className?: string;
}

const buildClassName = (base: string, parts: Array<string | false | undefined>) => {
  return [base, ...parts.filter(Boolean)].join(' ');
};

export const Tabs: React.FC<TabsProps> = ({
  options,
  value,
  onChange,
  className
}) => {
  const classes = buildClassName('tabs', [className]);

  return (
    <View className={classes}>
      {options.map((option) => (
        <View
          key={option.value}
          className={buildClassName('tabs__item', [
            option.value === value ? 'tabs__item--active' : undefined
          ])}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </View>
      ))}
    </View>
  );
};
