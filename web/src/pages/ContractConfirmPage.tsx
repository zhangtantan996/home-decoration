import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { EmptyBlock, ErrorBlock, LoadingBlock } from '../components/AsyncState';
import { StatusBanner } from '../components/StatusBanner';
import { useAsyncData } from '../hooks/useAsyncData';
import { confirmContract, getProjectContract } from '../services/contracts';
import { formatCurrency } from '../utils/format';

export function ContractConfirmPage() {
  const params = useParams();
  const projectId = Number(params.id || 0);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { data, loading, error, reload } = useAsyncData(() => getProjectContract(projectId), [projectId]);

  if (loading) return <div className="container page-stack"><LoadingBlock title="加载合同确认页" /></div>;
  if (error) {
    return (
      <div className="container page-stack">
        <StatusBanner
          description="Phase 2 入口已经挂好，但当前项目还没有生成合同。"
          label="合同确认"
          title="暂未生成可确认合同"
          tone="warning"
        />
        <section className="card section-card">
          <EmptyBlock title="暂无合同" description="等服务商发起合同后，这里会显示条款快照和付款计划。" action={<Link className="button-outline" to={`/projects/${projectId}`}>返回项目</Link>} />
        </section>
      </div>
    );
  }
  if (!data) return <div className="container page-stack"><ErrorBlock description="合同信息不存在" onRetry={() => void reload()} /></div>;

  return (
    <div className="container page-stack">
      <StatusBanner
        description="把合同编号、总价、付款计划和附件集中到一页，确认动作单独落在这里。"
        label="合同确认"
        meta={<span className="status-chip" data-tone={data.status === 'confirmed' ? 'success' : 'warning'}>{data.status}</span>}
        title={data.title}
        tone={data.status === 'confirmed' ? 'success' : 'warning'}
      />

      <section className="split-shell">
        <section className="dashboard-shell">
          <section className="card section-card">
            <div className="panel-head">
              <div>
                <p className="kicker eyebrow-accent">合同概览</p>
                <h2 className="section-title">合同编号 {data.contractNo || '待生成'}</h2>
              </div>
            </div>
            <div className="data-grid detail-grid-two">
              <article><span>合同状态</span><strong>{data.status}</strong></article>
              <article><span>合同总价</span><strong>{formatCurrency(data.totalAmount)}</strong></article>
              <article><span>项目ID</span><strong>{data.projectId || projectId}</strong></article>
              <article><span>确认时间</span><strong>{data.confirmedAt || '待确认'}</strong></article>
            </div>
          </section>

          <section className="card section-card">
            <div className="panel-head">
              <div>
                <p className="kicker eyebrow-accent">付款计划</p>
                <h2 className="section-title">每一笔款项什么时候触发</h2>
              </div>
            </div>
            {data.paymentPlan.length === 0 ? (
              <EmptyBlock title="暂无付款计划" description="当前合同还没有附带付款节奏。" />
            ) : (
              <div className="list-stack">
                {data.paymentPlan.map((item, index) => (
                  <div className="list-card" key={`${item.name || 'phase'}-${index}`}>
                    <div>
                      <h3>{item.name || `阶段 ${index + 1}`}</h3>
                      <p>触发条件 {item.trigger_event || '待补充'}</p>
                    </div>
                    <div className="list-meta">
                      <strong>{formatCurrency(Number(item.amount || 0))}</strong>
                      <span>{item.percentage ? `${item.percentage}%` : '未配置比例'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {data.attachmentUrls.length > 0 ? (
            <section className="card section-card">
              <div className="panel-head">
                <div>
                  <p className="kicker eyebrow-accent">合同附件</p>
                  <h2 className="section-title">打开合同原件或补充文件</h2>
                </div>
              </div>
              <div className="list-stack">
                {data.attachmentUrls.map((item) => (
                  <a className="surface-card" href={item} key={item} rel="noreferrer" target="_blank">
                    <div>
                      <h3>{item.split('/').pop() || '合同附件'}</h3>
                      <p>打开合同文件</p>
                    </div>
                  </a>
                ))}
              </div>
            </section>
          ) : null}
        </section>

        <section className="card section-card">
          <div className="panel-head">
            <div>
              <p className="kicker eyebrow-accent">确认动作</p>
              <h2 className="section-title">确认后才进入项目执行节奏</h2>
            </div>
          </div>
          {message ? <div className="status-note">{message}</div> : null}
          <div className="inline-actions" style={{ marginTop: 12 }}>
            <button
              className="button-secondary"
              disabled={submitting || data.status === 'confirmed'}
              onClick={async () => {
                setSubmitting(true);
                setMessage('');
                try {
                  await confirmContract(data.id);
                  await reload();
                  setMessage('合同已确认。');
                } catch (submitError) {
                  setMessage(submitError instanceof Error ? submitError.message : '合同确认失败');
                } finally {
                  setSubmitting(false);
                }
              }}
              type="button"
            >
              {submitting ? '确认中…' : data.status === 'confirmed' ? '已确认' : '确认合同'}
            </button>
            <Link className="button-outline" to={`/projects/${projectId}`}>返回项目详情</Link>
          </div>
        </section>
      </section>
    </div>
  );
}
