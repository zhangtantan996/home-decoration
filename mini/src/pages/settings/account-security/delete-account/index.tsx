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
import { isValidChineseMainlandPhone, maskPhone } from '../shared';

export default function DeleteAccountPage() {
  const auth = useAuthStore();
  const mountedRef = useMountedRef();
  const { resolvedPhone: phone } = useResolvedUserPhone();
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
    if (!code.trim()) {
      Taro.showToast({ title: '请输入验证码', icon: 'none' });
      return;
    }

    const modal = await Taro.showModal({
      title: '确认注销账号',
      content: '注销后将清空当前登录状态，账号资料无法恢复，请确认是否继续。',
      confirmText: '确认',
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
      await deleteAccount({ code: code.trim() });
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
            确认注销账号
          </Button>
        </View>
      }
    >
      <SettingsGroup title="注销提醒">
        <View className="security-form-page__summary">
          <Text className="security-form-page__summary-title">账号注销不可恢复</Text>
          <Text className="security-form-page__danger-copy">
            注销前请确认订单、预约、退款等事项已处理完毕，注销后将退出当前设备登录。
          </Text>
          <View className="security-form-page__danger-list">
            <Text className="security-form-page__danger-item">1. 已提交的订单与预约记录不会继续在小程序内展示。</Text>
            <Text className="security-form-page__danger-item">2. 当前登录设备会立即退出，需要重新注册或重新登录。</Text>
            <Text className="security-form-page__danger-item">3. 本操作需要短信验证码确认，避免误触注销。</Text>
          </View>
        </View>
      </SettingsGroup>

      <SettingsGroup title="短信确认">
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
                onInput={(event) => setCode(event.detail.value)}
              />
              <View className="security-form-page__code-button" onClick={handleSendCode}>
                <Text className="security-form-page__code-button-text">{sendButtonText}</Text>
              </View>
            </View>
            <Text className="security-form-page__warning">验证码将发送到当前绑定手机号，仅用于确认本次注销操作。</Text>
          </View>
        </View>
      </SettingsGroup>
    </SettingsLayout>
  );
}
