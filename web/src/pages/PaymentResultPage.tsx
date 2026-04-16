import { useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { ErrorBlock, LoadingBlock } from '../components/AsyncState';
import { useAsyncData } from '../hooks/useAsyncData';
import { getPaymentStatus } from '../services/payments';
import { formatCurrency, formatDateTime } from '../utils/format';
import styles from './PaymentResultPage.module.scss';

const terminalStatuses = new Set(['paid', 'closed', 'failed']);

function readContextPath(value: unknown) {
  return typeof value === 'string' && value.startsWith('/') ? value : '';
}

function readContextValue(context: Record<string, unknown> | undefined, key: string) {
  const raw = context?.[key];
  return typeof raw === 'string' ? raw : '';
}

const STATUS_META: Record<string, { label: string; title: string; description: string; tone: 'success' | 'warning' | 'danger' }> = {
  paid: {
    label: '已支付',
    title: '支付成功',
    description: '款项已确认到账，可继续处理后续业务流程。',
    tone: 'success',
  },
  closed: {
    label: '已关闭',
    title: '支付未完成',
    description: '本次支付已关闭，你可以返回业务页面重新发起。',
    tone: 'danger',
  },
  failed: {
    label: '支付失败',
    title: '支付未完成',
    description: '支付没有成功，请返回业务页面重新发起或稍后再试。',
    tone: 'danger',
  },
  scan_pending: {
    label: '已扫码待支付',
    title: '等待付款完成',
    description: '二维码已被扫描，请在支付宝内完成支付确认。',
    tone: 'warning',
  },
  pending: {
    label: '等待确认',
    title: '支付结果确认中',
    description: '支付渠道已返回，平台正在同步最终结果，请勿重复支付。',
    tone: 'warning',
  },
  launching: {
    label: '等待确认',
    title: '支付结果确认中',
    description: '支付渠道已返回，平台正在同步最终结果，请勿重复支付。',
    tone: 'warning',
  },
  created: {
    label: '待支付',
    title: '支付尚未完成',
    description: '支付单已创建，但尚未确认支付结果。',
    tone: 'warning',
  },
};

const CHANNEL_LABELS: Record<string, string> = {
  alipay: '支付宝',
  wechat_pay: '微信支付',
  bank_transfer: '银行转账',
};

const TERMINAL_LABELS: Record<string, string> = {
  pc_web: '网页端',
  mobile_h5: '手机网页',
  mini_qr: '支付宝扫码',
};

const BIZ_TYPE_LABELS: Record<string, string> = {
  booking_intent: '预约意向金',
  booking_survey_deposit: '量房定金',
  order: '订单支付',
  payment_plan: '阶段款支付',
  merchant_bond: '保证金',
};

function formatChannelLabel(channel: string | undefined) {
  const normalized = String(channel || '').trim();
  return CHANNEL_LABELS[normalized] || normalized || '支付宝';
}

function formatTerminalLabel(terminalType: string | undefined) {
  const normalized = String(terminalType || '').trim();
  return TERMINAL_LABELS[normalized] || normalized || '网页端';
}

function formatBusinessLabel(subject: string | undefined, returnContext: Record<string, unknown> | undefined) {
  const bizType = readContextValue(returnContext, 'bizType');
  if (bizType && BIZ_TYPE_LABELS[bizType]) {
    return BIZ_TYPE_LABELS[bizType];
  }
  return subject || '当前支付事项';
}

function resolveNextLabel(path: string, paid: boolean) {
  if (/^\/bookings\/\d+\/site-survey$/.test(path)) {
    return '返回预约详情';
  }
  if (/^\/bookings\/\d+$/.test(path)) {
    return '返回预约详情';
  }
  if (/^\/proposals\/\d+$/.test(path)) {
    return '查看方案详情';
  }
  if (/^\/projects\/\d+/.test(path)) {
    return '查看项目进度';
  }
  if (/^\/me\/orders/.test(path)) {
    return '查看我的订单';
  }
  if (/^\/bond/.test(path)) {
    return '返回保证金页';
  }
  return paid ? '返回业务页面' : '回到业务页面';
}

function resolveRefreshHint(status: string) {
  if (status === 'paid') {
    return '如果业务页暂未更新，返回后刷新一次即可。';
  }
  if (status === 'closed' || status === 'failed') {
    return '若仍需继续，可返回原页面重新发起支付。';
  }
  if (status === 'scan_pending') {
    return '已扫码但尚未完成付款，完成后页面会自动同步。';
  }
  return '页面会自动轮询最新状态，你也可以手动刷新。';
}

export function PaymentResultPage() {
  const [searchParams] = useSearchParams();
  const paymentId = Number(searchParams.get('paymentId') || 0);
  const fallbackNext = searchParams.get('next') || '/me/orders';

  const { data, loading, error, reload } = useAsyncData(
    () => getPaymentStatus(paymentId),
    [paymentId],
  );

  useEffect(() => {
    if (!data || terminalStatuses.has(data.status)) {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      void reload();
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [data, reload]);

  const targetPath = useMemo(() => {
    if (!data?.returnContext) {
      return fallbackNext;
    }
    if (data.status === 'paid') {
      return readContextPath(data.returnContext.successPath) || fallbackNext;
    }
    return readContextPath(data.returnContext.cancelPath) || fallbackNext;
  }, [data, fallbackNext]);

  const status = data?.status || 'pending';
  const statusMeta = STATUS_META[status] || STATUS_META.pending;
  const businessLabel = formatBusinessLabel(data?.subject, data?.returnContext);
  const paid = status === 'paid';
  const nextLabel = resolveNextLabel(targetPath, paid);
  const channelLabel = formatChannelLabel(data?.channel);
  const terminalLabel = formatTerminalLabel(data?.terminalType);
  const paidAtText = paid ? formatDateTime(data?.paidAt) : '待支付完成后更新';
  const expiresAtText = formatDateTime(data?.expiresAt);

  if (!paymentId) {
    return (
      <main className="container page-stack">
        <ErrorBlock description="缺少支付单编号，请返回上一页重新发起支付。" />
      </main>
    );
  }

  if (loading && !data) {
    return (
      <main className="container page-stack">
        <LoadingBlock title="确认支付结果" />
      </main>
    );
  }

  if (error && !data) {
    return (
      <main className="container page-stack">
        <ErrorBlock description={error} onRetry={() => void reload()} />
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroMark} data-tone={statusMeta.tone} aria-hidden="true">
          {paid ? '✓' : status === 'closed' || status === 'failed' ? '!' : '…'}
        </div>
        <div className={styles.heroBody}>
          <div className={styles.heroIntro}>
            <p className={styles.kicker}>支付结果</p>
            <h1>{statusMeta.title}</h1>
            <p>{statusMeta.description}</p>
          </div>
          <div className={styles.heroBadges}>
            <span className="status-chip" data-tone={statusMeta.tone}>{statusMeta.label}</span>
            <span className="status-chip">{channelLabel}</span>
            <span className="status-chip">{businessLabel}</span>
          </div>
        </div>
      </section>

      <section className={styles.grid}>
        <section className={`card ${styles.panel}`}>
          <div className={styles.panelHead}>
            <h2>支付信息</h2>
            <p>这笔款项的最新确认结果如下。</p>
          </div>
          <div className={styles.infoGrid}>
            <article className={styles.infoCard}>
              <span>支付单号</span>
              <strong>#{paymentId}</strong>
            </article>
            <article className={styles.infoCard}>
              <span>支付金额</span>
              <strong>{formatCurrency(data?.amount)}</strong>
            </article>
            <article className={styles.infoCard}>
              <span>支付项目</span>
              <strong>{businessLabel}</strong>
            </article>
            <article className={styles.infoCard}>
              <span>支付终端</span>
              <strong>{terminalLabel}</strong>
            </article>
          </div>
          <dl className={styles.metaList}>
            <div>
              <dt>支付时间</dt>
              <dd>{paidAtText}</dd>
            </div>
            <div>
              <dt>有效截止</dt>
              <dd>{expiresAtText}</dd>
            </div>
            <div>
              <dt>支付渠道</dt>
              <dd>{channelLabel}</dd>
            </div>
            <div>
              <dt>状态说明</dt>
              <dd>{resolveRefreshHint(status)}</dd>
            </div>
          </dl>
          {error ? (
            <div className={styles.inlineNotice}>
              最近一次状态查询提示：{error}
            </div>
          ) : null}
        </section>

        <aside className={`card ${styles.panel} ${styles.actionPanel}`}>
          <div className={styles.panelHead}>
            <h2>下一步</h2>
            <p>{paid ? '继续进入后续业务页面。' : '先回到原业务页查看或重新发起。'}</p>
          </div>
          <div className={styles.actionStack}>
            <Link className="button-secondary" to={targetPath}>
              {nextLabel}
            </Link>
            <Link className="button-ghost" to={`/payments/${paymentId}`}>
              查看支付详情
            </Link>
            {!terminalStatuses.has(status) ? (
              <button className="button-outline" onClick={() => void reload()} type="button">
                立即刷新结果
              </button>
            ) : (
              <Link className="button-ghost" to="/me/orders">
                查看我的订单
              </Link>
            )}
          </div>
          <p className={styles.helperText}>
            {paid
              ? '支付完成后通常会自动回到对应业务页，结果页主要用于确认状态与兜底跳转。'
              : '若页面长时间停留在确认中，请先刷新一次，再返回原页面查看。'}
          </p>
        </aside>
      </section>
    </main>
  );
}
