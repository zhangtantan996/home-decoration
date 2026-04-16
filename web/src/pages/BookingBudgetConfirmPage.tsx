import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ErrorBlock, LoadingBlock } from '../components/AsyncState';
import { BUDGET_CONFIRM_STATUS_LABELS, BUDGET_INCLUDE_LABELS } from '../constants/statuses';
import { useAsyncData } from '../hooks/useAsyncData';
import { acceptBookingBudgetConfirm, getBookingBudgetConfirm, rejectBookingBudgetConfirm } from '../services/bookings';
import { formatCurrency } from '../utils/format';
import styles from './BookingStagePage.module.scss';

function readStatusTone(status: string) {
  if (status === 'accepted') return 'success';
  if (status === 'rejected') return 'danger';
  return 'default';
}

export function BookingBudgetConfirmPage() {
  const params = useParams();
  const bookingId = Number(params.id || 0);
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { data, loading, error, reload } = useAsyncData(() => getBookingBudgetConfirm(bookingId), [bookingId]);

  if (loading) return <div className="container page-stack"><LoadingBlock title="加载沟通确认" /></div>;
  if (error) return <div className="container page-stack"><ErrorBlock description={error} onRetry={() => void reload()} /></div>;

  if (!data) {
    return (
      <div className={styles.page}>
        <section className={styles.hero}>
          <div className={styles.heroTop}>
            <div>
              <p className="kicker eyebrow-accent">沟通确认</p>
              <h1>预约 #{bookingId} 暂无沟通确认</h1>
            </div>
            <Link className="button-link" to={`/bookings/${bookingId}`}>返回预约详情</Link>
          </div>
          <p className={styles.helperNote}>设计师尚未提交沟通结果，提交后会在这里展示。</p>
        </section>
      </div>
    );
  }

  const includes = Object.entries(data.includes || {})
    .filter(([, checked]) => checked)
    .map(([key]) => BUDGET_INCLUDE_LABELS[key] || key);
  const canRespond = data.status === 'submitted';
  const rejectProgress = data.rejectLimit > 0 ? `${data.rejectCount}/${data.rejectLimit}` : `${data.rejectCount}`;

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroTop}>
          <div>
            <p className="kicker eyebrow-accent">沟通确认</p>
            <h1>预约 #{bookingId} 沟通结果与设计意向</h1>
          </div>
          <Link className="button-link" to={`/bookings/${bookingId}`}>返回预约详情</Link>
        </div>

        <div className={styles.summaryGrid}>
          <article className={styles.summaryCard}>
            <span>当前状态</span>
            <strong>{BUDGET_CONFIRM_STATUS_LABELS[data.status] || data.status}</strong>
          </article>
          <article className={styles.summaryCard}>
            <span>预算区间</span>
            <strong>{formatCurrency(data.budgetMin)} - {formatCurrency(data.budgetMax)}</strong>
          </article>
          <article className={styles.summaryCard}>
            <span>提交时间</span>
            <strong>{data.submittedAt || '待提交'}</strong>
          </article>
          <article className={styles.summaryCard}>
            <span>处理时间</span>
            <strong>{data.acceptedAt || data.rejectedAt || '待处理'}</strong>
          </article>
          <article className={styles.summaryCard}>
            <span>驳回次数</span>
            <strong>{rejectProgress}</strong>
          </article>
        </div>
      </section>

      <section className={styles.contentGrid}>
        <div className={styles.mainStack}>
          <section className={`card ${styles.panel}`}>
            <div className={styles.panelHead}>
              <h2>沟通包含项</h2>
              <p>设计师确认本次报价沟通涉及的费用范围与配合项。</p>
            </div>
            {includes.length ? (
              <div className={styles.chipRow}>
                {includes.map((item) => (
                  <span className="status-chip" key={item}>{item}</span>
                ))}
              </div>
            ) : (
              <p className={styles.helperNote}>暂无明确包含项。</p>
            )}
          </section>

          <section className={`card ${styles.panel}`}>
            <div className={styles.panelHead}>
              <h2>设计意向</h2>
              <p>这是设计师基于量房与前期沟通整理出的方向建议。</p>
            </div>
            <div className={styles.textBlock}>
              <span className={styles.textBlockLabel}>设计方向</span>
              <p>{data.designIntent || '暂未填写设计意向'}</p>
            </div>
            <div className={styles.textBlock}>
              <span className={styles.textBlockLabel}>风格方向</span>
              <p>{data.styleDirection || '暂未填写风格方向'}</p>
            </div>
            <div className={styles.textBlock}>
              <span className={styles.textBlockLabel}>空间需求</span>
              <p>{data.spaceRequirements || '暂未填写空间需求'}</p>
            </div>
            <div className={styles.textBlock}>
              <span className={styles.textBlockLabel}>可接受工期</span>
              <p>{data.expectedDurationDays ? `${data.expectedDurationDays} 天` : '暂未填写工期预期'}</p>
            </div>
            <div className={styles.textBlock}>
              <span className={styles.textBlockLabel}>特殊要求</span>
              <p>{data.specialRequirements || '暂无特殊要求'}</p>
            </div>
          </section>

          <section className={`card ${styles.panel}`}>
            <div className={styles.panelHead}>
              <h2>补充说明</h2>
              <p>结合量房结果，对预算、空间和后续合作方式的补充说明。</p>
            </div>
            <div className={styles.textBlock}>
              <span className={styles.textBlockLabel}>设计师备注</span>
              <p>{data.notes || '暂无补充说明'}</p>
            </div>
          </section>
        </div>

        <aside className={styles.sideStack}>
          <section className={`card ${styles.panel}`}>
            <div className={styles.panelHead}>
              <h2>当前动作</h2>
              <p>确认后进入设计费报价阶段；如当前结果不满足预期，可直接退回。</p>
            </div>

            <div className={styles.statusCard} data-tone={readStatusTone(data.status)}>
              <span>处理状态</span>
              <strong>{BUDGET_CONFIRM_STATUS_LABELS[data.status] || data.status}</strong>
              <p>
                {data.status === 'accepted'
                  ? '沟通确认已完成，下一步由设计师发起设计费报价。'
                  : data.status === 'rejected'
                    ? data.canResubmit
                      ? `你已退回当前沟通结果，等待设计师基于同一条沟通确认重提。当前驳回次数 ${rejectProgress}。`
                      : `沟通确认已达到驳回上限（${rejectProgress}），预约将进入关闭/退款链。`
                    : '请核对预算范围、设计意向与包含项后，再决定是否继续。'}
              </p>
            </div>

            {message ? <div className="status-note">{message}</div> : null}
            {data.rejectionReason ? <div className="status-note">上次退回原因：{data.rejectionReason}</div> : null}

            {canRespond ? (
              <>
                <div className={styles.textareaWrap}>
                  <label className={styles.textareaLabel} htmlFor="budget-confirm-reason">
                    退回说明
                  </label>
                  <textarea
                    className={styles.textarea}
                    id="budget-confirm-reason"
                    placeholder="如果你觉得预算压力过大、设计方向不匹配，或还需要继续沟通，可以在这里说明原因。"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                  />
                </div>

                <div className={styles.actionRow}>
                  <button
                    className="button-secondary"
                    disabled={submitting}
                    onClick={async () => {
                      setSubmitting(true);
                      setMessage('');
                      try {
                        await acceptBookingBudgetConfirm(bookingId);
                        setMessage('沟通结果已确认，设计师可继续发起设计费报价。');
                        await reload();
                      } catch (submitError) {
                        setMessage(submitError instanceof Error ? submitError.message : '确认失败');
                      } finally {
                        setSubmitting(false);
                      }
                    }}
                    type="button"
                  >
                    {submitting ? '处理中…' : '确认沟通结果'}
                  </button>
                  <button
                    className="button-outline"
                    disabled={submitting}
                    onClick={async () => {
                      setSubmitting(true);
                      setMessage('');
                      try {
                        await rejectBookingBudgetConfirm(bookingId, reason.trim() || '当前沟通结果不满足需求');
                        setMessage('已退回沟通结果，本预约会等待设计师重新整理后继续推进。');
                        await reload();
                      } catch (submitError) {
                        setMessage(submitError instanceof Error ? submitError.message : '退回失败');
                      } finally {
                        setSubmitting(false);
                      }
                    }}
                    type="button"
                  >
                    退回沟通结果
                  </button>
                </div>
              </>
            ) : (
              <div className={styles.actionRow}>
                <Link className="button-secondary" to={`/bookings/${bookingId}`}>返回预约详情</Link>
              </div>
            )}
          </section>
        </aside>
      </section>
    </div>
  );
}
