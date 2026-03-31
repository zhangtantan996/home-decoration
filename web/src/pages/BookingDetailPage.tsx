import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ErrorBlock, LoadingBlock } from '../components/AsyncState';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useAsyncData } from '../hooks/useAsyncData';
import { getBookingDetail, paySurveyDeposit } from '../services/bookings';
import type { BookingTimelineItemVM } from '../types/viewModels';
import { formatCurrency } from '../utils/format';

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

function renderRefundNotice(text: string) {
  return text
    .split(/(\d+%|¥\d+(?:\.\d+)?|转为设计费[^，。；]*)/g)
    .filter(Boolean)
    .map((segment, index) => {
      if (/^\d+%$/.test(segment) || /^¥\d+(?:\.\d+)?$/.test(segment)) {
        return <strong className="booking-detail-refund-strong booking-detail-refund-strong--danger" key={`${segment}-${index}`}>{segment}</strong>;
      }
      if (segment.includes('转为设计费')) {
        return <strong className="booking-detail-refund-strong" key={`${segment}-${index}`}>{segment}</strong>;
      }
      return <span key={`${segment}-${index}`}>{segment}</span>;
    });
}

export function BookingDetailPage() {
  const params = useParams();
  const bookingId = Number(params.id || 0);
  const { data, loading, error, reload } = useAsyncData(() => getBookingDetail(bookingId), [bookingId]);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  if (loading) return <div className="top-detail"><LoadingBlock title="加载预约详情" /></div>;
  if (error || !data) return <div className="top-detail"><ErrorBlock description={error || '预约详情不存在'} onRetry={() => void reload()} /></div>;

  const refundNotice = data.surveyRefundNotice || '量房完成后若不继续设计，默认退回 60% 给用户；后续确认设计方案后，量房定金转为设计费抵扣。';
  const providerTypeText = data.providerFacts.find((item) => item.label === '身份')?.value || '服务商';
  const stageTitle = data.stageOverview.title;
  const stageTone = data.statusCode === 4 ? 'danger' : data.depositPaid ? 'brand' : 'warning';
  const canPayDeposit = data.statusCode >= 2 && !data.depositPaid && data.statusCode !== 4;
  const hasMerchantConfirmed =
    data.statusCode >= 2 ||
    Boolean(data.siteSurveySummary?.status) ||
    Boolean(data.budgetConfirmSummary?.status) ||
    Boolean(data.proposalId);
  const surveyStatus = data.siteSurveySummary?.status;
  const budgetStatus = data.budgetConfirmSummary?.status;
  const supportActions: Array<{ label: string; to: string }> = [];
  const bookingFacts = [
    { label: '建筑面积', value: data.areaText || '待确认' },
    { label: '预算范围', value: data.budgetRange || '待确认' },
    { label: '期望时间', value: data.preferredDate || '待确认' },
    { label: '最近更新', value: data.updatedAt || '刚刚更新' },
  ];

  type BookingAction =
    | { kind: 'pay'; label: string; hint: string }
    | { kind: 'link'; label: string; to: string; hint: string }
    | { kind: 'status'; label: string; hint: string };

  let primaryAction: BookingAction;

  if (data.statusCode === 4) {
    primaryAction = data.providerId > 0
      ? {
          kind: 'link',
          label: '重新发起预约',
          to: `/providers/${data.providerType}/${data.providerId}/booking`,
          hint: '本次预约已关闭，如仍有需求可直接重新填写并再次发起预约。',
        }
      : {
          kind: 'status',
          label: '预约已关闭',
          hint: '本次预约不会继续推进，如仍有需求可重新发起预约。',
        };
  } else if (!hasMerchantConfirmed) {
    primaryAction = {
      kind: 'status',
      label: `等待${providerTypeText}确认`,
      hint: `${providerTypeText}会先确认档期与需求匹配度，确认后才进入支付与量房安排。`,
    };
  } else if (canPayDeposit) {
    primaryAction = {
      kind: 'pay',
      label: '支付量房定金',
      hint: `${providerTypeText}已确认预约，完成支付后会继续安排量房。`,
    };
  } else if (surveyStatus === 'submitted' || surveyStatus === 'revision_requested') {
    primaryAction = {
      kind: 'link',
      label: '查看量房记录',
      to: `/bookings/${data.id}/site-survey`,
      hint: '量房记录已更新，等待你确认或提出调整。',
    };
  } else if (budgetStatus === 'submitted' || budgetStatus === 'rejected') {
    primaryAction = {
      kind: 'link',
      label: '预算确认',
      to: `/bookings/${data.id}/budget-confirm`,
      hint: '预算区间与设计方向已提交，确认后继续推进正式方案。',
    };
  } else if (data.proposalId) {
    primaryAction = {
      kind: 'link',
      label: '查看报价详情',
      to: `/proposals/${data.proposalId}`,
      hint: `${providerTypeText}已提交方案或报价，你可以查看细节并决定是否继续。`,
    };
  } else if (surveyStatus === 'confirmed' && !budgetStatus) {
    primaryAction = {
      kind: 'status',
      label: `等待${providerTypeText}提交预算`,
      hint: '量房记录已确认，下一步会进入预算与设计方向确认。',
    };
  } else if (budgetStatus === 'accepted' && !data.proposalId) {
    primaryAction = {
      kind: 'status',
      label: `等待${providerTypeText}提交方案`,
      hint: '预算与设计方向已确认，正式方案提交后会出现在这里。',
    };
  } else {
    primaryAction = {
      kind: 'status',
      label: '当前无需操作',
      hint: data.stageOverview.helperText,
    };
  }

  const detailActions: Array<{ label: string; to: string }> = [
    data.siteSurveySummary ? { label: '量房记录', to: `/bookings/${data.id}/site-survey` } : null,
    data.budgetConfirmSummary ? { label: '预算确认', to: `/bookings/${data.id}/budget-confirm` } : null,
    data.proposalId ? { label: '查看报价详情', to: `/proposals/${data.proposalId}` } : null,
  ]
    .filter((item): item is { label: string; to: string } => Boolean(item))
    .filter((item) => (primaryAction.kind === 'link' ? item.to !== primaryAction.to : true))
    .slice(0, 2);

  if (data.depositPaid) {
    supportActions.push({ label: '申请退款', to: `/bookings/${data.id}/refund` });
  }
  if (data.depositPaid || Boolean(data.siteSurveySummary) || Boolean(data.budgetConfirmSummary) || Boolean(data.proposalId)) {
    supportActions.push({ label: '发起投诉/争议', to: `/after-sales/new?bookingId=${data.id}&type=complaint` });
  }

  const openPaymentDialog = () => {
    setPaymentError(null);
    setPaymentDialogOpen(true);
  };

  const closePaymentDialog = () => {
    if (paymentSubmitting) return;
    setPaymentError(null);
    setPaymentDialogOpen(false);
  };

  const handlePaySurveyDeposit = async () => {
    setPaymentSubmitting(true);
    setPaymentError(null);

    try {
      const payment = await paySurveyDeposit(data.id);
      window.location.assign(payment.launchUrl);
    } catch (paymentRequestError) {
      setPaymentError(paymentRequestError instanceof Error ? paymentRequestError.message : '发起支付失败，请稍后重试。');
      setPaymentSubmitting(false);
    }
  };

  return (
    <div className="top-detail booking-detail-page">
      <section className="card booking-detail-hero">
        <div className="booking-detail-hero-media">
          <div className="booking-detail-hero-avatar-wrap">
            <img alt={data.providerName} className="booking-detail-hero-avatar" src={data.providerAvatar} />
          </div>
        </div>

        <div className="booking-detail-hero-copy">
          <div className="booking-detail-hero-head">
            <div>
              <p className="detail-kicker">预约单号 #{data.id}</p>
              <h1>{data.address}</h1>
            </div>
            <div className="inline-actions booking-detail-hero-statuses">
              <span className="status-chip" data-tone={data.depositPaid ? 'success' : data.statusCode === 4 ? 'danger' : data.statusCode >= 2 ? 'warning' : 'brand'}>
                {data.depositPaid ? '量房定金已支付' : stageTitle}
              </span>
              <span className="status-chip">{data.statusText}</span>
            </div>
          </div>

          <div className="booking-detail-provider-facts">
            {data.providerFacts.map((item) => (
              <article className="booking-detail-provider-fact" key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </article>
            ))}
          </div>

          <div className="booking-detail-hero-facts">
            {bookingFacts.map((item) => (
              <article className="booking-detail-hero-fact" key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="detail-layout booking-detail-layout">
        <div className="detail-main booking-detail-main">
          <section className="card section-card booking-detail-section">
            <div className="section-head booking-detail-section-head">
              <h2>流程进度</h2>
              <span className="status-chip" data-tone={stageTone}>{stageTitle}</span>
            </div>

            <div className="booking-detail-stepper">
              {data.timeline.map((item) => (
                <article className="booking-detail-step" data-state={item.state} key={item.title}>
                  <div className="booking-detail-step-line">
                    <span className="booking-detail-step-dot" data-state={item.state} />
                  </div>
                  <div className="booking-detail-step-content">
                    <div className="booking-detail-step-head">
                      <h3>{item.title}</h3>
                      <span className="status-chip" data-tone={readTimelineStateTone(item.state)}>{readTimelineStateText(item.state)}</span>
                    </div>
                    <p>{item.description}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="card section-card booking-detail-section">
            <div className="section-head booking-detail-section-head">
              <h2>预约信息</h2>
              <span className="booking-detail-meta">更新于 {data.updatedAt || '刚刚'}</span>
            </div>

            <div className="booking-detail-info-grid">
              <article className="booking-detail-info-card">
                <span>装修类型</span>
                <strong>{data.renovationType}</strong>
              </article>
              <article className="booking-detail-info-card">
                <span>建筑面积</span>
                <strong>{data.areaText}</strong>
              </article>
              <article className="booking-detail-info-card">
                <span>预算范围</span>
                <strong>{data.budgetRange}</strong>
              </article>
              <article className="booking-detail-info-card">
                <span>期望时间</span>
                <strong>{data.preferredDate}</strong>
              </article>
            </div>

            <div className="booking-detail-note-panel">
              <span>补充说明</span>
              <p>{data.notes}</p>
            </div>
          </section>

          {data.siteSurveySummary || data.budgetConfirmSummary ? (
            <section className="card section-card booking-detail-section">
              <div className="section-head booking-detail-section-head">
                <h2>阶段记录</h2>
              </div>

              <div className="booking-detail-record-grid">
                {data.siteSurveySummary ? (
                  <article className="booking-detail-record-card">
                    <div className="booking-detail-record-head">
                      <div>
                        <span>量房记录</span>
                        <strong>{data.siteSurveySummary.statusText}</strong>
                      </div>
                    </div>
                    <div className="booking-detail-record-meta">
                      <p><span>提交时间</span><strong>{data.siteSurveySummary.submittedAt || '待服务商提交'}</strong></p>
                      <p><span>确认时间</span><strong>{data.siteSurveySummary.confirmedAt || '待你确认'}</strong></p>
                    </div>
                    {data.siteSurveySummary.revisionRequestReason ? <div className="booking-detail-record-note">退回原因：{data.siteSurveySummary.revisionRequestReason}</div> : null}
                  </article>
                ) : null}

                {data.budgetConfirmSummary ? (
                  <article className="booking-detail-record-card">
                    <div className="booking-detail-record-head">
                      <div>
                        <span>预算确认</span>
                        <strong>{data.budgetConfirmSummary.statusText}</strong>
                      </div>
                    </div>
                    <div className="booking-detail-record-meta">
                      <p>
                        <span>预算区间</span>
                        <strong>{formatCurrency(data.budgetConfirmSummary.budgetMin)} - {formatCurrency(data.budgetConfirmSummary.budgetMax)}</strong>
                      </p>
                      <p><span>设计意向</span><strong>{data.budgetConfirmSummary.designIntent || '待服务商补充'}</strong></p>
                    </div>
                    {data.budgetConfirmSummary.rejectionReason ? <div className="booking-detail-record-note">退回原因：{data.budgetConfirmSummary.rejectionReason}</div> : null}
                  </article>
                ) : null}
              </div>
            </section>
          ) : null}
        </div>

        <aside className="detail-aside booking-detail-side">
          <section className="card section-card booking-detail-action-card">
            <div className="section-head booking-detail-section-head">
              <h2>当前动作</h2>
            </div>

            <div className="booking-detail-provider-card">
              <img alt={data.providerName} className="booking-detail-provider-avatar" src={data.providerAvatar} />
              <div className="booking-detail-provider-copy">
                <strong>{data.providerName}</strong>
              </div>
            </div>

            <div className="booking-detail-fee-card" data-paid={data.depositPaid}>
              <span>量房定金</span>
              <strong>{data.depositAmountText}</strong>
              <small>
                {data.depositPaid
                  ? `已支付，等待${providerTypeText}继续安排量房与沟通。`
                  : canPayDeposit
                    ? `${providerTypeText}已确认预约，完成支付后会继续安排量房。`
                    : `需先等待${providerTypeText}确认预约，再进入量房定金支付。`}
              </small>
            </div>

            <div className="status-note booking-detail-refund-note">
              <p>{renderRefundNotice(refundNotice)}</p>
            </div>

            <div className="detail-actions booking-detail-action-list">
              {primaryAction.kind === 'pay' ? (
                <button
                  className="button-secondary booking-detail-pay-button"
                  disabled={paymentSubmitting}
                  onClick={() => {
                    openPaymentDialog();
                  }}
                  type="button"
                >
                  {paymentSubmitting ? '跳转支付中…' : primaryAction.label}
                </button>
              ) : null}

              {primaryAction.kind === 'link' ? (
                <Link className="button-secondary" to={primaryAction.to}>{primaryAction.label}</Link>
              ) : null}

              {primaryAction.kind === 'status' ? (
                <div className="booking-detail-action-placeholder">
                  <strong>{primaryAction.label}</strong>
                  <span>{primaryAction.hint}</span>
                </div>
              ) : null}
            </div>

            {detailActions.length ? (
              <div className="booking-detail-action-section">
                <span className="booking-detail-action-section-title">过程记录</span>
                <div className="detail-actions booking-detail-action-list booking-detail-action-list--compact">
                  {detailActions.map((action) => (
                    <Link className="button-outline" key={action.to} to={action.to}>{action.label}</Link>
                  ))}
                </div>
              </div>
            ) : null}

            {supportActions.length ? (
              <div className="booking-detail-support-links">
                {supportActions.map((action) => (
                  <Link className="button-link" key={action.to} to={action.to}>{action.label}</Link>
                ))}
              </div>
            ) : null}
          </section>
        </aside>
      </section>

      <ConfirmDialog
        amount={data.depositAmountText}
        cancelText="暂不支付"
        confirmDisabled={paymentSubmitting}
        confirmText={paymentSubmitting ? '跳转中…' : '确认支付'}
        description={`确认后将为 ${data.providerName} 支付量房定金，并继续进入量房安排与后续沟通。`}
        error={paymentError}
        notice={refundNotice}
        noticeTitle="退款与抵扣说明"
        onCancel={closePaymentDialog}
        onConfirm={() => {
          void handlePaySurveyDeposit();
        }}
        open={paymentDialogOpen}
        title="确认支付量房定金"
      />
    </div>
  );
}
