import Taro, { useLoad } from '@tarojs/taro';
import { View } from '@tarojs/components';
import { useEffect } from 'react';

import { Button } from '@/components/Button';
import { Empty } from '@/components/Empty';

const backToNotifications = () => {
  if (Taro.getCurrentPages().length > 1) {
    Taro.navigateBack();
    return;
  }

  Taro.switchTab({ url: '/pages/messages/index' });
};

export default function ChatPage() {
  useLoad(() => {
    Taro.setNavigationBarTitle({ title: '通知' });
  });

  useEffect(() => {
    Taro.showToast({ title: '一期暂未开放在线咨询', icon: 'none' });

    const timer = setTimeout(() => {
      backToNotifications();
    }, 900);

    return () => {
      clearTimeout(timer);
    };
  }, []);

  return (
    <View className="page p-md">
      <Empty
        description="一期暂未开放在线咨询，请通过通知查看处理进度。"
        action={{
          text: '返回通知',
          onClick: backToNotifications,
        }}
      />
      <View style={{ marginTop: '24rpx' }}>
        <Button variant="outline" block onClick={backToNotifications}>
          返回通知页
        </Button>
      </View>
    </View>
  );
}
