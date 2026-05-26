import Taro, { useDidShow, useRouter } from '@tarojs/taro';
import { Text, View } from '@tarojs/components';
import React, { useMemo, useState } from 'react';

import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import SettingsLayout from '@/components/settings/SettingsLayout';
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

const resolveStatusTone = (status?: string) => {
  if (status === 'verified') {
    return 'verified';
  }
  if (status === 'failed') {
    return 'failed';
  }
  if (status === 'pending') {
    return 'pending';
  }
  return 'unverified';
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

const resolveStatusCopy = (status?: string) => {
  switch (status) {
    case 'verified':
      return '身份信息已完成核验，可用于账号安全和必要服务确认。';
    case 'failed':
      return '认证信息未通过，请核对姓名和身份证号后重新提交。';
    case 'pending':
      return '认证信息正在核验中，请稍后查看结果。';
    default:
      return '如后续需要身份核验，将仅用于账号安全和必要服务确认。';
  }
};

const resolveStatusTitle = (status?: string) => {
  if (status === 'verified') {
    return '认证成功';
  }
  if (status === 'pending') {
    return '核验中';
  }
  if (status === 'failed') {
    return '认证未通过';
  }
  return '未认证';
};

const formatMaskedIDCard = (last4?: string) => {
  if (!last4) {
    return '已脱敏';
  }
  return `**************${last4}`;
};

const navigateAfterVerified = (returnUrl: string) => {
  if (!returnUrl) {
    const pages = Taro.getCurrentPages();
    if (pages.length > 1) {
      Taro.navigateBack();
      return;
    }
    Taro.switchTab({ url: '/pages/profile/index' });
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

function StatusVisual({ tone }: { tone: string }) {
  const isVerified = tone === 'verified';

  return (
    <View className={`real-name-page__status-visual real-name-page__status-visual--${tone}`}>
      <View className="real-name-page__shield">
        {isVerified ? (
          <View className="real-name-page__shield-check" />
        ) : (
          <View className="real-name-page__shield-person">
            <View className="real-name-page__shield-person-head" />
            <View className="real-name-page__shield-person-body" />
          </View>
        )}
      </View>
    </View>
  );
}

function FieldIcon({ type }: { type: 'name' | 'id' }) {
  return (
    <View className={`real-name-page__field-icon real-name-page__field-icon--${type}`}>
      {type === 'name' ? (
        <>
          <View className="real-name-page__field-icon-head" />
          <View className="real-name-page__field-icon-body" />
        </>
      ) : (
        <>
          <View className="real-name-page__field-icon-line real-name-page__field-icon-line--short" />
          <View className="real-name-page__field-icon-line" />
        </>
      )}
    </View>
  );
}

function VerifiedInfoRow({ type, label, value }: { type: 'name' | 'id'; label: string; value: string }) {
  return (
    <View className="real-name-page__info-row">
      <View className="real-name-page__info-icon">
        <FieldIcon type={type} />
      </View>
      <View className="real-name-page__info-content">
        <Text className="real-name-page__info-label">{label}</Text>
        <Text className="real-name-page__info-value">{value}</Text>
      </View>
    </View>
  );
}

export default function AccountVerificationPage() {
  const router = useRouter();
  const returnUrl = useMemo(() => decodeReturnUrl(router.params?.returnUrl), [router.params?.returnUrl]);
  const [verification, setVerification] = useState<UserVerificationStatus | null>(null);
  const [realName, setRealName] = useState('');
  const [idCard, setIdCard] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [focusedField, setFocusedField] = useState<'realName' | 'idCard' | null>(null);
  const isVerified = verification?.status === 'verified';
  const statusTone = resolveStatusTone(verification?.status);
  const realNameInvalid = Boolean(realName.trim() && !isValidRealNameInput(realName));
  const idCardInvalid = Boolean(idCard && !isValidIDCardInput(idCard));
  const realNameShellClass = [
    'real-name-page__input-shell',
    focusedField === 'realName' ? 'real-name-page__input-shell--focused' : '',
    realNameInvalid ? 'real-name-page__input-shell--error' : '',
  ].filter(Boolean).join(' ');
  const idCardShellClass = [
    'real-name-page__input-shell',
    focusedField === 'idCard' ? 'real-name-page__input-shell--focused' : '',
    idCardInvalid ? 'real-name-page__input-shell--error' : '',
  ].filter(Boolean).join(' ');

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
        isVerified ? (
          <Button
            block
            className="real-name-page__footer-button real-name-page__footer-button--verified"
            onClick={() => navigateAfterVerified(returnUrl)}
          >
            我知道了
          </Button>
        ) : (
          <Button
            block
            className="real-name-page__footer-button"
            disabled={disabled}
            loading={submitting}
            onClick={handleSubmit}
          >
            {submitting ? '认证中...' : '提交认证'}
          </Button>
        )
      }
    >
      <View className={`real-name-page__status-card real-name-page__status-card--${statusTone}`}>
        <StatusVisual tone={statusTone} />
        <View className="real-name-page__status-main">
          <View className="real-name-page__status-top">
            <Text className="real-name-page__status-label">实名认证</Text>
            <View className="real-name-page__status-pill">
              <Text className="real-name-page__status-pill-text">
                {loading ? '加载中' : resolveStatusText(verification?.status)}
              </Text>
            </View>
          </View>
          <Text className="real-name-page__status-value">
            {loading ? '正在读取' : resolveStatusTitle(verification?.status)}
          </Text>
          <Text className="real-name-page__status-copy">{resolveStatusCopy(verification?.status)}</Text>
          {verification?.status === 'failed' && verification.rejectReason ? (
            <Text className="real-name-page__reason">{verification.rejectReason}</Text>
          ) : null}
        </View>
        <View className="real-name-page__status-watermark" />
      </View>

      {isVerified ? (
        <>
          <View className="real-name-page__form-card real-name-page__form-card--verified">
            <View className="real-name-page__form-header">
              <Text className="real-name-page__section-title">认证信息</Text>
              <Text className="real-name-page__section-copy">以下为您已认证的身份信息</Text>
            </View>
            <View className="real-name-page__info-list">
              <VerifiedInfoRow type="name" label="真实姓名" value={verification?.realNameMasked || '已脱敏'} />
              <VerifiedInfoRow type="id" label="身份证号" value={formatMaskedIDCard(verification?.idCardLast4)} />
            </View>
          </View>
          <View className="real-name-page__privacy-note">
            <View className="real-name-page__privacy-icon">
              <View className="real-name-page__privacy-check" />
            </View>
            <Text className="real-name-page__privacy-text">我们将严格保护您的身份信息安全</Text>
          </View>
        </>
      ) : (
        <View className="real-name-page__form-card">
          <View className="real-name-page__form-header">
            <Text className="real-name-page__section-title">填写本人信息</Text>
            <Text className="real-name-page__section-copy">请填写与身份证一致的信息，页面不会展示完整证件号。</Text>
          </View>
          <View className="real-name-page__field">
            <Text className="real-name-page__label">真实姓名</Text>
            <View className={realNameShellClass}>
              <FieldIcon type="name" />
              <Input
                className="real-name-page__input"
                maxLength={20}
                placeholder="请输入本人姓名"
                value={realName}
                onBlur={() => setFocusedField(null)}
                onChange={setRealName}
                onFocus={() => setFocusedField('realName')}
              />
            </View>
            {realNameInvalid ? (
              <Text className="real-name-page__field-error">姓名需为2-20位中文，可包含间隔点</Text>
            ) : null}
          </View>
          <View className="real-name-page__divider" />
          <View className="real-name-page__field">
            <Text className="real-name-page__label">身份证号</Text>
            <View className={idCardShellClass}>
              <FieldIcon type="id" />
              <Input
                className="real-name-page__input"
                maxLength={18}
                placeholder="请输入18位身份证号"
                value={idCard}
                onBlur={() => setFocusedField(null)}
                onChange={(value) => setIdCard(normalizeIDCardInput(value))}
                onFocus={() => setFocusedField('idCard')}
              />
            </View>
            {idCardInvalid ? (
              <Text className="real-name-page__field-error">请填写正确的18位身份证号</Text>
            ) : null}
          </View>
        </View>
      )}
    </SettingsLayout>
  );
}
