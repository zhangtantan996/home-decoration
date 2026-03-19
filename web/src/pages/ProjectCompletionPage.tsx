import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ErrorBlock, LoadingBlock } from '../components/AsyncState';
import { useAsyncData } from '../hooks/useAsyncData';
import { approveProjectCompletion, getProjectCompletion, rejectProjectCompletion } from '../services/projects';

export function ProjectCompletionPage() {
  const params = useParams();
  const projectId = Number(params.id || 0);
  const [message, setMessage] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { data, loading, error, reload } = useAsyncData(() => getProjectCompletion(projectId), [projectId]);

  if (loading) return <div className="container page-stack"><LoadingBlock title="加载完工验收" /></div>;
  if (error || !data) return <div className="container page-stack"><ErrorBlock description={error || '完工信息不存在'} onRetry={() => void reload()} /></div>;

  const canApprove = data.availableActions?.includes('approve_completion');
  const canReject = data.availableActions?.includes('reject_completion');
  const canReview = Boolean(canApprove || canReject);

  const actionHint = (() => {
    if (canReview) {
      return '当前可执行整体验收通过或驳回整改。';
    }
    if (!data.completionSubmittedAt) {
      return '施工方尚未提交当前有效的完工材料，暂时不能执行整体验收。';
    }
    if (data.businessStage === 'archived' || data.inspirationCaseDraftId) {
      return '项目已完成整体验收并归档，无需重复操作。';
    }
    return '当前没有可执行的整体验收动作，请以项目主链状态为准。';
  })();

  return (
    <div className="container page-stack">
      <section className="card section-card">
        <div className="panel-head">
          <div>
            <p className="kicker eyebrow-accent">整体验收</p>
            <h1 className="section-title">项目 #{projectId} 完工材料</h1>
          </div>
          <Link className="button-link" to={`/projects/${projectId}`}>返回项目详情</Link>
        </div>
        {message ? <div className="status-note" style={{ marginBottom: 16 }}>{message}</div> : null}
        {data.completionRejectionReason ? <div className="status-note" style={{ marginBottom: 16 }}>上次驳回原因：{data.completionRejectionReason}</div> : null}
        <div className="detail-stat-grid">
          <article className="detail-stat"><span>当前阶段</span><strong>{data.businessStage || '处理中'}</strong></article>
          <article className="detail-stat"><span>提交时间</span><strong>{data.completionSubmittedAt || '未提交'}</strong></article>
          <article className="detail-stat"><span>整改时间</span><strong>{data.completionRejectedAt || '无'}</strong></article>
          <article className="detail-stat"><span>案例草稿</span><strong>{data.inspirationCaseDraftId ? `#${data.inspirationCaseDraftId}` : '待生成'}</strong></article>
        </div>
        {data.flowSummary ? <p className="detail-note" style={{ marginTop: 16 }}>{data.flowSummary}</p> : null}
      </section>

      <section className="card section-card">
        <div className="section-head"><h2>完工说明</h2></div>
        <p className="detail-note">{data.completionNotes || '暂无完工说明'}</p>
      </section>

      <section className="card section-card">
        <div className="section-head"><h2>完工照片</h2></div>
        <div className="inline-actions" style={{ flexWrap: 'wrap' }}>
          {data.completedPhotos.map((photo) => (
            <a key={photo} href={photo} rel="noreferrer" target="_blank"><span className="status-chip">查看图片</span></a>
          ))}
        </div>
        {!data.completedPhotos.length ? <p className="detail-note" style={{ marginTop: 16 }}>商家尚未上传完工照片。</p> : null}
      </section>

      <section className="card section-card">
        <div className="section-head"><h2>{canReview ? '通过或驳回' : '当前不可操作'}</h2></div>
        <p className="detail-note">{actionHint}</p>
        {canReview ? (
          <>
            <textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="如需驳回，请写明需要整改的点。" />
            <div className="inline-actions" style={{ marginTop: 16 }}>
              <button className="button-secondary" disabled={submitting || !canApprove} onClick={async () => {
                setSubmitting(true);
                setMessage('');
                try {
                  const result = await approveProjectCompletion(projectId);
                  setMessage(result.auditId ? `验收通过，已生成案例草稿 #${result.auditId}。` : '验收通过。');
                  await reload();
                } catch (submitError) {
                  setMessage(submitError instanceof Error ? submitError.message : '验收失败');
                } finally {
                  setSubmitting(false);
                }
              }} type="button">{submitting ? '处理中…' : '整体验收通过'}</button>
              <button className="button-outline" disabled={submitting || !canReject} onClick={async () => {
                setSubmitting(true);
                setMessage('');
                try {
                  await rejectProjectCompletion(projectId, reason.trim() || '仍需整改');
                  setMessage('已驳回完工，项目退回施工整改。');
                  await reload();
                } catch (submitError) {
                  setMessage(submitError instanceof Error ? submitError.message : '驳回失败');
                } finally {
                  setSubmitting(false);
                }
              }} type="button">驳回并整改</button>
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}
