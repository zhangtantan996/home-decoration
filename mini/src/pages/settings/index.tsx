import Taro from '@tarojs/taro';
import React, { useEffect, useMemo, useRef } from 'react';
import { useDidShow } from '@tarojs/taro';

import { Button } from '@/components/Button';
import SettingsLayout, { SettingsGroup, SettingsRow } from '@/components/settings/SettingsLayout';
import { useResolvedUserPhone } from '@/hooks/useResolvedUserPhone';
import { useAuthStore } from '@/store/auth';
import { showErrorToast } from '@/utils/error';

import './index.scss';

const maskPhone = (phone?: string) => {
  const value = String(phone || '').trim();
  if (!/^1\d{10}$/.test(value)) {
    return '未绑定';
  }
  return value.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
};

export default function SettingsPage() {
  const auth = useAuthStore();
  const navigationLockRef = useRef(false);
  const navigationUnlockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { resolvedPhone } = useResolvedUserPhone();
  const phoneLabel = useMemo(() => maskPhone(resolvedPhone), [resolvedPhone]);

  useEffect(() => {
    return () => {
      if (navigationUnlockTimerRef.current) {
        clearTimeout(navigationUnlockTimerRef.current);
        navigationUnlockTimerRef.current = null;
      }
    };
  }, []);

  useDidShow(() => {
    navigationLockRef.current = false;
    if (navigationUnlockTimerRef.current) {
      clearTimeout(navigationUnlockTimerRef.current);
      navigationUnlockTimerRef.current = null;
    }
  });

  const openPage = async (url: string) => {
    if (navigationLockRef.current) {
      return;
    }

    navigationLockRef.current = true;
    try {
      await Taro.navigateTo({ url });
    } catch (error) {
      navigationLockRef.current = false;
      showErrorToast(error, '打开失败');
      return;
    }

    if (navigationUnlockTimerRef.current) {
      clearTimeout(navigationUnlockTimerRef.current);
    }
    navigationUnlockTimerRef.current = setTimeout(() => {
      navigationLockRef.current = false;
      navigationUnlockTimerRef.current = null;
    }, 400);
  };

  const handleLogout = async () => {
    const result = await Taro.showModal({
      title: '退出登录',
      content: '退出后将返回未登录状态，但本地基础偏好仍会保留。',
      confirmText: '退出',
      cancelText: '取消',
      confirmColor: '#dc2626',
    });

    if (!result.confirm) {
      return;
    }

    auth.clear();
    Taro.showToast({ title: '已退出登录', icon: 'none' });
    Taro.switchTab({ url: '/pages/profile/index' });
  };

  return (
    <SettingsLayout
      title="设置"
      footer={
        <Button variant="outline" block className="settings-home__logout" onClick={handleLogout}>
          退出登录
        </Button>
      }
    >
      <SettingsGroup title="账号与安全">
        <SettingsRow label="个人资料" onClick={() => void openPage('/pages/profile/edit/index')} />
        <SettingsRow label="账号安全" value={phoneLabel} onClick={() => void openPage('/pages/settings/account-security/index')} />
        <SettingsRow label="登录设备" onClick={() => void openPage('/pages/settings/devices/index')} />
      </SettingsGroup>

      <SettingsGroup title="偏好设置">
        <SettingsRow label="通知提醒" onClick={() => void openPage('/pages/settings/notification/index')} />
        <SettingsRow label="隐私设置" onClick={() => void openPage('/pages/settings/privacy/index')} />
        <SettingsRow label="通用设置" onClick={() => void openPage('/pages/settings/general/index')} />
      </SettingsGroup>

      <SettingsGroup title="帮助与支持">
        <SettingsRow label="意见反馈" onClick={() => void openPage('/pages/settings/feedback/index')} />
        <SettingsRow label="关于我们" onClick={() => void openPage('/pages/about/index')} />
        <SettingsRow label="联系客服" onClick={() => void openPage('/pages/support/index')} />
      </SettingsGroup>
    </SettingsLayout>
  );
}
