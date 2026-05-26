import Taro from '@tarojs/taro';
import { navigateBackWithFallback } from '@/utils/navigation';
import { Text, View } from '@tarojs/components';
import React, { useEffect, useState } from 'react';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import MiniPageNav from '@/components/MiniPageNav';
import { fallbackPublicSiteConfig, getPublicSiteConfig } from '@/services/publicSiteConfig';

import './index.scss';

export default function AboutPage() {
  const [version, setVersion] = useState('开发版');
  const [miniProgramRecordNumber, setMiniProgramRecordNumber] = useState(
    fallbackPublicSiteConfig.miniProgramRecordNumber || '备案中',
  );
  const [icp, setIcp] = useState(fallbackPublicSiteConfig.icp || '已备案');

  useEffect(() => {
    try {
      const accountInfo = Taro.getAccountInfoSync();
      setVersion(accountInfo.miniProgram.version || '开发版');
    } catch {
      setVersion('开发版');
    }

    void getPublicSiteConfig()
      .then((config) => {
        setMiniProgramRecordNumber(config.miniProgramRecordNumber || '备案中');
        setIcp(config.icp || fallbackPublicSiteConfig.icp || '已备案');
      })
      .catch(() => {
        setMiniProgramRecordNumber(fallbackPublicSiteConfig.miniProgramRecordNumber || '备案中');
        setIcp(fallbackPublicSiteConfig.icp || '已备案');
      });
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
        <Text className="about-page__title">让家装服务选择更清晰</Text>
        <Text className="about-page__subtitle">从找服务商、看灵感案例到提交轻预约，平台工作人员会在线下联系跟进。</Text>
      </View>

      <View className="about-page__content">
        <Card title="平台介绍" className="about-page__card">
          <View className="about-page__paragraph">
            <Text>禾泽云是面向本地家装服务的信息展示与轻预约小程序，当前以西安试点为主，展示设计师、工长、装修公司、主材门店与灵感案例。</Text>
          </View>
        </Card>

        <Card title="我们提供" className="about-page__card">
          <View className="about-page__list">
            <Text className="about-page__list-item">服务商资料浏览、筛选与收藏</Text>
            <Text className="about-page__list-item">设计师和装修公司轻预约留资</Text>
            <Text className="about-page__list-item">灵感案例、主材门店和商品资料展示</Text>
          </View>
        </Card>

        <Card title="服务边界" className="about-page__card">
          <View className="about-page__paragraph">
            <Text>平台当前不提供线上交易、在线支付、订单履约、退款、投诉仲裁或施工进度管理。具体设计、施工、商品交付和售后服务由用户与对应服务商在线下确认。</Text>
          </View>
        </Card>

        <Card title="隐私与安全" className="about-page__card">
          <View className="about-page__paragraph">
            <Text>我们仅在登录、资料浏览、轻预约、平台联系跟进、反馈处理和安全审计等必要场景收集和使用信息。</Text>
          </View>
        </Card>

        <Card title="版本信息" className="about-page__card">
          <View className="about-page__meta-row">
            <Text className="about-page__meta-label">小程序版本</Text>
            <Text className="about-page__meta-value">{version}</Text>
          </View>
          <View className="about-page__meta-row">
            <Text className="about-page__meta-label">小程序备案号</Text>
            <Text className="about-page__meta-value">{miniProgramRecordNumber}</Text>
          </View>
          <View className="about-page__meta-row">
            <Text className="about-page__meta-label">ICP备案号</Text>
            <Text className="about-page__meta-value">{icp}</Text>
          </View>
        </Card>

        <Button variant="outline" block onClick={handleOpenSupport}>联系平台客服</Button>
      </View>
    </View>
  );
}
