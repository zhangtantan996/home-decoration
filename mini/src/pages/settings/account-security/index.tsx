import Taro, { useDidShow } from '@tarojs/taro';
import React, { useEffect, useMemo, useState } from 'react';

import SettingsLayout, { SettingsGroup, SettingsRow } from '@/components/settings/SettingsLayout';
import { useResolvedUserPhone } from '@/hooks/useResolvedUserPhone';
import { getUserVerification, type UserVerificationStatus } from '@/services/userSettings';

import { maskPhone } from './shared';

export default function AccountSecurityPage() {
  const { resolvedPhone } = useResolvedUserPhone();
  const [verification, setVerification] = useState<UserVerificationStatus | null>(null);
  const phoneLabel = useMemo(() => maskPhone(resolvedPhone), [resolvedPhone]);
  const verificationLabel = useMemo(() => {
    switch (verification?.status) {
      case 'verified':
        return '已认证';
      case 'failed':
        return '未通过';
      case 'pending':
        return '核验中';
      default:
        return '未认证';
    }
  }, [verification?.status]);

  const openPage = (url: string) => {
    void Taro.navigateTo({ url });
  };

  useEffect(() => {
    let mounted = true;
    getUserVerification()
      .then((result) => {
        if (mounted) {
          setVerification(result);
        }
      })
      .catch(() => {
        if (mounted) {
          setVerification(null);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);
  useDidShow(() => {
    void getUserVerification()
      .then(setVerification)
      .catch(() => setVerification(null));
  });

  return (
    <SettingsLayout title="账号安全">
      <SettingsGroup title="账号信息">
        <SettingsRow label="当前手机号" value={phoneLabel} arrow={false} />
        <SettingsRow
          label="修改手机号"
          onClick={() => openPage('/pages/settings/account-security/change-phone/index')}
        />
        <SettingsRow
          label="修改登录密码"
          onClick={() => openPage('/pages/settings/account-security/change-password/index')}
        />
      </SettingsGroup>

      <SettingsGroup title="安全管理">
        <SettingsRow
          label="登录设备管理"
          onClick={() => openPage('/pages/settings/devices/index')}
        />
        <SettingsRow
          label="实名认证"
          value={verificationLabel}
          onClick={() => openPage('/pages/settings/account-security/verification/index')}
        />
      </SettingsGroup>

      <SettingsGroup title="账号操作">
        <SettingsRow
          label="注销账号"
          hint="注销后账号资料与登录关系将无法恢复，请谨慎操作"
          danger
          onClick={() => openPage('/pages/settings/account-security/delete-account/index')}
        />
      </SettingsGroup>

    </SettingsLayout>
  );
}
