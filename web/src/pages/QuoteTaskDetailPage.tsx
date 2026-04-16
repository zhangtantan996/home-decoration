import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { EmptyBlock, ErrorBlock, LoadingBlock } from '../components/AsyncState';
import { StatusBanner } from '../components/StatusBanner';
import { useAsyncData } from '../hooks/useAsyncData';
import { getBusinessStageLabel } from '../constants/statuses';
import { getWebApiErrorMessage, isWebApiConflict } from '../services/http';
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
  const bridgeSummary = data.bridgeConversionSummary;

  return (
    <div className="container page-stack">
      <StatusBanner
        description="这里专门处理施工方和施工报价确认，不再混入设计方案确认。"
        label="施工报价确认"
        meta={(
          <>
            <span className="status-chip" data-tone="warning">{data.statusText}</span>
            {data.businessStage ? <span className="status-chip">{getBusinessStageLabel(data.businessStage)}</span> : null}
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
              <article><span>首笔支付</span><strong>{data.paymentPlanSummary[0] ? `${data.paymentPlanSummary[0].name} · ${data.paymentPlanSummary[0].amountText}` : '确认后生成'}</strong></article>
              <article><span>面积</span><strong>{data.taskSummary.area > 0 ? `${data.taskSummary.area}㎡` : '待补充'}</strong></article>
              <article><span>户型</span><strong>{data.taskSummary.layout || '待补充'}</strong></article>
            </div>
          </section>

          {bridgeSummary ? (
            <section className="card section-card">
              <div className="panel-head">
                <div>
                  <p className="kicker eyebrow-accent">为什么这个报价成立</p>
                  <h2 className="section-title">桥接解释与平台保障</h2>
                </div>
              </div>
              {bridgeSummary.bridgeNextStep?.reason ? <div className="status-note" style={{ marginBottom: 16 }}>{bridgeSummary.bridgeNextStep.reason}</div> : null}
              <div className="data-grid detail-grid-two">
                <article><span>报价基线</span><strong>{bridgeSummary.quoteBaselineSummary?.title || '待同步'}</strong></article>
                <article><span>下一责任人</span><strong>{bridgeSummary.bridgeNextStep?.owner || '待平台继续推进'}</strong></article>
                <article><span>平台保障</span><strong>{bridgeSummary.trustSignals?.officialReviewHint || '平台留痕、争议处理与评价沉淀'}</strong></article>
                <article><span>可对比主体</span><strong>{bridgeSummary.constructionSubjectComparison?.length || 0} 个</strong></article>
              </div>
              {(bridgeSummary.responsibilityBoundarySummary?.items || []).length ? (
                <div className="list-stack" style={{ marginTop: 16 }}>
                  {bridgeSummary.responsibilityBoundarySummary?.items?.map((item) => (
                    <div className="surface-card" key={item}><p>{item}</p></div>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

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
                      <h3>{item.itemName}</h3>
                      <p>
                        基准量 {item.baselineQuantity ?? '-'}{item.unit}
                        {' · '}
                        报价量 {item.quotedQuantity ?? item.baselineQuantity ?? '-'}{item.unit}
                      </p>
                      {item.quantityChangeReason ? <p>偏差说明：{item.quantityChangeReason}</p> : null}
                      {item.remark ? <p>备注：{item.remark}</p> : null}
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
                <h2 className="section-title">确认后进入待支付与待监理协调开工</h2>
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
                  setMessage('施工报价已确认，项目已进入待监理协调开工阶段。');
                  navigate('/progress');
                } catch (submitError) {
                  if (isWebApiConflict(submitError)) {
                    await reload();
                    setMessage('状态已变化，请刷新后重试');
                    return;
                  }
                  setMessage(getWebApiErrorMessage(submitError, '确认失败'));
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
                  if (isWebApiConflict(submitError)) {
                    await reload();
                    setMessage('状态已变化，请刷新后重试');
                    return;
                  }
                  setMessage(getWebApiErrorMessage(submitError, '驳回失败'));
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
