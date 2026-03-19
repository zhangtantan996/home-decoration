import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ErrorBlock, LoadingBlock } from '../components/AsyncState';
import { BUDGET_CONFIRM_STATUS_LABELS, BUDGET_INCLUDE_LABELS } from '../constants/statuses';
import { useAsyncData } from '../hooks/useAsyncData';
import { acceptBookingBudgetConfirm, getBookingBudgetConfirm, rejectBookingBudgetConfirm } from '../services/bookings';
import { formatCurrency } from '../utils/format';

export function BookingBudgetConfirmPage() {
  const params = useParams();
  const bookingId = Number(params.id || 0);
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { data, loading, error, reload } = useAsyncData(() => getBookingBudgetConfirm(bookingId), [bookingId]);

  if (loading) return <div className="container page-stack"><LoadingBlock title="加载预算确认" /></div>;
  if (error) return <div className="container page-stack"><ErrorBlock description={error} onRetry={() => void reload()} /></div>;
  if (!data) {
    return (
      <div className="container page-stack">
        <section className="card section-card">
          <div className="panel-head">
            <div>
              <p className="kicker eyebrow-accent">预算确认</p>
              <h1 className="section-title">预约 #{bookingId} 暂无预算确认</h1>
            </div>
            <Link className="button-link" to={`/bookings/${bookingId}`}>返回预约详情</Link>
          </div>
          <p className="detail-note">服务商尚未提交预算区间和设计意向，提交后会在这里展示。</p>
        </section>
      </div>
    );
  }

  const includes = Object.entries(data.includes || {}).filter(([, checked]) => checked);

  return (
    <div className="container page-stack">
      <section className="card section-card">
        <div className="panel-head">
          <div>
            <p className="kicker eyebrow-accent">预算确认</p>
            <h1 className="section-title">预约 #{bookingId} 预算与设计意向</h1>
          </div>
          <Link className="button-link" to={`/bookings/${bookingId}`}>返回预约详情</Link>
        </div>
        {message ? <div className="status-note" style={{ marginBottom: 16 }}>{message}</div> : null}
        {data.rejectionReason ? <div className="status-note" style={{ marginBottom: 16 }}>上次拒绝原因：{data.rejectionReason}</div> : null}
        <div className="detail-stat-grid">
          <article className="detail-stat"><span>当前状态</span><strong>{BUDGET_CONFIRM_STATUS_LABELS[data.status] || data.status}</strong></article>
          <article className="detail-stat"><span>预算区间</span><strong>{formatCurrency(data.budgetMin)} - {formatCurrency(data.budgetMax)}</strong></article>
          <article className="detail-stat"><span>提交时间</span><strong>{data.submittedAt || '待提交'}</strong></article>
          <article className="detail-stat"><span>接受时间</span><strong>{data.acceptedAt || '待确认'}</strong></article>
        </div>
      </section>

      <section className="card section-card">
        <div className="section-head"><h2>预算包含项</h2></div>
        <div className="inline-actions" style={{ flexWrap: 'wrap' }}>
          {includes.map(([key]) => <span className="status-chip" key={key}>{BUDGET_INCLUDE_LABELS[key] || key}</span>)}
        </div>
        <div className="detail-note" style={{ marginTop: 16 }}>{data.notes || '无补充说明'}</div>
      </section>

      <section className="card section-card">
        <div className="section-head"><h2>设计意向</h2></div>
        <p className="detail-note">{data.designIntent || '未填写设计意向'}</p>
      </section>

      <section className="card section-card">
        <div className="section-head"><h2>接受或拒绝</h2></div>
        <textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="如需拒绝，请说明预算压力或方向不匹配的原因。" />
        <div className="inline-actions" style={{ marginTop: 16 }}>
          <button className="button-secondary" disabled={submitting || data.status === 'accepted'} onClick={async () => {
            setSubmitting(true);
            setMessage('');
            try {
              await acceptBookingBudgetConfirm(bookingId);
              setMessage('预算与设计意向已确认，商家可进入方案提交阶段。');
              await reload();
            } catch (submitError) {
              setMessage(submitError instanceof Error ? submitError.message : '确认失败');
            } finally {
              setSubmitting(false);
            }
          }} type="button">{submitting ? '处理中…' : '接受预算并确认设计意向'}</button>
          <button className="button-outline" disabled={submitting} onClick={async () => {
            setSubmitting(true);
            setMessage('');
            try {
              await rejectBookingBudgetConfirm(bookingId, reason.trim() || '预算超出预期');
              setMessage('已拒绝预算，本预约已关闭。');
              await reload();
            } catch (submitError) {
              setMessage(submitError instanceof Error ? submitError.message : '拒绝失败');
            } finally {
              setSubmitting(false);
            }
          }} type="button">拒绝预算</button>
        </div>
      </section>
    </div>
  );
}
