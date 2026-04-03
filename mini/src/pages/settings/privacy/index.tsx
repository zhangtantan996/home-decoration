import Taro from '@tarojs/taro';
import { Text, View } from '@tarojs/components';
import React from 'react';

import { useUserSettings } from '@/hooks/useUserSettings';
import SettingsLayout, { SettingsGroup, SettingsRow, SettingsSwitchRow } from '@/components/settings/SettingsLayout';

import './index.scss';

export default function PrivacySettingsPage() {
  const { settings, loading, savePatch } = useUserSettings({
    loadErrorMessage: '隐私设置加载失败',
  });

  return (
    <SettingsLayout title="隐私设置">
      <SettingsGroup title="隐私偏好">
        {loading ? (
          <View className="privacy-settings__loading">
            <Text className="privacy-settings__loading-text">正在加载隐私配置...</Text>
          </View>
        ) : (
          <>
            <SettingsSwitchRow
              label="手机号对外可见"
              checked={settings.phoneVisible}
              onChange={(value) => void savePatch({ phoneVisible: value })}
            />
            <SettingsSwitchRow
              label="定位信息授权"
              checked={settings.locationTracking}
              onChange={(value) => void savePatch({ locationTracking: value })}
            />
            <SettingsSwitchRow
              label="个性化推荐"
              checked={settings.personalizedRecommend}
              onChange={(value) => void savePatch({ personalizedRecommend: value })}
            />
          </>
        )}
      </SettingsGroup>

      <SettingsGroup title="协议说明">
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
