import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ErrorBlock, LoadingBlock } from '../components/AsyncState';
import { StatusBanner } from '../components/StatusBanner';
import { useAsyncData } from '../hooks/useAsyncData';
import { acceptProjectMilestone, getProjectDetail, listProjectLogs } from '../services/projects';

export function ProjectAcceptancePage() {
  const params = useParams();
  const projectId = Number(params.id || 0);
  const [opinion, setOpinion] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { data, loading, error, reload } = useAsyncData(async () => {
    const [detail, logs] = await Promise.all([
      getProjectDetail(projectId),
      listProjectLogs(projectId, { page: 1, pageSize: 6 }).catch(() => ({ list: [], total: 0 })),
    ]);
    return { detail, logs: logs.list };
  }, [projectId]);

  if (loading) {
    return <div className="container page-stack"><LoadingBlock title="加载验收页" /></div>;
  }

  if (error || !data) {
    return <div className="container page-stack"><ErrorBlock description={error || '验收页加载失败'} onRetry={() => void reload()} /></div>;
  }

  const pendingMilestone = data.detail.milestones.find((milestone) => milestone.status === '0' || milestone.status === '1');

  return (
    <div className="container page-stack">
      <StatusBanner
        description="把当前可验收的节点、交付材料和验收动作放在同一页，方便你单独处理。"
        label="节点验收"
        meta={pendingMilestone ? <span className="status-chip" data-tone="warning">{pendingMilestone.statusText}</span> : <span className="status-chip" data-tone="success">暂无待验收节点</span>}
        title={pendingMilestone ? `${pendingMilestone.name} 验收` : '当前没有待验收节点'}
        tone={pendingMilestone ? 'warning' : 'success'}
      />

      <section className="split-shell">
        <section className="dashboard-shell">
          <section className="card section-card">
            <div className="panel-head">
              <div>
                <p className="kicker eyebrow-accent">验收范围</p>
                <h2 className="section-title">{data.detail.name}</h2>
              </div>
              <Link className="button-link" to={`/projects/${projectId}`}>返回项目详情</Link>
            </div>
            <div className="data-grid detail-grid-two">
              <article>
                <span>当前阶段</span>
                <strong>{data.detail.currentPhase}</strong>
              </article>
              <article>
                <span>服务商</span>
                <strong>{data.detail.providerName}</strong>
              </article>
              <article>
                <span>项目地址</span>
                <strong>{data.detail.address}</strong>
              </article>
              <article>
                <span>预算</span>
                <strong>{data.detail.budgetText}</strong>
              </article>
            </div>
            {pendingMilestone ? <div className="status-note" style={{ marginTop: 18 }}>验收标准：{pendingMilestone.criteria}</div> : null}
          </section>

          <section className="card section-card">
            <div className="panel-head">
              <div>
                <p className="kicker eyebrow-accent">交付材料</p>
                <h2 className="section-title">最近施工日志与图片</h2>
              </div>
            </div>
            <div className="list-stack">
              {data.logs.map((item) => (
                <div className="list-card" key={item.id}>
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                    <div className="inline-actions" style={{ marginTop: 10 }}>
                      {item.photos.slice(0, 4).map((photo) => (
                        <a href={photo} key={photo} rel="noreferrer" target="_blank">
                          <span className="status-chip">查看图片</span>
                        </a>
                      ))}
                    </div>
                  </div>
                  <div className="list-meta">
                    <strong>{item.logDate}</strong>
                    <span>{item.photos.length} 张图</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </section>

        <section className="card section-card">
          <div className="panel-head">
            <div>
              <p className="kicker eyebrow-accent">验收意见</p>
              <h2 className="section-title">通过、驳回或提交争议</h2>
            </div>
          </div>
          {actionMessage ? <div className="status-note" style={{ marginBottom: 16 }}>{actionMessage}</div> : null}
          <div className="field">
            <label htmlFor="acceptance-opinion">验收说明</label>
            <textarea id="acceptance-opinion" onChange={(event) => setOpinion(event.target.value)} placeholder="填写你的验收意见、风险说明或需要补充的地方。" value={opinion} />
          </div>
          <div className="inline-actions" style={{ marginTop: 18 }}>
            <button
              className="button-secondary"
              disabled={!pendingMilestone || submitting}
              onClick={async () => {
                if (!pendingMilestone) {
                  return;
                }
                setSubmitting(true);
                setActionMessage('');
                try {
                  await acceptProjectMilestone(projectId, pendingMilestone.id);
                  await reload();
                  setActionMessage(`节点 ${pendingMilestone.name} 已通过验收。`);
                } catch (submitError) {
                  setActionMessage(submitError instanceof Error ? submitError.message : '验收失败');
                } finally {
                  setSubmitting(false);
                }
              }}
              type="button"
            >
              {submitting ? '提交中…' : '通过验收'}
            </button>
            <button className="button-outline" onClick={() => setActionMessage('当前版本暂未开放线上驳回流程，请通过消息中心联系平台处理。')} type="button">
              驳回
            </button>
            <button className="button-outline" onClick={() => setActionMessage('当前版本暂未开放线上争议提交流程，请通过消息中心联系平台处理。')} type="button">
              提交争议
            </button>
          </div>
        </section>
      </section>
    </div>
  );
}
