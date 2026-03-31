import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { EmptyBlock, ErrorBlock, LoadingBlock } from '../components/AsyncState';
import { useAsyncData } from '../hooks/useAsyncData';
import { payOrder } from '../services/orders';
import { confirmProposal, getProposalDetail } from '../services/proposals';
import type { ProposalDetailVM } from '../types/viewModels';

export function ProposalDetailPage() {
  const params = useParams();
  const proposalId = Number(params.id || 0);
  const [message, setMessage] = useState('');
  const { data, loading, error, reload } = useAsyncData<ProposalDetailVM>(() => getProposalDetail(proposalId), [proposalId]);

  if (loading) return <div className="top-detail"><LoadingBlock title="加载报价详情" /></div>;
  if (error || !data) return <div className="top-detail"><ErrorBlock description={error || '报价详情不存在'} onRetry={() => void reload()} /></div>;

  return (
    <div className="top-detail">
      <section className="detail-header">
        <div className="detail-header-row">
          <div>
            <p className="detail-kicker">报价详情</p>
            <h1>{data.summary}</h1>
            <p>先看费用拆分、付款计划和当前确认状态。</p>
          </div>
          <div className="inline-actions">
            <span className="status-chip" data-tone={data.canConfirm ? 'warning' : 'brand'}>{data.statusText}</span>
            <span className="status-chip">{data.orderStatusText}</span>
          </div>
        </div>
      </section>

      <section className="detail-layout">
        <div className="detail-main">
          <section className="card section-card">
            <div className="section-head"><h2>支付前预览</h2></div>
            <div className="detail-note">
              {data.previewSummary || '当前方案提供彩平摘要、必要效果图预览与报价说明，支付设计费后解锁完整交付包。'}
            </div>
            {(data.previewFloorPlanImages?.length || data.previewEffectImages?.length || data.previewEffectLinks?.length) ? (
              <div className="inline-actions" style={{ flexWrap: 'wrap', marginTop: 16 }}>
                {(data.previewFloorPlanImages || []).map((url) => (
                  <a key={url} className="status-chip" href={url} target="_blank" rel="noreferrer">彩平预览</a>
                ))}
                {(data.previewEffectImages || []).map((url) => (
                  <a key={url} className="status-chip" href={url} target="_blank" rel="noreferrer">效果图预览</a>
                ))}
                {(data.previewEffectLinks || []).map((url) => (
                  <a key={url} className="status-chip" href={url} target="_blank" rel="noreferrer">效果图链接</a>
                ))}
              </div>
            ) : null}
            <p className="detail-note" style={{ marginTop: 12 }}>
              {data.previewHasCad ? '包含 CAD 施工图' : '暂未包含 CAD 标记'} · {data.previewHasAttachments ? '包含其他附件' : '暂未包含其他附件'}
            </p>
          </section>

          <section className="card section-card">
            <div className="section-head"><h2>费用结构</h2></div>
            <div className="detail-stat-grid">
              <article className="detail-stat"><span>设计费</span><strong>{data.designFeeText}</strong></article>
              <article className="detail-stat"><span>施工费</span><strong>{data.constructionFeeText}</strong></article>
              <article className="detail-stat"><span>主材费</span><strong>{data.materialFeeText}</strong></article>
              <article className="detail-stat"><span>总价估算</span><strong>{data.totalFeeText}</strong></article>
            </div>
            <p className="detail-note" style={{ marginTop: 16 }}>预计工期 {data.estimatedDays > 0 ? `${data.estimatedDays} 天` : '待补充'} · 提交时间 {data.submittedAt} · 响应截止 {data.responseDeadline}</p>
          </section>

          <section className="card section-card">
            <div className="section-head"><h2>节点付款计划</h2></div>
            {data.planItems.length === 0 ? <EmptyBlock title="暂无分期计划" description="订单生成后会在这里显示节点付款安排。" /> : (
              <div className="project-list">
                {data.planItems.map((plan) => (
                  <div className="proj-card" key={plan.id}>
                    <div>
                      <div className="proj-name">{plan.name}</div>
                      <div className="proj-phase">应付时间 {plan.dueAt}</div>
                    </div>
                    <div className="proj-percent">{plan.amountText}</div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="card section-card">
            <div className="section-head"><h2>正式设计交付包</h2></div>
            {!data.deliveryUnlocked ? (
              <p className="detail-note">支付设计费后解锁完整彩平图、效果图、CAD 施工图和附件下载。</p>
            ) : (
              <>
                {data.deliveryDescription ? <p className="detail-note">{data.deliveryDescription}</p> : null}
                <div className="inline-actions" style={{ flexWrap: 'wrap', marginTop: 16 }}>
                  {(data.deliveryFloorPlanImages || []).map((url) => (
                    <a key={url} className="status-chip" href={url} target="_blank" rel="noreferrer">彩平图</a>
                  ))}
                  {(data.deliveryEffectImages || []).map((url) => (
                    <a key={url} className="status-chip" href={url} target="_blank" rel="noreferrer">效果图</a>
                  ))}
                  {(data.deliveryEffectLinks || []).map((url) => (
                    <a key={url} className="status-chip" href={url} target="_blank" rel="noreferrer">效果图外链</a>
                  ))}
                  {(data.deliveryCadFiles || []).map((url) => (
                    <a key={url} className="status-chip" href={url} target="_blank" rel="noreferrer">CAD 图纸</a>
                  ))}
                  {(data.deliveryAttachments || []).map((url) => (
                    <a key={url} className="status-chip" href={url} target="_blank" rel="noreferrer">附件下载</a>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>

        <aside className="detail-aside">
          <section className="card section-card">
            <div className="section-head"><h2>订单与动作</h2></div>
            {message ? <div className="status-note">{message}</div> : null}
            {!data.projectId ? (
              <div className="detail-note" style={{ marginBottom: 16 }}>
                设计确认不会直接创建项目。支付设计费后，待服务商提交施工报价，再到进度看板确认施工报价进入项目阶段。
              </div>
            ) : null}
            <div className="project-list">
              <div className="proj-card"><div><div className="proj-name">订单状态</div><div className="proj-phase">{data.orderStatusText}</div></div></div>
              {data.rejectionReason ? <div className="proj-card"><div><div className="proj-name">拒绝原因</div><div className="proj-phase">{data.rejectionReason}</div></div></div> : null}
            </div>
            <div className="detail-actions" style={{ marginTop: 16 }}>
              <button
                className={data.canConfirm ? 'button-secondary' : 'button-ghost'}
                disabled={!data.canConfirm}
                onClick={async () => {
                  setMessage('');
                  await confirmProposal(data.id);
                  await reload();
                  setMessage('报价已确认，设计费订单已生成。项目会在确认施工报价后创建。');
                }}
                type="button"
              >
                确认报价
              </button>
              {data.orderStatus === 0 && data.orderId ? (
                <button
                  className="button-secondary"
                  onClick={async () => {
                    setMessage('');
                    try {
                      const payment = await payOrder(data.orderId!);
                      window.location.assign(payment.launchUrl);
                    } catch (payError) {
                      setMessage(payError instanceof Error ? payError.message : '支付失败');
                    }
                  }}
                  type="button"
                >
                  支付设计费
                </button>
              ) : null}
              {!data.projectId ? <Link className="button-outline" to="/progress">去进度看板</Link> : null}
              {data.projectId ? <Link className="button-outline" to={`/projects/${data.projectId}`}>进入项目</Link> : null}
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}
