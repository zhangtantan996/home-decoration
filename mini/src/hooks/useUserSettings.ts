import Taro from '@tarojs/taro';
import { useCallback, useEffect, useState } from 'react';

import { useMountedRef } from '@/hooks/useMountedRef';
import { DEFAULT_USER_SETTINGS, getUserSettings, updateUserSettings, type UserSettings } from '@/services/userSettings';
import { showErrorToast } from '@/utils/error';

interface UseUserSettingsOptions {
  loadErrorMessage?: string;
  saveErrorMessage?: string;
  successToast?: boolean;
}

export function useUserSettings(options: UseUserSettingsOptions = {}) {
  const {
    loadErrorMessage = '设置加载失败',
    saveErrorMessage = '设置保存失败',
    successToast = false,
  } = options;

  const [settings, setSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS);
  const [loading, setLoading] = useState(true);
  const mountedRef = useMountedRef();

  const reload = useCallback(async (force = false) => {
    try {
      const result = await getUserSettings({ force });
      if (mountedRef.current) {
        setSettings(result);
      }
    } catch (error) {
      if (mountedRef.current) {
        showErrorToast(error, loadErrorMessage);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [loadErrorMessage, mountedRef]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const savePatch = useCallback(
    async (patch: Partial<UserSettings>) => {
      const previous = settings;
      const next = { ...settings, ...patch };
      if (mountedRef.current) {
        setSettings(next);
      }

      try {
        await updateUserSettings(patch);
        if (successToast) {
          Taro.showToast({ title: '已更新', icon: 'none' });
        }
        return true;
      } catch (error) {
        if (mountedRef.current) {
          setSettings(previous);
          showErrorToast(error, saveErrorMessage);
        }
        return false;
      }
    },
    [mountedRef, saveErrorMessage, settings, successToast],
  );

  return {
    settings,
    loading,
    setSettings,
    reload,
    savePatch,
  };
}

export default useUserSettings;
