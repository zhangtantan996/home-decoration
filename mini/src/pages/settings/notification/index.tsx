import { Text, View } from '@tarojs/components';
import React from 'react';

import { useUserSettings } from '@/hooks/useUserSettings';
import SettingsLayout, { SettingsGroup, SettingsSwitchRow } from '@/components/settings/SettingsLayout';

import './index.scss';

export default function NotificationSettingsPage() {
  const { settings, loading, savePatch } = useUserSettings({
    loadErrorMessage: '通知设置加载失败',
  });

  return (
    <SettingsLayout title="通知提醒">
      <SettingsGroup title="消息提醒">
        {loading ? (
          <View className="notification-settings__loading">
            <Text className="notification-settings__loading-text">正在加载通知配置...</Text>
          </View>
        ) : (
          <>
            <SettingsSwitchRow
              label="系统通知"
              checked={settings.notifySystem}
              onChange={(value) => void savePatch({ notifySystem: value })}
            />
            <SettingsSwitchRow
              label="项目进度提醒"
              checked={settings.notifyProject}
              onChange={(value) => void savePatch({ notifyProject: value })}
            />
            <SettingsSwitchRow
              label="订单与支付提醒"
              checked={settings.notifyPayment}
              onChange={(value) => void savePatch({ notifyPayment: value })}
            />
          </>
        )}
      </SettingsGroup>
    </SettingsLayout>
  );
}
