import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ErrorBlock, LoadingBlock } from '../components/AsyncState';
import { StatusBanner } from '../components/StatusBanner';
import { REFUND_STATUS_LABELS, REFUND_TYPE_LABELS } from '../constants/statuses';
import { useAsyncData } from '../hooks/useAsyncData';
import { getBookingDetail, listMyRefundApplications, submitBookingRefund, type RefundApplicationItem } from '../services/bookings';

const refundTypeOptions: Array<{ value: RefundApplicationItem['refundType']; label: string }> = [
  { value: 'intent_fee', label: REFUND_TYPE_LABELS.intent_fee },
  { value: 'design_fee', label: REFUND_TYPE_LABELS.design_fee },
  { value: 'construction_fee', label: REFUND_TYPE_LABELS.construction_fee },
  { value: 'full', label: REFUND_TYPE_LABELS.full },
];

export function BookingRefundPage() {
  const params = useParams();
  const bookingId = Number(params.id || 0);
  const [reason, setReason] = useState('');
  const [refundType, setRefundType] = useState<RefundApplicationItem['refundType']>('intent_fee');
  const [evidence, setEvidence] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data, loading, error, reload } = useAsyncData(async () => {
    const [booking, refunds] = await Promise.all([
      getBookingDetail(bookingId),
      listMyRefundApplications().catch(() => [] as RefundApplicationItem[]),
    ]);
    return {
      booking,
      refunds: refunds.filter((item) => Number(item.bookingId) === bookingId),
    };
  }, [bookingId]);

  const latestRefund = useMemo(() => data?.refunds?.[0] || null, [data?.refunds]);

  if (loading) {
    return <div className="container page-stack"><LoadingBlock title="加载退款申请页" /></div>;
  }

  if (error || !data) {
    return <div className="container page-stack"><ErrorBlock description={error || '预约不存在'} onRetry={() => void reload()} /></div>;
  }

  return (
    <div className="container page-stack">
      <StatusBanner
        label="退款申请"
        title="提交退款理由并进入平台异常处理"
        description="提交后会冻结普通流转，由平台结合当前预约、方案与履约状态统一处理。"
      />

      <section className="split-shell">
        <section className="dashboard-shell">
          <section className="card section-card">
            <div className="panel-head">
              <div>
                <p className="kicker eyebrow-accent">预约信息</p>
                <h2 className="section-title">{data.booking.address}</h2>
              </div>
            </div>
            <div className="data-grid detail-grid-two">
              <article><span>预约状态</span><strong>{data.booking.statusText}</strong></article>
              <article><span>服务商</span><strong>{data.booking.providerName}</strong></article>
              <article><span>意向金</span><strong>{data.booking.intentFeeText}</strong></article>
              <article><span>装修预算</span><strong>{data.booking.budgetRange}</strong></article>
            </div>
            {latestRefund ? (
              <p className="detail-note" style={{ marginTop: 16 }}>
                最近一条申请：{REFUND_STATUS_LABELS[latestRefund.status] || latestRefund.status}，类型 {REFUND_TYPE_LABELS[latestRefund.refundType] || latestRefund.refundType}。当前链路已进入平台异常处理。
              </p>
            ) : null}
          </section>
        </section>

        <section className="card section-card">
          <div className="panel-head">
            <div>
              <p className="kicker eyebrow-accent">提交申请</p>
              <h2 className="section-title">退款类型、原因、证据</h2>
            </div>
          </div>
          {message ? <div className="status-note" style={{ marginBottom: 16 }}>{message}</div> : null}
          <div className="form-grid">
            <div className="field">
              <label htmlFor="refund-type">退款类型</label>
              <select id="refund-type" value={refundType} onChange={(event) => setRefundType(event.target.value as RefundApplicationItem['refundType'])}>
                {refundTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="refund-reason">申请原因</label>
              <textarea
                id="refund-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="例如：服务商长期未响应，申请退回已支付意向金。"
              />
            </div>
            <div className="field">
              <label htmlFor="refund-evidence">证据 URL</label>
              <textarea
                id="refund-evidence"
                value={evidence}
                onChange={(event) => setEvidence(event.target.value)}
                placeholder="每行一条图片或文档 URL。"
              />
            </div>
          </div>

          <div className="inline-actions" style={{ marginTop: 18 }}>
            <button
              className="button-secondary"
              disabled={submitting || !reason.trim()}
              onClick={async () => {
                setSubmitting(true);
                setMessage('');
                try {
                  await submitBookingRefund(bookingId, {
                    refundType,
                    reason: reason.trim(),
                    evidence: evidence.split(/\n|,|，/).map((item) => item.trim()).filter(Boolean),
                  });
                  setMessage('退款申请已提交，当前链路已进入平台异常处理。');
                  await reload();
                } catch (submitError) {
                  setMessage(submitError instanceof Error ? submitError.message : '提交退款失败');
                } finally {
                  setSubmitting(false);
                }
              }}
              type="button"
            >
              {submitting ? '提交中…' : '提交退款申请'}
            </button>
            <Link className="button-outline" to={`/bookings/${bookingId}`}>返回预约详情</Link>
          </div>

          {data.refunds.length > 0 ? (
            <div className="project-list" style={{ marginTop: 16 }}>
              {data.refunds.map((item) => (
                <div className="proj-card" key={item.id}>
                  <div>
                    <div className="proj-name">#{item.id} · {item.refundType}</div>
                    <div className="proj-phase">{item.reason || '未填写原因'}</div>
                  </div>
                  <div className="proj-percent">{REFUND_STATUS_LABELS[item.status] || item.status}</div>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      </section>
    </div>
  );
}
