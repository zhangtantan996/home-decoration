import Taro, { useRouter } from '@tarojs/taro';
import { View } from '@tarojs/components';
import React, { useMemo, useState } from 'react';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { sendLoginCode, wechatH5BindPhone } from '@/services/auth_h5';
import { navigateAfterAuthSuccess } from '@/utils/authRedirect';
import { showErrorToast } from '@/utils/error';

export default function WechatBindPhonePage() {
  const router = useRouter();
  const bindToken = (router.params?.bindToken || '').trim();
  const returnUrl = (router.params?.returnUrl || '').trim();

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

  const handleBind = async () => {
    if (!bindToken) {
      Taro.showToast({ title: '缺少绑定凭证，请重新登录', icon: 'none' });
      return;
    }
    if (!phone.trim() || !code.trim()) {
      Taro.showToast({ title: '请输入手机号和验证码', icon: 'none' });
      return;
    }
    if (phoneError) {
      Taro.showToast({ title: phoneError, icon: 'none' });
      return;
    }

    try {
      await wechatH5BindPhone(bindToken, phone.trim(), code.trim());
      Taro.showToast({ title: '绑定成功', icon: 'success' });
      await navigateAfterAuthSuccess(returnUrl);
    } catch (err) {
      showErrorToast(err, '绑定失败');
    }
  };

  return (
    <View className="page">
      <View className="m-md">
        <View className="text-primary font-bold" style={{ fontSize: '40rpx', marginBottom: '24rpx' }}>
          绑定手机号
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
              <Button onClick={handleBind} variant="brand">
                绑定并登录
              </Button>
            </View>
          </View>
        </Card>

        <Card title="说明">
          <View className="text-secondary" style={{ fontSize: '24rpx', lineHeight: 1.7 }}>
            该手机号将与当前微信账号绑定，用于后续登录与订单通知。
          </View>
        </Card>
      </View>
    </View>
  );
}
