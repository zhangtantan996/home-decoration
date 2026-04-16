import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ErrorBlock, LoadingBlock } from '../components/AsyncState';
import { BUDGET_INCLUDE_LABELS } from '../constants/statuses';
import { useAsyncData } from '../hooks/useAsyncData';
import { getBookingDetail, paySurveyDeposit } from '../services/bookings';
import type { BookingTimelineItemVM } from '../types/viewModels';
import { formatCurrency } from '../utils/format';
import { startAlipayWebPayment } from '../utils/paymentLaunch';
import styles from './BookingDetailPage.module.scss';

function readTimelineStateText(state: BookingTimelineItemVM['state']) {
  if (state === 'done') return '已完成';
  if (state === 'danger') return '已关闭';
  if (state === 'active') return '进行中';
  return '待处理';
}

function readTimelineStateTone(state: BookingTimelineItemVM['state']) {
  if (state === 'done') return 'success';
  if (state === 'danger') return 'danger';
  if (state === 'active') return 'brand';
  return 'warning';
}

function readBudgetConfirmTone(status: string | undefined) {
  if (status === 'accepted') return 'success';
  if (status === 'rejected') return 'danger';
  return 'warning';
}

type StepAction = {
  key: string;
  label: string;
  to?: string;
  onClick?: () => void;
  tone?: 'secondary' | 'outline';
};

function readButtonClassName(tone: StepAction['tone']) {
  if (tone === 'outline') return 'button-outline';
  return 'button-secondary';
}

export function BookingDetailPage() {
  const params = useParams();
  const bookingId = Number(params.id || 0);
  const { data, loading, error, reload } = useAsyncData(() => getBookingDetail(bookingId), [bookingId]);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);

  useEffect(() => {
    if (!budgetDialogOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setBudgetDialogOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [budgetDialogOpen]);

  if (loading) return <div className="top-detail"><LoadingBlock title="加载预约详情" /></div>;
  if (error || !data) return <div className="top-detail"><ErrorBlock description={error || '预约详情不存在'} onRetry={() => void reload()} /></div>;

  const providerTypeText = data.providerFacts.find((item) => item.label === '身份')?.value || '服务商';
  const providerReputation = data.providerFacts.find((item) => item.label === '口碑参考')?.value || '待补充';
  const providerExperience = data.providerFacts.find((item) => item.label === '从业经验')?.value || '待补充';
  const providerCompleted = data.providerFacts.find((item) => item.label === '完成项目')?.value || '待补充';
  const stageTitle = data.stageOverview.title;
  const bookingStatusText = data.statusText || (data.statusCode === 4 ? '已关闭' : '进行中');
  const canPayDeposit = data.statusCode >= 2 && !data.depositPaid && data.statusCode !== 4;
  const designFeeQuoteStatus = String(data.designFeeQuoteSummary?.status || '').trim();
  const designFeeOrderStatus = typeof data.designFeeQuoteSummary?.orderStatus === 'number'
    ? Number(data.designFeeQuoteSummary.orderStatus)
    : null;
  const designDeliverableStatus = String(data.designDeliverableSummary?.status || '').trim();
  const constructionBridgeStarted = [
    'construction_party_pending',
    'construction_quote_pending',
    'ready_to_start',
    'in_construction',
    'node_acceptance_in_progress',
    'completed',
    'archived',
    'disputed',
    'payment_paused',
  ].includes(String(data.currentStage || '').trim());
  const bookingNote = data.notes && data.notes !== '无补充说明' ? data.notes : '';
  const budgetIncludes = Object.entries(data.budgetConfirmSummary?.includes || {})
    .filter(([, checked]) => checked)
    .map(([key]) => BUDGET_INCLUDE_LABELS[key] || key);
  const surveyPhotoCount = data.siteSurveySummary?.photos?.length || 0;
  const surveyDimensionCount = Object.keys(data.siteSurveySummary?.dimensions || {}).length;
  const budgetRejectProgress = data.budgetConfirmSummary
    ? (data.budgetConfirmSummary.rejectLimit > 0
      ? `${data.budgetConfirmSummary.rejectCount}/${data.budgetConfirmSummary.rejectLimit}`
      : `${data.budgetConfirmSummary.rejectCount}`)
    : '0';
  const summaryFacts = [
    { label: '当前阶段', value: stageTitle },
    { label: '预约状态', value: bookingStatusText },
    { label: '建筑面积', value: data.areaText || '待确认' },
    { label: '预算范围', value: data.budgetRange || '待确认' },
    { label: '装修类型', value: data.renovationType || '待确认' },
    { label: '期望时间', value: data.preferredDate || '待确认' },
  ];

  const handlePaySurveyDeposit = async () => {
    setPaymentSubmitting(true);
    setPaymentError(null);

    try {
      await startAlipayWebPayment((request) => paySurveyDeposit(data.id, request), { onPaid: reload });
    } catch (paymentRequestError) {
      setPaymentError(paymentRequestError instanceof Error ? paymentRequestError.message : '发起支付失败，请稍后重试。');
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const timelineActions = data.timeline.map<StepAction[]>((_, index) => {
    switch (index) {
      case 2:
        if (data.surveyDepositPaymentId) {
          return [{ key: 'view-survey-payment', label: '查看记录', to: `/payments/${data.surveyDepositPaymentId}`, tone: 'outline' }];
        }
        if (canPayDeposit) {
          return [{ key: 'pay-survey-deposit', label: paymentSubmitting ? '拉起支付中…' : '去支付', onClick: () => { void handlePaySurveyDeposit(); } }];
        }
        return [];
      case 3:
      {
        const actions: StepAction[] = [];
        if (data.siteSurveySummary) {
          actions.push({ key: 'view-site-survey', label: '查看量房资料', to: `/bookings/${data.id}/site-survey`, tone: 'outline' });
        }
        if (data.budgetConfirmSummary) {
          actions.push({ key: 'view-budget-confirm', label: '查看沟通确认', onClick: () => setBudgetDialogOpen(true), tone: 'outline' });
        }
        return actions;
      }
      case 4:
        if (designFeeQuoteStatus === 'pending') {
          return [{ key: 'pay-design-quote', label: '确认并支付', to: `/bookings/${data.id}/design-quote` }];
        }
        if (designFeeQuoteStatus === 'confirmed' && designFeeOrderStatus === 0) {
          const actions: StepAction[] = [{ key: 'view-design-quote', label: '查看报价', to: `/bookings/${data.id}/design-quote`, tone: 'outline' }];
          if (data.designFeeQuoteSummary?.orderId) {
            actions.push({ key: 'pay-design-order', label: '去支付', to: `/orders/${data.designFeeQuoteSummary.orderId}` });
          }
          return actions;
        }
        if (designFeeQuoteStatus === 'confirmed' && designFeeOrderStatus === 1 && data.designFeeQuoteSummary?.orderId) {
          return [{ key: 'view-design-order', label: '查看订单', to: `/orders/${data.designFeeQuoteSummary.orderId}`, tone: 'outline' }];
        }
        return [];
      case 5:
        if (!data.designDeliverableSummary) return [];
        if (
          designDeliverableStatus === 'submitted'
          || designDeliverableStatus === 'rejected'
          || designDeliverableStatus === 'accepted'
        ) {
          return [{
            key: 'view-design-deliverable',
            label: designDeliverableStatus === 'accepted' ? '查看详情' : '查看交付',
            to: `/bookings/${data.id}/design-deliverable`,
            tone: 'outline',
          }];
        }
        return [];
      case 6:
        if (constructionBridgeStarted) return [];
        if (!data.proposalId) return [];
        return [{ key: 'view-proposal', label: '查看方案', to: `/proposals/${data.proposalId}` }];
      case 7:
        if (!constructionBridgeStarted) return [];
        return [{ key: 'view-construction-bridge', label: '查看后续进度', to: '/progress' }];
      default:
        return [];
    }
  });

  return (
    <div className={styles.page}>
      <section className={styles.topGrid}>
        <article className={styles.summaryCard}>
          <div className={styles.summaryHeader}>
            <div className={styles.summaryIntro}>
              <p className={styles.kicker}>预约单号 #{data.id}</p>
              <h1>{data.address}</h1>
            </div>
          </div>

          <div className={styles.summaryGrid}>
            {summaryFacts.map((item) => (
              <article className={styles.summaryItem} key={item.label}>
                <span>{item.label}</span>
                <strong title={item.value}>{item.value}</strong>
              </article>
            ))}
          </div>

          {bookingNote ? (
            <div className={styles.summaryNote}>
              <span>补充说明</span>
              <p>{bookingNote}</p>
            </div>
          ) : null}

          {data.siteSurveySummary ? (
            <div className={styles.summaryNote}>
              <span>量房资料摘要</span>
              <p>
                状态：{data.siteSurveySummary.statusText}；图片 {surveyPhotoCount} 张；空间尺寸 {surveyDimensionCount} 项。
                {data.siteSurveySummary.submittedAt ? ` 提交于 ${data.siteSurveySummary.submittedAt}。` : ''}
              </p>
              <div className="inline-actions">
                <Link className="button-outline" to={`/bookings/${data.id}/site-survey`}>查看量房明细</Link>
              </div>
            </div>
          ) : null}
        </article>

        <aside className={styles.providerCard}>
          <div className={styles.providerHead}>
            <img alt={data.providerName} className={styles.providerAvatar} src={data.providerAvatar} />
            <div className={styles.providerBody}>
              <div className={styles.providerTitleRow}>
                <strong>{data.providerName}</strong>
                <span className="status-chip">{providerTypeText}</span>
              </div>
              {data.providerTags.length ? (
                <p className={styles.providerTagline}>{data.providerTags.join(' · ')}</p>
              ) : null}
            </div>
          </div>

          <div className={styles.providerStats}>
            <article className={styles.providerStat}>
              <span>口碑参考</span>
              <strong>{providerReputation}</strong>
            </article>
            <article className={styles.providerStat}>
              <span>从业经验</span>
              <strong>{providerExperience}</strong>
            </article>
            <article className={styles.providerStat}>
              <span>完成项目</span>
              <strong>{providerCompleted}</strong>
            </article>
          </div>
        </aside>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <div className={styles.sectionCopy}>
            <h2>流程进度</h2>
          </div>
        </div>
        <div className={styles.stepper}>
          {data.timeline.map((item, index) => {
            const actions = timelineActions[index] || [];
            const isDepositStep = index === 2;

            return (
              <article className={styles.step} data-state={item.state} key={item.title}>
                <div className={styles.stepIndicator} />
                <div className={styles.stepContent}>
                  <div className={styles.stepTitleRow}>
                    <h3>{item.title}</h3>
                    <span className="status-chip" data-tone={readTimelineStateTone(item.state)}>{readTimelineStateText(item.state)}</span>
                  </div>
                  <div className={`${styles.stepBodyRow} ${!actions.length ? styles.stepBodyRowFull : ''}`}>
                    <p className={styles.stepDescription}>{item.description}</p>
                    {actions.length ? (
                      <div className={styles.stepActionGroup}>
                        {actions.map((action) => (
                          action.to ? (
                            <Link className={`${readButtonClassName(action.tone)} ${styles.stepActionButton}`} key={action.key} to={action.to}>
                              {action.label}
                            </Link>
                          ) : (
                            <button
                              className={`${readButtonClassName(action.tone)} ${styles.stepActionButton}`}
                              disabled={paymentSubmitting && isDepositStep}
                              key={action.key}
                              onClick={action.onClick}
                              type="button"
                            >
                              {action.label}
                            </button>
                          )
                        ))}
                      </div>
                    ) : null}
                  </div>
                  {isDepositStep && paymentError ? <div className="status-note" data-tone="danger">{paymentError}</div> : null}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {budgetDialogOpen && data.budgetConfirmSummary ? (
        <div
          aria-hidden="true"
          className={`modal-backdrop ${styles.budgetDialogBackdrop}`}
          onClick={() => setBudgetDialogOpen(false)}
          role="presentation"
        >
          <div
            aria-modal="true"
            className={`modal-card ${styles.budgetDialog}`}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className={styles.budgetDialogHead}>
              <div className={styles.budgetDialogIntro}>
                <p className={styles.budgetDialogKicker}>沟通确认详情</p>
                <div className={styles.budgetDialogTitleRow}>
                  <h3>预约 #{data.id} 沟通确认记录</h3>
                  <span className="status-chip" data-tone={readBudgetConfirmTone(data.budgetConfirmSummary.status)}>
                    {data.budgetConfirmSummary.statusText}
                  </span>
                </div>
              </div>
              <button className={styles.dialogClose} onClick={() => setBudgetDialogOpen(false)} type="button">
                关闭
              </button>
            </div>

            <div className={styles.budgetDialogMeta}>
              <article className={styles.budgetDialogMetric}>
                <span>状态</span>
                <strong>{data.budgetConfirmSummary.statusText}</strong>
              </article>
              <article className={styles.budgetDialogMetric}>
                <span>预算区间</span>
                <strong>{formatCurrency(data.budgetConfirmSummary.budgetMin)} - {formatCurrency(data.budgetConfirmSummary.budgetMax)}</strong>
              </article>
              <article className={styles.budgetDialogMetric}>
                <span>提交时间</span>
                <strong>{data.budgetConfirmSummary.submittedAt || '待补充'}</strong>
              </article>
              <article className={styles.budgetDialogMetric}>
                <span>处理时间</span>
                <strong>{data.budgetConfirmSummary.acceptedAt || data.budgetConfirmSummary.rejectedAt || '待处理'}</strong>
              </article>
              <article className={styles.budgetDialogMetric}>
                <span>驳回次数</span>
                <strong>{budgetRejectProgress}</strong>
              </article>
              <article className={styles.budgetDialogMetric}>
                <span>最近驳回</span>
                <strong>{data.budgetConfirmSummary.lastRejectedAt || '暂无'}</strong>
              </article>
            </div>

            <div className={styles.budgetDialogBody}>
              {budgetIncludes.length ? (
                <section className={`${styles.budgetDialogPanel} ${styles.budgetDialogPanelWide}`}>
                  <span className={styles.budgetDialogLabel}>沟通包含项</span>
                  <div className={styles.budgetChipRow}>
                    {budgetIncludes.map((item) => (
                      <span className="status-chip" key={item}>{item}</span>
                    ))}
                  </div>
                </section>
              ) : null}

              <section className={styles.budgetDialogPanel}>
                <span className={styles.budgetDialogLabel}>设计诉求</span>
                <div className={styles.budgetDialogRows}>
                  <div className={styles.budgetDialogRow}>
                    <span>设计方向</span>
                    <p>{data.budgetConfirmSummary.designIntent || '暂未填写'}</p>
                  </div>
                  <div className={styles.budgetDialogRow}>
                    <span>风格方向</span>
                    <p>{data.budgetConfirmSummary.styleDirection || '暂未填写'}</p>
                  </div>
                </div>
              </section>

              <section className={styles.budgetDialogPanel}>
                <span className={styles.budgetDialogLabel}>空间与工期</span>
                <div className={styles.budgetDialogRows}>
                  <div className={styles.budgetDialogRow}>
                    <span>空间需求</span>
                    <p>{data.budgetConfirmSummary.spaceRequirements || '暂未填写'}</p>
                  </div>
                  <div className={styles.budgetDialogRow}>
                    <span>可接受工期</span>
                    <p>{data.budgetConfirmSummary.expectedDurationDays ? `${data.budgetConfirmSummary.expectedDurationDays} 天` : '暂未填写'}</p>
                  </div>
                </div>
              </section>

              <section className={`${styles.budgetDialogPanel} ${styles.budgetDialogPanelWide}`}>
                <span className={styles.budgetDialogLabel}>补充说明</span>
                <div className={styles.budgetDialogRows}>
                  <div className={styles.budgetDialogRow}>
                    <span>特殊要求</span>
                    <p>{data.budgetConfirmSummary.specialRequirements || '暂无特殊要求'}</p>
                  </div>
                  <div className={styles.budgetDialogRow}>
                    <span>设计师备注</span>
                    <p>{data.budgetConfirmSummary.notes || '暂无补充说明'}</p>
                  </div>
                </div>
              </section>
            </div>

            {data.budgetConfirmSummary.rejectionReason ? (
              <section className={styles.budgetDialogAlert}>
                <span className={styles.budgetDialogLabel}>最近一次退回原因</span>
                <div className="status-note" data-tone="danger">{data.budgetConfirmSummary.rejectionReason}</div>
                <div className="status-note" style={{ marginTop: 12 }}>
                  {data.budgetConfirmSummary.canResubmit
                    ? '当前沟通确认仍可由商家在同一条记录上重提。'
                    : '当前沟通确认已达到驳回上限，后续会进入关闭/退款链。'}
                </div>
              </section>
            ) : null}

            <div className={styles.budgetDialogActions}>
              <button className="button-secondary" onClick={() => setBudgetDialogOpen(false)} type="button">
                我知道了
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
