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
  const [version, setVersion] = useState('');
  const [miniProgramRecordNumber, setMiniProgramRecordNumber] = useState(
    fallbackPublicSiteConfig.miniProgramRecordNumber || '',
  );
  const [icp, setIcp] = useState(fallbackPublicSiteConfig.icp || '');

  useEffect(() => {
    try {
      const accountInfo = Taro.getAccountInfoSync();
      setVersion(accountInfo.miniProgram.version || '');
    } catch {
      setVersion('');
    }

    void getPublicSiteConfig()
      .then((config) => {
        setMiniProgramRecordNumber(config.miniProgramRecordNumber || '');
        setIcp(config.icp || fallbackPublicSiteConfig.icp || '');
      })
      .catch(() => {
        setMiniProgramRecordNumber(fallbackPublicSiteConfig.miniProgramRecordNumber || '');
        setIcp(fallbackPublicSiteConfig.icp || '');
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
        <Text className="about-page__subtitle">从找服务商、看灵感案例、智能报价到项目进度查看，帮助你更清楚地推进装修决策。</Text>
      </View>

      <View className="about-page__content">
        <Card title="平台介绍" className="about-page__card">
          <View className="about-page__paragraph">
            <Text>禾泽云是面向本地家装服务的信息展示与轻预约小程序，当前以西安试点为主，提供服务商浏览、灵感案例、智能报价、预约留资和项目进度查看等能力。</Text>
          </View>
        </Card>

        <Card title="我们提供" className="about-page__card">
          <View className="about-page__list">
            <Text className="about-page__list-item">设计师、工长、装修公司和主材门店资料浏览</Text>
            <Text className="about-page__list-item">灵感案例、智能报价和预约留资</Text>
            <Text className="about-page__list-item">项目进度查看、通知提醒和意见反馈</Text>
          </View>
        </Card>

        <Card title="服务边界" className="about-page__card">
          <View className="about-page__paragraph">
            <Text>平台提供信息展示、预约留资、项目进度查看和必要的联系跟进。具体设计、施工、材料交付、付款安排和售后责任，以用户与对应服务主体确认的线下约定或平台记录为准。</Text>
          </View>
        </Card>

        <Card title="隐私与安全" className="about-page__card">
          <View className="about-page__paragraph">
            <Text>我们仅在登录、资料浏览、轻预约、平台联系跟进、反馈处理和安全审计等必要场景收集和使用信息。</Text>
          </View>
        </Card>

        <Card title="版本信息" className="about-page__card">
          {version ? (
            <View className="about-page__meta-row">
              <Text className="about-page__meta-label">小程序版本</Text>
              <Text className="about-page__meta-value">{version}</Text>
            </View>
          ) : null}
          {miniProgramRecordNumber ? (
            <View className="about-page__meta-row">
              <Text className="about-page__meta-label">小程序备案号</Text>
              <Text className="about-page__meta-value">{miniProgramRecordNumber}</Text>
            </View>
          ) : null}
          {icp ? (
            <View className="about-page__meta-row">
              <Text className="about-page__meta-label">ICP备案号</Text>
              <Text className="about-page__meta-value">{icp}</Text>
            </View>
          ) : null}
        </Card>

        <Button variant="outline" block onClick={handleOpenSupport}>联系平台客服</Button>
      </View>
    </View>
  );
}
