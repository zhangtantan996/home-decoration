import Taro from '@tarojs/taro';
import { Input, Text, View } from '@tarojs/components';
import React, { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/Button';
import SettingsLayout, { SettingsGroup } from '@/components/settings/SettingsLayout';
import { useMountedRef } from '@/hooks/useMountedRef';
import { useResolvedUserPhone } from '@/hooks/useResolvedUserPhone';
import { changePhone, sendSecurityCode } from '@/services/userSettings';
import { useAuthStore } from '@/store/auth';
import { showErrorToast } from '@/utils/error';

import '../index.scss';
import { isValidChineseMainlandPhone, maskPhone } from '../shared';

export default function ChangePhonePage() {
  const auth = useAuthStore();
  const mountedRef = useMountedRef();
  const { resolvedPhone: currentPhone, refreshResolvedPhone } = useResolvedUserPhone();
  const [newPhone, setNewPhone] = useState('');
  const [code, setCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (countdown <= 0) {
      return undefined;
    }

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown]);

  const sendButtonText = useMemo(() => {
    if (sending) {
      return '发送中...';
    }
    if (countdown > 0) {
      return `${countdown}s后重发`;
    }
    return '发送验证码';
  }, [countdown, sending]);

  const handleSendCode = async () => {
    if (sending || countdown > 0) {
      return;
    }

    const trimmedPhone = newPhone.trim();
    if (!isValidChineseMainlandPhone(trimmedPhone)) {
      Taro.showToast({ title: '请输入正确手机号', icon: 'none' });
      return;
    }

    try {
      if (mountedRef.current) {
        setSending(true);
      }
      await sendSecurityCode(trimmedPhone, 'change_phone');
      if (mountedRef.current) {
        setCountdown(60);
      }
      Taro.showToast({ title: '验证码已发送', icon: 'none' });
    } catch (error) {
      if (mountedRef.current) {
        showErrorToast(error, '验证码发送失败');
      }
    } finally {
      if (mountedRef.current) {
        setSending(false);
      }
    }
  };

  const handleSubmit = async () => {
    const trimmedPhone = newPhone.trim();
    const trimmedCode = code.trim();

    if (!isValidChineseMainlandPhone(trimmedPhone)) {
      Taro.showToast({ title: '请输入正确手机号', icon: 'none' });
      return;
    }
    if (!trimmedCode) {
      Taro.showToast({ title: '请输入验证码', icon: 'none' });
      return;
    }
    if (trimmedPhone === String(currentPhone || '').trim()) {
      Taro.showToast({ title: '新手机号不能与当前一致', icon: 'none' });
      return;
    }

    try {
      if (mountedRef.current) {
        setSubmitting(true);
      }
      await changePhone({ newPhone: trimmedPhone, code: trimmedCode });
      auth.updateUser({ phone: trimmedPhone });
      const latestPhone = await refreshResolvedPhone();
      if (!mountedRef.current) {
        return;
      }
      if (latestPhone && latestPhone !== trimmedPhone) {
        auth.updateUser({ phone: latestPhone });
      }
      Taro.showToast({ title: '手机号已更新', icon: 'success' });
      setTimeout(() => {
        Taro.navigateBack();
      }, 420);
    } catch (error) {
      if (mountedRef.current) {
        showErrorToast(error, '手机号修改失败');
      }
    } finally {
      if (mountedRef.current) {
        setSubmitting(false);
      }
    }
  };

  return (
    <SettingsLayout
      title="修改手机号"
      className="security-form-page"
      footer={
        <Button block loading={submitting} onClick={handleSubmit}>
          确认修改
        </Button>
      }
    >
      <SettingsGroup title="当前号码">
        <View className="security-form-page__summary">
          <Text className="security-form-page__summary-title">当前绑定手机号</Text>
          <Text className="security-form-page__summary-copy">修改后，新手机号将作为登录和验证码接收号码。</Text>
          <View className="security-form-page__value-chip">{maskPhone(currentPhone)}</View>
        </View>
      </SettingsGroup>

      <SettingsGroup title="新手机号验证">
        <View className="security-form-page__form">
          <View className="security-form-page__field">
            <Text className="security-form-page__label">新手机号</Text>
            <Input
              className="security-form-page__input"
              type="number"
              maxlength={11}
              placeholder="请输入新的手机号"
              value={newPhone}
              onInput={(event) => setNewPhone(event.detail.value)}
            />
          </View>

          <View className="security-form-page__field">
            <Text className="security-form-page__label">短信验证码</Text>
            <View className="security-form-page__code-row">
              <Input
                className="security-form-page__input security-form-page__code-input"
                type="number"
                maxlength={6}
                placeholder="请输入验证码"
                value={code}
                onInput={(event) => setCode(event.detail.value)}
              />
              <View className="security-form-page__code-button" onClick={handleSendCode}>
                <Text className="security-form-page__code-button-text">{sendButtonText}</Text>
              </View>
            </View>
          </View>
        </View>
      </SettingsGroup>
    </SettingsLayout>
  );
}
