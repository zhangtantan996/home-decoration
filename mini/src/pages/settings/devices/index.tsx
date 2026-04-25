import Taro from '@tarojs/taro';
import { Text, View } from '@tarojs/components';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/Button';
import SettingsLayout, { SettingsGroup } from '@/components/settings/SettingsLayout';
import { useMountedRef } from '@/hooks/useMountedRef';
import { getUserDevices, removeOtherUserDevices, removeUserDevice, type UserDevice } from '@/services/userSettings';
import { showErrorToast } from '@/utils/error';

import './index.scss';

const formatDeviceType = (value?: string) => {
  switch (String(value || '').toLowerCase()) {
    case 'ios':
      return 'iOS 设备';
    case 'android':
      return 'Android 设备';
    case 'web':
      return 'Web';
    case 'wechat-mini-program':
    case 'mini':
      return '微信小程序';
    default:
      return value || '未知设备';
  }
};

const formatDateTime = (value?: string) => {
  if (!value) {
    return '最近登录时间未知';
  }

  const next = new Date(value);
  if (Number.isNaN(next.getTime())) {
    return value;
  }

  const month = `${next.getMonth() + 1}`.padStart(2, '0');
  const day = `${next.getDate()}`.padStart(2, '0');
  const hours = `${next.getHours()}`.padStart(2, '0');
  const minutes = `${next.getMinutes()}`.padStart(2, '0');
  return `${month}-${day} ${hours}:${minutes}`;
};

export default function LoginDevicesPage() {
  const mountedRef = useMountedRef();
  const [devices, setDevices] = useState<UserDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionKey, setActionKey] = useState<string>('');

  const loadDevices = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
    }

    try {
      const result = await getUserDevices();
      if (mountedRef.current) {
        setDevices(result);
      }
    } catch (error) {
      if (mountedRef.current) {
        showErrorToast(error, '设备列表加载失败');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [mountedRef]);

  useEffect(() => {
    void loadDevices();
  }, [loadDevices]);

  const currentDevice = useMemo(() => devices.find((item) => item.isCurrent) || null, [devices]);
  const otherDevices = useMemo(() => devices.filter((item) => !item.isCurrent), [devices]);

  const handleRemoveDevice = async (device: UserDevice) => {
    const result = await Taro.showModal({
      title: '移除设备',
      content: `确认将「${device.deviceName || '该设备'}」移出当前账号登录列表吗？`,
      confirmText: '移除',
      cancelText: '取消',
      confirmColor: '#dc2626',
    });

    if (!result.confirm) {
      return;
    }

    try {
      setActionKey(`device-${device.id}`);
      await removeUserDevice(device.id);
      setDevices((prev) => prev.filter((item) => item.id !== device.id));
      Taro.showToast({ title: '设备已移除', icon: 'none' });
    } catch (error) {
      showErrorToast(error, '移除失败');
    } finally {
      setActionKey('');
    }
  };

  const handleRemoveOthers = async () => {
    const result = await Taro.showModal({
      title: '移除其他设备',
      content: '除当前设备外，其他设备都将失去登录状态。',
      confirmText: '确认',
      cancelText: '取消',
      confirmColor: '#dc2626',
    });

    if (!result.confirm) {
      return;
    }

    try {
      setActionKey('others');
      await removeOtherUserDevices();
      setDevices((prev) => prev.filter((item) => item.isCurrent));
      Taro.showToast({ title: '已移除其他设备', icon: 'none' });
    } catch (error) {
      showErrorToast(error, '批量移除失败');
    } finally {
      setActionKey('');
    }
  };

  return (
    <SettingsLayout title="登录设备">
      <SettingsGroup title="当前设备">
        {currentDevice ? (
          <View className="devices-page__item devices-page__item--current">
            <View className="devices-page__item-main">
              <View className="devices-page__title-row">
                <Text className="devices-page__name">{currentDevice.deviceName || '当前设备'}</Text>
                <View className="devices-page__badge">
                  <Text className="devices-page__badge-text">当前</Text>
                </View>
              </View>
              <Text className="devices-page__meta">{formatDeviceType(currentDevice.deviceType)}</Text>
              {currentDevice.location ? <Text className="devices-page__meta">{currentDevice.location}</Text> : null}
              <Text className="devices-page__meta">{formatDateTime(currentDevice.lastLoginAt)}</Text>
            </View>
          </View>
        ) : (
          <View className="devices-page__empty">
            <Text className="devices-page__empty-text">当前设备信息暂未记录</Text>
          </View>
        )}
      </SettingsGroup>

      <SettingsGroup title={`其他设备${otherDevices.length > 0 ? `（${otherDevices.length}）` : ''}`}>
        {loading ? (
          <View className="devices-page__empty">
            <Text className="devices-page__empty-text">正在加载设备列表...</Text>
          </View>
        ) : otherDevices.length === 0 ? (
          <View className="devices-page__empty">
            <Text className="devices-page__empty-text">当前没有其他登录设备</Text>
          </View>
        ) : (
          otherDevices.map((device) => (
            <View key={device.id} className="devices-page__item">
              <View className="devices-page__item-main">
                <Text className="devices-page__name">{device.deviceName || '未知设备'}</Text>
                <Text className="devices-page__meta">{formatDeviceType(device.deviceType)}</Text>
                {device.location ? <Text className="devices-page__meta">{device.location}</Text> : null}
                <Text className="devices-page__meta">{formatDateTime(device.lastLoginAt)}</Text>
              </View>
              <Button
                variant="outline"
                size="sm"
                className="devices-page__action"
                loading={actionKey === `device-${device.id}`}
                onClick={() => handleRemoveDevice(device)}
              >
                移除
              </Button>
            </View>
          ))
        )}
      </SettingsGroup>

      {otherDevices.length > 0 ? (
        <Button
          variant="outline"
          block
          className="devices-page__batch"
          loading={actionKey === 'others'}
          onClick={handleRemoveOthers}
        >
          移除全部其他设备
        </Button>
      ) : null}
    </SettingsLayout>
  );
}
