import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { EmptyBlock, ErrorBlock, LoadingBlock } from '../components/AsyncState';
import { StatusBanner } from '../components/StatusBanner';
import { useAsyncData } from '../hooks/useAsyncData';
import { confirmQuoteTaskSubmission, getQuoteTaskDetail, rejectQuoteTaskSubmission } from '../services/quoteTasks';

export function QuoteTaskDetailPage() {
  const params = useParams();
  const navigate = useNavigate();
  const taskId = Number(params.id || 0);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const { data, loading, error, reload } = useAsyncData(() => getQuoteTaskDetail(taskId), [taskId]);

  if (loading) return <div className="container page-stack"><LoadingBlock title="加载施工报价确认页" /></div>;
  if (error || !data) return <div className="container page-stack"><ErrorBlock description={error || '施工报价任务不存在'} onRetry={() => void reload()} /></div>;

  return (
    <div className="container page-stack">
      <StatusBanner
        description="这里专门处理施工方和施工报价确认，不再混入设计方案确认。"
        label="施工报价确认"
        meta={(
          <>
            <span className="status-chip" data-tone="warning">{data.statusText}</span>
            {data.businessStage ? <span className="status-chip">{data.businessStage}</span> : null}
          </>
        )}
        title={data.title}
        tone="warning"
      />

      <section className="split-shell">
        <section className="dashboard-shell">
          <section className="card section-card">
            <div className="panel-head">
              <div>
                <p className="kicker eyebrow-accent">任务摘要</p>
                <h2 className="section-title">施工报价概览</h2>
              </div>
            </div>
            {data.flowSummary ? <div className="status-note" style={{ marginBottom: 16 }}>{data.flowSummary}</div> : null}
            <div className="data-grid detail-grid-two">
              <article><span>预计工期</span><strong>{data.estimatedDays > 0 ? `${data.estimatedDays} 天` : '待补充'}</strong></article>
              <article><span>施工总价</span><strong>{data.totalFeeText}</strong></article>
              <article><span>面积</span><strong>{data.taskSummary.area > 0 ? `${data.taskSummary.area}㎡` : '待补充'}</strong></article>
              <article><span>户型</span><strong>{data.taskSummary.layout || '待补充'}</strong></article>
            </div>
          </section>

          <section className="card section-card">
            <div className="panel-head">
              <div>
                <p className="kicker eyebrow-accent">施工清单</p>
                <h2 className="section-title">逐项查看报价</h2>
              </div>
            </div>
            {data.items.length === 0 ? (
              <EmptyBlock title="暂无施工清单" description="当前报价任务还没有可展示的施工项。" />
            ) : (
              <div className="list-stack">
                {data.items.map((item) => (
                  <div className="list-card" key={item.id}>
                    <div>
                      <h3>清单项 #{item.quoteListItemId}</h3>
                      <p>{item.remark || '无备注'}</p>
                    </div>
                    <div className="list-meta">
                      <strong>{item.amountText}</strong>
                      <span>{item.unitPriceText} / 单位</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </section>

        <section className="card section-card">
          <div className="panel-head">
            <div>
              <p className="kicker eyebrow-accent">确认动作</p>
              <h2 className="section-title">确认后项目进入待开工状态</h2>
            </div>
          </div>
          {message ? <div className="status-note">{message}</div> : null}
          <div className="field">
            <label htmlFor="quote-reject-reason">驳回原因（选填）</label>
            <textarea id="quote-reject-reason" onChange={(event) => setRejectReason(event.target.value)} placeholder="若驳回，请说明价格、工期或施工范围问题。" value={rejectReason} />
          </div>
          <div className="inline-actions" style={{ marginTop: 18 }}>
            <button
              className="button-secondary"
              disabled={submitting}
              onClick={async () => {
                setSubmitting(true);
                setMessage('');
                try {
                  await confirmQuoteTaskSubmission(data.submissionId);
                  setMessage('施工报价已确认，项目已进入待开工阶段。');
                  navigate('/progress');
                } catch (submitError) {
                  setMessage(submitError instanceof Error ? submitError.message : '确认失败');
                } finally {
                  setSubmitting(false);
                }
              }}
              type="button"
            >
              {submitting ? '处理中…' : '确认施工报价'}
            </button>
            <button
              className="button-outline"
              disabled={submitting}
              onClick={async () => {
                setSubmitting(true);
                setMessage('');
                try {
                  await rejectQuoteTaskSubmission(data.submissionId, rejectReason.trim() || '用户要求重新报价');
                  await reload();
                  setMessage('施工报价已驳回，任务已退回待重新报价。');
                } catch (submitError) {
                  setMessage(submitError instanceof Error ? submitError.message : '驳回失败');
                } finally {
                  setSubmitting(false);
                }
              }}
              type="button"
            >
              驳回施工报价
            </button>
            <Link className="button-outline" to="/progress">返回我的项目</Link>
          </div>
        </section>
      </section>
    </div>
  );
}
