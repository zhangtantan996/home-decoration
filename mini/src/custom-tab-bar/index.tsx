import Taro from '@tarojs/taro';
import { Text, View } from '@tarojs/components';
import React, { useEffect, useMemo, useState } from 'react';

import { Icon, type IconName } from '@/components/Icon';
import { CUSTOM_TAB_BAR_SELECT_EVENT, getCurrentTabRoute } from '@/utils/customTabBar';

import './index.scss';

interface TabItem {
  pagePath: string;
  text: string;
  icon: IconName;
}

const TAB_ITEMS: TabItem[] = [
  {
    pagePath: '/pages/home/index',
    text: '首页',
    icon: 'home',
  },
  {
    pagePath: '/pages/inspiration/index',
    text: '灵感',
    icon: 'inspiration',
  },
  {
    pagePath: '/pages/progress/index',
    text: '进度',
    icon: 'progress',
  },
  {
    pagePath: '/pages/profile/index',
    text: '我的',
    icon: 'profile',
  },
];

export default function CustomTabBar() {
  const [selectedPath, setSelectedPath] = useState('');

  useEffect(() => {
    const syncSelected = (pagePath?: string) => {
      setSelectedPath(pagePath || getCurrentTabRoute());
    };

    syncSelected();
    Taro.eventCenter.on(CUSTOM_TAB_BAR_SELECT_EVENT, syncSelected);

    return () => {
      Taro.eventCenter.off(CUSTOM_TAB_BAR_SELECT_EVENT, syncSelected);
    };
  }, []);

  const currentIndex = useMemo(
    () => TAB_ITEMS.findIndex((item) => item.pagePath === selectedPath),
    [selectedPath],
  );

  return (
    <View className="floating-tabbar">
      <View className="floating-tabbar__shell">
        {TAB_ITEMS.map((item, index) => {
          const active = item.pagePath === selectedPath || (currentIndex === -1 && index === 0);

          return (
            <View
              key={item.pagePath}
              className={`floating-tabbar__item ${active ? 'floating-tabbar__item--active' : ''}`}
              onClick={() => {
                if (item.pagePath === selectedPath) {
                  return;
                }

                setSelectedPath(item.pagePath);
                void Taro.switchTab({ url: item.pagePath });
              }}
            >
              <View className={`floating-tabbar__icon-wrap ${active ? 'floating-tabbar__icon-wrap--active' : ''}`}>
                <Icon
                  name={item.icon}
                  size={30}
                  color={active ? '#FFFFFF' : '#7A7A7A'}
                />
              </View>
              <Text className={`floating-tabbar__label ${active ? 'floating-tabbar__label--active' : ''}`}>
                {item.text}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
