import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ErrorBlock, LoadingBlock } from '../components/AsyncState';
import { StatusBanner } from '../components/StatusBanner';
import { useAsyncData } from '../hooks/useAsyncData';
import {
  confirmProjectChangeOrder,
  getProjectDetail,
  listProjectChangeOrders,
  rejectProjectChangeOrder,
  type ChangeOrderDTO,
} from '../services/projects';
import { formatCurrency, formatDateTime } from '../utils/format';

const CHANGE_STATUS_LABELS: Record<string, string> = {
  pending_user_confirm: '待你确认',
  user_confirmed: '已确认',
  user_rejected: '已拒绝',
  admin_settlement_required: '待平台结算',
  settled: '已结算',
  cancelled: '已取消',
};

function getStatusTone(status?: string) {
  switch (status) {
    case 'user_confirmed':
    case 'settled':
      return 'success';
    case 'user_rejected':
    case 'cancelled':
      return 'danger';
    case 'admin_settlement_required':
      return 'warning';
    default:
      return 'default';
  }
}

export function ProjectChangeRequestPage() {
  const params = useParams();
  const projectId = Number(params.id || 0);
  const [reasonMap, setReasonMap] = useState<Record<number, string>>({});
  const [submittingId, setSubmittingId] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const { data, loading, error, reload } = useAsyncData(async () => {
    const [project, changeOrders] = await Promise.all([
      getProjectDetail(projectId),
      listProjectChangeOrders(projectId),
    ]);
    return { project, changeOrders };
  }, [projectId]);

  if (loading) {
    return <div className="container page-stack"><LoadingBlock title="加载项目变更" /></div>;
  }

  if (error || !data) {
    return <div className="container page-stack"><ErrorBlock description={error || '变更页加载失败'} onRetry={() => void reload()} /></div>;
  }

  const pendingItems = (data.changeOrders || []).filter((item) => item.status === 'pending_user_confirm');

  const handleConfirm = async (item: ChangeOrderDTO) => {
    setSubmittingId(item.id);
    setMessage('');
    try {
      await confirmProjectChangeOrder(item.id);
      setMessage(`已确认变更“${item.title || item.id}”，如涉及增项，系统已生成对应待支付计划。`);
      await reload();
    } catch (submitError) {
      setMessage(submitError instanceof Error ? submitError.message : '确认失败');
    } finally {
      setSubmittingId(null);
    }
  };

  const handleReject = async (item: ChangeOrderDTO) => {
    setSubmittingId(item.id);
    setMessage('');
    try {
      await rejectProjectChangeOrder(item.id, { reason: reasonMap[item.id] || '当前变更方案不接受' });
      setMessage(`已拒绝变更“${item.title || item.id}”。`);
      await reload();
    } catch (submitError) {
      setMessage(submitError instanceof Error ? submitError.message : '拒绝失败');
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div className="container page-stack">
      <StatusBanner
        description="这里只展示已进入项目主链的正式变更单。增项确认后会直接生成待支付计划，减项会进入平台人工结算。"
        label="项目变更"
        title={`项目变更 · ${data.project.name}`}
        tone={pendingItems.length ? 'warning' : 'info'}
      />

      <section className="split-shell">
        <section className="card section-card">
          <div className="panel-head">
            <div>
              <p className="kicker eyebrow-accent">待处理变更</p>
              <h2 className="section-title">确认会直接影响支付、工期或说明边界</h2>
            </div>
            <Link className="button-link" to={`/projects/${projectId}`}>返回项目详情</Link>
          </div>

          {message ? <div className="status-note" style={{ marginBottom: 16 }}>{message}</div> : null}

          {!data.changeOrders.length ? (
            <div className="status-note">当前项目还没有正式变更单。</div>
          ) : (
            <div className="page-stack">
              {data.changeOrders.map((item) => {
                const canRespond = item.status === 'pending_user_confirm';
                return (
                  <article className="card section-card" key={item.id} style={{ boxShadow: 'none', border: '1px solid rgba(15,23,42,0.08)' }}>
                    <div className="panel-head">
                      <div>
                        <p className="kicker eyebrow-accent">{item.changeType || 'scope'}</p>
                        <h3 className="section-title" style={{ marginBottom: 6 }}>{item.title || `变更单 #${item.id}`}</h3>
                        <div className="status-chip" data-tone={getStatusTone(item.status)}>
                          {CHANGE_STATUS_LABELS[item.status || ''] || item.status || '待更新'}
                        </div>
                      </div>
                      <div className="status-note">创建于 {formatDateTime(item.createdAt)}</div>
                    </div>

                    <div className="data-grid detail-grid-two">
                      <article>
                        <span>金额影响</span>
                        <strong>{formatCurrency(item.amountImpact || 0)}</strong>
                      </article>
                      <article>
                        <span>工期影响</span>
                        <strong>{item.timelineImpact ? `${item.timelineImpact > 0 ? '+' : ''}${item.timelineImpact} 天` : '无'}</strong>
                      </article>
                      <article>
                        <span>变更原因</span>
                        <strong>{item.reason || '未填写'}</strong>
                      </article>
                      <article>
                        <span>处理结果</span>
                        <strong>{item.settlementReason || item.userRejectReason || '待处理'}</strong>
                      </article>
                    </div>

                    <div className="text-block" style={{ marginTop: 16 }}>
                      <span className="text-block-label">变更说明</span>
                      <p>{item.description || '暂无补充说明'}</p>
                    </div>

                    {item.items?.length ? (
                      <div className="text-block" style={{ marginTop: 16 }}>
                        <span className="text-block-label">变更项</span>
                        <div className="page-stack" style={{ gap: 10 }}>
                          {item.items.map((change, index) => (
                            <div className="status-note" key={`${item.id}-${index}`}>
                              <strong>{change.title || `变更项 ${index + 1}`}</strong>
                              <div>{change.description || '无附加说明'}</div>
                              {change.amountImpact ? <div>金额影响：{formatCurrency(change.amountImpact)}</div> : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {item.evidenceUrls?.length ? (
                      <div className="chip-row" style={{ marginTop: 16 }}>
                        {item.evidenceUrls.map((url, index) => (
                          <a className="status-chip" href={url} key={`${item.id}-evidence-${index}`} rel="noreferrer" target="_blank">
                            附件 {index + 1}
                          </a>
                        ))}
                      </div>
                    ) : null}

                    {canRespond ? (
                      <>
                        <div className="field" style={{ marginTop: 18 }}>
                          <label htmlFor={`change-reason-${item.id}`}>拒绝说明</label>
                          <textarea
                            id={`change-reason-${item.id}`}
                            onChange={(event) => setReasonMap((prev) => ({ ...prev, [item.id]: event.target.value }))}
                            placeholder="如果当前变更内容、金额或工期不接受，请在这里写明原因。"
                            value={reasonMap[item.id] || ''}
                          />
                        </div>
                        <div className="inline-actions" style={{ marginTop: 18 }}>
                          <button className="button-secondary" disabled={submittingId === item.id} onClick={() => void handleConfirm(item)} type="button">
                            {submittingId === item.id ? '处理中…' : '确认变更'}
                          </button>
                          <button className="button-outline" disabled={submittingId === item.id} onClick={() => void handleReject(item)} type="button">
                            拒绝变更
                          </button>
                        </div>
                      </>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="card section-card">
          <div className="panel-head">
            <div>
              <p className="kicker eyebrow-accent">项目摘要</p>
              <h2 className="section-title">当前项目与支付上下文</h2>
            </div>
          </div>
          <div className="data-grid detail-grid-two">
            <article>
              <span>项目状态</span>
              <strong>{data.project.statusText}</strong>
            </article>
            <article>
              <span>当前阶段</span>
              <strong>{data.project.currentPhase}</strong>
            </article>
            <article>
              <span>服务商</span>
              <strong>{data.project.providerName}</strong>
            </article>
            <article>
              <span>预算</span>
              <strong>{data.project.budgetText}</strong>
            </article>
          </div>
          <div className="status-note" style={{ marginTop: 16 }}>
            {pendingItems.length
              ? '当前存在待你确认的正式变更。确认后会直接影响项目工期、说明边界或支付计划。'
              : '当前没有待你确认的变更，后续如商家发起正式变更，会在这里和通知中心同步显示。'}
          </div>
        </section>
      </section>
    </div>
  );
}
