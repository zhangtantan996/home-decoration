import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ErrorBlock, LoadingBlock } from '../components/AsyncState';
import { useAsyncData } from '../hooks/useAsyncData';
import { getBusinessStageLabel } from '../constants/statuses';
import { getWebApiErrorMessage, isWebApiConflict } from '../services/http';
import { approveProjectCompletion, getProjectCompletion, rejectProjectCompletion, submitProjectReview } from '../services/projects';

function normalizeReviewImages(raw: string) {
  return raw
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 9);
}

export function ProjectCompletionPage() {
  const params = useParams();
  const projectId = Number(params.id || 0);
  const [message, setMessage] = useState('');
  const [reason, setReason] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewContent, setReviewContent] = useState('');
  const [reviewImages, setReviewImages] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { data, loading, error, reload } = useAsyncData(() => getProjectCompletion(projectId), [projectId]);

  if (loading) return <div className="container page-stack"><LoadingBlock title="加载完工验收" /></div>;
  if (error || !data) return <div className="container page-stack"><ErrorBlock description={error || '完工信息不存在'} onRetry={() => void reload()} /></div>;

  const canApprove = data.availableActions?.includes('approve_completion');
  const canReject = data.availableActions?.includes('reject_completion');
  const canSubmitReview = data.availableActions?.includes('submit_review');
  const canReview = Boolean(canApprove || canReject);
  const closureSummary = data.closureSummary;

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
          <article className="detail-stat"><span>当前阶段</span><strong>{getBusinessStageLabel(data.businessStage)}</strong></article>
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

      {closureSummary ? (
        <section className="card section-card">
          <div className="section-head"><h2>归档与资金收口</h2></div>
          <div className="detail-stat-grid">
            <article className="detail-stat"><span>资料归档</span><strong>{closureSummary.archiveStatus || '待同步'}</strong></article>
            <article className="detail-stat"><span>结算状态</span><strong>{closureSummary.settlementStatus || '待同步'}</strong></article>
            <article className="detail-stat"><span>出款状态</span><strong>{closureSummary.payoutStatus || '待同步'}</strong></article>
            <article className="detail-stat"><span>资金闭环</span><strong>{closureSummary.financialClosureStatus || '待同步'}</strong></article>
          </div>
          {closureSummary.nextPendingAction ? <p className="detail-note" style={{ marginTop: 16 }}>{closureSummary.nextPendingAction}</p> : null}
        </section>
      ) : null}

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
                  if (isWebApiConflict(submitError)) {
                    await reload();
                    setMessage('状态已变化，请刷新后重试');
                    return;
                  }
                  setMessage(getWebApiErrorMessage(submitError, '验收失败'));
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
                  if (isWebApiConflict(submitError)) {
                    await reload();
                    setMessage('状态已变化，请刷新后重试');
                    return;
                  }
                  setMessage(getWebApiErrorMessage(submitError, '驳回失败'));
                } finally {
                  setSubmitting(false);
                }
              }} type="button">驳回并整改</button>
            </div>
          </>
        ) : null}
      </section>

      <section className="card section-card">
        <div className="section-head"><h2>正式评价</h2></div>
        {data.projectReview ? (
          <div className="list-stack">
            <div className="surface-card">
              <div style={{ display: 'grid', gap: 12 }}>
                <div className="inline-actions">
                  <span className="status-chip" data-tone="success">已提交正式评价</span>
                  <span className="status-chip">{data.projectReview.rating.toFixed(1)} 分</span>
                  <span className="status-chip">{data.projectReview.createdAt || '提交时间待同步'}</span>
                </div>
                <p className="detail-note">{data.projectReview.content || '业主未填写文字评价。'}</p>
                {data.projectReview.images.length > 0 ? (
                  <div className="inline-actions" style={{ flexWrap: 'wrap' }}>
                    {data.projectReview.images.map((image) => (
                      <a key={image} href={image} rel="noreferrer" target="_blank"><span className="status-chip">查看评价图片</span></a>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : canSubmitReview ? (
          <>
            <p className="detail-note">仅支持项目完工验收通过后的业主正式评价，一项目只能提交一次。</p>
            <div className="inline-actions" style={{ marginTop: 16, flexWrap: 'wrap' }}>
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  className={value === reviewRating ? 'button-secondary' : 'button-outline'}
                  disabled={submitting}
                  key={value}
                  onClick={() => setReviewRating(value)}
                  type="button"
                >
                  {value} 星
                </button>
              ))}
            </div>
            <textarea
              onChange={(event) => setReviewContent(event.target.value)}
              placeholder="补充你的真实评价，帮助后续业主判断。"
              style={{ marginTop: 16 }}
              value={reviewContent}
            />
            <textarea
              onChange={(event) => setReviewImages(event.target.value)}
              placeholder="评价图片链接（可选，每行一张，最多 9 张）"
              style={{ marginTop: 16 }}
              value={reviewImages}
            />
            <div className="inline-actions" style={{ marginTop: 16 }}>
              <button
                className="button-secondary"
                disabled={submitting}
                onClick={async () => {
                  setSubmitting(true);
                  setMessage('');
                  try {
                    await submitProjectReview(projectId, {
                      rating: reviewRating,
                      content: reviewContent.trim(),
                      images: normalizeReviewImages(reviewImages),
                    });
                    setMessage('正式评价提交成功。');
                    setReviewContent('');
                    setReviewImages('');
                    await reload();
                  } catch (submitError) {
                    if (isWebApiConflict(submitError)) {
                      await reload();
                      setMessage('状态已变化，请刷新后重试');
                      return;
                    }
                    setMessage(getWebApiErrorMessage(submitError, '正式评价提交失败'));
                  } finally {
                    setSubmitting(false);
                  }
                }}
                type="button"
              >
                {submitting ? '提交中…' : '提交正式评价'}
              </button>
            </div>
          </>
        ) : (
          <p className="detail-note">当前还未到正式评价阶段，需先通过项目整体验收。</p>
        )}
      </section>
    </div>
  );
}
