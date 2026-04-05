import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Taro, { useDidHide } from '@tarojs/taro';

import { miniPaymentAdapter } from '@/adapters/payment';
import { paySurveyDeposit, type SurveyDepositPaymentOption } from '@/services/bookings';
import {
  getPaymentStatus,
  normalizePaymentLaunchUrl,
  type MiniPaymentLaunchResponse,
} from '@/services/payments';
import { showErrorToast } from '@/utils/error';
import { buildSurveyDepositPaymentWebviewUrl } from '@/utils/orderRoutes';
import {
  chooseSurveyDepositPaymentAction,
  getSurveyDepositChannelOptions,
  resolveSurveyDepositTerminalType,
  type SurveyDepositPaymentAction,
  type SurveyDepositPaymentSource,
} from '@/utils/surveyDepositPayment';

export type SurveyDepositQrPaymentState = MiniPaymentLaunchResponse & {
  amount: number;
  statusText: string;
  expired: boolean;
};

interface UseSurveyDepositPaymentFlowOptions {
  bookingId?: number;
  amount?: number;
  paymentOptions?: SurveyDepositPaymentOption[];
  autoLaunchAction?: SurveyDepositPaymentAction | null;
  isPaid?: boolean;
  source?: SurveyDepositPaymentSource;
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
  onPaid,
  launchPayment,
}: UseSurveyDepositPaymentFlowOptions) => {
  const [launchingAction, setLaunchingAction] = useState<SurveyDepositPaymentAction | null>(null);
  const [qrPayment, setQrPayment] = useState<SurveyDepositQrPaymentState | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoLaunchTriggeredRef = useRef(false);

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

  const closeQrPayment = useCallback(() => {
    stopPaymentTracking();
    setRemainingSeconds(0);
    setQrPayment(null);
  }, [stopPaymentTracking]);

  const markQrExpired = useCallback(() => {
    stopPaymentTracking();
    setRemainingSeconds(0);
    setQrPayment((current) => (
      current
        ? { ...current, expired: true, statusText: '二维码已失效，请重新发起支付' }
        : current
    ));
  }, [stopPaymentTracking]);

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

  const startStatusPolling = useCallback((paymentId: number, forQrDialog: boolean, expiresAt?: string) => {
    const poll = async () => {
      try {
        const status = await getPaymentStatus(paymentId);
        if (status.status === 'paid') {
          stopPaymentTracking();
          setQrPayment(null);
          setRemainingSeconds(0);
          Taro.showToast({ title: '支付成功', icon: 'success' });
          await onPaid?.();
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
          setQrPayment((current) => (
            current
              ? { ...current, statusText: '请使用支付宝扫码完成支付' }
              : current
          ));
        }
      } catch (error) {
        if (forQrDialog) {
          setQrPayment((current) => (
            current
              ? { ...current, statusText: '支付结果确认中，请稍后刷新' }
              : current
          ));
        }
      }
    };

    void poll();
    pollingTimerRef.current = setInterval(() => {
      void poll();
    }, 2500);
  }, [markQrExpired, onPaid, stopPaymentTracking]);

  const openAlipayWebview = useCallback(async (launch: MiniPaymentLaunchResponse) => {
    if (!bookingId || !source) {
      throw new Error('支付承接页参数缺失');
    }

    const launchUrl = normalizePaymentLaunchUrl(launch.launchUrl);
    if (!launchUrl) {
      throw new Error('支付跳转地址缺失');
    }

    await Taro.navigateTo({
      url: buildSurveyDepositPaymentWebviewUrl({
        paymentId: launch.paymentId,
        launchUrl,
        sourceType: source.sourceType,
        bookingId,
        amount,
        entryKey: source.sourceType === 'survey_deposit_order'
          ? source.entryKey
          : undefined,
      }),
    });
  }, [amount, bookingId, source]);

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
          stopPaymentTracking();
          setQrPayment({
            ...launch,
            qrCodeImageUrl,
            amount,
            statusText: '请使用支付宝扫码完成支付',
            expired: false,
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
    launchPayment,
    launchingAction,
    openAlipayWebview,
    startCountdown,
    startStatusPolling,
    stopPaymentTracking,
  ]);

  const chooseAndLaunch = useCallback(async () => {
    if (channelOptions.length === 0) {
      Taro.showToast({ title: '当前预约暂不可支付', icon: 'none' });
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

  useEffect(() => {
    autoLaunchTriggeredRef.current = false;
  }, [autoLaunchAction, bookingId]);

  useEffect(() => {
    if (!autoLaunchAction || autoLaunchTriggeredRef.current || !bookingId || launchingAction || qrPayment || isPaid) {
      return;
    }
    const matched = findAutoLaunchAction(channelOptions, autoLaunchAction);
    if (!matched) {
      return;
    }
    autoLaunchTriggeredRef.current = true;
    void launchPaymentByAction(matched);
  }, [autoLaunchAction, bookingId, channelOptions, isPaid, launchPaymentByAction, launchingAction, qrPayment]);

  useDidHide(() => {
    stopPaymentTracking();
  });

  useEffect(() => () => {
    stopPaymentTracking();
  }, [stopPaymentTracking]);

  return {
    launchingAction,
    launchingChannel: launchingAction?.channel || null,
    qrPayment,
    remainingSeconds,
    closeQrPayment,
    launchPaymentByAction,
    chooseAndLaunch,
    canPay: !isPaid && channelOptions.length > 0,
    canPayWithWechat: channelOptions.some((option) => option.channel === 'wechat'),
    canPayWithAlipay: channelOptions.some((option) => option.channel === 'alipay'),
  };
};
