import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ErrorBlock, LoadingBlock } from '../components/AsyncState';
import { useAsyncData } from '../hooks/useAsyncData';
import { acceptProjectMilestone, getProjectBill, getProjectDetail, getProjectEscrow, getProjectFiles, listProjectLogs } from '../services/projects';

function calcPhaseProgress(name: string, statusText: string) {
  if (statusText.includes('已完成')) return 100;
  if (name.includes('验收')) return 92;
  if (name.includes('安装')) return 82;
  if (name.includes('油漆')) return 70;
  if (name.includes('泥木')) return 56;
  if (name.includes('水电')) return 42;
  return 20;
}

export function ProjectDetailPage() {
  const params = useParams();
  const projectId = Number(params.id || 0);
  const [acceptingId, setAcceptingId] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const { data, loading, error, reload } = useAsyncData(async () => {
    const [detail, logs, escrow, bill, files] = await Promise.all([
      getProjectDetail(projectId),
      listProjectLogs(projectId, { page: 1, pageSize: 4 }).catch(() => ({ list: [], total: 0 })),
      getProjectEscrow(projectId).catch(() => null),
      getProjectBill(projectId).catch(() => []),
      getProjectFiles(projectId).catch(() => []),
    ]);
    return { detail, logs: logs.list, escrow, bill, files };
  }, [projectId]);

  if (loading) return <div className="top-detail"><LoadingBlock title="加载项目详情" /></div>;
  if (error || !data) return <div className="top-detail"><ErrorBlock description={error || '项目详情不存在'} onRetry={() => void reload()} /></div>;

  const pendingMilestone = data.detail.milestones.find((milestone) => milestone.status === '0' || milestone.status === '1');

  return (
    <div className="top-detail">
      <section className="detail-header">
        <div className="detail-header-row">
          <div>
            <p className="detail-kicker">项目详情</p>
            <h1>{data.detail.name}</h1>
            <p>{data.detail.address}</p>
          </div>
          <div className="inline-actions">
            <span className="status-chip" data-tone="brand">{data.detail.statusText}</span>
            <span className="status-chip">{data.detail.currentPhase}</span>
          </div>
        </div>
      </section>

      <section className="detail-layout">
        <div className="detail-main">
          <section className="card section-card">
            <div className="section-head"><h2>项目基础信息</h2></div>
            <div className="detail-stat-grid">
              <article className="detail-stat"><span>项目状态</span><strong>{data.detail.statusText}</strong></article>
              <article className="detail-stat"><span>当前阶段</span><strong>{data.detail.currentPhase}</strong></article>
              <article className="detail-stat"><span>建筑面积</span><strong>{data.detail.areaText}</strong></article>
              <article className="detail-stat"><span>预算</span><strong>{data.detail.budgetText}</strong></article>
            </div>
          </section>

          <section className="card section-card">
            <div className="section-head"><h2>阶段时间线</h2></div>
            <div className="project-list">
              {data.detail.phases.map((phase) => {
                const progress = calcPhaseProgress(phase.name, phase.statusText);
                return (
                  <div className="proj-card" key={phase.id}>
                    <div>
                      <div className="proj-name">{phase.name}</div>
                      <div className="proj-phase">{phase.statusText} · {phase.startDate} - {phase.endDate}</div>
                      <div className="proj-bar"><div className="proj-bar-fill" style={{ width: `${progress}%` }} /></div>
                    </div>
                    <div className="proj-percent">{progress}%</div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="card section-card">
            <div className="section-head"><h2>最近施工日志</h2></div>
            <div className="project-list">
              {data.logs.map((item) => (
                <div className="proj-card" key={item.id}>
                  <div>
                    <div className="proj-name">{item.title}</div>
                    <div className="proj-phase">{item.description}</div>
                  </div>
                  <div className="proj-percent">{item.logDate}</div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="detail-aside">
          <section className="card section-card">
            <div className="section-head"><h2>待处理动作</h2></div>
            {message ? <div className="status-note">{message}</div> : null}
            {pendingMilestone ? (
              <div className="detail-actions" style={{ marginBottom: 16 }}>
                <Link className="button-outline" to={`/projects/${projectId}/acceptance`}>去验收页</Link>
                <button
                  className="button-secondary"
                  disabled={acceptingId === pendingMilestone.id}
                  onClick={async () => {
                    setAcceptingId(pendingMilestone.id);
                    setMessage('');
                    try {
                      await acceptProjectMilestone(projectId, pendingMilestone.id);
                      await reload();
                      setMessage(`节点 ${pendingMilestone.name} 已验收。`);
                    } catch (acceptError) {
                      setMessage(acceptError instanceof Error ? acceptError.message : '验收失败');
                    } finally {
                      setAcceptingId(null);
                    }
                  }}
                  type="button"
                >
                  {acceptingId === pendingMilestone.id ? '验收中…' : '确认验收'}
                </button>
              </div>
            ) : null}
            <div className="project-list">
              {data.escrow ? <div className="proj-card"><div><div className="proj-name">托管余额</div><div className="proj-phase">{data.escrow.totalAmountText} · 已释放 {data.escrow.releasedAmountText}</div></div></div> : null}
              {data.bill.slice(0, 2).map((item) => <div className="proj-card" key={item.id}><div><div className="proj-name">{item.orderNo}</div><div className="proj-phase">{item.statusText}</div></div><div className="proj-percent">{item.amountText}</div></div>)}
              {data.files.slice(0, 2).map((item) => <a className="proj-card" href={item.url} key={item.url} rel="noreferrer" target="_blank"><div><div className="proj-name">{item.name}</div><div className="proj-phase">打开设计资料</div></div></a>)}
            </div>
            <div className="detail-actions" style={{ marginTop: 16 }}>
              <Link className="button-outline" to={`/projects/${projectId}/contract`}>合同入口</Link>
              <Link className="button-outline" to={`/projects/${projectId}/change-request`}>变更入口</Link>
              <Link className="button-outline" to={`/complaints/new?projectId=${projectId}`}>投诉入口</Link>
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}
