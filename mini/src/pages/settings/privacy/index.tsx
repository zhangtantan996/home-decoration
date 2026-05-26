import Taro from '@tarojs/taro';
import React from 'react';

import SettingsLayout, { SettingsGroup, SettingsRow } from '@/components/settings/SettingsLayout';

export default function PrivacySettingsPage() {
  return (
    <SettingsLayout title="隐私设置">
      <SettingsGroup title="法务与规则">
        <SettingsRow
          label="用户协议"
          onClick={() => Taro.navigateTo({ url: '/pages/legal/user-agreement/index' })}
        />
        <SettingsRow
          label="隐私政策"
          onClick={() => Taro.navigateTo({ url: '/pages/legal/privacy-policy/index' })}
        />
        <SettingsRow
          label="个人信息收集清单"
          onClick={() => Taro.navigateTo({ url: '/pages/legal/personal-info-collection-list/index' })}
        />
        <SettingsRow
          label="轻预约服务规则"
          onClick={() => Taro.navigateTo({ url: '/pages/legal/transaction-rules/index' })}
        />
        <SettingsRow
          label="预约反馈说明"
          onClick={() => Taro.navigateTo({ url: '/pages/legal/refund-rules/index' })}
        />
        <SettingsRow
          label="第三方信息共享清单"
          onClick={() => Taro.navigateTo({ url: '/pages/legal/third-party-sharing/index' })}
        />
      </SettingsGroup>
    </SettingsLayout>
  );
}
