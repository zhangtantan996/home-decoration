import Taro from '@tarojs/taro';
import { Text, View } from '@tarojs/components';
import React, { useMemo } from 'react';

import SettingsLayout, { SettingsGroup, SettingsRow } from '@/components/settings/SettingsLayout';
import { useResolvedUserPhone } from '@/hooks/useResolvedUserPhone';

import { maskPhone } from './shared';

export default function AccountSecurityPage() {
  const { resolvedPhone } = useResolvedUserPhone();
  const phoneLabel = useMemo(() => maskPhone(resolvedPhone), [resolvedPhone]);

  const openPage = (url: string) => {
    void Taro.navigateTo({ url });
  };

  const handleVerification = async () => {
    await Taro.showModal({
      title: '实名认证',
      content: '一期先保留入口说明，完整实名认证流程后续补齐。',
      showCancel: false,
      confirmText: '知道了',
    });
  };

  return (
    <SettingsLayout title="账号安全" className="account-security-page">
      <SettingsGroup title="账号信息">
        <SettingsRow label="当前手机号" value={phoneLabel} arrow={false} />
        <SettingsRow
          label="修改手机号"
          hint="更换登录手机号与接收验证码号码"
          onClick={() => openPage('/pages/settings/account-security/change-phone/index')}
        />
        <SettingsRow
          label="修改登录密码"
          hint="用于验证码以外的账号安全校验"
          onClick={() => openPage('/pages/settings/account-security/change-password/index')}
        />
      </SettingsGroup>

      <SettingsGroup title="安全管理">
        <SettingsRow
          label="登录设备管理"
          hint="查看当前设备与其他登录设备"
          onClick={() => openPage('/pages/settings/devices/index')}
        />
        <SettingsRow
          label="实名认证"
          value="后续开放"
          onClick={handleVerification}
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

      <View className="account-security-page__tip">
        <Text className="account-security-page__tip-text">
          涉及手机号、密码和注销的操作都改为独立页面处理，避免在当前页展开打断浏览。
        </Text>
      </View>
    </SettingsLayout>
  );
}
