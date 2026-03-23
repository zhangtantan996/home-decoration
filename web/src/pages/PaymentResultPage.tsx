import { useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { ErrorBlock, LoadingBlock } from '../components/AsyncState';
import { useAsyncData } from '../hooks/useAsyncData';
import { getPaymentStatus } from '../services/payments';
import { formatCurrency, formatDateTime } from '../utils/format';

const terminalStatuses = new Set(['paid', 'closed', 'failed']);

function readContextPath(value: unknown) {
  return typeof value === 'string' && value.startsWith('/') ? value : '';
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

  const status = data?.status || 'pending';
  const title = status === 'paid'
    ? '支付成功'
    : status === 'closed' || status === 'failed'
      ? '支付未完成'
      : '支付结果确认中';
  const description = status === 'paid'
    ? '资金已确认到账，相关业务状态会在同一流程内更新。'
    : status === 'closed' || status === 'failed'
      ? '本次支付未成功或已关闭，你可以返回业务页面重新发起。'
      : '支付宝已返回，平台仍在确认异步通知或查询结果，请稍候。';
  const tone = status === 'paid' ? 'success' : status === 'closed' || status === 'failed' ? 'danger' : 'warning';

  return (
    <div className="top-detail">
      <section className="detail-header">
        <div className="detail-header-row">
          <div>
            <p className="detail-kicker">支付结果</p>
            <h1>{title}</h1>
            <p>{description}</p>
          </div>
          <div className="inline-actions">
            <span className="status-chip" data-tone={tone}>{status}</span>
            <span className="status-chip">{data?.channel || 'alipay'}</span>
          </div>
        </div>
      </section>

      <section className="detail-layout">
        <div className="detail-main">
          <section className="card section-card">
            <div className="section-head"><h2>支付单信息</h2></div>
            <div className="detail-stat-grid">
              <article className="detail-stat"><span>支付单号</span><strong>#{paymentId}</strong></article>
              <article className="detail-stat"><span>金额</span><strong>{formatCurrency(data?.amount)}</strong></article>
              <article className="detail-stat"><span>支付主题</span><strong>{data?.subject || '待确认'}</strong></article>
              <article className="detail-stat"><span>终端</span><strong>{data?.terminalType || '待确认'}</strong></article>
            </div>
            <p className="detail-note" style={{ marginTop: 16 }}>
              已支付时间：{formatDateTime(data?.paidAt)} · 订单过期时间：{formatDateTime(data?.expiresAt)}
            </p>
            {error ? <p className="detail-note" style={{ marginTop: 12 }}>最近一次查询提示：{error}</p> : null}
          </section>
        </div>

        <aside className="detail-aside">
          <section className="card section-card">
            <div className="section-head"><h2>下一步</h2></div>
            <div className="detail-actions" style={{ marginTop: 16 }}>
              <Link className="button-secondary" to={targetPath}>返回业务页面</Link>
              {!terminalStatuses.has(status) ? (
                <button className="button-outline" onClick={() => void reload()} type="button">
                  立即刷新结果
                </button>
              ) : null}
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}
