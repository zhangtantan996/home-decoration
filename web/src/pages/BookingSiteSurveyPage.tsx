import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ErrorBlock, LoadingBlock } from '../components/AsyncState';
import { SITE_SURVEY_STATUS_LABELS } from '../constants/statuses';
import { useAsyncData } from '../hooks/useAsyncData';
import { confirmBookingSiteSurvey, getBookingSiteSurvey, rejectBookingSiteSurvey } from '../services/bookings';

export function BookingSiteSurveyPage() {
  const params = useParams();
  const bookingId = Number(params.id || 0);
  const [message, setMessage] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { data, loading, error, reload } = useAsyncData(() => getBookingSiteSurvey(bookingId), [bookingId]);

  if (loading) return <div className="container page-stack"><LoadingBlock title="加载量房记录" /></div>;
  if (error) return <div className="container page-stack"><ErrorBlock description={error} onRetry={() => void reload()} /></div>;
  if (!data) {
    return (
      <div className="container page-stack">
        <section className="card section-card">
          <div className="panel-head">
            <div>
              <p className="kicker eyebrow-accent">量房进度</p>
              <h1 className="section-title">预约 #{bookingId} 暂无量房记录</h1>
            </div>
            <Link className="button-link" to={`/bookings/${bookingId}`}>返回预约详情</Link>
          </div>
          <p className="detail-note">服务商尚未提交量房照片和尺寸记录，提交后会在这里展示。</p>
        </section>
      </div>
    );
  }

  return (
    <div className="container page-stack">
      <section className="card section-card">
        <div className="panel-head">
          <div>
            <p className="kicker eyebrow-accent">量房进度</p>
            <h1 className="section-title">预约 #{bookingId} 量房记录</h1>
          </div>
          <Link className="button-link" to={`/bookings/${bookingId}`}>返回预约详情</Link>
        </div>
        {message ? <div className="status-note" style={{ marginBottom: 16 }}>{message}</div> : null}
        {data.revisionRequestReason ? <div className="status-note" style={{ marginBottom: 16 }}>上次退回原因：{data.revisionRequestReason}</div> : null}
        <div className="detail-stat-grid">
          <article className="detail-stat"><span>当前状态</span><strong>{SITE_SURVEY_STATUS_LABELS[data.status] || data.status}</strong></article>
          <article className="detail-stat"><span>提交时间</span><strong>{data.submittedAt || '待提交'}</strong></article>
          <article className="detail-stat"><span>确认时间</span><strong>{data.confirmedAt || '待确认'}</strong></article>
          <article className="detail-stat"><span>重测时间</span><strong>{data.revisionRequestedAt || '无'}</strong></article>
        </div>
      </section>

      <section className="card section-card">
        <div className="section-head"><h2>量房照片</h2></div>
        <div className="inline-actions" style={{ flexWrap: 'wrap' }}>
          {data.photos.map((photo) => (
            <a key={photo} href={photo} rel="noreferrer" target="_blank"><span className="status-chip">查看图片</span></a>
          ))}
        </div>
        {!data.photos.length ? <p className="detail-note" style={{ marginTop: 12 }}>暂未提交照片</p> : null}
      </section>

      <section className="card section-card">
        <div className="section-head"><h2>尺寸记录</h2></div>
        <div className="project-list">
          {Object.entries(data.dimensions || {}).map(([area, value]) => (
            <div className="proj-card" key={area}>
              <div>
                <div className="proj-name">{area}</div>
                <div className="proj-phase">长 {value.length} / 宽 {value.width} / 高 {value.height} {value.unit || 'm'}</div>
              </div>
            </div>
          ))}
        </div>
        {data.notes ? <p className="detail-note" style={{ marginTop: 16 }}>{data.notes}</p> : null}
      </section>

      <section className="card section-card">
        <div className="section-head"><h2>确认或要求重测</h2></div>
        <textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="如需重新量房，请写明原因和需要补测的点。" />
        <div className="inline-actions" style={{ marginTop: 16 }}>
          <button className="button-secondary" disabled={submitting || data.status === 'confirmed'} onClick={async () => {
            setSubmitting(true);
            setMessage('');
            try {
              await confirmBookingSiteSurvey(bookingId);
              setMessage('量房已确认，可继续查看预算确认。');
              await reload();
            } catch (submitError) {
              setMessage(submitError instanceof Error ? submitError.message : '确认失败');
            } finally {
              setSubmitting(false);
            }
          }} type="button">{submitting ? '提交中…' : '确认量房完成'}</button>
          <button className="button-outline" disabled={submitting} onClick={async () => {
            setSubmitting(true);
            setMessage('');
            try {
              await rejectBookingSiteSurvey(bookingId, reason.trim() || '请重新量房');
              setMessage('已要求重新量房，等待商家重提。');
              await reload();
            } catch (submitError) {
              setMessage(submitError instanceof Error ? submitError.message : '提交失败');
            } finally {
              setSubmitting(false);
            }
          }} type="button">要求重新量房</button>
        </div>
      </section>
    </div>
  );
}
