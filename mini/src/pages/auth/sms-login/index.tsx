import Taro, { useDidShow } from '@tarojs/taro';
import { Input as TaroInput, Text, View } from '@tarojs/components';
import React, { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/Button';
import MiniPageNav from '@/components/MiniPageNav';
import { loginWithSmsCode, sendLoginCode } from '@/services/auth_h5';
import {
  fallbackPublicSiteConfig,
  findLegalDocument,
  getPublicSiteConfig,
  type PublicSiteConfig,
} from '@/services/publicSiteConfig';
import { getAuthAgreementAccepted, setAuthAgreementAccepted } from '@/utils/authAgreement';
import { navigateAfterAuthSuccess } from '@/utils/authRedirect';
import { showErrorToast } from '@/utils/error';

import './index.scss';

const PHONE_PATTERN = /^1\d{10}$/;
const AGREEMENT_SUBLINE = '· 若您的手机号未注册，将为您直接注册账号';

type AgreementDocType = 'terms' | 'privacy';
type AgreementTitles = Record<AgreementDocType, string>;

const AGREEMENT_PAGE_MAP: Record<AgreementDocType, string> = {
  terms: '/pages/legal/user-agreement/index',
  privacy: '/pages/legal/privacy-policy/index',
};

const AgreementCopy = ({
  legalTitles,
  onOpenAgreement,
}: {
  legalTitles: AgreementTitles;
  onOpenAgreement: (type: AgreementDocType) => void;
}) => (
  <>
    <View className="mini-sms-login__agreement-line">
      <Text className="mini-sms-login__agreement-text">我已阅读并同意</Text>
      <View
        className="mini-sms-login__agreement-link mini-sms-login__agreement-link--tap"
        onClick={() => onOpenAgreement('terms')}
        hoverClass="mini-sms-login__agreement-link--pressed"
      >
        <Text className="mini-sms-login__agreement-link">《{legalTitles.terms}》</Text>
      </View>
      <Text className="mini-sms-login__agreement-text">、</Text>
      <View
        className="mini-sms-login__agreement-link mini-sms-login__agreement-link--tap"
        onClick={() => onOpenAgreement('privacy')}
        hoverClass="mini-sms-login__agreement-link--pressed"
      >
        <Text className="mini-sms-login__agreement-link">《{legalTitles.privacy}》</Text>
      </View>
    </View>
    <Text className="mini-sms-login__agreement-text mini-sms-login__agreement-text--subline">
      {AGREEMENT_SUBLINE}
    </Text>
  </>
);

export default function SmsLoginPage() {
  const router = Taro.useRouter();
  const returnUrl = decodeURIComponent((router.params?.returnUrl || '').trim());
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [agreed, setAgreed] = useState(getAuthAgreementAccepted);
  const [agreementTouched, setAgreementTouched] = useState(false);
  const [phoneLocked, setPhoneLocked] = useState(false);
  const [siteConfig, setSiteConfig] = useState<PublicSiteConfig>(fallbackPublicSiteConfig);

  const legalTitles = useMemo<AgreementTitles>(() => ({
    terms: findLegalDocument(siteConfig, 'user-agreement').title,
    privacy: findLegalDocument(siteConfig, 'privacy-policy').title,
  }), [siteConfig]);

  useDidShow(() => {
    setAgreed(getAuthAgreementAccepted());
  });

  useEffect(() => {
    let active = true;
    void getPublicSiteConfig()
      .then((nextConfig) => {
        if (active) {
          setSiteConfig(nextConfig);
        }
      })
      .catch(() => {
        // Keep fallback legal titles; login must remain usable when config API is unavailable.
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (countdown <= 0) {
      return undefined;
    }

    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown]);

  const phoneError = useMemo(() => {
    if (!phone) return '';
    if (!PHONE_PATTERN.test(phone)) return '请输入正确的 11 位手机号';
    return '';
  }, [phone]);

  const canSendCode = PHONE_PATTERN.test(phone) && countdown === 0 && !sending;
  const canSubmitSms = PHONE_PATTERN.test(phone) && /^\d{4,6}$/.test(code.trim()) && !submitting;

  const handlePhoneChange = (value: string) => {
    if (phoneLocked) {
      return;
    }
    setPhone(value.replace(/\D/g, '').slice(0, 11));
  };

  const handleCodeChange = (value: string) => {
    setCode(value.replace(/\D/g, '').slice(0, 6));
  };

  const handleOpenAgreement = (type: AgreementDocType) => {
    Taro.navigateTo({ url: AGREEMENT_PAGE_MAP[type] });
  };

  const ensureAgreementAccepted = () => {
    if (agreed) {
      return true;
    }

    setAgreementTouched(true);
    Taro.showToast({ title: '请先阅读并同意协议', icon: 'none' });
    return false;
  };

  const handleSendCode = async () => {
    if (!ensureAgreementAccepted() || sending) {
      return;
    }

    if (!phone) {
      Taro.showToast({ title: '请输入手机号', icon: 'none' });
      return;
    }

    if (phoneError) {
      Taro.showToast({ title: phoneError, icon: 'none' });
      return;
    }

    try {
      setSending(true);
      const result = await sendLoginCode(phone.trim());
      setCountdown(60);
      setPhoneLocked(true);
      if (result.debugCode) {
        console.debug(`[DEV] 登录验证码: ${result.debugCode}`);
      }
      Taro.showToast({ title: '验证码已发送', icon: 'success' });
    } catch (error) {
      showErrorToast(error, '发送失败');
    } finally {
      setSending(false);
    }
  };

  const handleResetPhoneStage = () => {
    setPhoneLocked(false);
    setCode('');
    setCountdown(0);
  };

  const handleSubmit = async () => {
    if (!ensureAgreementAccepted()) {
      return;
    }

    if (!phone || !code) {
      Taro.showToast({ title: '请输入手机号和验证码', icon: 'none' });
      return;
    }

    if (phoneError) {
      Taro.showToast({ title: phoneError, icon: 'none' });
      return;
    }

    try {
      setSubmitting(true);
      await loginWithSmsCode(phone.trim(), code.trim());
      Taro.showToast({ title: '登录成功', icon: 'success' });
      await navigateAfterAuthSuccess(returnUrl);
    } catch (error) {
      showErrorToast(error, '登录失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    const pages = Taro.getCurrentPages();
    const previousRoute = pages[pages.length - 2]?.route || '';

    if (previousRoute === 'pages/auth/login/index') {
      Taro.navigateBack();
      return;
    }

    const loginUrl = returnUrl
      ? `/pages/auth/login/index?returnUrl=${encodeURIComponent(returnUrl)}`
      : '/pages/auth/login/index';
    Taro.redirectTo({ url: loginUrl });
  };

  return (
    <View className="mini-sms-login">
      <MiniPageNav title="登录" onBack={handleBack} placeholder />

      <View className="mini-sms-login__content">
        <View className="mini-sms-login__brand-panel">
          <View className="mini-sms-login__logo" />
          <Text className="mini-sms-login__brand-name">禾泽云</Text>
        </View>

        <View className="mini-sms-login__panel">
          <View className="mini-sms-login__field">
            <Text className="mini-sms-login__field-label">手机号</Text>
            <View className={`mini-sms-login__field-box ${phoneError ? 'mini-sms-login__field-box--error' : ''}`}>
              <TaroInput
                className="mini-sms-login__field-input"
                type="number"
                disabled={phoneLocked}
                maxlength={11}
                value={phone}
                onInput={(event) => handlePhoneChange(event.detail.value)}
                placeholder="请输入手机号"
                placeholderClass="mini-sms-login__placeholder"
              />
            </View>
            {phoneError ? <Text className="mini-sms-login__field-error">{phoneError}</Text> : null}
          </View>

          <View className="mini-sms-login__field mini-sms-login__field--code">
            <Text className="mini-sms-login__field-label">验证码</Text>
            <View className="mini-sms-login__field-box mini-sms-login__field-box--code">
              <TaroInput
                className="mini-sms-login__field-input"
                type="number"
                maxlength={6}
                value={code}
                onInput={(event) => handleCodeChange(event.detail.value)}
                placeholder="请输入验证码"
                placeholderClass="mini-sms-login__placeholder"
              />
              <View
                className={`mini-sms-login__send-code ${canSendCode ? '' : 'mini-sms-login__send-code--disabled'}`}
                onClick={canSendCode || !agreed ? handleSendCode : undefined}
              >
                <Text className="mini-sms-login__send-code-text">
                  {countdown > 0 ? `${countdown}s` : sending ? '发送中' : '发送验证码'}
                </Text>
              </View>
            </View>
            {phoneLocked ? (
              <View className="mini-sms-login__field-meta">
                <Text className="mini-sms-login__field-link" onClick={handleResetPhoneStage}>
                  修改手机号
                </Text>
              </View>
            ) : null}
          </View>

          <Button
            block
            size="lg"
            className="mini-sms-login__button mini-sms-login__button--submit"
            onClick={handleSubmit}
            disabled={!canSubmitSms}
            loading={submitting}
          >
            确认登录
          </Button>
        </View>
      </View>

      <View className="mini-sms-login__actions mini-sms-login__actions--bottom">
        <Button
          block
          size="lg"
          variant="outline"
          className="mini-sms-login__button mini-sms-login__button--secondary"
          onClick={() => Taro.navigateBack()}
        >
          返回快捷登录
        </Button>
      </View>

      <View className={`mini-sms-login__agreement ${agreementTouched && !agreed ? 'mini-sms-login__agreement--error' : ''}`}>
        <View className="mini-sms-login__agreement-row">
          <View
            className="mini-sms-login__checkbox-slot"
            onClick={() => {
              setAgreed((prev) => {
                const next = !prev;
                setAuthAgreementAccepted(next);
                return next;
              });
              setAgreementTouched(false);
            }}
          >
            <View className={`mini-sms-login__checkbox ${agreed ? 'mini-sms-login__checkbox--checked' : ''}`}>
              <View className="mini-sms-login__checkbox-inner" />
            </View>
          </View>
          <View className="mini-sms-login__agreement-copy">
            <AgreementCopy legalTitles={legalTitles} onOpenAgreement={handleOpenAgreement} />
          </View>
        </View>
      </View>
    </View>
  );
}
