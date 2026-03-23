import Taro, { useRouter } from '@tarojs/taro';
import { View } from '@tarojs/components';
import React, { useEffect } from 'react';

import { Card } from '@/components/Card';
import { wechatH5Login } from '@/services/auth_h5';
import { navigateAfterAuthSuccess, resolveAuthReturnUrl } from '@/utils/authRedirect';
import { showErrorToast } from '@/utils/error';

export default function WechatCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const run = async () => {
      const code = (router.params?.code || '').trim();
      const state = (router.params?.state || '').trim();
      if (!code || !state) {
        Taro.showToast({ title: '缺少授权信息', icon: 'none' });
        return;
      }

      try {
        const res = await wechatH5Login(code, state);
        if (res.needBindPhone && res.bindToken) {
          const returnUrl = resolveAuthReturnUrl();
          Taro.redirectTo({
            url: `/pages/auth/wechat-bind-phone/index?bindToken=${encodeURIComponent(res.bindToken)}&returnUrl=${encodeURIComponent(returnUrl)}`,
          });
          return;
        }

        if (res.token) {
          Taro.showToast({ title: '登录成功', icon: 'success' });
          await navigateAfterAuthSuccess();
          return;
        }

        Taro.showToast({ title: '登录失败，请重试', icon: 'none' });
      } catch (err) {
        showErrorToast(err, '登录失败');
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View className="page">
      <View className="m-md">
        <Card title="微信登录">
          <View className="text-secondary">正在处理授权回调...</View>
        </Card>
      </View>
    </View>
  );
}
