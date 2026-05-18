import Taro from '@tarojs/taro';
import { Input, Text, View } from '@tarojs/components';
import React, { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/Button';
import SettingsLayout, { SettingsGroup } from '@/components/settings/SettingsLayout';
import { useResolvedUserPhone } from '@/hooks/useResolvedUserPhone';
import { useMountedRef } from '@/hooks/useMountedRef';
import { deleteAccount, sendSecurityCode } from '@/services/userSettings';
import { useAuthStore } from '@/store/auth';
import { showErrorToast } from '@/utils/error';

import '../index.scss';
import { isValidChineseMainlandPhone, isValidSecurityCode, maskPhone } from '../shared';

export default function DeleteAccountPage() {
  const auth = useAuthStore();
  const mountedRef = useMountedRef();
  const { resolvedPhone: phone } = useResolvedUserPhone();
  const [code, setCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const normalizeCode = (value: string) => value.replace(/\D/g, '').slice(0, 6);

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

    if (!isValidChineseMainlandPhone(phone)) {
      Taro.showToast({ title: '当前账号未绑定有效手机号', icon: 'none' });
      return;
    }

    try {
      if (mountedRef.current) {
        setSending(true);
      }
      await sendSecurityCode(phone.trim(), 'delete_account');
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
    if (submitting) {
      return;
    }

    const trimmedCode = code.trim();

    if (!isValidChineseMainlandPhone(phone)) {
      Taro.showToast({ title: '当前账号未绑定有效手机号', icon: 'none' });
      return;
    }
    if (!isValidSecurityCode(trimmedCode)) {
      Taro.showToast({ title: '请输入6位验证码', icon: 'none' });
      return;
    }

    const modal = await Taro.showModal({
      title: '确认注销账号',
      content: '注销后账号无法恢复，当前设备将退出登录。确认继续？',
      confirmText: '注销',
      cancelText: '取消',
      confirmColor: '#dc2626',
    });

    if (!modal.confirm) {
      return;
    }

    try {
      if (mountedRef.current) {
        setSubmitting(true);
      }
      await deleteAccount({ code: trimmedCode });
      if (!mountedRef.current) {
        return;
      }
      auth.clear();
      Taro.showToast({ title: '账号已注销', icon: 'none' });
      setTimeout(() => {
        Taro.switchTab({ url: '/pages/profile/index' });
      }, 420);
    } catch (error) {
      if (mountedRef.current) {
        showErrorToast(error, '账号注销失败');
      }
    } finally {
      if (mountedRef.current) {
        setSubmitting(false);
      }
    }
  };

  return (
    <SettingsLayout
      title="注销账号"
      className="security-form-page"
      footer={
        <View className="security-form-page__footer-stack">
          <Button
            block
            className="security-form-page__danger-button"
            loading={submitting}
            onClick={handleSubmit}
          >
            注销账号
          </Button>
        </View>
      }
    >
      <SettingsGroup title="验证身份">
        <View className="security-form-page__form">
          <View className="security-form-page__field">
            <Text className="security-form-page__label">验证手机号</Text>
            <View className="security-form-page__value-chip">{maskPhone(phone)}</View>
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
                onInput={(event) => setCode(normalizeCode(event.detail.value))}
              />
              <View className="security-form-page__code-button" onClick={handleSendCode}>
                <Text className="security-form-page__code-button-text">{sendButtonText}</Text>
              </View>
            </View>
            <Text className="security-form-page__warning">验证码用于确认本次注销。</Text>
          </View>
        </View>
      </SettingsGroup>
    </SettingsLayout>
  );
}
