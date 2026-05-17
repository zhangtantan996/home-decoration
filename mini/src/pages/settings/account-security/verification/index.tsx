import Taro, { useDidShow, useRouter } from '@tarojs/taro';
import { Text, View } from '@tarojs/components';
import React, { useMemo, useState } from 'react';

import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import SettingsLayout, { SettingsGroup } from '@/components/settings/SettingsLayout';
import {
  getUserVerification,
  submitUserVerification,
  type UserVerificationStatus,
} from '@/services/userSettings';
import { showErrorToast } from '@/utils/error';

import './index.scss';

const tabPages = new Set([
  '/pages/home/index',
  '/pages/inspiration/index',
  '/pages/progress/index',
  '/pages/messages/index',
  '/pages/profile/index',
]);

const decodeReturnUrl = (value?: string | string[]) => {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) {
    return '';
  }
  try {
    return decodeURIComponent(raw);
  } catch (_error) {
    return raw;
  }
};

const normalizeIDCardInput = (value: string) => value.replace(/\s+/g, '').toUpperCase();

const isValidRealNameInput = (value: string) => /^[\u4e00-\u9fa5·]{2,20}$/.test(value.trim());

const isValidIDCardInput = (value: string) => {
  const id = normalizeIDCardInput(value);
  if (!/^\d{17}[\dX]$/.test(id)) {
    return false;
  }
  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
  const checkMap = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];
  const sum = id
    .slice(0, 17)
    .split('')
    .reduce((acc, char, index) => acc + Number(char) * weights[index], 0);
  return checkMap[sum % 11] === id[17];
};

const resolveStatusText = (status?: string) => {
  switch (status) {
    case 'verified':
      return '已认证';
    case 'failed':
      return '认证未通过';
    case 'pending':
      return '核验中';
    default:
      return '未认证';
  }
};

const navigateAfterVerified = (returnUrl: string) => {
  if (!returnUrl) {
    Taro.navigateBack();
    return;
  }
  const target = returnUrl.startsWith('/') ? returnUrl : `/${returnUrl}`;
  const pathOnly = target.split('?')[0];
  if (tabPages.has(pathOnly)) {
    void Taro.switchTab({ url: pathOnly });
    return;
  }
  void Taro.redirectTo({ url: target });
};

export default function AccountVerificationPage() {
  const router = useRouter();
  const returnUrl = useMemo(() => decodeReturnUrl(router.params?.returnUrl), [router.params?.returnUrl]);
  const [verification, setVerification] = useState<UserVerificationStatus | null>(null);
  const [realName, setRealName] = useState('');
  const [idCard, setIdCard] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const disabled = useMemo(() => {
    return submitting || !isValidRealNameInput(realName) || !isValidIDCardInput(idCard);
  }, [idCard, realName, submitting]);

  const loadVerification = async () => {
    setLoading(true);
    try {
      const result = await getUserVerification();
      setVerification(result);
    } catch (error) {
      showErrorToast(error, '认证状态加载失败');
    } finally {
      setLoading(false);
    }
  };

  useDidShow(() => {
    void loadVerification();
  });

  const handleSubmit = async () => {
    const nextName = realName.trim();
    const nextIDCard = normalizeIDCardInput(idCard);
    if (!isValidRealNameInput(nextName)) {
      Taro.showToast({ title: '请填写正确的姓名', icon: 'none' });
      return;
    }
    if (!isValidIDCardInput(nextIDCard)) {
      Taro.showToast({ title: '身份证号格式不正确', icon: 'none' });
      return;
    }

    try {
      setSubmitting(true);
      const result = await submitUserVerification({ realName: nextName, idCard: nextIDCard });
      setVerification(result);
      if (result.status === 'verified') {
        Taro.showToast({ title: '认证完成', icon: 'success' });
        setTimeout(() => navigateAfterVerified(returnUrl), 480);
        return;
      }
      Taro.showToast({ title: result.rejectReason || '认证未通过', icon: 'none' });
    } catch (error) {
      showErrorToast(error, '实名认证失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SettingsLayout
      title="实名认证"
      className="real-name-page"
      footer={
        verification?.status === 'verified' ? (
          <Button block onClick={() => navigateAfterVerified(returnUrl)}>返回继续</Button>
        ) : (
          <Button block disabled={disabled} loading={submitting} onClick={handleSubmit}>提交认证</Button>
        )
      }
    >
      <View className="real-name-page__status-card">
        <Text className="real-name-page__status-label">当前状态</Text>
        <Text className="real-name-page__status-value">{loading ? '加载中' : resolveStatusText(verification?.status)}</Text>
        {verification?.status === 'verified' ? (
          <View className="real-name-page__verified-lines">
            <Text className="real-name-page__verified-line">姓名：{verification.realNameMasked || '已脱敏'}</Text>
            <Text className="real-name-page__verified-line">身份证尾号：{verification.idCardLast4 || '已脱敏'}</Text>
          </View>
        ) : null}
        {verification?.status === 'failed' && verification.rejectReason ? (
          <Text className="real-name-page__reason">{verification.rejectReason}</Text>
        ) : null}
      </View>

      {verification?.status !== 'verified' ? (
        <SettingsGroup title="认证信息">
          <View className="real-name-page__form">
            <View className="real-name-page__field">
              <Text className="real-name-page__label">真实姓名</Text>
              <Input
                className="real-name-page__input"
                maxLength={20}
                placeholder="请输入本人姓名"
                value={realName}
                onChange={setRealName}
              />
              {realName.trim() && !isValidRealNameInput(realName) ? (
                <Text className="real-name-page__field-error">姓名需为2-20位中文，可包含间隔点</Text>
              ) : null}
            </View>
            <View className="real-name-page__field">
              <Text className="real-name-page__label">身份证号</Text>
              <Input
                className="real-name-page__input"
                maxLength={18}
                placeholder="请输入18位身份证号"
                value={idCard}
                onChange={(value) => setIdCard(normalizeIDCardInput(value))}
              />
              {idCard && !isValidIDCardInput(idCard) ? (
                <Text className="real-name-page__field-error">请填写正确的18位身份证号</Text>
              ) : null}
            </View>
            <Text className="real-name-page__notice">仅用于支付前实名核验，页面不会展示完整证件号。</Text>
          </View>
        </SettingsGroup>
      ) : null}
    </SettingsLayout>
  );
}
