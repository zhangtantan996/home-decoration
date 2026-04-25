import Taro from '@tarojs/taro';
import { Input, Text, View } from '@tarojs/components';
import React, { useMemo, useState } from 'react';

import { Button } from '@/components/Button';
import SettingsLayout, { SettingsGroup } from '@/components/settings/SettingsLayout';
import { changePassword } from '@/services/userSettings';
import { showErrorToast } from '@/utils/error';

import '../index.scss';

export default function ChangePasswordPage() {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const disabled = useMemo(() => {
    return !oldPassword.trim() || !newPassword.trim() || !confirmPassword.trim() || submitting;
  }, [confirmPassword, newPassword, oldPassword, submitting]);

  const handleSubmit = async () => {
    const nextPassword = newPassword.trim();
    if (nextPassword.length < 6) {
      Taro.showToast({ title: '新密码至少 6 位', icon: 'none' });
      return;
    }
    if (nextPassword !== confirmPassword.trim()) {
      Taro.showToast({ title: '两次输入的新密码不一致', icon: 'none' });
      return;
    }
    if (oldPassword.trim() === nextPassword) {
      Taro.showToast({ title: '新旧密码不能相同', icon: 'none' });
      return;
    }

    try {
      setSubmitting(true);
      await changePassword({ oldPassword: oldPassword.trim(), newPassword: nextPassword });
      Taro.showToast({ title: '密码已更新', icon: 'success' });
      setTimeout(() => {
        Taro.navigateBack();
      }, 420);
    } catch (error) {
      showErrorToast(error, '密码修改失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SettingsLayout
      title="修改登录密码"
      className="security-form-page"
      footer={
        <Button block disabled={disabled} loading={submitting} onClick={handleSubmit}>
          保存密码
        </Button>
      }
    >
      <SettingsGroup title="填写信息">
        <View className="security-form-page__form">
          <View className="security-form-page__field">
            <Text className="security-form-page__label">当前密码</Text>
            <Input
              className="security-form-page__input"
              password
              maxlength={32}
              placeholder="请输入当前密码"
              value={oldPassword}
              onInput={(event) => setOldPassword(event.detail.value)}
            />
          </View>

          <View className="security-form-page__field">
            <Text className="security-form-page__label">新密码</Text>
            <Input
              className="security-form-page__input"
              password
              maxlength={32}
              placeholder="请输入新密码，至少 6 位"
              value={newPassword}
              onInput={(event) => setNewPassword(event.detail.value)}
            />
          </View>

          <View className="security-form-page__field">
            <Text className="security-form-page__label">确认新密码</Text>
            <Input
              className="security-form-page__input"
              password
              maxlength={32}
              placeholder="请再次输入新密码"
              value={confirmPassword}
              onInput={(event) => setConfirmPassword(event.detail.value)}
            />
          </View>
        </View>
      </SettingsGroup>
    </SettingsLayout>
  );
}
