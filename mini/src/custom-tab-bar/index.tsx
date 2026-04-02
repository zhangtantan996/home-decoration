import Taro from '@tarojs/taro';
import { Text, View } from '@tarojs/components';
import { useEffect, useMemo, useState } from 'react';

import { Icon, type IconName } from '@/components/Icon';
import { useAuthStore } from '@/store/auth';
import { openAuthLoginPage } from '@/utils/authRedirect';
import {
  CUSTOM_TAB_BAR_SELECT_EVENT,
  CUSTOM_TAB_BAR_VISIBILITY_EVENT,
  getCurrentTabRoute,
} from '@/utils/customTabBar';

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
    pagePath: '/pages/messages/index',
    text: '通知',
    icon: 'message',
  },
  {
    pagePath: '/pages/profile/index',
    text: '我的',
    icon: 'profile',
  },
];

const PROTECTED_TAB_PATHS = new Set([
  '/pages/progress/index',
  '/pages/messages/index',
]);

export default function CustomTabBar() {
  const [selectedPath, setSelectedPath] = useState('');
  const [hidden, setHidden] = useState(false);

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

  useEffect(() => {
    const syncHidden = (nextHidden?: boolean) => {
      setHidden(Boolean(nextHidden));
    };

    Taro.eventCenter.on(CUSTOM_TAB_BAR_VISIBILITY_EVENT, syncHidden);

    return () => {
      Taro.eventCenter.off(CUSTOM_TAB_BAR_VISIBILITY_EVENT, syncHidden);
    };
  }, []);

  const currentIndex = useMemo(
    () => TAB_ITEMS.findIndex((item) => item.pagePath === selectedPath),
    [selectedPath],
  );

  return (
    <View className={`floating-tabbar ${hidden ? 'floating-tabbar--hidden' : ''}`}>
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

                if (PROTECTED_TAB_PATHS.has(item.pagePath) && !useAuthStore.getState().token) {
                  void openAuthLoginPage(item.pagePath);
                  return;
                }

                setSelectedPath(item.pagePath);
                void Taro.switchTab({ url: item.pagePath });
              }}
            >
              <View className={`floating-tabbar__icon-wrap ${active ? 'floating-tabbar__icon-wrap--active' : ''}`}>
                <Icon
                  name={item.icon}
                  size={28}
                  color={active ? '#111111' : '#A1A1AA'}
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
