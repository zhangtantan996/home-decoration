import Taro from '@tarojs/taro';
import { navigateBackWithFallback } from '@/utils/navigation';
import { Text, View } from '@tarojs/components';
import React, { useEffect, useState } from 'react';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import MiniPageNav from '@/components/MiniPageNav';

import './index.scss';

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

  const handleBack = () => {
    navigateBackWithFallback('/pages/profile/index');
  };

  return (
    <View className="about-page">
      <MiniPageNav title="关于我们" onBack={handleBack} placeholder />
      <View className="about-page__hero">
        <Text className="about-page__eyebrow">禾泽云</Text>
        <Text className="about-page__title">让家装服务流程更清晰</Text>
        <Text className="about-page__subtitle">从找服务商、预约沟通，到订单支付与项目进度查看，帮助业主把装修关键节点看得更明白。</Text>
      </View>

      <View className="about-page__content">
        <Card title="平台介绍" className="about-page__card">
          <View className="about-page__paragraph">
            <Text>禾泽云是面向本地家装服务的一体化小程序，当前以西安试点为主，连接设计师、工长、装修公司、主材门店与业主。</Text>
          </View>
        </Card>

        <Card title="我们提供" className="about-page__card">
          <View className="about-page__list">
            <Text className="about-page__list-item">服务商浏览、筛选与预约沟通</Text>
            <Text className="about-page__list-item">智能报价、方案确认与订单支付</Text>
            <Text className="about-page__list-item">项目进度、施工日志与关键节点查看</Text>
          </View>
        </Card>

        <Card title="服务边界" className="about-page__card">
          <View className="about-page__paragraph">
            <Text>平台提供信息展示、预约协同、订单与进度管理能力；具体设计、施工、商品交付和售后服务由对应服务商履约。</Text>
          </View>
        </Card>

        <Card title="隐私与安全" className="about-page__card">
          <View className="about-page__paragraph">
            <Text>我们仅在必要场景收集和使用信息。实名、支付、联系方式等敏感信息会按平台规则用于身份核验、交易处理和服务沟通。</Text>
          </View>
        </Card>

        <Card title="版本信息" className="about-page__card">
          <View className="about-page__meta-row">
            <Text className="about-page__meta-label">小程序版本</Text>
            <Text className="about-page__meta-value">{version}</Text>
          </View>
        </Card>

        <Button variant="outline" block onClick={handleOpenSupport}>联系平台客服</Button>
      </View>
    </View>
  );
}
