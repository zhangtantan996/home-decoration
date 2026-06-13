import Taro from '@tarojs/taro';
import { navigateBackWithFallback } from '@/utils/navigation';
import { Image, Text, View } from '@tarojs/components';
import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import MiniPageNav from '@/components/MiniPageNav';
import {
  fallbackPublicSiteConfig,
  getPublicSiteConfig,
} from '@/services/publicSiteConfig';
import { colors } from '@/theme/tokens';
import { showErrorToast } from '@/utils/error';
import officialAccountImage from '@/assets/support/official-account.jpeg';
import './index.scss';

const SUPPORT_PHONE = '17764774797';
const SUPPORT_WECHAT = '17782628714';
const SUPPORT_TIME = '工作日 09:00 - 18:00';
const isUserCancelled = (err: unknown) => {
  const message = typeof (err as { errMsg?: string })?.errMsg === 'string'
    ? (err as { errMsg?: string }).errMsg || ''
    : '';
  return message.includes('cancel');
};

export default function SupportPage() {
  const [phone, setPhone] = useState(fallbackPublicSiteConfig.customerPhone || SUPPORT_PHONE);
  const handleBack = () => {
    navigateBackWithFallback('/pages/profile/index');
  };

  useEffect(() => {
    let mounted = true;
    const loadConfig = async () => {
      try {
        const config = await getPublicSiteConfig();
        if (!mounted) {
          return;
        }
        setPhone(config.customerPhone || fallbackPublicSiteConfig.customerPhone || SUPPORT_PHONE);
      } catch {
        if (!mounted) {
          return;
        }
        setPhone(fallbackPublicSiteConfig.customerPhone || SUPPORT_PHONE);
      }
    };
    void loadConfig();
    return () => {
      mounted = false;
    };
  }, []);

  const handleCallSupport = async () => {
    try {
      await Taro.makePhoneCall({ phoneNumber: phone });
    } catch (err) {
      if (isUserCancelled(err)) {
        return;
      }
      showErrorToast(err, '拨号失败，请稍后重试');
    }
  };

  const handleCopyPhone = async () => {
    try {
      await Taro.setClipboardData({ data: phone });
      Taro.showToast({ title: '手机号已复制', icon: 'none' });
    } catch (err) {
      showErrorToast(err, '复制失败，请稍后重试');
    }
  };

  const handleCopyWechat = async () => {
    try {
      await Taro.setClipboardData({ data: SUPPORT_WECHAT });
      Taro.showToast({ title: '微信号已复制', icon: 'none' });
    } catch (err) {
      showErrorToast(err, '复制失败，请稍后重试');
    }
  };

  const handleSaveQr = async () => {
    try {
      const imageInfo = await Taro.getImageInfo({ src: officialAccountImage });
      await Taro.saveImageToPhotosAlbum({ filePath: imageInfo.path });
      Taro.showToast({ title: '已保存到相册', icon: 'none' });
    } catch (err: any) {
      const message = typeof err?.errMsg === 'string' ? err.errMsg : '';
      if (message.includes('auth deny') || message.includes('authorize no response')) {
        Taro.showModal({
          title: '需要相册权限',
          content: '请在设置中允许保存到相册后重试。',
          confirmText: '去设置',
          success: (result) => {
            if (result.confirm) {
              void Taro.openSetting();
            }
          },
        });
        return;
      }
      showErrorToast(err, '保存失败，请稍后重试');
    }
  };

  const faqItems = useMemo(
    () => [
      '还没决定预约谁，可以先电话或微信咨询平台，再决定下一步预约。',
      '涉及改时间、补充需求、协调服务商时，优先电话沟通处理更快。',
      '扫码关注公众号后，也可先复制微信号添加平台客服。',
    ],
    [],
  );

  return (
    <View className="page support-page">
      <MiniPageNav title="咨询平台" onBack={handleBack} placeholder />
      <View className="m-md support-page__content">
        <Card className="support-page__hero-card">
          <View className="support-page__hero">
            <View className="support-page__hero-icon">
              <Icon name="support" size={36} color={colors.info} />
            </View>
            <View className="support-page__hero-main">
              <Text className="support-page__hero-title">平台咨询热线</Text>
              <View className="support-page__hero-phone-row">
                <Text className="support-page__hero-phone">{phone}</Text>
                <View className="support-page__hero-actions">
                  <View
                    className="support-page__hero-action"
                    hoverClass="support-page__hero-action--pressed"
                    onClick={handleCallSupport}
                  >
                    <Icon name="phone" size={24} color={colors.textPrimary} />
                  </View>
                  <View
                    className="support-page__hero-action"
                    hoverClass="support-page__hero-action--pressed"
                    onClick={handleCopyPhone}
                  >
                    <Icon name="copy" size={24} color={colors.textPrimary} />
                  </View>
                </View>
              </View>
              <Text className="support-page__hero-copy">服务时间：{SUPPORT_TIME}</Text>
            </View>
          </View>
        </Card>

        <Card title="微信咨询" className="support-page__qr-card">
          <View className="support-page__qr-wrap">
            <View className="support-page__qr-box" onLongPress={handleSaveQr}>
              <Image
                className="support-page__qr-image"
                src={officialAccountImage}
                mode="aspectFill"
              />
            </View>
            <Text className="support-page__qr-title">
              扫码关注公众号，或复制微信号添加平台客服
            </Text>
            <View className="support-page__qr-wechat-row">
              <Text className="support-page__qr-wechat">微信号：{SUPPORT_WECHAT}</Text>
              <View
                className="support-page__hero-action"
                hoverClass="support-page__hero-action--pressed"
                onClick={handleCopyWechat}
              >
                <Icon name="copy" size={24} color={colors.textPrimary} />
              </View>
            </View>
            <Button
              size="large"
              variant="outline"
              className="support-page__wechat-button support-page__wechat-button--secondary"
              onClick={handleSaveQr}
            >
              保存二维码
            </Button>
            <Text className="support-page__qr-note">
              如扫码异常，请优先拨打平台电话或复制微信号联系
            </Text>
          </View>
        </Card>

        <Card title="联系说明" className="support-page__tips-card">
          <View className="support-page__tips-list">
            {faqItems.map((item) => (
              <View key={item} className="support-page__tip-item">
                <View className="support-page__tip-dot" />
                <Text className="support-page__tip-text">{item}</Text>
              </View>
            ))}
          </View>
        </Card>
      </View>
    </View>
  );
}
