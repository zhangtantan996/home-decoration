import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ErrorBlock, LoadingBlock } from '../components/AsyncState';
import { useAsyncData } from '../hooks/useAsyncData';
import {
  confirmDesignFeeQuote,
  getDesignFeeQuote,
  rejectDesignFeeQuote,
  type DesignFeeQuoteVM,
} from '../services/bookings';
import { payOrder } from '../services/orders';
import { formatCurrency, formatDateTime } from '../utils/format';
import { startAlipayWebPayment } from '../utils/paymentLaunch';
import styles from './DesignFeeQuotePage.module.scss';

const STATUS_MAP: Record<string, { label: string; tone: 'warning' | 'success' | 'danger' | 'brand'; title: string; description: string }> = {
  pending: {
    label: '待确认',
    tone: 'warning',
    title: '等待你确认并支付',
    description: '请先核对设计费总额、量房定金抵扣和设计说明，确认后会直接进入支付流程。',
  },
  confirmed: {
    label: '已确认',
    tone: 'success',
    title: '报价已确认',
    description: '报价已经确认，后续按订单状态继续支付或进入设计交付。',
  },
  rejected: {
    label: '已拒绝',
    tone: 'danger',
    title: '报价已退回',
    description: '当前报价已被退回，设计师需要重新整理报价后才能继续推进。',
  },
  expired: {
    label: '已过期',
    tone: 'brand',
    title: '报价已过期',
    description: '该报价已超过有效期，需等待设计师重新发起报价。',
  },
};

function resolveNextStep(quote: DesignFeeQuoteVM, orderStatus: number | null) {
  if (quote.status === 'pending') {
    return '确认并支付设计费后，设计师才会继续提交正式方案。';
  }
  if (quote.status === 'confirmed' && orderStatus === 0) {
    return '设计费订单待支付，支付完成后设计师才会继续提交正式方案。';
  }
  if (quote.status === 'confirmed' && orderStatus === 1) {
    return '设计费已支付，下一步请在预约详情继续跟进设计交付与方案确认。';
  }
  if (quote.status === 'rejected') {
    return '等待设计师根据你的反馈重新整理报价。';
  }
  return '订单状态正在同步，请稍后刷新查看。';
}

function resolveActionTitle(quote: DesignFeeQuoteVM, orderStatus: number | null) {
  if (quote.status === 'pending') {
    return '确认并支付设计费';
  }
  if (quote.status === 'confirmed' && orderStatus === 0) {
    return '继续支付设计费';
  }
  if (quote.status === 'confirmed' && orderStatus === 1) {
    return '等待设计师提交正式方案';
  }
  if (quote.status === 'rejected') {
    return '等待设计师重新报价';
  }
  if (quote.status === 'expired') {
    return '等待新的设计费报价';
  }
  return '查看预约详情';
}

export function DesignFeeQuotePage() {
  const params = useParams();
  const bookingId = Number(params.id || 0);

  const { data, loading, error, reload } = useAsyncData(
    () => getDesignFeeQuote(bookingId),
    [bookingId],
  );

  const [acting, setActing] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  const quote = data?.quote as DesignFeeQuoteVM | null | undefined;
  const orderStatus = typeof data?.order?.status === 'number'
    ? Number(data.order.status)
    : typeof quote?.orderStatus === 'number'
      ? Number(quote.orderStatus)
      : null;

  const handleConfirmAndPay = useCallback(async () => {
    if (!quote) return;
    setActing(true);
    setActionMessage('');
    try {
      const order = await confirmDesignFeeQuote(quote.id);
      await reload();
      if (!order?.id) {
        setActionMessage('设计费订单已生成，请刷新页面后继续支付。');
        return;
      }
      await startAlipayWebPayment((request) => payOrder(order.id, request), { onPaid: reload });
    } catch (submitError) {
      setActionMessage(submitError instanceof Error ? submitError.message : '确认并支付失败，请稍后重试。');
    } finally {
      setActing(false);
    }
  }, [quote, reload]);

  const handleReject = useCallback(async () => {
    if (!quote || !rejectReason.trim()) return;
    setActing(true);
    setActionMessage('');
    try {
      await rejectDesignFeeQuote(quote.id, rejectReason.trim());
      setShowRejectInput(false);
      await reload();
      setActionMessage('已退回本次报价，设计师需要重新整理后才能继续推进。');
    } catch (submitError) {
      setActionMessage(submitError instanceof Error ? submitError.message : '退回报价失败，请稍后重试。');
    } finally {
      setActing(false);
    }
  }, [quote, rejectReason, reload]);

  if (loading) {
    return <div className="top-detail"><LoadingBlock title="加载设计费报价" /></div>;
  }

  if (error) {
    return <div className="top-detail"><ErrorBlock description={error} onRetry={() => void reload()} /></div>;
  }

  if (!quote) {
    return (
      <div className={styles.page}>
        <section className={styles.hero}>
          <div className={styles.heroTop}>
            <div>
              <p className="kicker eyebrow-accent">设计费报价</p>
              <h1>预约 #{bookingId} 暂无设计费报价</h1>
            </div>
            <Link className="button-link" to={`/bookings/${bookingId}`}>返回预约详情</Link>
          </div>
          <p className={styles.heroCopy}>
            设计师尚未发送设计费报价，后续报价发起后会在这里展示，你也会收到站内通知提醒。
          </p>
        </section>
      </div>
    );
  }

  const status = STATUS_MAP[quote.status] || {
    label: quote.status,
    tone: 'brand' as const,
    title: '报价状态已更新',
    description: '请根据当前状态继续推进后续操作。',
  };
  const canPayOrder = quote.status === 'confirmed' && Boolean(quote.orderId) && orderStatus === 0;
  const nextStepText = resolveNextStep(quote, orderStatus);
  const actionTitle = resolveActionTitle(quote, orderStatus);
  const paymentModeText = quote.paymentMode === 'staged' ? '分阶段支付' : '一次性支付';
  const orderStatusLabel = orderStatus === 1 ? '已支付' : orderStatus === 0 ? '待支付' : quote.status === 'pending' ? '待生成订单' : '待同步';
  const expireText = quote.expireAt ? formatDateTime(quote.expireAt) : '待补充';

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroTop}>
          <div className={styles.heroIntro}>
            <p className="kicker eyebrow-accent">预约 #{bookingId}</p>
            <h1>设计费报价</h1>
            <p>{status.description}</p>
          </div>
          <div className={styles.heroBadges}>
            <span className="status-chip">设计费阶段</span>
            <span className="status-chip" data-tone={status.tone}>{status.label}</span>
          </div>
        </div>

        <div className={styles.heroGrid}>
          <div className={styles.quotePanel}>
            <div className={styles.amountCard}>
              <span>当前应付</span>
              <strong>{formatCurrency(quote.netAmount)}</strong>
            </div>

            <div className={styles.formulaRow} aria-label="费用结构">
              <span className={styles.formulaItem}>
                <em>设计费</em>
                <b>{formatCurrency(quote.totalFee)}</b>
              </span>
              <i className={styles.formulaOperator}>-</i>
              <span className={styles.formulaItem}>
                <em>定金抵扣</em>
                <b>{formatCurrency(quote.depositDeduction || 0)}</b>
              </span>
              <i className={styles.formulaOperator}>=</i>
              <span className={styles.formulaItem} data-accent="true">
                <em>本次实付</em>
                <b>{formatCurrency(quote.netAmount)}</b>
              </span>
            </div>

            <div className={styles.factGrid}>
              <article className={styles.factItem}>
                <span>订单状态</span>
                <strong>{orderStatusLabel}</strong>
              </article>
              <article className={styles.factItem}>
                <span>支付方式</span>
                <strong>{paymentModeText}</strong>
              </article>
              <article className={styles.factItem}>
                <span>报价有效期</span>
                <strong>{expireText}</strong>
              </article>
            </div>
          </div>

          <aside className={styles.actionPanel}>
            <div className={styles.actionIntro}>
              <span>当前动作</span>
              <strong>{actionTitle}</strong>
              <p>{nextStepText}</p>
            </div>

            {actionMessage ? (
              <div className={styles.actionMessage}>
                <div className="status-note">{actionMessage}</div>
              </div>
            ) : null}

            {quote.status === 'pending' ? (
              <>
                <div className={styles.actionRow}>
                  <button className="button-secondary" disabled={acting} onClick={() => void handleConfirmAndPay()} type="button">
                    {acting ? '处理中…' : '确认并支付设计费'}
                  </button>
                  <button className="button-outline" disabled={acting} onClick={() => setShowRejectInput((prev) => !prev)} type="button">
                    {showRejectInput ? '收起退回说明' : '退回报价'}
                  </button>
                </div>

                {showRejectInput ? (
                  <div className={styles.rejectPanel}>
                    <label className={styles.rejectLabel} htmlFor="design-quote-reject-reason">退回说明</label>
                    <textarea
                      className={styles.rejectTextarea}
                      id="design-quote-reject-reason"
                      placeholder="如果报价超出预期、计费方式不清楚，或你希望设计方向先调整，可以在这里直接说明。"
                      rows={4}
                      value={rejectReason}
                      onChange={(event) => setRejectReason(event.target.value)}
                    />
                    <button
                      className="button-danger"
                      disabled={acting || !rejectReason.trim()}
                      onClick={() => void handleReject()}
                      type="button"
                    >
                      {acting ? '处理中…' : '提交退回原因'}
                    </button>
                  </div>
                ) : null}
              </>
            ) : null}

            {quote.status === 'confirmed' ? (
              <div className={styles.actionRow}>
                {canPayOrder ? (
                  <button
                    className="button-secondary"
                    disabled={acting}
                    onClick={async () => {
                      setActing(true);
                      setActionMessage('');
                      try {
                        await startAlipayWebPayment((request) => payOrder(quote.orderId!, request), { onPaid: reload });
                      } catch (launchError) {
                        setActionMessage(launchError instanceof Error ? launchError.message : '发起支付失败，请稍后重试。');
                      } finally {
                        setActing(false);
                      }
                    }}
                    type="button"
                  >
                    {acting ? '拉起支付中…' : '去支付设计费'}
                  </button>
                ) : null}
                <Link className="button-outline" to={`/bookings/${bookingId}`}>返回预约详情</Link>
              </div>
            ) : null}

            {quote.status !== 'pending' && quote.status !== 'confirmed' ? (
              <div className={styles.actionRow}>
                <Link className="button-secondary" to={`/bookings/${bookingId}`}>返回预约详情</Link>
              </div>
            ) : null}
          </aside>
        </div>
      </section>

      <section className={styles.detailGrid}>
        <section className={`card ${styles.panel}`}>
          <div className={styles.panelHead}>
            <h2>报价说明</h2>
            <p>设计师对本次服务范围、收费方式和补充内容的说明。</p>
          </div>
          <div className={styles.noteCard}>
            <span className={styles.noteLabel}>设计师说明</span>
            <p>{quote.description || '暂无额外说明。'}</p>
          </div>
        </section>

        <section className={`card ${styles.panel}`}>
          <div className={styles.panelHead}>
            <h2>后续流程</h2>
            <p>当前页面只处理设计费阶段，后续交付会回到预约详情继续推进。</p>
          </div>
          <div className={styles.flowList}>
            <article className={styles.flowItem} data-state={quote.status === 'pending' || (quote.status === 'confirmed' && orderStatus === 0) ? 'current' : 'done'}>
              <span>1</span>
              <div>
                <strong>确认并支付设计费</strong>
                <p>先核对金额与说明，确认后会直接进入本次支付。</p>
              </div>
            </article>
            <article className={styles.flowItem} data-state={quote.status === 'confirmed' && orderStatus === 1 ? 'current' : 'upcoming'}>
              <span>2</span>
              <div>
                <strong>等待设计师提交正式方案</strong>
                <p>支付完成后，设计师才会继续进入正式设计方案交付。</p>
              </div>
            </article>
            <article className={styles.flowItem} data-state="upcoming">
              <span>3</span>
              <div>
                <strong>查看并确认方案</strong>
                <p>设计师提交正式方案后，你会在预约详情与项目页继续确认。</p>
              </div>
            </article>
          </div>
        </section>
      </section>

      {quote.rejectionReason ? (
        <section className={`card ${styles.panel} ${styles.dangerPanel}`}>
          <div className={styles.panelHead}>
            <h2>退回原因</h2>
            <p>以下是你最近一次退回该报价时留下的说明。</p>
          </div>
          <div className={styles.noteCard}>
            <span className={styles.noteLabel}>退回备注</span>
            <p>{quote.rejectionReason}</p>
          </div>
        </section>
      ) : null}
    </div>
  );
}
