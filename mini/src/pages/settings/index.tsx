import Taro from '@tarojs/taro';
import { Text, View } from '@tarojs/components';
import React from 'react';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ListItem } from '@/components/ListItem';
import { useAuthStore } from '@/store/auth';

import './index.scss';

export default function SettingsPage() {
  const auth = useAuthStore();

  const handleClearSession = () => {
    auth.clear();
    Taro.showToast({ title: '已退出登录', icon: 'none' });
    Taro.navigateBack();
  };

  return (
    <View className="page page-settings bg-gray-50 min-h-screen p-md">
      <Card title="账号与安全" className="mb-md">
        <ListItem title="手机号" description={auth.user?.phone || '-'} />
        <ListItem title="昵称" description={auth.user?.nickname || '-'} />
      </Card>

      <Card title="功能设置" className="mb-md">
        <ListItem title="消息提醒" description="已开启" />
        <ListItem title="隐私说明" description="遵循平台隐私协议" />
      </Card>

      <Card title="关于" className="mb-md">
        <View className="p-md text-sm text-gray-600">
          <Text>家装设计一体化平台 · 小程序版</Text>
        </View>
      </Card>

      <Button variant="outline" onClick={handleClearSession}>
        退出登录
      </Button>
    </View>
  );
}
