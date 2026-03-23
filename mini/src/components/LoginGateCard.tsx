import Taro from '@tarojs/taro';
import { Text, View } from '@tarojs/components';
import React, { useState } from 'react';

import { bindPhone, loginWithWxCode } from '@/services/auth';
import { getWechatH5AuthorizeUrl } from '@/services/auth_h5';
import { setPendingAuthReturnUrl } from '@/utils/authRedirect';
import { showErrorToast } from '@/utils/error';

import { Button } from './Button';
import { Card } from './Card';
import { Icon, type IconName } from './Icon';
import './LoginGateCard.scss';

interface LoginGateCardProps {
  title: string;
  description: string;
  iconName?: IconName;
  className?: string;
  returnUrl?: string;
}

const buildClassName = (base: string, className?: string) => {
  return className ? `${base} ${className}` : base;
};

export const LoginGateCard: React.FC<LoginGateCardProps> = ({
  title,
  description,
  iconName = 'profile',
  className,
  returnUrl,
}) => {
  const isH5 = process.env.TARO_ENV === 'h5';
  const [bindToken, setBindToken] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleWechatLogin = async () => {
    try {
      setSubmitting(true);
      const { code } = await Taro.login();
      if (!code) {
        Taro.showToast({ title: '微信登录失败', icon: 'none' });
        return;
      }

      const result = await loginWithWxCode(code);
      if (result.needBindPhone && result.bindToken) {
        setBindToken(result.bindToken);
        Taro.showToast({ title: '请继续授权手机号', icon: 'none' });
        return;
      }

      Taro.showToast({ title: '登录成功', icon: 'success' });
    } catch (error) {
      showErrorToast(error, '登录失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePhoneLogin = () => {
    const next = returnUrl ? `?returnUrl=${encodeURIComponent(returnUrl)}` : '';
    Taro.navigateTo({ url: `/pages/auth/login/index${next}` });
  };

  const handleWechatH5Login = async () => {
    try {
      setPendingAuthReturnUrl(returnUrl);
      const { url } = await getWechatH5AuthorizeUrl();
      // eslint-disable-next-line no-restricted-globals
      window.location.href = url;
    } catch (error) {
      showErrorToast(error, '跳转失败');
    }
  };

  const handleBindPhone = async (event: any) => {
    const phoneCode = event.detail?.code;
    if (!phoneCode || !bindToken) {
      Taro.showToast({ title: '缺少手机号授权信息', icon: 'none' });
      return;
    }

    try {
      setSubmitting(true);
      await bindPhone(bindToken, phoneCode);
      setBindToken('');
      Taro.showToast({ title: '绑定成功', icon: 'success' });
    } catch (error) {
      showErrorToast(error, '绑定失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className={buildClassName('login-gate', className)}>
      <View className="login-gate__header">
        <View className="login-gate__icon">
          <Icon name={iconName} size={36} color="#D4AF37" />
        </View>
        <View className="login-gate__copy">
          <Text className="login-gate__title">{title}</Text>
          <Text className="login-gate__description">{description}</Text>
        </View>
      </View>

      {bindToken && !isH5 ? (
        <View className="login-gate__actions">
          <Button
            variant="brand"
            block
            loading={submitting}
            openType="getPhoneNumber"
            onGetPhoneNumber={handleBindPhone}
          >
            授权手机号，继续登录
          </Button>
          <Text className="login-gate__hint">首次微信登录后，需要补齐手机号以继续访问完整业务能力。</Text>
        </View>
      ) : (
        <View className="login-gate__actions">
          {isH5 ? (
            <>
              <Button variant="brand" block onClick={handleWechatH5Login}>
                微信登录
              </Button>
              <Button variant="outline" block onClick={handlePhoneLogin}>
                手机号验证码登录
              </Button>
            </>
          ) : (
            <>
              <Button variant="brand" block loading={submitting} onClick={handleWechatLogin}>
                微信一键登录
              </Button>
              <Button variant="outline" block onClick={handlePhoneLogin}>
                手机号验证码登录
              </Button>
            </>
          )}
          <Text className="login-gate__hint">建议优先使用微信登录；如授权受限，可改用手机号验证码登录。</Text>
        </View>
      )}
    </Card>
  );
};
