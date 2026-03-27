import { Link, useParams } from 'react-router-dom';

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

function resolvePrimaryActionLabel(actionPath: string | undefined, hasBooking: boolean) {
  if (hasBooking) {
    return '查看预约详情';
  }
  if (actionPath?.startsWith('/projects/')) {
    return '查看项目进度';
  }
  if (actionPath?.startsWith('/proposals/')) {
    return '查看方案详情';
  }
  return '查看关联业务';
}

export function PaymentDetailPage() {
  const { id } = useParams();
  const paymentId = Number(id || 0);
  const { data, loading, error, reload } = useAsyncData(
    () => (paymentId ? getPaymentDetail(paymentId) : Promise.reject(new Error('缺少支付单编号，请返回订单列表重新查看。'))),
    [paymentId],
  );

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
        <ErrorBlock description={error} onRetry={() => void reload()} />
      </main>
    );
  }

  if (!data) {
    return null;
  }

  const statusMeta = STATUS_META[data.status] || STATUS_META.created;
  const providerInitial = (data.provider?.name || '商').trim().slice(0, 1).toUpperCase();
  const primaryActionPath = data.actionPath || '/me/orders';
  const primaryActionLabel = resolvePrimaryActionLabel(data.actionPath, Boolean(data.booking?.id));
  const canViewSiteSurvey = data.bizType === 'booking_survey_deposit' && Boolean(data.booking?.id);
  const showExpiresAt = ['created', 'launching', 'pending'].includes(data.status) && Boolean(data.expiresAt);

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
                <dd>{data.terminalTypeText || '待补充'}</dd>
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
              <h2>下一步</h2>
            </div>

            <div className={styles.actionStack}>
              <Link className="button-secondary" to={primaryActionPath}>
                {primaryActionLabel}
              </Link>
              {canViewSiteSurvey && data.booking ? (
                <Link className="button-ghost" to={`/bookings/${data.booking.id}/site-survey`}>
                  查看量房记录
                </Link>
              ) : null}
              <Link className="button-ghost" to="/me/orders">
                返回我的订单
              </Link>
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}
