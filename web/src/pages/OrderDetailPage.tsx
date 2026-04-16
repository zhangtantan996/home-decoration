import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ErrorBlock, LoadingBlock } from '../components/AsyncState';
import { useAsyncData } from '../hooks/useAsyncData';
import { getOrderCenterEntryDetail, startOrderCenterEntryPayment, type OrderCenterEntryDetail } from '../services/orderCenter';
import { getOrderDetail, payOrder } from '../services/orders';
import type { OrderDetailVM } from '../types/viewModels';
import { formatCurrency, formatDateTime } from '../utils/format';
import { startAlipayWebPayment } from '../utils/paymentLaunch';
import styles from './OrderDetailPage.module.scss';

const LEGACY_STATUS_TONES: Record<number, 'warning' | 'success' | 'danger'> = {
  0: 'warning',
  1: 'success',
  2: 'danger',
  3: 'danger',
};

const ENTRY_STATUS_TONES: Record<string, 'warning' | 'success' | 'danger'> = {
  pending_payment: 'warning',
  paid: 'success',
  cancelled: 'danger',
  refund: 'danger',
};

const SOURCE_KIND_LABELS: Record<string, string> = {
  survey_deposit: '量房定金',
  design_order: '设计费订单',
  construction_order: '施工订单',
  material_order: '主材订单',
  refund_record: '退款记录',
  merchant_bond: '保证金记录',
};

type DetailState =
  | { mode: 'legacy'; detail: OrderDetailVM }
  | { mode: 'entry'; detail: OrderCenterEntryDetail };

function decodeRouteToken(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function resolveEntryAction(detail: OrderCenterEntryDetail) {
  const explicitPath = String(detail.legacyActionPath || '').trim();
  const path = explicitPath
    || (detail.project?.id ? `/projects/${detail.project.id}` : '')
    || (detail.booking?.id ? `/bookings/${detail.booking.id}` : '');

  if (!path) {
    return null;
  }
  if (path.startsWith('/projects/')) {
    return { path, label: '查看项目' };
  }
  if (path.startsWith('/bookings/')) {
    return { path, label: '查看预约' };
  }
  if (path.startsWith('/proposals/')) {
    return { path, label: '查看方案' };
  }
  if (path.startsWith('/orders/')) {
    return { path, label: '查看业务订单' };
  }
  return { path, label: '查看关联业务' };
}

function findSectionValue(detail: OrderCenterEntryDetail, labels: string[]) {
  const normalized = new Set(labels.map((item) => item.trim()));
  for (const section of detail.descriptionSections || []) {
    for (const item of section.items || []) {
      if (normalized.has(String(item.label || '').trim()) && String(item.value || '').trim()) {
        return item.value;
      }
    }
  }
  return '';
}

function buildEntryMetaRows(detail: OrderCenterEntryDetail) {
  const proposalId = detail.booking?.proposalId || detail.order?.proposalId || 0;
  const projectId = detail.project?.id || detail.order?.projectId || 0;
  const currentStage = findSectionValue(detail, ['当前阶段']) || detail.businessStage || '';
  const flowSummary = findSectionValue(detail, ['进度说明']) || detail.flowSummary || detail.subtitle || '';
  const paidAt = detail.booking?.surveyDepositPaidAt || detail.order?.paidAt || '';

  return [
    { label: '订单编号', value: detail.referenceNo || '待补充', mono: true },
    { label: '下单时间', value: formatDateTime(detail.createdAt) },
    { label: '支付时间', value: paidAt ? formatDateTime(paidAt) : '待支付完成后更新' },
    { label: '服务地址', value: detail.booking?.address || detail.project?.address || '待补充' },
    { label: '当前阶段', value: currentStage || '待补充' },
    { label: '进度说明', value: flowSummary || '待补充' },
    { label: '关联预约', value: detail.booking?.id ? `#${detail.booking.id}` : '-' },
    { label: '关联方案', value: proposalId ? `#${proposalId}` : '-' },
    { label: '关联项目', value: projectId ? `#${projectId}` : '-' },
  ];
}

export function OrderDetailPage() {
  const params = useParams();
  const rawToken = String(params.id || '').trim();
  const numericOrderId = /^\d+$/.test(rawToken) ? Number(rawToken) : 0;
  const entryKey = useMemo(
    () => (rawToken && !numericOrderId ? decodeRouteToken(rawToken) : ''),
    [numericOrderId, rawToken],
  );
  const { data, loading, error, reload } = useAsyncData<DetailState>(
    async () => {
      if (entryKey) {
        const detail = await getOrderCenterEntryDetail(entryKey);
        return { mode: 'entry', detail };
      }
      if (numericOrderId > 0) {
        const detail = await getOrderDetail(numericOrderId);
        return { mode: 'legacy', detail };
      }
      throw new Error('缺少订单编号，请返回我的订单重新查看。');
    },
    [entryKey, numericOrderId],
  );
  const [actionError, setActionError] = useState('');
  const [paying, setPaying] = useState(false);

  if (!rawToken) {
    return (
      <main className="container page-stack">
        <ErrorBlock description="缺少订单编号，请返回我的订单重新查看。" />
      </main>
    );
  }

  if (loading && !data) {
    return (
      <main className="container page-stack">
        <LoadingBlock title="加载订单详情" />
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

  const handlePay = async () => {
    setActionError('');
    setPaying(true);
    try {
      if (data.mode === 'entry') {
        await startAlipayWebPayment((request) => startOrderCenterEntryPayment(data.detail.entryKey, request), { onPaid: reload });
      } else {
        await startAlipayWebPayment((request) => payOrder(data.detail.id, request), { onPaid: reload });
      }
    } catch (payError) {
      setActionError(payError instanceof Error ? payError.message : '发起支付失败，请稍后重试。');
    } finally {
      setPaying(false);
    }
  };

  if (data.mode === 'legacy') {
    const detail = data.detail;
    const tone = LEGACY_STATUS_TONES[detail.status] || 'warning';

    return (
      <main className={styles.page}>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.kicker}>订单详情</p>
            <h1>{detail.orderTypeText}</h1>
            <div className={styles.heroMeta}>
              <span className="status-chip" data-tone={tone}>{detail.statusText}</span>
              <span className="status-chip">{detail.orderNo}</span>
            </div>
          </div>

          <div className={styles.amountCard}>
            <span>订单金额</span>
            <strong>{detail.totalAmountText}</strong>
            <p>{detail.paidAt && detail.paidAt !== '待补充' ? `支付时间 ${detail.paidAt}` : `创建时间 ${detail.createdAt}`}</p>
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
                  <span>订单类型</span>
                  <strong>{detail.orderTypeText}</strong>
                </article>
                <article className={styles.infoCard}>
                  <span>订单状态</span>
                  <strong>{detail.statusText}</strong>
                </article>
                <article className={styles.infoCard}>
                  <span>已支付金额</span>
                  <strong>{detail.paidAmountText}</strong>
                </article>
              </div>

              <dl className={styles.metaList}>
                <div>
                  <dt>订单编号</dt>
                  <dd className={styles.mono}>{detail.orderNo}</dd>
                </div>
                <div>
                  <dt>创建时间</dt>
                  <dd>{detail.createdAt}</dd>
                </div>
                <div>
                  <dt>支付时间</dt>
                  <dd>{detail.paidAt}</dd>
                </div>
                <div>
                  <dt>支付截止</dt>
                  <dd>{detail.expireAt}</dd>
                </div>
                <div>
                  <dt>优惠抵扣</dt>
                  <dd>{detail.discountText}</dd>
                </div>
                <div>
                  <dt>关联预约</dt>
                  <dd>{detail.bookingId ? `#${detail.bookingId}` : '-'}</dd>
                </div>
                <div>
                  <dt>关联方案</dt>
                  <dd>{detail.proposalId ? `#${detail.proposalId}` : '-'}</dd>
                </div>
                <div>
                  <dt>关联项目</dt>
                  <dd>{detail.projectId ? `#${detail.projectId}` : '-'}</dd>
                </div>
              </dl>
            </section>

            {(detail.closureSummary || detail.bridgeConversionSummary) ? (
              <section className={`card ${styles.panel}`}>
                <div className={styles.panelHead}>
                  <h2>履约后链状态</h2>
                </div>
                <div className={styles.infoGrid}>
                  <article className={styles.infoCard}>
                    <span>业务阶段</span>
                    <strong>{detail.businessStage || '待同步'}</strong>
                  </article>
                  <article className={styles.infoCard}>
                    <span>资料归档</span>
                    <strong>{detail.closureSummary?.archiveStatus || '待同步'}</strong>
                  </article>
                  <article className={styles.infoCard}>
                    <span>资金闭环</span>
                    <strong>{detail.closureSummary?.financialClosureStatus || '待同步'}</strong>
                  </article>
                </div>
                {detail.flowSummary ? <p className={styles.helperText}>{detail.flowSummary}</p> : null}
                {detail.closureSummary?.nextPendingAction ? <p className={styles.helperText}>{detail.closureSummary.nextPendingAction}</p> : null}
              </section>
            ) : null}

            {detail.planItems.length ? (
              <section className={`card ${styles.panel}`}>
                <div className={styles.panelHead}>
                  <h2>支付计划</h2>
                </div>

                <div className={styles.planList}>
                  {detail.planItems.map((item) => (
                    <article className={styles.planItem} key={item.id}>
                      <div>
                        <strong>{item.name}</strong>
                        <p>{item.dueAt && item.dueAt !== '待补充' ? `应付时间 ${item.dueAt}` : '应付时间未设置'}</p>
                      </div>
                      <div className={styles.planMeta}>
                        <span>{item.statusText}</span>
                        <strong>{item.amountText}</strong>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}
          </div>

          <aside className={styles.sideStack}>
            <section className={`card ${styles.panel}`}>
              <div className={styles.panelHead}>
                <h2>下一步</h2>
              </div>

              <div className={styles.actionStack}>
                {detail.canPay ? (
                  <button className="button-secondary" disabled={paying} onClick={() => void handlePay()} type="button">
                    {paying ? '拉起支付中…' : '去支付'}
                  </button>
                ) : null}
                <Link className="button-ghost" to={detail.primaryActionPath}>
                  {detail.primaryActionLabel}
                </Link>
                <Link className="button-ghost" to="/me/orders">
                  返回我的订单
                </Link>
              </div>

              {actionError ? <div className="status-note" data-tone="danger">{actionError}</div> : null}
            </section>
          </aside>
        </section>
      </main>
    );
  }

  const detail = data.detail;
  const tone = ENTRY_STATUS_TONES[detail.statusGroup] || 'warning';
  const infoCards = [
    { label: '订单类型', value: SOURCE_KIND_LABELS[detail.sourceKind] || '订单' },
    { label: '当前状态', value: detail.statusText || '处理中' },
    { label: '服务商', value: detail.provider?.name || '待补充' },
  ];
  const metaRows = buildEntryMetaRows(detail);
  const relatedAction = resolveEntryAction(detail);
  const amountLabel = detail.statusGroup === 'pending_payment' ? '待支付金额' : '订单金额';
  const amountValue = detail.statusGroup === 'pending_payment' && detail.payableAmount > 0 ? detail.payableAmount : detail.amount;
  const amountMeta = detail.statusGroup === 'paid'
    ? `支付时间 ${formatDateTime(detail.booking?.surveyDepositPaidAt || detail.order?.paidAt || detail.createdAt)}`
    : `创建时间 ${formatDateTime(detail.createdAt)}`;

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>订单详情</p>
          <h1>{detail.title || SOURCE_KIND_LABELS[detail.sourceKind] || '订单'}</h1>
          <div className={styles.heroMeta}>
            <span className="status-chip" data-tone={tone}>{detail.statusText || '处理中'}</span>
            {detail.referenceNo ? <span className="status-chip">{detail.referenceNo}</span> : null}
          </div>
        </div>

        <div className={styles.amountCard}>
          <span>{amountLabel}</span>
          <strong>{formatCurrency(amountValue)}</strong>
          <p>{amountMeta}</p>
        </div>
      </section>

      <section className={styles.grid}>
        <div className={styles.mainStack}>
          <section className={`card ${styles.panel}`}>
            <div className={styles.panelHead}>
              <h2>订单信息</h2>
            </div>

            <div className={styles.infoGrid}>
              {infoCards.map((item) => (
                <article className={styles.infoCard} key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </article>
              ))}
            </div>

            <dl className={styles.metaList}>
              {metaRows.map((item) => (
                <div key={item.label}>
                  <dt>{item.label}</dt>
                  <dd className={item.mono ? styles.mono : undefined}>{item.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          {detail.paymentPlans && detail.paymentPlans.length > 0 ? (
            <section className={`card ${styles.panel}`}>
              <div className={styles.panelHead}>
                <h2>支付计划</h2>
              </div>

              <div className={styles.planList}>
                {detail.paymentPlans.map((item) => (
                  <article className={styles.planItem} key={item.id}>
                    <div>
                      <strong>{item.name}</strong>
                      <p>{item.dueAt ? `应付时间 ${formatDateTime(item.dueAt)}` : '应付时间未设置'}</p>
                    </div>
                    <div className={styles.planMeta}>
                      <span>{item.status || '处理中'}</span>
                      <strong>{formatCurrency(item.amount)}</strong>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {detail.timeline && detail.timeline.length > 0 ? (
            <section className={`card ${styles.panel}`}>
              <div className={styles.panelHead}>
                <h2>处理进度</h2>
              </div>

              <div className={styles.planList}>
                {detail.timeline.map((item, index) => (
                  <article className={styles.planItem} key={`${item.title}-${index}`}>
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.description || '状态已记录'}</p>
                    </div>
                    <div className={styles.planMeta}>
                      <span>{item.at ? formatDateTime(item.at) : '时间待补充'}</span>
                      <strong>{item.status || '已记录'}</strong>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <aside className={styles.sideStack}>
          <section className={`card ${styles.panel}`}>
            <div className={styles.panelHead}>
              <h2>下一步</h2>
            </div>

            <div className={styles.actionStack}>
              {detail.statusGroup === 'pending_payment' ? (
                <button className="button-secondary" disabled={paying} onClick={() => void handlePay()} type="button">
                  {paying ? '拉起支付中…' : '去支付'}
                </button>
              ) : null}
              {relatedAction ? (
                <Link className="button-ghost" to={relatedAction.path}>
                  {relatedAction.label}
                </Link>
              ) : null}
              <Link className="button-ghost" to="/me/orders">
                返回我的订单
              </Link>
            </div>

            {actionError ? <div className="status-note" data-tone="danger">{actionError}</div> : null}
          </section>
        </aside>
      </section>
    </main>
  );
}
