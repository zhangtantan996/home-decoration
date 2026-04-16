import { useEffect } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { ErrorBlock, LoadingBlock } from '../components/AsyncState';
import { useAsyncData } from '../hooks/useAsyncData';
import { getPaymentDetail } from '../services/payments';
import { formatCurrency, formatDateTime } from '../utils/format';
import styles from './PaymentDetailPage.module.scss';

const STATUS_META: Record<string, { tone: 'success' | 'warning' | 'danger' | 'brand' }> = {
  paid: {
    tone: 'success',
  },
  closed: {
    tone: 'danger',
  },
  failed: {
    tone: 'danger',
  },
  scan_pending: {
    tone: 'warning',
  },
  pending: {
    tone: 'warning',
  },
  launching: {
    tone: 'warning',
  },
  created: {
    tone: 'brand',
  },
};

const FINAL_PAYMENT_STATUSES = new Set(['paid', 'closed', 'failed']);

function resolvePaymentErrorDescription(rawError: string, mode: string | null) {
  const message = String(rawError || '').trim();
  if (!message) {
    return '支付详情暂时不可用，请稍后重试。';
  }

  if (mode === 'qr_code' && message.includes('(404)')) {
    return '当前支付详情暂时不可用，可能是支付单未正确创建或测试环境支付链路未完全就绪。请返回订单页重新发起支付；若仍失败，请联系平台处理。';
  }

  if (mode === 'qr_code' && message.includes('登录已过期')) {
    return '登录状态已失效，请重新登录后再次发起支付。';
  }

  if (mode === 'qr_code' && message.includes('无权查看')) {
    return '当前账号无法查看这笔支付单，可能是登录账号与下单账号不一致。请返回订单页核对当前账号后重新发起支付。';
  }

  if (message.includes('(404)')) {
    return '未找到这笔支付记录，可能已失效、已被关闭，或当前环境未生成对应支付详情。请返回订单页重新发起。';
  }

  if (message.includes('无权查看')) {
    return '当前账号无法查看这笔支付记录，请确认你使用的是下单账号；若你正是从当前订单页进入仍失败，请联系平台处理支付单归属异常。';
  }

  return message;
}

export function PaymentDetailPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const paymentId = Number(id || 0);
  const paymentMode = searchParams.get('mode');
  const { data, loading, error, reload } = useAsyncData(
    () => (paymentId ? getPaymentDetail(paymentId) : Promise.reject(new Error('缺少支付单编号，请返回订单列表重新查看。'))),
    [paymentId],
  );

  useEffect(() => {
    if (!data || FINAL_PAYMENT_STATUSES.has(data.status)) {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      void reload();
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [data, reload]);

  if (!paymentId) {
    return (
      <main className="container page-stack">
        <ErrorBlock description="缺少支付单编号，请返回订单列表重新查看。" />
      </main>
    );
  }

  if (loading && !data) {
    return (
      <main className="container page-stack">
        <LoadingBlock title="加载支付详情" />
      </main>
    );
  }

  if (error && !data) {
    return (
      <main className="container page-stack">
        <ErrorBlock description={resolvePaymentErrorDescription(error, paymentMode)} onRetry={() => void reload()} />
      </main>
    );
  }

  if (!data) {
    return null;
  }

  const statusMeta = STATUS_META[data.status] || STATUS_META.created;
  const providerInitial = (data.provider?.name || '商').trim().slice(0, 1).toUpperCase();
  const fallbackBackPath = data.actionPath || '/me/orders';
  const showExpiresAt = ['created', 'launching', 'pending', 'scan_pending'].includes(data.status) && Boolean(data.expiresAt);
  const terminalLabel = data.terminalType === 'mini_qr' && data.channel === 'alipay'
    ? '支付宝扫码'
    : data.terminalTypeText || '待补充';
  const qrCodeImageUrl = String(searchParams.get('qrCodeImageUrl') || '').trim();
  const showQRCode = paymentMode === 'qr_code' && qrCodeImageUrl !== '';
  const qrHelperText = data.status === 'paid'
    ? '支付宝已确认支付成功，可继续处理后续业务。'
    : data.status === 'scan_pending'
      ? '二维码已被扫描，请在支付宝内完成付款确认。'
    : data.status === 'closed' || data.status === 'failed'
      ? '当前二维码已失效，请返回业务页重新发起支付。'
      : '请使用支付宝 App 扫描下方二维码完成支付，页面会自动刷新支付状态。';

  const handleGoBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate(fallbackBackPath);
  };

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>支付详情</p>
          <h1>{data.purposeText || data.bizTypeText || '支付记录'}</h1>
          <div className={styles.heroBadges}>
            <span className="status-chip" data-tone={statusMeta.tone}>{data.statusText || '处理中'}</span>
            <span className="status-chip">{data.channelText || '支付渠道待补充'}</span>
            <span className="status-chip">{data.fundSceneText || data.bizTypeText || '费用类型待补充'}</span>
          </div>
        </div>

        <div className={styles.amountCard}>
          <span>实付金额</span>
          <strong>{formatCurrency(data.amount)}</strong>
          <p>{data.paidAt ? `支付时间 ${formatDateTime(data.paidAt)}` : `当前状态 ${data.statusText || '处理中'}`}</p>
        </div>
      </section>

      <section className={styles.grid}>
        <div className={styles.mainStack}>
          {showQRCode ? (
            <section className={`card ${styles.panel}`}>
              <div className={styles.panelHead}>
                <h2>支付宝扫码支付</h2>
                <p>{qrHelperText}</p>
              </div>

              <div className={styles.qrPanel}>
                <div className={styles.qrPreview} data-tone={statusMeta.tone}>
                  {FINAL_PAYMENT_STATUSES.has(data.status) ? (
                    <div className={styles.qrStateText}>{data.statusText || '支付状态已更新'}</div>
                  ) : (
                    <img alt="支付宝支付二维码" className={styles.qrImage} src={qrCodeImageUrl} />
                  )}
                </div>

                <div className={styles.qrMeta}>
                  <article className={styles.qrMetaCard}>
                    <span>支付方式</span>
                    <strong>{data.channelText || '支付宝'}</strong>
                  </article>
                  <article className={styles.qrMetaCard}>
                    <span>当前状态</span>
                    <strong>{data.statusText || '处理中'}</strong>
                  </article>
                  <article className={styles.qrMetaCard}>
                    <span>支付金额</span>
                    <strong>{formatCurrency(data.amount)}</strong>
                  </article>
                  <article className={styles.qrMetaCard}>
                    <span>支付截止</span>
                    <strong>{data.expiresAt ? formatDateTime(data.expiresAt) : '待补充'}</strong>
                  </article>
                </div>
              </div>

              <div className={styles.qrActionRow}>
                <button className="button-secondary" onClick={() => void reload()} type="button">
                  刷新支付状态
                </button>
                <Link className="button-ghost" to={fallbackBackPath}>
                  稍后继续处理
                </Link>
              </div>
            </section>
          ) : null}

          <section className={`card ${styles.panel}`}>
            <div className={styles.panelHead}>
              <h2>订单信息</h2>
            </div>

            <div className={styles.infoGrid}>
              <article className={styles.infoCard}>
                <span>支付事项</span>
                <strong>{data.purposeText || data.subject || '支付记录'}</strong>
              </article>
              <article className={styles.infoCard}>
                <span>费用类型</span>
                <strong>{data.fundSceneText || data.bizTypeText || '待补充'}</strong>
              </article>
              <article className={styles.infoCard}>
                <span>支付状态</span>
                <strong>{data.statusText || '处理中'}</strong>
              </article>
            </div>

            <dl className={styles.metaList}>
              <div>
                <dt>平台支付单号</dt>
                <dd className={styles.mono}>{data.outTradeNo || '待生成'}</dd>
              </div>
              <div>
                <dt>渠道流水号</dt>
                <dd className={styles.mono}>{data.providerTradeNo || '支付完成后同步'}</dd>
              </div>
              <div>
                <dt>支付方式</dt>
                <dd>{data.channelText || '待补充'}</dd>
              </div>
              <div>
                <dt>支付终端</dt>
                <dd>{terminalLabel}</dd>
              </div>
              <div>
                <dt>支付时间</dt>
                <dd>{data.paidAt ? formatDateTime(data.paidAt) : '待支付完成后更新'}</dd>
              </div>
              <div>
                <dt>下单时间</dt>
                <dd>{formatDateTime(data.createdAt)}</dd>
              </div>
              <div>
                <dt>支付金额</dt>
                <dd>{formatCurrency(data.amount)}</dd>
              </div>
              {showExpiresAt ? (
                <div>
                  <dt>支付截止时间</dt>
                  <dd>{formatDateTime(data.expiresAt)}</dd>
                </div>
              ) : null}
            </dl>
          </section>

          <section className={`card ${styles.panel}`}>
            <div className={styles.panelHead}>
              <h2>商家信息</h2>
            </div>

            {data.provider ? (
              <div className={styles.providerCard}>
                <div className={styles.providerAvatar} aria-hidden="true">
                  {data.provider.avatar ? (
                    <img alt={data.provider.name} src={data.provider.avatar} />
                  ) : (
                    <span>{providerInitial}</span>
                  )}
                </div>
                <div className={styles.providerMeta}>
                  <div className={styles.providerTitleRow}>
                    <h3>{data.provider.name}</h3>
                    <div className={styles.providerBadges}>
                      <span className="status-chip">{data.provider.roleText || '服务商'}</span>
                      {data.provider.verified ? <span className="status-chip" data-tone="success">已认证</span> : null}
                    </div>
                  </div>
                  <dl className={styles.providerFacts}>
                    <div>
                      <dt>服务地址</dt>
                      <dd>{data.booking?.address || '待补充'}</dd>
                    </div>
                    <div>
                      <dt>关联预约</dt>
                      <dd>{data.booking?.id ? `#${data.booking.id}` : '待补充'}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            ) : (
              <div className={styles.emptyState}>商家信息暂未同步，请稍后刷新查看。</div>
            )}
          </section>
        </div>

        <aside className={styles.sideStack}>
          <section className={`card ${styles.panel}`}>
            <div className={styles.panelHead}>
              <h2>返回</h2>
            </div>

            <div className={styles.actionStack}>
              <button className="button-secondary" onClick={handleGoBack} type="button">
                返回上一页
              </button>
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}
