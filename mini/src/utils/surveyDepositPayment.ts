import Taro from '@tarojs/taro';

import {
  getBookingDetail,
  type BookingDetailResponse,
  type SurveyDepositPaymentOption,
} from '@/services/bookings';
import type { OrderCenterSourceKind } from '@/services/orderCenter';
import type { PaymentChannel, PaymentLaunchMode } from '@/services/payments';
import { showErrorToast } from '@/utils/error';

import { buildSurveyDepositDetailUrl } from './orderRoutes';

export type SurveyDepositTerminalType =
  | 'mini_wechat_jsapi'
  | 'mobile_h5'
  | 'mini_qr';

export type SurveyDepositPaymentAction = {
  channel: PaymentChannel;
  label: string;
  launchMode: PaymentLaunchMode;
};

export type SurveyDepositPaymentSource =
  | {
      sourceType: 'booking_detail';
      bookingId: number;
    }
  | {
      sourceType: 'survey_deposit_order';
      bookingId: number;
      entryKey?: string;
    };

export const getSurveyDepositAmount = (detail: BookingDetailResponse) => {
  const surveyDeposit = Number(detail.surveyDepositAmount || detail.booking.surveyDeposit || 0);
  if (surveyDeposit > 0) {
    return surveyDeposit;
  }
  return 0;
};

export const getSurveyDepositChannelOptions = (
  options?: SurveyDepositPaymentOption[],
): SurveyDepositPaymentAction[] => {
  return (options || [])
    .filter((option) => {
      if (option.channel !== 'wechat' && option.channel !== 'alipay') {
        return false;
      }
      return (
        option.launchMode === 'wechat_jsapi'
        || option.launchMode === 'redirect'
        || option.launchMode === 'qr_code'
      );
    })
    .map((option) => ({
      channel: option.channel,
      label: option.label || (option.channel === 'wechat' ? '微信支付' : '支付宝支付'),
      launchMode: option.launchMode,
    }));
};

export const chooseSurveyDepositPaymentAction = async (
  paymentActions: SurveyDepositPaymentAction[],
): Promise<SurveyDepositPaymentAction | null> => {
  if (paymentActions.length === 0) {
    Taro.showToast({ title: '当前暂不可支付', icon: 'none' });
    return null;
  }

  if (paymentActions.length === 1) {
    return paymentActions[0];
  }

  try {
    const result = await Taro.showActionSheet({
      itemList: paymentActions.map((option) => option.label),
    });
    return paymentActions[result.tapIndex] || null;
  } catch (error) {
    const actionSheetError = error as { errMsg?: string } | undefined;
    if (actionSheetError?.errMsg?.includes('cancel')) {
      return null;
    }
    throw error;
  }
};

export const findSurveyDepositPaymentAction = (
  paymentActions: SurveyDepositPaymentAction[],
  channel?: PaymentChannel | null,
  launchMode?: PaymentLaunchMode | null,
) => {
  if (!channel) {
    return null;
  }
  return paymentActions.find((option) => (
    option.channel === channel && (!launchMode || option.launchMode === launchMode)
  )) || paymentActions.find((option) => option.channel === channel) || null;
};

export const resolveSurveyDepositTerminalType = (
  action: Pick<SurveyDepositPaymentAction, 'channel' | 'launchMode'>,
): SurveyDepositTerminalType => {
  if (action.channel === 'wechat') {
    return 'mini_wechat_jsapi';
  }
  if (action.launchMode === 'redirect') {
    return 'mobile_h5';
  }
  return 'mini_qr';
};

export const normalizeSurveyDepositPaymentAction = (
  action?: Partial<SurveyDepositPaymentAction> | null,
): SurveyDepositPaymentAction | null => {
  if (!action?.channel || !action.launchMode) {
    return null;
  }
  if (action.channel !== 'wechat' && action.channel !== 'alipay') {
    return null;
  }
  if (
    action.launchMode !== 'wechat_jsapi'
    && action.launchMode !== 'redirect'
    && action.launchMode !== 'qr_code'
  ) {
    return null;
  }
  return {
    channel: action.channel,
    launchMode: action.launchMode,
    label: action.label || (
      action.channel === 'wechat'
        ? '微信支付'
        : action.launchMode === 'qr_code'
          ? '支付宝扫码支付'
          : '支付宝支付'
    ),
  };
};

export const navigateToSurveyDepositPayment = async (bookingId: number, orderNo?: string) => {
  return navigateToSurveyDepositPaymentWithOptions(bookingId, undefined, orderNo);
};

export const navigateToSurveyDepositPaymentWithOptions = async (
  bookingId: number,
  paymentOptions?: SurveyDepositPaymentOption[],
  orderNo?: string,
  entryKey?: string,
) => {
  try {
    const detail = paymentOptions
      ? { booking: { id: bookingId }, surveyDepositPaymentOptions: paymentOptions }
      : await getBookingDetail(bookingId);
    const paymentActions = getSurveyDepositChannelOptions(detail.surveyDepositPaymentOptions);
    if (paymentActions.length === 0) {
      Taro.navigateTo({
        url: buildSurveyDepositDetailUrl(bookingId, {
          orderNo,
          entryKey,
        }),
      });
      return true;
    }

    const selectedAction = await chooseSurveyDepositPaymentAction(paymentActions);
    if (!selectedAction) {
      return false;
    }

    Taro.navigateTo({
      url: buildSurveyDepositDetailUrl(bookingId, {
        autoPayChannel: selectedAction.channel,
        autoPayLaunchMode: selectedAction.launchMode,
        orderNo,
        entryKey,
      }),
    });
    return true;
  } catch (error) {
    showErrorToast(error, '获取支付方式失败');
    return false;
  }
};

export const openSurveyDepositDetail = (bookingId: number, orderNo?: string, entryKey?: string) => {
  Taro.navigateTo({
    url: buildSurveyDepositDetailUrl(bookingId, { orderNo, entryKey }),
  });
};

export const mapPendingRouteTypeToSourceKind = (value?: string): OrderCenterSourceKind | undefined => {
  switch (String(value || '').trim()) {
    case 'intent_fee':
    case 'survey_deposit':
    case 'survey_deposit_fee':
      return 'survey_deposit';
    case 'design_fee':
      return 'design_order';
    case 'construction_fee':
      return 'construction_order';
    case 'material_fee':
      return 'material_order';
    default:
      return undefined;
  }
};
