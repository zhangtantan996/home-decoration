import Taro, { useDidShow } from '@tarojs/taro';
import { Text, View } from '@tarojs/components';
import React, { useState } from 'react';

import { Button } from '@/components/Button';
import MiniPageNav from '@/components/MiniPageNav';
import { bindPhone, loginWithWxCode } from '@/services/auth';
import { getWechatH5AuthorizeUrl } from '@/services/auth_h5';
import { useAuthStore } from '@/store/auth';
import { getAuthAgreementAccepted, setAuthAgreementAccepted } from '@/utils/authAgreement';
import { navigateAfterAuthSuccess, setPendingAuthReturnUrl } from '@/utils/authRedirect';
import { showErrorToast } from '@/utils/error';

import './index.scss';

const PROTECTED_SOURCE_ROUTES = new Set(['pages/progress/index', 'pages/messages/index']);
const AGREEMENT_SUBLINE = '· 若您的手机号未注册，将为您直接注册账号';

type AgreementDocType = 'terms' | 'privacy';
type PendingAgreementAction = 'quick-login' | null;
type AgreementCopyVariant = 'agreement' | 'dialog';

const AGREEMENT_PAGE_MAP: Record<AgreementDocType, string> = {
  terms: '/pages/legal/user-agreement/index',
  privacy: '/pages/legal/privacy-policy/index',
};

const AgreementCopy = ({
  onOpenAgreement,
  variant,
}: {
  onOpenAgreement: (type: AgreementDocType) => void;
  variant: AgreementCopyVariant;
}) => {
  const lineClassName = `mini-login__${variant}-line`;
  const textClassName = `mini-login__${variant}-text`;
  const linkClassName = `mini-login__${variant}-link`;
  const sublineClassName = `${textClassName} ${textClassName}--subline`;

  return (
    <>
      <View className={lineClassName}>
        <Text className={textClassName}>我已阅读并同意</Text>
        <View
          className={`${linkClassName} ${linkClassName}--tap`}
          onClick={() => onOpenAgreement('terms')}
          hoverClass={`${linkClassName}--pressed`}
        >
          <Text className={linkClassName}>《用户协议》</Text>
        </View>
        <Text className={textClassName}>、</Text>
        <View
          className={`${linkClassName} ${linkClassName}--tap`}
          onClick={() => onOpenAgreement('privacy')}
          hoverClass={`${linkClassName}--pressed`}
        >
          <Text className={linkClassName}>《隐私政策》</Text>
        </View>
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
  const [submitting, setSubmitting] = useState(false);
  const [agreed, setAgreed] = useState(getAuthAgreementAccepted);
  const [agreementTouched, setAgreementTouched] = useState(false);
  const [agreementDialogVisible, setAgreementDialogVisible] = useState(false);
  const [agreementDialogAuthorizing, setAgreementDialogAuthorizing] = useState(false);
  const [pendingAgreementAction, setPendingAgreementAction] = useState<PendingAgreementAction>(null);

  const primaryLabel = isH5 ? '微信快捷登录' : '手机号快捷登录';
  const primaryOpenType = isWeapp && agreed && !submitting ? 'getPhoneNumber' : undefined;
  const dialogConfirmOpenType = isWeapp && pendingAgreementAction === 'quick-login' ? 'getPhoneNumber' : undefined;
  const smsLoginUrl = returnUrl
    ? `/pages/auth/sms-login/index?returnUrl=${encodeURIComponent(returnUrl)}`
    : '/pages/auth/sms-login/index';

  useDidShow(() => {
    setAgreed(getAuthAgreementAccepted());
  });

  const openAgreementDialog = (action: PendingAgreementAction) => {
    setAgreementTouched(true);
    setAgreementDialogAuthorizing(false);
    setPendingAgreementAction(action);
    setAgreementDialogVisible(true);
  };

  const closeAgreementDialog = () => {
    setAgreementDialogAuthorizing(false);
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

  const performQuickLogin = async () => {
    if (isH5) {
      try {
        setPendingAuthReturnUrl(returnUrl);
        const { url } = await getWechatH5AuthorizeUrl();
        // eslint-disable-next-line no-restricted-globals
        window.location.href = url;
      } catch (error) {
        showErrorToast(error, '跳转失败');
      }
    }
  };

  const completeMiniPhoneQuickLogin = async (phoneCode: string) => {
    try {
      setSubmitting(true);
      const { code: wxCode } = await Taro.login();
      if (!wxCode) {
        Taro.showToast({ title: '微信登录失败', icon: 'none' });
        return;
      }

      const result = await loginWithWxCode(wxCode);
      if (result.needBindPhone && result.bindToken) {
        await bindPhone(result.bindToken, phoneCode);
      }

      Taro.showToast({ title: '登录成功', icon: 'success' });
      await navigateAfterAuthSuccess(returnUrl);
    } catch (error) {
      showErrorToast(error, '登录失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePhoneQuickLogin = async (event: any) => {
    const phoneCode = event.detail?.code;
    const errMsg = String(event.detail?.errMsg || '');
    const fromAgreementDialog = agreementDialogVisible || agreementDialogAuthorizing;

    if (fromAgreementDialog) {
      setAgreed(true);
      setAuthAgreementAccepted(true);
      setAgreementTouched(false);
      setAgreementDialogAuthorizing(false);
      setAgreementDialogVisible(false);
      setPendingAgreementAction(null);
    }

    if (!phoneCode) {
      const rejected = /deny|denied|cancel|fail/i.test(errMsg);
      Taro.showToast({
        title: rejected ? '已取消手机号授权，可改用验证码登录' : '未获取到手机号授权',
        icon: 'none',
      });
      return;
    }

    await completeMiniPhoneQuickLogin(phoneCode);
  };

  const handleQuickLogin = async () => {
    if (!agreed) {
      openAgreementDialog('quick-login');
      return;
    }

    if (isWeapp) {
      return;
    }

    await performQuickLogin();
  };

  const handleAgreementConfirm = async () => {
    const action = pendingAgreementAction;
    setAgreed(true);
    setAuthAgreementAccepted(true);
    setAgreementTouched(false);
    setAgreementDialogVisible(false);
    setPendingAgreementAction(null);

    if (!action) {
      return;
    }

    if (action === 'quick-login' && !isWeapp) {
      await performQuickLogin();
    }
  };

  const handleAgreementPhoneQuickLoginTap = () => {
    setAgreed(true);
    setAuthAgreementAccepted(true);
    setAgreementTouched(false);
    setAgreementDialogAuthorizing(true);
  };

  return (
    <View className="mini-login">
      <MiniPageNav title="登录" onBack={handleBack} placeholder />

      <View className="mini-login__content">
        <View className="mini-login__brand-panel">
          <View className="mini-login__logo" />
          <Text className="mini-login__brand-name">禾泽云</Text>
        </View>

        <View className="mini-login__actions">
          <Button
            block
            size="lg"
            loading={submitting}
            className="mini-login__button mini-login__button--primary"
            onClick={primaryOpenType ? undefined : handleQuickLogin}
            openType={primaryOpenType}
            onGetPhoneNumber={primaryOpenType ? handlePhoneQuickLogin : undefined}
          >
            {primaryLabel}
          </Button>

          <Button
            block
            size="lg"
            variant="outline"
            className="mini-login__button mini-login__button--secondary"
            onClick={() => Taro.navigateTo({ url: smsLoginUrl })}
          >
            手机号验证码登录
          </Button>
        </View>
      </View>

      <View className={`mini-login__agreement ${agreementTouched && !agreed ? 'mini-login__agreement--error' : ''}`}>
        <View className="mini-login__agreement-row">
          <View
            className="mini-login__checkbox-slot"
            onClick={() => {
              setAgreed((prev) => {
                const next = !prev;
                setAuthAgreementAccepted(next);
                return next;
              });
              setAgreementTouched(false);
            }}
          >
            <View
              className={`mini-login__checkbox ${agreed ? 'mini-login__checkbox--checked' : ''}`}
            >
              <View className="mini-login__checkbox-inner" />
            </View>
          </View>
          <View className="mini-login__agreement-copy">
            <AgreementCopy variant="agreement" onOpenAgreement={handleOpenAgreement} />
          </View>
        </View>
      </View>

      {agreementDialogVisible ? (
        <View
          className={`mini-login__dialog-mask ${agreementDialogAuthorizing ? 'mini-login__dialog-mask--hidden' : ''}`}
          onClick={agreementDialogAuthorizing ? undefined : closeAgreementDialog}
        >
          <View className="mini-login__dialog" onClick={(event) => event.stopPropagation()}>
            <Text className="mini-login__dialog-title">登录前请先阅读并同意</Text>
            <View className="mini-login__dialog-copy">
              <AgreementCopy variant="dialog" onOpenAgreement={handleOpenAgreement} />
            </View>
            <View className="mini-login__dialog-actions">
              <View className="mini-login__dialog-button mini-login__dialog-button--ghost" onClick={closeAgreementDialog}>
                <Text className="mini-login__dialog-button-text">取消</Text>
              </View>
              {dialogConfirmOpenType ? (
                <Button
                  block
                  className="mini-login__dialog-control mini-login__dialog-control--primary"
                  openType={dialogConfirmOpenType}
                  onClick={handleAgreementPhoneQuickLoginTap}
                  onGetPhoneNumber={handlePhoneQuickLogin}
                >
                  确认
                </Button>
              ) : (
                <View className="mini-login__dialog-button mini-login__dialog-button--primary" onClick={() => void handleAgreementConfirm()}>
                  <Text className="mini-login__dialog-button-text mini-login__dialog-button-text--primary">确认</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}
