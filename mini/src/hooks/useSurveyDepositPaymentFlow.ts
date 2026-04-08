import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Taro, { useDidHide } from '@tarojs/taro';

import type {
  SurveyDepositQrDialogPhase,
  SurveyDepositQrDialogStatusTone,
} from '@/components/SurveyDepositQrDialog';
import { miniPaymentAdapter } from '@/adapters/payment';
import {
  QR_EXPIRED_TEXT,
  QR_MANUAL_CHECKING_TEXT,
  QR_MANUAL_FEEDBACK_HOLD_MS,
  QR_MANUAL_PENDING_TEXT,
  QR_MANUAL_RETRY_TEXT,
  QR_SUCCESS_TEXT,
  QR_WAITING_TEXT,
} from '@/constants/paymentQr';
import { paySurveyDeposit, type SurveyDepositPaymentOption } from '@/services/bookings';
import {
  getPaymentStatus,
  normalizePaymentLaunchUrl,
  type MiniPaymentLaunchResponse,
} from '@/services/payments';
import { showErrorToast } from '@/utils/error';
import { buildPaymentWebviewUrl } from '@/utils/orderRoutes';
import {
  chooseSurveyDepositPaymentAction,
  getSurveyDepositChannelOptions,
  resolveSurveyDepositTerminalType,
  type SurveyDepositPaymentAction,
} from '@/utils/surveyDepositPayment';

export type SurveyDepositQrPaymentState = MiniPaymentLaunchResponse & {
  amount: number;
  phase: SurveyDepositQrDialogPhase;
  statusText: string;
  statusTone: SurveyDepositQrDialogStatusTone;
};

export type EntryPaymentFlowSource = {
  returnUrl: string;
  bookingId?: number;
  entryKey?: string;
};

interface UseSurveyDepositPaymentFlowOptions {
  bookingId?: number;
  amount?: number;
  paymentOptions?: SurveyDepositPaymentOption[];
  autoLaunchAction?: SurveyDepositPaymentAction | null;
  isPaid?: boolean;
  source?: EntryPaymentFlowSource;
  amountLabel?: string;
  onPaid?: () => Promise<void> | void;
  launchPayment?: (action: SurveyDepositPaymentAction) => Promise<MiniPaymentLaunchResponse>;
}

const isSamePaymentAction = (
  left?: Pick<SurveyDepositPaymentAction, 'channel' | 'launchMode'> | null,
  right?: Pick<SurveyDepositPaymentAction, 'channel' | 'launchMode'> | null,
) => left?.channel === right?.channel && left?.launchMode === right?.launchMode;

const findAutoLaunchAction = (
  actions: SurveyDepositPaymentAction[],
  target?: SurveyDepositPaymentAction | null,
) => {
  if (!target) {
    return null;
  }

  const exact = actions.find((item) => isSamePaymentAction(item, target));
  if (exact) {
    return exact;
  }

  return actions.find((item) => item.channel === target.channel) || null;
};

export const useSurveyDepositPaymentFlow = ({
  bookingId,
  amount = 0,
  paymentOptions,
  autoLaunchAction,
  isPaid = false,
  source,
  amountLabel,
  onPaid,
  launchPayment,
}: UseSurveyDepositPaymentFlowOptions) => {
  const [launchingAction, setLaunchingAction] = useState<SurveyDepositPaymentAction | null>(null);
  const [qrPayment, setQrPayment] = useState<SurveyDepositQrPaymentState | null>(null);
  const [qrConfirmLoading, setQrConfirmLoading] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoLaunchTriggeredRef = useRef(false);
  const lastQrActionRef = useRef<SurveyDepositPaymentAction | null>(null);
  const manualFeedbackUntilRef = useRef(0);

  const channelOptions = useMemo(
    () => getSurveyDepositChannelOptions(paymentOptions),
    [paymentOptions],
  );

  const stopPaymentTracking = useCallback(() => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  }, []);

  const clearSuccessTimer = useCallback(() => {
    if (successTimerRef.current) {
      clearTimeout(successTimerRef.current);
      successTimerRef.current = null;
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

  const closeQrPayment = useCallback(() => {
    stopPaymentTracking();
    clearSuccessTimer();
    clearManualFeedbackLock();
    setQrConfirmLoading(false);
    setRemainingSeconds(0);
    setQrPayment(null);
    void onPaid?.();
  }, [clearManualFeedbackLock, clearSuccessTimer, onPaid, stopPaymentTracking]);

  const markQrExpired = useCallback(() => {
    stopPaymentTracking();
    clearSuccessTimer();
    clearManualFeedbackLock();
    setQrConfirmLoading(false);
    setRemainingSeconds(0);
    setQrPayment((current) => (
      current
        ? { ...current, phase: 'expired', statusText: QR_EXPIRED_TEXT, statusTone: 'error' }
        : current
    ));
  }, [clearManualFeedbackLock, clearSuccessTimer, stopPaymentTracking]);

  const finishQrPayment = useCallback(async () => {
    stopPaymentTracking();
    clearSuccessTimer();
    clearManualFeedbackLock();
    setQrConfirmLoading(false);
    setRemainingSeconds(0);
    setQrPayment((current) => (
      current
        ? { ...current, phase: 'success', statusText: QR_SUCCESS_TEXT, statusTone: 'success' }
        : current
    ));

    successTimerRef.current = setTimeout(() => {
      setQrPayment(null);
      Taro.showToast({ title: '支付成功', icon: 'success' });
      void onPaid?.();
    }, 1200);
  }, [clearManualFeedbackLock, clearSuccessTimer, onPaid, stopPaymentTracking]);

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
    paymentId: number,
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
      const status = await getPaymentStatus(paymentId);
      if (status.status === 'paid') {
        if (forQrDialog) {
          await finishQrPayment();
        } else {
          stopPaymentTracking();
          setQrPayment(null);
          setRemainingSeconds(0);
          Taro.showToast({ title: '支付成功', icon: 'success' });
          await onPaid?.();
        }
        return;
      }

      if (status.status === 'closed' || status.status === 'failed') {
        if (forQrDialog) {
          markQrExpired();
        } else {
          stopPaymentTracking();
        }
        return;
      }

      if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
        if (forQrDialog) {
          markQrExpired();
        } else {
          stopPaymentTracking();
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
      }
    } finally {
      if (manual && forQrDialog) {
        setQrConfirmLoading(false);
      }
    }
  }, [
    finishQrPayment,
    hasManualFeedbackLock,
    holdManualFeedbackLock,
    keepManualFeedbackVisible,
    markQrExpired,
    onPaid,
    stopPaymentTracking,
  ]);

  const startStatusPolling = useCallback((paymentId: number, forQrDialog: boolean, expiresAt?: string) => {
    const poll = async () => {
      try {
        await pollPaymentStatus(paymentId, { forQrDialog, expiresAt });
      } catch (_error) {
        return;
      }
    };

    void poll();
    pollingTimerRef.current = setInterval(() => {
      void poll();
    }, 2500);
  }, [pollPaymentStatus]);

  const openAlipayWebview = useCallback(async (launch: MiniPaymentLaunchResponse) => {
    if (!source?.returnUrl) {
      throw new Error('支付承接页参数缺失');
    }

    const launchUrl = normalizePaymentLaunchUrl(launch.launchUrl);
    if (!launchUrl) {
      throw new Error('支付跳转地址缺失');
    }

    await Taro.navigateTo({
      url: buildPaymentWebviewUrl({
        paymentId: launch.paymentId,
        launchUrl,
        returnUrl: source.returnUrl,
        bookingId: source.bookingId || bookingId,
        amount,
        entryKey: source.entryKey,
        amountLabel,
      }),
    });
  }, [amount, amountLabel, bookingId, source]);

  const launchPaymentByAction = useCallback(async (action: SurveyDepositPaymentAction) => {
    if ((!bookingId && !launchPayment) || launchingAction) {
      return false;
    }

    setLaunchingAction(action);
    try {
      const launch = launchPayment
        ? await launchPayment(action)
        : await paySurveyDeposit(bookingId!, action.channel, resolveSurveyDepositTerminalType(action));

      switch (launch.launchMode) {
        case 'wechat_jsapi':
          if (!launch.wechatPayParams) {
            throw new Error('微信支付参数缺失');
          }
          try {
            await miniPaymentAdapter.requestPayment(launch.wechatPayParams);
          } catch (error) {
            const err = error as { errMsg?: string } | undefined;
            if (err?.errMsg?.includes('cancel')) {
              Taro.showToast({ title: '已取消支付', icon: 'none' });
              return false;
            }
            throw error;
          }
          stopPaymentTracking();
          startStatusPolling(launch.paymentId, false, launch.expiresAt);
          return true;
        case 'redirect':
          stopPaymentTracking();
          setQrPayment(null);
          setRemainingSeconds(0);
          await openAlipayWebview(launch);
          return true;
        case 'qr_code': {
          const qrCodeImageUrl = normalizePaymentLaunchUrl(launch.qrCodeImageUrl);
          if (!qrCodeImageUrl) {
            throw new Error('支付二维码生成失败');
          }
          lastQrActionRef.current = action;
          clearSuccessTimer();
          clearManualFeedbackLock();
          setQrConfirmLoading(false);
          stopPaymentTracking();
          setQrPayment({
            ...launch,
            qrCodeImageUrl,
            amount,
            phase: 'waiting',
            statusText: QR_WAITING_TEXT,
            statusTone: 'default',
          });
          startCountdown(launch.expiresAt);
          startStatusPolling(launch.paymentId, true, launch.expiresAt);
          return true;
        }
        default:
          throw new Error('当前支付方式暂不可用');
      }
    } catch (error) {
      showErrorToast(error, '发起支付失败');
      return false;
    } finally {
      setLaunchingAction(null);
    }
  }, [
    amount,
    bookingId,
    clearManualFeedbackLock,
    clearSuccessTimer,
    launchPayment,
    launchingAction,
    openAlipayWebview,
    startCountdown,
    startStatusPolling,
    stopPaymentTracking,
  ]);

  const chooseAndLaunch = useCallback(async () => {
    if (channelOptions.length === 0) {
      Taro.showToast({ title: '当前暂不可支付', icon: 'none' });
      return false;
    }

    try {
      const selectedAction = await chooseSurveyDepositPaymentAction(channelOptions);
      if (!selectedAction) {
        return false;
      }
      return launchPaymentByAction(selectedAction);
    } catch (error) {
      showErrorToast(error, '选择支付方式失败');
      return false;
    }
  }, [channelOptions, launchPaymentByAction]);

  const confirmQrPayment = useCallback(async () => {
    if (!qrPayment || qrConfirmLoading) {
      return false;
    }
    await pollPaymentStatus(qrPayment.paymentId, {
      forQrDialog: true,
      expiresAt: qrPayment.expiresAt,
      manual: true,
    });
    return true;
  }, [pollPaymentStatus, qrConfirmLoading, qrPayment]);

  const retryQrPayment = useCallback(async () => {
    const action = lastQrActionRef.current;
    if (!action || launchingAction) {
      return false;
    }
    return launchPaymentByAction(action);
  }, [launchPaymentByAction, launchingAction]);

  useEffect(() => {
    autoLaunchTriggeredRef.current = false;
  }, [autoLaunchAction, bookingId]);

  useEffect(() => {
    if (
      !autoLaunchAction
      || autoLaunchTriggeredRef.current
      || launchingAction
      || qrPayment
      || isPaid
      || (!bookingId && !launchPayment)
    ) {
      return;
    }
    const matched = findAutoLaunchAction(channelOptions, autoLaunchAction);
    if (!matched) {
      return;
    }
    autoLaunchTriggeredRef.current = true;
    void launchPaymentByAction(matched);
  }, [autoLaunchAction, bookingId, channelOptions, isPaid, launchPayment, launchPaymentByAction, launchingAction, qrPayment]);

  useDidHide(() => {
    stopPaymentTracking();
  });

  useEffect(() => () => {
    stopPaymentTracking();
    clearSuccessTimer();
    clearManualFeedbackLock();
  }, [clearManualFeedbackLock, clearSuccessTimer, stopPaymentTracking]);

  return {
    launchingAction,
    launchingChannel: launchingAction?.channel || null,
    qrPayment,
    qrConfirmLoading,
    remainingSeconds,
    closeQrPayment,
    confirmQrPayment,
    retryQrPayment,
    launchPaymentByAction,
    chooseAndLaunch,
    canPay: !isPaid && channelOptions.length > 0,
    canPayWithWechat: channelOptions.some((option) => option.channel === 'wechat'),
    canPayWithAlipay: channelOptions.some((option) => option.channel === 'alipay'),
  };
};
