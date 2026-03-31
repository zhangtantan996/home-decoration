import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { ErrorBlock, LoadingBlock } from '../components/AsyncState';
import { StatusBanner } from '../components/StatusBanner';
import { useAsyncData } from '../hooks/useAsyncData';
import { getBusinessStageLabel } from '../constants/statuses';
import { getWebApiErrorMessage, isWebApiConflict } from '../services/http';
import { getProjectDetail, pauseProject, resumeProject } from '../services/projects';

export function ProjectPausePage() {
  const params = useParams();
  const navigate = useNavigate();
  const projectId = Number(params.id || 0);
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resuming, setResuming] = useState(false);
  const { data, loading, error, reload } = useAsyncData(() => getProjectDetail(projectId), [projectId]);

  if (loading) {
    return <div className="container page-stack"><LoadingBlock title="加载项目暂停页" /></div>;
  }

  if (error || !data) {
    return <div className="container page-stack"><ErrorBlock description={error || '项目不存在'} onRetry={() => void reload()} /></div>;
  }

  const isDisputed = data.businessStage === 'disputed';

  return (
    <div className="container page-stack">
      <StatusBanner
        label="暂停施工"
        title="临时中止施工并保留后续处理空间"
        description="暂停后会阻止项目继续推进，直至你在此页恢复。"
      />

      <section className="split-shell">
        <section className="dashboard-shell">
          <section className="card section-card">
            <div className="panel-head">
              <div>
                <p className="kicker eyebrow-accent">项目状态</p>
                <h2 className="section-title">{data.name}</h2>
              </div>
            </div>
            <div className="data-grid detail-grid-two">
              <article><span>当前阶段</span><strong>{data.currentPhase}</strong></article>
              <article><span>业务阶段</span><strong>{getBusinessStageLabel(data.businessStage)}</strong></article>
              <article><span>服务商</span><strong>{data.providerName}</strong></article>
              <article><span>预算</span><strong>{data.budgetText}</strong></article>
            </div>
            {data.flowSummary ? <p className="detail-note" style={{ marginTop: 16 }}>{data.flowSummary}</p> : null}
          </section>
        </section>

        <section className="card section-card">
          <div className="panel-head">
            <div>
              <p className="kicker eyebrow-accent">暂停操作</p>
              <h2 className="section-title">填写原因并提交</h2>
            </div>
          </div>
          {message ? <div className="status-note" style={{ marginBottom: 16 }}>{message}</div> : null}
          <div className="field">
            <label htmlFor="pause-reason">暂停原因</label>
            <textarea
              id="pause-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="例如：家中临时有事，需暂停两周后再继续施工。"
            />
          </div>
          <div className="inline-actions" style={{ marginTop: 18 }}>
            <button
              className="button-secondary"
              disabled={submitting || isDisputed || !reason.trim()}
              onClick={async () => {
                setSubmitting(true);
                setMessage('');
                try {
                  await pauseProject(projectId, reason.trim(), 'user');
                  setMessage('暂停申请已提交。');
                  await reload();
                } catch (submitError) {
                  if (isWebApiConflict(submitError)) {
                    await reload();
                    setMessage('状态已变化，请刷新后重试');
                    return;
                  }
                  setMessage(getWebApiErrorMessage(submitError, '暂停失败'));
                } finally {
                  setSubmitting(false);
                }
              }}
              type="button"
            >
              {submitting ? '提交中…' : '确认暂停'}
            </button>
            <button
              className="button-outline"
              disabled={resuming}
              onClick={async () => {
                setResuming(true);
                setMessage('');
                try {
                  await resumeProject(projectId);
                  setMessage('项目已恢复施工。');
                  await reload();
                } catch (resumeError) {
                  if (isWebApiConflict(resumeError)) {
                    await reload();
                    setMessage('状态已变化，请刷新后重试');
                    return;
                  }
                  setMessage(getWebApiErrorMessage(resumeError, '恢复失败'));
                } finally {
                  setResuming(false);
                }
              }}
              type="button"
            >
              {resuming ? '恢复中…' : '恢复施工'}
            </button>
            <Link className="button-outline" to={`/projects/${projectId}`}>返回项目详情</Link>
            <button className="button-link" onClick={() => navigate(-1)} type="button">返回上一页</button>
          </div>
          {isDisputed ? <p className="detail-note" style={{ marginTop: 12 }}>当前项目处于争议处理中，暂停操作已禁用。</p> : null}
        </section>
      </section>
    </div>
  );
}
