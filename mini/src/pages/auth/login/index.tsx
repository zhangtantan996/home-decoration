import Taro from '@tarojs/taro';
import { View } from '@tarojs/components';
import React, { useMemo, useState } from 'react';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { getWechatH5AuthorizeUrl, loginWithSmsCode, sendLoginCode } from '@/services/auth_h5';
import { showErrorToast } from '@/utils/error';

export default function LoginPage() {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);

  const phoneError = useMemo(() => {
    const v = phone.trim();
    if (!v) return '';
    if (!/^1\d{10}$/.test(v)) return '手机号格式不正确';
    return '';
  }, [phone]);

  const handleSendCode = async () => {
    if (sending) return;
    if (!phone.trim()) {
      Taro.showToast({ title: '请输入手机号', icon: 'none' });
      return;
    }
    if (phoneError) {
      Taro.showToast({ title: phoneError, icon: 'none' });
      return;
    }
    setSending(true);
    try {
      const res = await sendLoginCode(phone.trim());
      if (res.debugCode) {
        Taro.showToast({ title: `测试验证码: ${res.debugCode}`, icon: 'none' });
      } else {
        Taro.showToast({ title: '验证码已发送', icon: 'success' });
      }
    } catch (err) {
      showErrorToast(err, '发送失败');
    } finally {
      setSending(false);
    }
  };

  const handleLogin = async () => {
    if (!phone.trim() || !code.trim()) {
      Taro.showToast({ title: '请输入手机号和验证码', icon: 'none' });
      return;
    }
    if (phoneError) {
      Taro.showToast({ title: phoneError, icon: 'none' });
      return;
    }
    try {
      await loginWithSmsCode(phone.trim(), code.trim());
      Taro.showToast({ title: '登录成功', icon: 'success' });
      Taro.switchTab({ url: '/pages/profile/index' });
    } catch (err) {
      showErrorToast(err, '登录失败');
    }
  };

  const handleWechatLogin = async () => {
    if (process.env.TARO_ENV !== 'h5') {
      Taro.showToast({ title: '仅支持在 H5 使用微信网页授权', icon: 'none' });
      return;
    }
    try {
      const { url } = await getWechatH5AuthorizeUrl();
      // eslint-disable-next-line no-restricted-globals
      window.location.href = url;
    } catch (err) {
      showErrorToast(err, '跳转失败');
    }
  };

  return (
    <View className="page">
      <View className="m-md">
        <View className="text-primary font-bold" style={{ fontSize: '40rpx', marginBottom: '24rpx' }}>
          登录
        </View>

        <Card className="mb-lg">
          <Input
            label="手机号"
            value={phone}
            onChange={setPhone}
            placeholder="请输入手机号"
            type="phone"
            error={phoneError}
          />
          <View className="mt-md" />
          <Input
            label="验证码"
            value={code}
            onChange={setCode}
            placeholder="请输入验证码"
            type="number"
          />
          <View className="mt-md" />
          <View className="flex gap-sm">
            <View className="flex-1">
              <Button onClick={handleSendCode} variant="outline" disabled={sending}>
                {sending ? '发送中' : '发送验证码'}
              </Button>
            </View>
            <View className="flex-1">
              <Button onClick={handleLogin} variant="primary">
                登录
              </Button>
            </View>
          </View>
        </Card>

        <Card title="其他方式">
          <Button onClick={handleWechatLogin} variant="brand">
            微信登录（网页授权）
          </Button>
          <View className="text-secondary mt-sm" style={{ fontSize: '24rpx', lineHeight: 1.7 }}>
            提示：微信网页授权需要配置公众号网页授权域名；在非微信环境可能无法完成授权。
          </View>
        </Card>
      </View>
    </View>
  );
}
