import Taro from '@tarojs/taro';
import { Input as TaroInput, Text, View } from '@tarojs/components';
import React, { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/Button';
import MiniPageNav from '@/components/MiniPageNav';
import { bindPhone, loginWithWxCode } from '@/services/auth';
import { getWechatH5AuthorizeUrl, loginWithSmsCode, sendLoginCode } from '@/services/auth_h5';
import { useAuthStore } from '@/store/auth';
import {
  navigateAfterAuthSuccess,
  setPendingAuthReturnUrl,
} from '@/utils/authRedirect';
import { showErrorToast } from '@/utils/error';

import './index.scss';

const PHONE_PATTERN = /^1\d{10}$/;
const PROTECTED_SOURCE_ROUTES = new Set(['pages/progress/index', 'pages/messages/index']);
type AgreementDocType = 'terms' | 'privacy';
type PendingAgreementAction = 'quick-login' | 'toggle-sms' | 'sms-login' | 'bind-phone' | null;
type AgreementCopyVariant = 'agreement' | 'dialog';

const AGREEMENT_PAGE_MAP: Record<AgreementDocType, string> = {
  terms: '/pages/legal/user-agreement/index',
  privacy: '/pages/legal/privacy-policy/index',
};

const AGREEMENT_SUBLINE = '· 若您的手机号未注册，将为您直接注册账号';

const AgreementCopy = ({
  variant,
  onOpenAgreement,
}: {
  variant: AgreementCopyVariant;
  onOpenAgreement: (type: AgreementDocType) => void;
}) => {
  const lineClassName = `mini-login__${variant}-line`;
  const textClassName = `mini-login__${variant}-text`;
  const linkClassName = `mini-login__${variant}-link`;
  const sublineClassName = `${textClassName} ${textClassName}--subline`;

  return (
    <>
      <View className={lineClassName}>
        <Text className={textClassName}>我已阅读并同意</Text>
        <Text className={linkClassName} onClick={() => onOpenAgreement('terms')}>
          《用户协议》
        </Text>
        <Text className={textClassName}>、</Text>
        <Text className={linkClassName} onClick={() => onOpenAgreement('privacy')}>
          《隐私政策》
        </Text>
      </View>
      <Text className={sublineClassName}>{AGREEMENT_SUBLINE}</Text>
    </>
  );
};

export default function LoginPage() {
  const router = Taro.useRouter();
  const returnUrl = decodeURIComponent((router.params?.returnUrl || '').trim());
  const isWeapp = process.env.TARO_ENV === 'weapp';
  const isH5 = process.env.TARO_ENV === 'h5';
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [bindToken, setBindToken] = useState('');
  const [smsExpanded, setSmsExpanded] = useState(false);
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [agreed, setAgreed] = useState(false);
  const [agreementTouched, setAgreementTouched] = useState(false);
  const [agreementDialogVisible, setAgreementDialogVisible] = useState(false);
  const [pendingAgreementAction, setPendingAgreementAction] = useState<PendingAgreementAction>(null);

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
  const primaryLabel = bindToken
    ? '微信授权手机号登录'
    : isH5
      ? '微信快捷登录'
      : '手机号快捷登录';
  const bindPhoneOpenType = bindToken && isWeapp && agreed ? 'getPhoneNumber' : undefined;
  const agreementDialogTip = pendingAgreementAction === 'bind-phone'
    ? '点击确认后，将自动勾选上述协议，请继续点击“微信授权手机号登录”完成授权。'
    : '点击确认后，将自动勾选上述协议并继续当前操作。';

  const openAgreementDialog = (action: PendingAgreementAction) => {
    setAgreementTouched(true);
    setPendingAgreementAction(action);
    setAgreementDialogVisible(true);
  };

  const closeAgreementDialog = () => {
    setAgreementDialogVisible(false);
    setPendingAgreementAction(null);
  };

  const handleOpenAgreement = (type: AgreementDocType) => {
    Taro.navigateTo({ url: AGREEMENT_PAGE_MAP[type] });
  };

  const handleBack = () => {
    const pages = Taro.getCurrentPages();
    const previousRoute = pages[pages.length - 2]?.route || '';

    if (previousRoute && PROTECTED_SOURCE_ROUTES.has(previousRoute) && !useAuthStore.getState().token) {
      Taro.switchTab({ url: '/pages/profile/index' });
      return;
    }

    if (pages.length > 1) {
      Taro.navigateBack();
      return;
    }

    Taro.switchTab({ url: '/pages/profile/index' });
  };

  const handlePhoneChange = (value: string) => {
    setPhone(value.replace(/\D/g, '').slice(0, 11));
  };

  const handleCodeChange = (value: string) => {
    setCode(value.replace(/\D/g, '').slice(0, 6));
  };

  const performQuickLogin = async () => {
    if (bindToken) {
      return;
    }

    if (isH5) {
      try {
        setPendingAuthReturnUrl(returnUrl);
        const { url } = await getWechatH5AuthorizeUrl();
        // eslint-disable-next-line no-restricted-globals
        window.location.href = url;
      } catch (error) {
        showErrorToast(error, '跳转失败');
      }
      return;
    }

    try {
      setSubmitting(true);
      const { code: wxCode } = await Taro.login();
      if (!wxCode) {
        Taro.showToast({ title: '微信登录失败', icon: 'none' });
        return;
      }

      const result = await loginWithWxCode(wxCode);
      if (result.needBindPhone && result.bindToken) {
        setBindToken(result.bindToken);
        Taro.showToast({ title: '请继续完成手机号授权', icon: 'none' });
        return;
      }

      Taro.showToast({ title: '登录成功', icon: 'success' });
      await navigateAfterAuthSuccess(returnUrl);
    } catch (error) {
      showErrorToast(error, '登录失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickLogin = async () => {
    if (!agreed) {
      openAgreementDialog('quick-login');
      return;
    }

    await performQuickLogin();
  };

  const handleBindPhoneEntry = () => {
    if (!bindToken) {
      return;
    }

    if (!agreed) {
      openAgreementDialog('bind-phone');
    }
  };

  const handleBindPhone = async (event: any) => {
    const phoneCode = event.detail?.code;
    if (!phoneCode) {
      Taro.showToast({ title: '未获取到手机号授权', icon: 'none' });
      return;
    }

    if (!bindToken) {
      Taro.showToast({ title: '登录态已失效，请重试', icon: 'none' });
      return;
    }

    try {
      setSubmitting(true);
      await bindPhone(bindToken, phoneCode);
      setBindToken('');
      Taro.showToast({ title: '登录成功', icon: 'success' });
      await navigateAfterAuthSuccess(returnUrl);
    } catch (error) {
      showErrorToast(error, '授权失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendCode = async () => {
    if (sending) {
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
      if (result.debugCode) {
        Taro.showToast({ title: `测试验证码 ${result.debugCode}`, icon: 'none' });
      } else {
        Taro.showToast({ title: '验证码已发送', icon: 'success' });
      }
    } catch (error) {
      showErrorToast(error, '发送失败');
    } finally {
      setSending(false);
    }
  };

  const performSmsLogin = async () => {
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

  const handleSmsLogin = async () => {
    if (!agreed) {
      openAgreementDialog('sms-login');
      return;
    }

    await performSmsLogin();
  };

  const handleToggleSmsPanel = () => {
    if (!smsExpanded && !agreed) {
      openAgreementDialog('toggle-sms');
      return;
    }

    setSmsExpanded((prev) => !prev);
  };

  const continuePendingAgreementAction = async (action: PendingAgreementAction) => {
    switch (action) {
      case 'quick-login':
        await performQuickLogin();
        return;
      case 'toggle-sms':
        setSmsExpanded(true);
        return;
      case 'sms-login':
        await performSmsLogin();
        return;
      case 'bind-phone':
        Taro.showToast({ title: '请再次点击授权手机号登录', icon: 'none' });
        return;
      default:
        return;
    }
  };

  const handleAgreementConfirm = async () => {
    const action = pendingAgreementAction;
    setAgreed(true);
    setAgreementTouched(false);
    setAgreementDialogVisible(false);
    setPendingAgreementAction(null);

    if (!action) {
      return;
    }

    await continuePendingAgreementAction(action);
  };

  return (
    <View className="mini-login">
      <MiniPageNav title="登录" onBack={handleBack} placeholder />

      <View className="mini-login__content">
        <View className="mini-login__brand-panel">
          <View className="mini-login__logo" />
          <Text className="mini-login__brand-name">禾泽云创</Text>
        </View>

        <View className="mini-login__actions">
          <Button
            block
            size="lg"
            loading={submitting}
            className="mini-login__button mini-login__button--primary"
            onClick={bindToken ? handleBindPhoneEntry : handleQuickLogin}
            openType={bindPhoneOpenType}
            onGetPhoneNumber={bindPhoneOpenType ? handleBindPhone : undefined}
          >
            {primaryLabel}
          </Button>

          <Button
            block
            size="lg"
            variant="outline"
            className="mini-login__button mini-login__button--secondary"
            onClick={handleToggleSmsPanel}
          >
            {smsExpanded ? '收起验证码登录' : '手机号验证码登录'}
          </Button>
        </View>

        {bindToken ? (
          <Text className="mini-login__helper">首次微信登录需补齐手机号，用于账号识别、验证码验证和服务通知。</Text>
        ) : null}

        {smsExpanded ? (
          <View className="mini-login__sms-panel">
            <View className="mini-login__field">
              <Text className="mini-login__field-label">手机号</Text>
              <View className={`mini-login__field-box ${phoneError ? 'mini-login__field-box--error' : ''}`}>
                <TaroInput
                  className="mini-login__field-input"
                  type="number"
                  maxlength={11}
                  value={phone}
                  onInput={(event) => handlePhoneChange(event.detail.value)}
                  placeholder="请输入手机号"
                  placeholderClass="mini-login__placeholder"
                />
              </View>
              {phoneError ? <Text className="mini-login__field-error">{phoneError}</Text> : null}
            </View>

            <View className="mini-login__field mini-login__field--code">
              <Text className="mini-login__field-label">验证码</Text>
              <View className="mini-login__field-box mini-login__field-box--code">
                <TaroInput
                  className="mini-login__field-input"
                  type="number"
                  maxlength={6}
                  value={code}
                  onInput={(event) => handleCodeChange(event.detail.value)}
                  placeholder="请输入验证码"
                  placeholderClass="mini-login__placeholder"
                />
                <View
                  className={`mini-login__send-code ${canSendCode ? '' : 'mini-login__send-code--disabled'}`}
                  onClick={canSendCode ? handleSendCode : undefined}
                >
                  <Text className="mini-login__send-code-text">
                    {countdown > 0 ? `${countdown}s` : sending ? '发送中' : '发送验证码'}
                  </Text>
                </View>
              </View>
            </View>

            <Button
              block
              size="lg"
              className="mini-login__button mini-login__button--submit"
              onClick={handleSmsLogin}
              disabled={!canSubmitSms}
              loading={submitting}
            >
              确认登录
            </Button>
          </View>
        ) : null}
      </View>

      <View className={`mini-login__agreement ${agreementTouched && !agreed ? 'mini-login__agreement--error' : ''}`}>
        <View className="mini-login__agreement-row">
          <View
            className={`mini-login__checkbox ${agreed ? 'mini-login__checkbox--checked' : ''}`}
            onClick={() => {
              setAgreed((prev) => !prev);
              setAgreementTouched(false);
            }}
          >
            <View className="mini-login__checkbox-inner" />
          </View>
          <View className="mini-login__agreement-copy">
            <AgreementCopy variant="agreement" onOpenAgreement={handleOpenAgreement} />
          </View>
        </View>
      </View>

      {agreementDialogVisible ? (
        <View className="mini-login__dialog-mask" onClick={closeAgreementDialog}>
          <View className="mini-login__dialog" onClick={(event) => event.stopPropagation()}>
            <Text className="mini-login__dialog-title">登录前请先阅读并同意</Text>
            <View className="mini-login__dialog-copy">
              <AgreementCopy variant="dialog" onOpenAgreement={handleOpenAgreement} />
            </View>
            <Text className="mini-login__dialog-tip">{agreementDialogTip}</Text>
            <View className="mini-login__dialog-actions">
              <View className="mini-login__dialog-button mini-login__dialog-button--ghost" onClick={closeAgreementDialog}>
                <Text className="mini-login__dialog-button-text">取消</Text>
              </View>
              <View className="mini-login__dialog-button mini-login__dialog-button--primary" onClick={() => void handleAgreementConfirm()}>
                <Text className="mini-login__dialog-button-text mini-login__dialog-button-text--primary">确认</Text>
              </View>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}
