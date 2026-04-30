import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Text, View, WebView } from '@tarojs/components';
import Taro, { useDidHide, useDidShow, useLoad } from '@tarojs/taro';

import { Button } from '@/components/Button';
import MiniPageNav from '@/components/MiniPageNav';
import {
  SurveyDepositQrDialog,
  type SurveyDepositQrDialogPhase,
  type SurveyDepositQrDialogStatusTone,
} from '@/components/SurveyDepositQrDialog';
import {
  QR_EXPIRED_TEXT,
  QR_MANUAL_CHECKING_TEXT,
  QR_MANUAL_FEEDBACK_HOLD_MS,
  QR_MANUAL_PENDING_TEXT,
  QR_MANUAL_RETRY_TEXT,
  QR_SUCCESS_TEXT,
  QR_WAITING_TEXT,
} from '@/constants/paymentQr';
import { paySurveyDeposit } from '@/services/bookings';
import { payOrderCenterEntry } from '@/services/orderCenter';
import { getPaymentStatus, normalizePaymentLaunchUrl } from '@/services/payments';
import { showErrorToast } from '@/utils/error';
import { publishPaymentRefreshNotice } from '@/utils/paymentRefresh';
import { isRealNameRequiredError, navigateToRealNameVerification } from '@/utils/realNameVerification';

import './index.scss';

type SurveyDepositPaymentSourceType = 'booking_detail' | 'survey_deposit_order';

type QrPaymentState = {
  paymentId: number;
  amount: number;
  phase: SurveyDepositQrDialogPhase;
  qrCodeImageUrl?: string;
  expiresAt?: string;
  statusText: string;
  statusTone: SurveyDepositQrDialogStatusTone;
};

const formatAmount = (amount: number) => `¥${Number(amount || 0).toLocaleString()}`;

const SurveyDepositPaymentWebviewPage: React.FC = () => {
  const [paymentId, setPaymentId] = useState(0);
  const [bookingId, setBookingId] = useState(0);
  const [entryKey, setEntryKey] = useState('');
  const [returnUrl, setReturnUrl] = useState('');
  const [sourceType, setSourceType] = useState<SurveyDepositPaymentSourceType>('booking_detail');
  const [launchUrl, setLaunchUrl] = useState('');
  const [amount, setAmount] = useState(0);
  const [amountLabel, setAmountLabel] = useState('待支付金额');
  const [statusText, setStatusText] = useState('已打开支付宝页面，请完成支付后返回当前页面');
  const [fallbackLoading, setFallbackLoading] = useState(false);
  const [qrConfirmLoading, setQrConfirmLoading] = useState(false);
  const [qrPayment, setQrPayment] = useState<QrPaymentState | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const qrSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextShowRef = useRef(false);
  const manualFeedbackUntilRef = useRef(0);

  const stopTracking = useCallback(() => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  }, []);

  const clearQrSuccessTimer = useCallback(() => {
    if (qrSuccessTimerRef.current) {
      clearTimeout(qrSuccessTimerRef.current);
      qrSuccessTimerRef.current = null;
    }
  }, []);

  const clearManualFeedbackLock = useCallback(() => {
    manualFeedbackUntilRef.current = 0;
  }, []);

  const holdManualFeedbackLock = useCallback(() => {
    manualFeedbackUntilRef.current = Number.MAX_SAFE_INTEGER;
  }, []);

  const keepManualFeedbackVisible = useCallback(() => {
    manualFeedbackUntilRef.current = Date.now() + QR_MANUAL_FEEDBACK_HOLD_MS;
  }, []);

  const hasManualFeedbackLock = useCallback(() => {
    const current = manualFeedbackUntilRef.current;
    return current === Number.MAX_SAFE_INTEGER || current > Date.now();
  }, []);

  const navigateBackToSource = useCallback(() => {
    const pages = Taro.getCurrentPages();
    if (pages.length > 1) {
      void Taro.navigateBack();
      return;
    }

    if (returnUrl) {
      if (returnUrl.startsWith('/pages/')) {
        if (returnUrl.includes('/pages/') && (returnUrl.includes('/pages/profile/index') || returnUrl.includes('/pages/orders/') || returnUrl.includes('/pages/booking/'))) {
          void Taro.redirectTo({ url: returnUrl });
          return;
        }
        void Taro.navigateTo({ url: returnUrl });
        return;
      }
      if (returnUrl.startsWith('/')) {
        void Taro.switchTab({ url: returnUrl });
        return;
      }
    }

    if (sourceType === 'survey_deposit_order' && bookingId) {
      void Taro.redirectTo({
        url: `/pages/orders/survey-deposit/index?id=${bookingId}${entryKey ? `&entryKey=${encodeURIComponent(entryKey)}` : ''}`,
      });
      return;
    }

    if (bookingId) {
      void Taro.redirectTo({ url: `/pages/booking/detail/index?id=${bookingId}` });
      return;
    }

    void Taro.switchTab({ url: '/pages/profile/index' });
  }, [bookingId, entryKey, returnUrl, sourceType]);

  const finishPayment = useCallback((targetPaymentId: number, status: 'paid' | 'closed' | 'failed' | 'expired') => {
    stopTracking();
    publishPaymentRefreshNotice({
      paymentId: targetPaymentId,
      status,
      at: Date.now(),
    });

    if (status === 'paid') {
      Taro.showToast({ title: '支付成功', icon: 'success' });
    }

    navigateBackToSource();
  }, [navigateBackToSource, stopTracking]);

  const finishQrPayment = useCallback((targetPaymentId: number) => {
    stopTracking();
    clearQrSuccessTimer();
    clearManualFeedbackLock();
    setQrConfirmLoading(false);
    setRemainingSeconds(0);
    setQrPayment((current) => (
      current
        ? { ...current, phase: 'success', statusText: QR_SUCCESS_TEXT, statusTone: 'success' }
        : current
    ));

    qrSuccessTimerRef.current = setTimeout(() => {
      finishPayment(targetPaymentId, 'paid');
    }, 1200);
  }, [clearManualFeedbackLock, clearQrSuccessTimer, finishPayment, stopTracking]);

  const markQrExpired = useCallback(() => {
    stopTracking();
    clearQrSuccessTimer();
    clearManualFeedbackLock();
    setQrConfirmLoading(false);
    setRemainingSeconds(0);
    setQrPayment((current) => (
      current
        ? { ...current, phase: 'expired', statusText: QR_EXPIRED_TEXT, statusTone: 'error' }
        : current
    ));
  }, [clearManualFeedbackLock, clearQrSuccessTimer, stopTracking]);

  const startCountdown = useCallback((expiresAt?: string) => {
    if (!expiresAt) {
      setRemainingSeconds(0);
      return;
    }

    const update = () => {
      const diff = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setRemainingSeconds(diff);
      if (diff <= 0) {
        markQrExpired();
      }
    };

    update();
    countdownTimerRef.current = setInterval(update, 1000);
  }, [markQrExpired]);

  const pollPaymentStatus = useCallback(async (
    targetPaymentId: number,
    options: { forQrDialog: boolean; expiresAt?: string; manual?: boolean },
  ) => {
    const { forQrDialog, expiresAt, manual = false } = options;
    if (manual && forQrDialog) {
      holdManualFeedbackLock();
      setQrConfirmLoading(true);
      setQrPayment((current) => (
        current
          ? {
              ...current,
              phase: 'checking',
              statusText: QR_MANUAL_CHECKING_TEXT,
              statusTone: 'default',
            }
          : current
      ));
    }

    try {
      const status = await getPaymentStatus(targetPaymentId);
      if (status.status === 'paid') {
        if (forQrDialog) {
          finishQrPayment(targetPaymentId);
        } else {
          finishPayment(targetPaymentId, 'paid');
        }
        return;
      }
      if (status.status === 'closed') {
        if (forQrDialog) {
          markQrExpired();
        } else {
          stopTracking();
          setStatusText('支付已关闭，可重新发起支付');
        }
        return;
      }
      if (status.status === 'failed') {
        if (forQrDialog) {
          markQrExpired();
        } else {
          stopTracking();
          setStatusText('支付失败，请稍后重试');
        }
        return;
      }
      if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
        if (forQrDialog) {
          markQrExpired();
        } else {
          stopTracking();
          setStatusText('支付已过期，请重新发起支付');
        }
        return;
      }
      if (forQrDialog) {
        if (manual) {
          keepManualFeedbackVisible();
          setQrPayment((current) => (
            current
              ? {
                  ...current,
                  phase: 'waiting',
                  statusText: QR_MANUAL_PENDING_TEXT,
                  statusTone: 'warning',
                }
              : current
          ));
          return;
        }

        if (hasManualFeedbackLock()) {
          return;
        }

        setQrPayment((current) => (
          current
            ? {
                ...current,
                phase: 'waiting',
                statusText: QR_WAITING_TEXT,
                statusTone: 'default',
              }
            : current
        ));
      } else {
        setStatusText('已打开支付宝页面，请完成支付后返回当前页面');
      }
    } catch (_error) {
      if (forQrDialog) {
        if (manual) {
          keepManualFeedbackVisible();
          setQrPayment((current) => (
            current
              ? {
                  ...current,
                  phase: 'waiting',
                  statusText: QR_MANUAL_RETRY_TEXT,
                  statusTone: 'warning',
                }
              : current
          ));
          return;
        }

        if (hasManualFeedbackLock()) {
          return;
        }

        setQrPayment((current) => (
          current
            ? {
                ...current,
                phase: current.phase,
                statusText: current.statusText,
                statusTone: current.statusTone,
              }
            : current
        ));
      } else {
        setStatusText('支付结果确认中，请稍后返回查看');
      }
    } finally {
      if (manual && forQrDialog) {
        setQrConfirmLoading(false);
      }
    }
  }, [
    finishPayment,
    finishQrPayment,
    hasManualFeedbackLock,
    holdManualFeedbackLock,
    keepManualFeedbackVisible,
    markQrExpired,
    stopTracking,
  ]);

  const startStatusPolling = useCallback((targetPaymentId: number, forQrDialog: boolean, expiresAt?: string) => {
    const poll = async () => {
      try {
        await pollPaymentStatus(targetPaymentId, { forQrDialog, expiresAt });
      } catch (_error) {
        return;
      }
    };

    void poll();
    pollingTimerRef.current = setInterval(() => {
      void poll();
    }, 2500);
  }, [pollPaymentStatus]);

  const handleClose = useCallback(() => {
    stopTracking();
    navigateBackToSource();
  }, [navigateBackToSource, stopTracking]);

  const handleFallbackQr = useCallback(async () => {
    if (!bookingId) {
      Taro.showToast({ title: '支付参数缺失', icon: 'none' });
      return;
    }

    setFallbackLoading(true);
    try {
      const launch = entryKey
        ? await payOrderCenterEntry(entryKey, { channel: 'alipay', terminalType: 'mini_qr' })
        : await paySurveyDeposit(bookingId, 'alipay', 'mini_qr');
      const qrCodeImageUrl = normalizePaymentLaunchUrl(launch.qrCodeImageUrl);
      if (launch.launchMode !== 'qr_code' || !qrCodeImageUrl) {
        throw new Error('支付二维码生成失败');
      }

      setPaymentId(launch.paymentId);
      stopTracking();
      clearManualFeedbackLock();
      setQrPayment({
        paymentId: launch.paymentId,
        amount,
        qrCodeImageUrl,
        expiresAt: launch.expiresAt,
        phase: 'waiting',
        statusText: QR_WAITING_TEXT,
        statusTone: 'default',
      });
      startCountdown(launch.expiresAt);
      startStatusPolling(launch.paymentId, true, launch.expiresAt);
    } catch (error) {
      if (isRealNameRequiredError(error)) {
        Taro.showToast({ title: '支付前请先完成实名认证', icon: 'none' });
        navigateToRealNameVerification(returnUrl || undefined);
        return;
      }
      showErrorToast(error, '发起二维码支付失败');
    } finally {
      setFallbackLoading(false);
    }
  }, [
    amount,
    bookingId,
    clearManualFeedbackLock,
    entryKey,
    startCountdown,
    startStatusPolling,
    stopTracking,
    returnUrl,
  ]);

  useLoad((options) => {
    setPaymentId(Number(options.paymentId || 0));
    setBookingId(Number(options.bookingId || 0));
    setEntryKey(options.entryKey ? decodeURIComponent(options.entryKey) : '');
    setReturnUrl(options.returnUrl ? decodeURIComponent(options.returnUrl) : '');
    setSourceType(options.sourceType === 'survey_deposit_order' ? 'survey_deposit_order' : 'booking_detail');
    setLaunchUrl(normalizePaymentLaunchUrl(options.launchUrl ? decodeURIComponent(options.launchUrl) : ''));
    setAmount(Number(options.amount || 0));
    setAmountLabel(options.amountLabel ? decodeURIComponent(options.amountLabel) : '待支付金额');
  });

  useEffect(() => {
    if (!paymentId) {
      return;
    }
    skipNextShowRef.current = true;
    stopTracking();
    startStatusPolling(paymentId, false);
  }, [paymentId, startStatusPolling, stopTracking]);

  useDidShow(() => {
    if (!paymentId || qrPayment) {
      return;
    }
    if (skipNextShowRef.current) {
      skipNextShowRef.current = false;
      return;
    }
    stopTracking();
    startStatusPolling(paymentId, false);
  });

  useDidHide(() => {
    stopTracking();
  });

  useEffect(() => () => {
    stopTracking();
    clearQrSuccessTimer();
    clearManualFeedbackLock();
  }, [clearManualFeedbackLock, clearQrSuccessTimer, stopTracking]);

  const confirmQrPayment = useCallback(async () => {
    if (!qrPayment || qrConfirmLoading) {
      return;
    }
    await pollPaymentStatus(qrPayment.paymentId, {
      forQrDialog: true,
      expiresAt: qrPayment.expiresAt,
      manual: true,
    });
  }, [pollPaymentStatus, qrConfirmLoading, qrPayment]);

  const amountText = useMemo(() => formatAmount(amount), [amount]);

  return (
    <View className="payment-webview-page">
      <MiniPageNav title="支付宝支付" onBack={handleClose} placeholder />

      <View className="payment-webview-page__body">
        <View className="payment-webview-page__summary">
          <Text className="payment-webview-page__label">{amountLabel}</Text>
          <Text className="payment-webview-page__amount">{amountText}</Text>
          <Text className="payment-webview-page__status">{statusText}</Text>
        </View>

        {launchUrl ? (
          <View className="payment-webview-page__viewer">
            <WebView src={launchUrl} />
          </View>
        ) : (
          <View className="payment-webview-page__empty">
            <Text className="payment-webview-page__empty-title">支付页面地址缺失</Text>
            <Text className="payment-webview-page__empty-desc">请返回上一页重新发起支付</Text>
          </View>
        )}
      </View>

      <View className="payment-webview-page__footer">
        <Button
          variant="outline"
          block
          loading={fallbackLoading}
          disabled={fallbackLoading}
          onClick={() => {
            void handleFallbackQr();
          }}
        >
          改用支付宝扫码支付
        </Button>
        <Button variant="primary" block onClick={handleClose}>
          关闭
        </Button>
      </View>

      {qrPayment ? (
        <SurveyDepositQrDialog
          amount={qrPayment.amount}
          classNamePrefix="payment-webview-page"
          onClose={() => {
            stopTracking();
            clearQrSuccessTimer();
            clearManualFeedbackLock();
            setQrConfirmLoading(false);
            setQrPayment(null);
            setRemainingSeconds(0);
            if (paymentId) {
              startStatusPolling(paymentId, false);
            }
          }}
          onConfirmPaid={() => {
            void confirmQrPayment();
          }}
          onRetry={() => {
            void handleFallbackQr();
          }}
          phase={qrPayment.phase}
          confirmLoading={qrConfirmLoading}
          qrCodeImageUrl={qrPayment.qrCodeImageUrl}
          remainingSeconds={remainingSeconds}
          statusText={qrPayment.statusText}
          statusTone={qrPayment.statusTone}
        />
      ) : null}
    </View>
  );
};

export default SurveyDepositPaymentWebviewPage;
