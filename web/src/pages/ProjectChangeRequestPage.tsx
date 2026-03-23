import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ErrorBlock, LoadingBlock } from '../components/AsyncState';
import { StatusBanner } from '../components/StatusBanner';
import { useAsyncData } from '../hooks/useAsyncData';
import { getProjectDetail } from '../services/projects';

export function ProjectChangeRequestPage() {
  const params = useParams();
  const projectId = Number(params.id || 0);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    changeType: 'scope',
    reason: '',
    amountImpact: '',
    timelineImpact: '',
    notes: '',
  });
  const { data, loading, error, reload } = useAsyncData(() => getProjectDetail(projectId), [projectId]);

  if (loading) {
    return <div className="container page-stack"><LoadingBlock title="加载变更页" /></div>;
  }

  if (error || !data) {
    return <div className="container page-stack"><ErrorBlock description={error || '变更页加载失败'} onRetry={() => void reload()} /></div>;
  }

  return (
    <div className="container page-stack">
      <StatusBanner
        description="当前版本先把变更页的结构、字段和说明补齐。正式变更单的后端接口还未开放，因此这里先作为前置收口页面。"
        label="变更申请"
        title={`项目变更 · ${data.name}`}
        tone="warning"
      />

      <section className="split-shell">
        <section className="card section-card">
          <div className="panel-head">
            <div>
              <p className="kicker eyebrow-accent">变更内容</p>
              <h2 className="section-title">把范围、金额和工期影响说清楚</h2>
            </div>
            <Link className="button-link" to={`/projects/${projectId}`}>返回项目详情</Link>
          </div>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="change-type">变更类型</label>
              <select id="change-type" onChange={(event) => setForm((prev) => ({ ...prev, changeType: event.target.value }))} value={form.changeType}>
                <option value="scope">范围变更</option>
                <option value="amount">金额变更</option>
                <option value="timeline">工期变更</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="change-reason">变更原因</label>
              <input id="change-reason" onChange={(event) => setForm((prev) => ({ ...prev, reason: event.target.value }))} placeholder="例如：新增柜体、改动施工范围、调整工期" value={form.reason} />
            </div>
            <div className="grid-2">
              <div className="field">
                <label htmlFor="change-amount">金额影响</label>
                <input id="change-amount" onChange={(event) => setForm((prev) => ({ ...prev, amountImpact: event.target.value }))} placeholder="例如：+8000 元" value={form.amountImpact} />
              </div>
              <div className="field">
                <label htmlFor="change-timeline">工期影响</label>
                <input id="change-timeline" onChange={(event) => setForm((prev) => ({ ...prev, timelineImpact: event.target.value }))} placeholder="例如：延长 5 天" value={form.timelineImpact} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="change-notes">补充说明</label>
              <textarea id="change-notes" onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} placeholder="补充说明涉及的材料、节点、影响范围和希望平台怎么协助。" value={form.notes} />
            </div>
          </div>
          {message ? <div className="status-note" style={{ marginTop: 18 }}>{message}</div> : null}
          <div className="inline-actions" style={{ marginTop: 18 }}>
            <button
              className="button-secondary"
              onClick={() => setMessage('当前版本仅完成变更页结构，正式变更单接口待后端开放后接入。你可以先通过通知中心与平台同步变更内容。')}
              type="button"
            >
              提交变更意向
            </button>
          </div>
        </section>

        <section className="card section-card">
          <div className="panel-head">
            <div>
              <p className="kicker eyebrow-accent">项目摘要</p>
              <h2 className="section-title">当前项目上下文</h2>
            </div>
          </div>
          <div className="data-grid detail-grid-two">
            <article>
              <span>项目状态</span>
              <strong>{data.statusText}</strong>
            </article>
            <article>
              <span>当前阶段</span>
              <strong>{data.currentPhase}</strong>
            </article>
            <article>
              <span>服务商</span>
              <strong>{data.providerName}</strong>
            </article>
            <article>
              <span>预算</span>
              <strong>{data.budgetText}</strong>
            </article>
          </div>
          <div className="status-note" style={{ marginTop: 16 }}>后续接入正式接口后，这里会增加变更历史、发起方、状态流转和确认记录。</div>
        </section>
      </section>
    </div>
  );
}
