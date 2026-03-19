import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { ErrorBlock, LoadingBlock } from '../components/AsyncState';
import { StatusBanner } from '../components/StatusBanner';
import { useAsyncData } from '../hooks/useAsyncData';
import { disputeProject, getProjectDetail } from '../services/projects';

export function ProjectDisputePage() {
  const params = useParams();
  const navigate = useNavigate();
  const projectId = Number(params.id || 0);
  const [reason, setReason] = useState('');
  const [evidence, setEvidence] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { data, loading, error, reload } = useAsyncData(() => getProjectDetail(projectId), [projectId]);

  if (loading) {
    return <div className="container page-stack"><LoadingBlock title="加载项目争议页" /></div>;
  }

  if (error || !data) {
    return <div className="container page-stack"><ErrorBlock description={error || '项目不存在'} onRetry={() => void reload()} /></div>;
  }

  return (
    <div className="container page-stack">
      <StatusBanner
        label="项目争议"
        title="把争议提交给平台进入仲裁队列"
        description="提交后项目会进入平台处理中状态，建议附上现场图和关键沟通记录。"
      />

      <section className="split-shell">
        <section className="dashboard-shell">
          <section className="card section-card">
            <div className="panel-head">
              <div>
                <p className="kicker eyebrow-accent">项目信息</p>
                <h2 className="section-title">{data.name}</h2>
              </div>
            </div>
            <div className="data-grid detail-grid-two">
              <article><span>当前阶段</span><strong>{data.currentPhase}</strong></article>
              <article><span>业务阶段</span><strong>{data.businessStage || '-'}</strong></article>
              <article><span>服务商</span><strong>{data.providerName}</strong></article>
              <article><span>预算</span><strong>{data.budgetText}</strong></article>
            </div>
            {data.flowSummary ? <p className="detail-note" style={{ marginTop: 16 }}>{data.flowSummary}</p> : null}
          </section>
        </section>

        <section className="card section-card">
          <div className="panel-head">
            <div>
              <p className="kicker eyebrow-accent">提交争议</p>
              <h2 className="section-title">争议说明与证据</h2>
            </div>
          </div>
          {message ? <div className="status-note" style={{ marginBottom: 16 }}>{message}</div> : null}
          <div className="form-grid">
            <div className="field">
              <label htmlFor="dispute-reason">争议原因</label>
              <textarea
                id="dispute-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="例如：施工质量不达标，返工仍未解决。"
              />
            </div>
            <div className="field">
              <label htmlFor="dispute-evidence">证据 URL</label>
              <textarea
                id="dispute-evidence"
                value={evidence}
                onChange={(event) => setEvidence(event.target.value)}
                placeholder="每行一条图片或文档 URL。"
              />
            </div>
          </div>
          <div className="inline-actions" style={{ marginTop: 18 }}>
            <button
              className="button-secondary"
              disabled={submitting || !reason.trim()}
              onClick={async () => {
                setSubmitting(true);
                setMessage('');
                try {
                  await disputeProject(projectId, {
                    reason: reason.trim(),
                    evidence: evidence.split(/\n|,|，/).map((item) => item.trim()).filter(Boolean),
                  });
                  setMessage('争议已提交，平台将介入处理。');
                  await reload();
                } catch (submitError) {
                  setMessage(submitError instanceof Error ? submitError.message : '提交争议失败');
                } finally {
                  setSubmitting(false);
                }
              }}
              type="button"
            >
              {submitting ? '提交中…' : '提交争议'}
            </button>
            <Link className="button-outline" to={`/projects/${projectId}`}>返回项目详情</Link>
            <button className="button-link" onClick={() => navigate(-1)} type="button">返回上一页</button>
          </div>
        </section>
      </section>
    </div>
  );
}
