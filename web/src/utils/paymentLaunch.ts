import type { PaymentLaunchPayload, PaymentLaunchRequest } from '../services/payments';
import { usePaymentDialogStore } from '../modules/payment/paymentDialogStore';
import { detectTerminalType } from './terminal';

interface WebPaymentLaunchOptions {
  onPaid?: () => void | Promise<void>;
}

export function buildAlipayWebLaunchRequest(): PaymentLaunchRequest {
  return {
    channel: 'alipay',
    terminalType: detectTerminalType() === 'mobile_h5' ? 'mobile_h5' : 'mini_qr',
  };
}

export function handleWebPaymentLaunch(payload: PaymentLaunchPayload, options: WebPaymentLaunchOptions = {}) {
  if (!payload || !payload.paymentId) {
    usePaymentDialogStore.getState().closeDialog();
    throw new Error('支付单创建失败，请稍后重试。');
  }

  switch (payload.launchMode) {
    case 'redirect': {
      usePaymentDialogStore.getState().closeDialog();
      const launchUrl = String(payload.launchUrl || '').trim();
      if (!launchUrl) {
        throw new Error('支付宝支付链接缺失，请稍后重试。');
      }
      window.location.assign(launchUrl);
      return;
    }
    case 'qr_code': {
      const qrCodeImageUrl = String(payload.qrCodeImageUrl || '').trim();
      if (!qrCodeImageUrl) {
        usePaymentDialogStore.getState().closeDialog();
        throw new Error('支付宝支付二维码缺失，请稍后重试。');
      }
      usePaymentDialogStore.getState().openDialog(payload, { onPaid: options.onPaid });
      return;
    }
    default:
      usePaymentDialogStore.getState().closeDialog();
      throw new Error('当前支付方式暂不支持在网页端发起，请稍后重试。');
  }
}

export async function startAlipayWebPayment(
  launcher: (request: PaymentLaunchRequest) => Promise<PaymentLaunchPayload>,
  options?: WebPaymentLaunchOptions,
) {
  const payload = await launcher(buildAlipayWebLaunchRequest());
  handleWebPaymentLaunch(payload, options);
  return payload;
}
