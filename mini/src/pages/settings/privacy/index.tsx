import Taro from '@tarojs/taro';
import React from 'react';

import SettingsLayout, { SettingsGroup, SettingsRow } from '@/components/settings/SettingsLayout';

export default function PrivacySettingsPage() {
  return (
    <SettingsLayout title="隐私设置">
      <SettingsGroup title="协议">
        <SettingsRow
          label="用户协议"
          onClick={() => Taro.navigateTo({ url: '/pages/legal/user-agreement/index' })}
        />
        <SettingsRow
          label="隐私政策"
          onClick={() => Taro.navigateTo({ url: '/pages/legal/privacy-policy/index' })}
        />
      </SettingsGroup>
    </SettingsLayout>
  );
}
