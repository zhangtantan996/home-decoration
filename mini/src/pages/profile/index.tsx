import { Button, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useState } from 'react';

import SectionCard from '@/components/SectionCard';
import { useAuthStore } from '@/store/auth';
import { bindPhone, loginWithWxCode } from '@/services/auth';

export default function Profile() {
  const auth = useAuthStore();
  const [bindToken, setBindToken] = useState('');

  const handleWxLogin = async () => {
    try {
      const { code } = await Taro.login();
      if (!code) {
        Taro.showToast({ title: '登录失败，请稍后再试', icon: 'none' });
        return;
      }
      const result = await loginWithWxCode(code);
      if (result.needBindPhone && result.bindToken) {
        setBindToken(result.bindToken);
        Taro.showToast({ title: '请授权手机号完成绑定', icon: 'none' });
      } else {
        Taro.showToast({ title: '登录成功', icon: 'success' });
      }
    } catch (err) {
      Taro.showToast({ title: err instanceof Error ? err.message : '登录失败', icon: 'none' });
    }
  };

  const handleBindPhone = async (e: any) => {
    const phoneCode = e.detail?.code;
    if (!phoneCode || !bindToken) {
      Taro.showToast({ title: '缺少手机号授权信息', icon: 'none' });
      return;
    }
    try {
      await bindPhone(bindToken, phoneCode);
      setBindToken('');
      Taro.showToast({ title: '绑定成功', icon: 'success' });
    } catch (err) {
      Taro.showToast({ title: err instanceof Error ? err.message : '绑定失败', icon: 'none' });
    }
  };

  const handleLogout = () => {
    auth.clear();
    setBindToken('');
    Taro.showToast({ title: '已退出', icon: 'none' });
  };

  return (
    <View className="page">
      <View className="page__title">我的</View>
      <SectionCard title="账号状态">
        {auth.user ? (
          <View>
            <Text style={{ display: 'block', fontSize: '28px', fontWeight: 600, color: '#1f2430' }}>{auth.user.nickname}</Text>
            <Text className="text-dim">手机号 {auth.user.phone}</Text>
            <Button type="warn" style={{ marginTop: '16px' }} onClick={handleLogout}>
              退出登录
            </Button>
          </View>
        ) : (
          <View>
            <Text className="text-dim">未登录</Text>
            <Button type="primary" style={{ marginTop: '12px' }} onClick={handleWxLogin}>
              微信一键登录
            </Button>
          </View>
        )}
      </SectionCard>

      {bindToken && (
        <SectionCard title="绑定手机号">
          <Text className="text-dim">点击下方按钮授权手机号，完成账号绑定</Text>
          <Button
            type="primary"
            openType="getPhoneNumber"
            onGetPhoneNumber={handleBindPhone}
            style={{ marginTop: '12px', backgroundColor: '#d4af37', border: 'none' }}
          >
            授权手机号并绑定
          </Button>
        </SectionCard>
      )}

      <SectionCard title="常用入口">
        <Text className="text-dim">后续补充：订单、售后、设置等二级入口</Text>
      </SectionCard>
    </View>
  );
}
