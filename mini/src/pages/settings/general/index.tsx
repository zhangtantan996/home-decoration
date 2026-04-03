import Taro from '@tarojs/taro';
import { Text, View } from '@tarojs/components';
import React, { useEffect, useMemo, useState } from 'react';

import { useUserSettings } from '@/hooks/useUserSettings';
import SettingsLayout, { SettingsGroup, SettingsRow } from '@/components/settings/SettingsLayout';
import { showErrorToast } from '@/utils/error';

import './index.scss';

const AUTH_STORAGE_KEY = 'hd-mini-auth';
const FONT_OPTIONS = [
  { key: 'small', label: '紧凑显示' },
  { key: 'medium', label: '标准显示' },
  { key: 'large', label: '大字号显示' },
] as const;
const LANGUAGE_OPTIONS = [
  { key: 'zh', label: '简体中文' },
  { key: 'en', label: 'English' },
] as const;

const formatCacheSize = (size = 0) => {
  if (size <= 0) {
    return '已清理';
  }
  if (size >= 1024) {
    return `${(size / 1024).toFixed(1)} MB`;
  }
  return `${size} KB`;
};

const readCacheSize = () => {
  try {
    return Taro.getStorageInfoSync().currentSize || 0;
  } catch {
    return 0;
  }
};

const preserveStorageAndClear = () => {
  const storageInfo = Taro.getStorageInfoSync();
  const preservedEntries = storageInfo.keys
    .filter((key) => key === AUTH_STORAGE_KEY)
    .map((key) => [key, Taro.getStorageSync(key)] as const);

  const before = storageInfo.currentSize || 0;
  Taro.clearStorageSync();
  preservedEntries.forEach(([key, value]) => Taro.setStorageSync(key, value));

  const after = readCacheSize();
  return Math.max(before - after, 0);
};

export default function GeneralSettingsPage() {
  const { settings, loading, savePatch } = useUserSettings({
    loadErrorMessage: '通用设置加载失败',
  });
  const [cacheSize, setCacheSize] = useState(0);

  useEffect(() => {
    setCacheSize(readCacheSize());
  }, []);

  const fontLabel = useMemo(
    () => FONT_OPTIONS.find((item) => item.key === settings.fontSize)?.label || '标准显示',
    [settings.fontSize],
  );
  const languageLabel = useMemo(
    () => LANGUAGE_OPTIONS.find((item) => item.key === settings.language)?.label || '简体中文',
    [settings.language],
  );

  const handleSelectFontSize = async () => {
    const result = await Taro.showActionSheet({
      itemList: FONT_OPTIONS.map((item) => item.label),
    }).catch(() => null);

    if (!result || result.tapIndex < 0) {
      return;
    }

    const next = FONT_OPTIONS[result.tapIndex];
    if (!next || next.key === settings.fontSize) {
      return;
    }

    await savePatch({ fontSize: next.key });
  };

  const handleSelectLanguage = async () => {
    const result = await Taro.showActionSheet({
      itemList: LANGUAGE_OPTIONS.map((item) => item.label),
    }).catch(() => null);

    if (!result || result.tapIndex < 0) {
      return;
    }

    const next = LANGUAGE_OPTIONS[result.tapIndex];
    if (!next || next.key === settings.language) {
      return;
    }

    await savePatch({ language: next.key });
  };

  const handleClearCache = async () => {
    const result = await Taro.showModal({
      title: '清理缓存',
      content: `将清理本地临时缓存，预计释放 ${formatCacheSize(cacheSize)}。`,
      confirmText: '清理',
      cancelText: '取消',
      confirmColor: '#111111',
    });

    if (!result.confirm) {
      return;
    }

    try {
      const released = preserveStorageAndClear();
      setCacheSize(readCacheSize());
      Taro.showToast({ title: `已释放 ${formatCacheSize(released)}`, icon: 'none' });
    } catch (error) {
      showErrorToast(error, '缓存清理失败');
    }
  };

  return (
    <SettingsLayout title="通用设置">
      <SettingsGroup title="显示与缓存">
        {loading ? (
          <View className="general-settings__loading">
            <Text className="general-settings__loading-text">正在加载通用配置...</Text>
          </View>
        ) : (
          <>
            <SettingsRow label="字体显示" value={fontLabel} onClick={handleSelectFontSize} />
            <SettingsRow label="语言" value={languageLabel} onClick={handleSelectLanguage} />
            <SettingsRow label="清理缓存" value={formatCacheSize(cacheSize)} onClick={handleClearCache} />
          </>
        )}
      </SettingsGroup>
    </SettingsLayout>
  );
}
