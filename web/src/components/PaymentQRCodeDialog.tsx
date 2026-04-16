import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import { usePaymentDialogStore } from '../modules/payment/paymentDialogStore';
import { getPaymentDetail, getPaymentStatus, type PaymentDetailPayload, type PaymentStatusPayload } from '../services/payments';
import { formatCurrency, formatDateTime } from '../utils/format';
import styles from './PaymentQRCodeDialog.module.scss';

const FINAL_PAYMENT_STATUSES = new Set(['paid', 'closed', 'failed']);
const QR_STATE_STATUSES = new Set(['paid', 'closed', 'failed']);

const STATUS_META: Record<string, { text: string; tone: 'success' | 'warning' | 'danger' | 'brand' }> = {
  created: { text: '待支付', tone: 'brand' },
  launching: { text: '拉起中', tone: 'warning' },
  pending: { text: '待支付', tone: 'warning' },
  scan_pending: { text: '已扫码待支付', tone: 'warning' },
  paid: { text: '已支付', tone: 'success' },
  closed: { text: '已关闭', tone: 'danger' },
  failed: { text: '支付失败', tone: 'danger' },
};

function resolveDialogError(rawError: string) {
  const message = String(rawError || '').trim();
  if (!message) {
    return '支付信息暂时加载失败，请稍后重试。';
  }
  if (message.includes('(404)')) {
    return '当前支付单暂时不可用，请关闭弹窗后重新发起支付。';
  }
  if (message.includes('无权查看')) {
    return '当前账号无法查看这笔支付，请确认你使用的是下单账号。';
  }
  if (message.includes('登录已过期')) {
    return '登录已失效，请重新登录后再次发起支付。';
  }
  return message;
}

function stripReferenceFromTitle(title: string, referenceNo: string) {
  const rawTitle = String(title || '').trim();
  const rawReference = String(referenceNo || '').trim();
  if (!rawTitle || !rawReference) {
    return rawTitle;
  }

  return rawTitle
    .replace(`#${rawReference}`, '')
    .replace(rawReference, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function CloseIcon() {
  return (
    <svg fill="none" viewBox="0 0 16 16">
      <path d="M4 4l8 8M12 4 4 12" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg fill="none" viewBox="0 0 20 20">
      <path
        d="M10 2.5 4.5 4.75v4.1c0 3.6 2.3 6.95 5.5 8.15 3.2-1.2 5.5-4.55 5.5-8.15v-4.1L10 2.5Z"
        fill="currentColor"
        opacity="0.14"
      />
      <path
        d="M10 2.5 4.5 4.75v4.1c0 3.6 2.3 6.95 5.5 8.15 3.2-1.2 5.5-4.55 5.5-8.15v-4.1L10 2.5Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
      <path d="m7.6 9.8 1.55 1.55 3.25-3.45" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.4" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg fill="none" viewBox="0 0 20 20">
      <rect height="11" rx="2" stroke="currentColor" strokeWidth="1.5" width="9" x="7" y="5" />
      <path d="M5 12.5H4A1.5 1.5 0 0 1 2.5 11V4A1.5 1.5 0 0 1 4 2.5h7A1.5 1.5 0 0 1 12.5 4v1" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
    </svg>
  );
}

function SuccessIcon() {
  return (
    <svg fill="none" viewBox="0 0 20 20">
      <circle cx="10" cy="10" fill="currentColor" opacity="0.14" r="7.25" />
      <circle cx="10" cy="10" r="7.25" stroke="currentColor" strokeWidth="1.5" />
      <path d="m7.2 10.25 1.95 1.95 3.65-4.05" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg fill="none" viewBox="0 0 20 20">
      <path d="M16.25 10A6.25 6.25 0 1 1 14.42 5.58" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
      <path d="M14.4 2.95v3.35h3.35" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
    </svg>
  );
}

export function PaymentQRCodeDialog() {
  const titleId = useId();
  const open = usePaymentDialogStore((state) => state.open);
  const payload = usePaymentDialogStore((state) => state.payload);
  const onPaid = usePaymentDialogStore((state) => state.onPaid);
  const paidHandled = usePaymentDialogStore((state) => state.paidHandled);
  const closeDialog = usePaymentDialogStore((state) => state.closeDialog);
  const markPaidHandled = usePaymentDialogStore((state) => state.markPaidHandled);

  const paymentId = payload?.paymentId || 0;
  const [detail, setDetail] = useState<PaymentDetailPayload | null>(null);
  const [status, setStatus] = useState<PaymentStatusPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [qrImageLoaded, setQrImageLoaded] = useState(false);

  const detailStatus = detail?.status;
  const paymentStatus = status?.status || detailStatus || 'pending';
  const statusText = status?.statusText || (detailStatus === paymentStatus ? detail?.statusText : '') || (STATUS_META[paymentStatus] || STATUS_META.pending).text;
  const amount = detail?.amount ?? status?.amount ?? 0;
  const amountText = amount > 0 ? formatCurrency(amount) : '待确认';
  const title = detail?.purposeText || detail?.subject || status?.subject || '支付设计费';
  const referenceNo = String(detail?.referenceNo || '').trim();
  const paymentNo = detail?.outTradeNo || `PAY-${paymentId}`;
  const headerTitle = stripReferenceFromTitle(title, referenceNo) || '订单支付';
  const expiresAt = detail?.expiresAt || status?.expiresAt || payload?.expiresAt;
  const terminalText = detail?.channelText || '支付宝';
  const currentStatusTone = paymentStatus === 'paid' ? 'success' : paymentStatus === 'closed' || paymentStatus === 'failed' ? 'danger' : 'warning';

  const amountParts = useMemo(() => {
    const normalized = amountText.replace(/^¥\s?/, '');
    const [integerPart, decimalPart = '00'] = normalized.split('.');
    return {
      integerPart,
      decimalPart,
    };
  }, [amountText]);

  const applySnapshot = useCallback(
    (nextDetail: PaymentDetailPayload | null, nextStatus: PaymentStatusPayload | null, nextError = '') => {
      const current = usePaymentDialogStore.getState();
      if (!current.open || current.payload?.paymentId !== paymentId) {
        return;
      }
      if (nextDetail) {
        setDetail(nextDetail);
      }
      if (nextStatus) {
        setStatus(nextStatus);
      }
      setError(nextError);
    },
    [paymentId],
  );

  const loadSnapshot = useCallback(
    async (mode: 'initial' | 'refresh' | 'poll') => {
      if (!paymentId) return;

      if (mode === 'initial') {
        setLoading(true);
      } else if (mode === 'refresh') {
        setRefreshing(true);
      }

      try {
        if (mode === 'poll') {
          const nextStatus = await getPaymentStatus(paymentId);
          applySnapshot(null, nextStatus);
          return;
        }

        const [detailResult, statusResult] = await Promise.allSettled([
          getPaymentDetail(paymentId),
          getPaymentStatus(paymentId),
        ]);

        const nextDetail = detailResult.status === 'fulfilled' ? detailResult.value : null;
        const nextStatus = statusResult.status === 'fulfilled' ? statusResult.value : null;
        const nextError = !nextDetail && !nextStatus
          ? resolveDialogError(
              detailResult.status === 'rejected'
                ? detailResult.reason instanceof Error
                  ? detailResult.reason.message
                  : '支付信息加载失败'
                : statusResult.status === 'rejected'
                  ? statusResult.reason instanceof Error
                    ? statusResult.reason.message
                    : '支付状态加载失败'
                  : '',
            )
          : '';

        applySnapshot(nextDetail, nextStatus, nextError);
      } catch (requestError) {
        if (mode === 'poll') {
          return;
        }
        applySnapshot(null, null, resolveDialogError(requestError instanceof Error ? requestError.message : '支付信息加载失败'));
      } finally {
        if (mode === 'initial') {
          setLoading(false);
        } else if (mode === 'refresh') {
          setRefreshing(false);
        }
      }
    },
    [applySnapshot, paymentId],
  );

  useEffect(() => {
    if (!open || !paymentId) {
      setDetail(null);
      setStatus(null);
      setError('');
      setLoading(false);
      setRefreshing(false);
      setCopied(false);
      return;
    }
    void loadSnapshot('initial');
  }, [loadSnapshot, open, paymentId]);

  useEffect(() => {
    setCopied(false);
  }, [paymentNo]);

  useEffect(() => {
    setQrImageLoaded(false);
  }, [payload?.qrCodeImageUrl]);

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeDialog();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeDialog, open]);

  useEffect(() => {
    if (!open || !paymentId || FINAL_PAYMENT_STATUSES.has(paymentStatus)) {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      void loadSnapshot('poll');
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [loadSnapshot, open, paymentId, paymentStatus]);

  useEffect(() => {
    if (!open || paymentStatus !== 'paid' || paidHandled || !onPaid) {
      return;
    }
    markPaidHandled();
    void Promise.resolve(onPaid()).catch(() => undefined);
  }, [markPaidHandled, onPaid, open, paidHandled, paymentStatus]);

  if (!open || !payload) {
    return null;
  }

  const handleCopyOrderNo = async () => {
    if (!paymentNo || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      return;
    }
    try {
      await navigator.clipboard.writeText(paymentNo);
      setCopied(true);
      window.setTimeout(() => {
        setCopied(false);
      }, 1600);
    } catch {
      setCopied(false);
    }
  };

  return createPortal(
    <div
      aria-hidden="true"
      className={styles.backdrop}
      onClick={() => {
        closeDialog();
      }}
      role="presentation"
    >
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className={styles.dialog}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className={styles.header}>
          <div className={styles.headerMain}>
            <h2 className={styles.title} id={titleId}>{headerTitle}</h2>
            {referenceNo ? (
              <p className={styles.referenceNo} title={referenceNo}>
                #{referenceNo}
              </p>
            ) : null}
            <div className={styles.badgeRow}>
              <span className={styles.secureBadge}>
                <ShieldIcon />
                安全支付环境
              </span>
            </div>
          </div>
          <button aria-label="关闭支付弹窗" className={styles.closeButton} onClick={closeDialog} type="button">
            <CloseIcon />
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.summary}>
            <p className={styles.kicker}>应付金额</p>
            <p className={styles.amount}>
              <small>¥</small>
              <span>{amountParts.integerPart}</span>
              <em>.{amountParts.decimalPart}</em>
            </p>
          </div>

          <div className={styles.qrSection}>
            <div className={styles.qrCard} data-tone={currentStatusTone}>
              <div className={styles.qrFrame}>
                {QR_STATE_STATUSES.has(paymentStatus) ? (
                  <div className={styles.qrState} data-tone={currentStatusTone}>
                    {paymentStatus === 'paid' ? <SuccessIcon /> : null}
                    <strong>{statusText}</strong>
                  </div>
                ) : (
                  <>
                    {!qrImageLoaded ? (
                      <div className={styles.qrPlaceholder} aria-hidden="true" />
                    ) : null}
                    <img
                      alt="支付宝支付二维码"
                      className={styles.qrImage}
                      data-ready={qrImageLoaded}
                      onLoad={() => setQrImageLoaded(true)}
                      src={payload?.qrCodeImageUrl}
                    />
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <section className={styles.detailPanel}>
          <div className={styles.detailRow}>
            <span>支付单号</span>
            <div className={styles.detailValueGroup}>
              <strong title={paymentNo}>{paymentNo}</strong>
              <button className={styles.copyButton} onClick={() => void handleCopyOrderNo()} type="button">
                <CopyIcon />
                {copied ? '已复制' : '复制'}
              </button>
            </div>
          </div>
          <div className={styles.detailRow}>
            <span>支付方式</span>
            <strong>{terminalText}</strong>
          </div>
          <div className={styles.detailRow}>
            <span>支付截止</span>
            <strong title={expiresAt ? formatDateTime(expiresAt) : '待补充'}>
              {expiresAt ? formatDateTime(expiresAt) : '待补充'}
            </strong>
          </div>
        </section>

        {error ? <p className={styles.error}>{error}</p> : null}

        <div className={styles.actions}>
          <button className="button-secondary" disabled={refreshing || loading || !paymentId} onClick={() => void loadSnapshot('refresh')} type="button">
            <RefreshIcon />
            {refreshing ? '刷新中…' : '刷新状态'}
          </button>
          <button className="button-outline" onClick={closeDialog} type="button">
            {paymentStatus === 'paid' ? '完成' : '关闭'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
