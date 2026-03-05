import Taro from '@tarojs/taro';
import { Text, View } from '@tarojs/components';
import React, { useEffect, useState } from 'react';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';

export default function AboutPage() {
  const [version, setVersion] = useState('开发版');

  useEffect(() => {
    try {
      const accountInfo = Taro.getAccountInfoSync();
      setVersion(accountInfo.miniProgram.version || '开发版');
    } catch {
      setVersion('开发版');
    }
  }, []);

  const handleOpenSupport = () => {
    Taro.navigateTo({ url: '/pages/support/index' });
  };

  return (
    <View className="page">
      <View className="m-md">
        <Card title="平台介绍" className="mb-lg">
          <View className="text-secondary" style={{ fontSize: '26rpx', lineHeight: '1.8' }}>
            <Text>家装设计一体化平台小程序，提供服务商浏览、预约、方案确认、订单支付与项目进度管理。</Text>
          </View>
        </Card>

        <Card title="版本信息" className="mb-lg">
          <View className="text-secondary" style={{ fontSize: '26rpx', lineHeight: '1.8' }}>
            <Text>小程序版本：{version}</Text>
          </View>
        </Card>

        <Card title="服务说明" className="mb-lg">
          <View className="text-secondary" style={{ fontSize: '26rpx', lineHeight: '1.8' }}>
            <Text>我们会持续优化业主端核心流程，确保预约、订单与项目管理体验稳定可靠。</Text>
          </View>
        </Card>

        <Button variant="outline" onClick={handleOpenSupport}>联系平台客服</Button>
      </View>
    </View>
  );
}
