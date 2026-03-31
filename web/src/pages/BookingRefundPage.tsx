import { useMemo, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ErrorBlock, LoadingBlock } from '../components/AsyncState';
import { REFUND_STATUS_LABELS, REFUND_TYPE_LABELS } from '../constants/statuses';
import { useAsyncData } from '../hooks/useAsyncData';
import { getBookingDetail, listMyRefundApplications, submitBookingRefund, type RefundApplicationItem } from '../services/bookings';
import { formatCurrency, formatDateTime } from '../utils/format';
import styles from './BookingRefundPage.module.scss';

const openRefundStatuses = new Set<RefundApplicationItem['status']>(['pending', 'approved']);
const reasonTips = [
  '说明这次为什么不继续推进量房或后续合作。',
  '简单写下你和服务商已经沟通过什么，目前卡在哪一步。',
  '如果你有明确诉求，直接写希望平台怎么协助处理。',
];

type FeedbackState =
  | { tone: 'success' | 'danger'; text: string }
  | null;

function readRefundTone(status: RefundApplicationItem['status']) {
  if (status === 'completed') return 'success';
  if (status === 'rejected') return 'danger';
  if (status === 'approved') return 'brand';
  return 'warning';
}

function sortRefunds(items: RefundApplicationItem[]) {
  return [...items].sort((left, right) => {
    const byCreatedAt = String(right.createdAt || '').localeCompare(String(left.createdAt || ''));
    if (byCreatedAt !== 0) {
      return byCreatedAt;
    }
    return right.id - left.id;
  });
}

export function BookingRefundPage() {
  const params = useParams();
  const bookingId = Number(params.id || 0);
  const [reason, setReason] = useState('');
  const [reasonTouched, setReasonTouched] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data, loading, error, reload } = useAsyncData(async () => {
    const [booking, refunds] = await Promise.all([
      getBookingDetail(bookingId),
      listMyRefundApplications().catch(() => [] as RefundApplicationItem[]),
    ]);

    return {
      booking,
      refunds: sortRefunds(refunds.filter((item) => Number(item.bookingId) === bookingId)),
    };
  }, [bookingId]);

  const latestRefund = useMemo(() => data?.refunds?.[0] || null, [data?.refunds]);
  const hasOpenRefund = Boolean(latestRefund && openRefundStatuses.has(latestRefund.status));
  const reasonLength = reason.trim().length;
  const reasonError = reasonTouched
    ? reasonLength === 0
      ? '请先写一下退款原因。'
      : reasonLength < 10
        ? '再补充一点细节，至少写满 10 个字。'
        : ''
    : '';
  const canSubmit = reasonLength >= 10 && !submitting && !hasOpenRefund;

  if (loading) {
    return <div className="container page-stack"><LoadingBlock title="加载退款申请页" /></div>;
  }

  if (error || !data) {
    return <div className="container page-stack"><ErrorBlock description={error || '预约不存在'} onRetry={() => void reload()} /></div>;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setReasonTouched(true);
    setFeedback(null);

    if (!canSubmit) {
      return;
    }

    setSubmitting(true);

    try {
      await submitBookingRefund(bookingId, {
        refundType: 'intent_fee',
        reason: reason.trim(),
        evidence: [],
      });
      setReason('');
      setFeedback({ tone: 'success', text: '退款申请已提交，请等待平台处理。' });
      await reload();
    } catch (submitError) {
      setFeedback({
        tone: 'danger',
        text: submitError instanceof Error ? submitError.message : '提交退款失败',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`container page-stack ${styles.page}`}>
      <header className={`card ${styles.hero}`}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>退款申请</p>
          <h1>申请退回量房定金</h1>
          <p>把原因写清楚，后续处理会更顺一点。</p>
        </div>

        <div className={styles.heroMeta}>
          <span className="status-chip" data-tone="brand">预约 #{data.booking.id}</span>
          <span className="status-chip">{data.booking.statusText}</span>
          {latestRefund ? (
            <span className="status-chip" data-tone={readRefundTone(latestRefund.status)}>
              最近申请 {REFUND_STATUS_LABELS[latestRefund.status] || latestRefund.status}
            </span>
          ) : null}
        </div>
      </header>

      <section className={styles.layout}>
        <div className={styles.summaryStack}>
          <section className={`card ${styles.summaryCard}`}>
            <div className={styles.sectionHead}>
              <div>
                <p className={styles.sectionLabel}>预约信息</p>
                <h2>{data.booking.address}</h2>
              </div>
              <span className="status-chip">{REFUND_TYPE_LABELS.intent_fee}</span>
            </div>

            <div className={styles.metricsGrid}>
              <article className={styles.metricCard}>
                <span>服务商</span>
                <strong>{data.booking.providerName || '待确认'}</strong>
              </article>
              <article className={styles.metricCard}>
                <span>量房定金</span>
                <strong>{data.booking.depositAmountText || '待确认'}</strong>
              </article>
              <article className={styles.metricCard}>
                <span>装修预算</span>
                <strong>{data.booking.budgetRange || '待确认'}</strong>
              </article>
              <article className={styles.metricCard}>
                <span>当前阶段</span>
                <strong>{data.booking.stageOverview.title || '待同步'}</strong>
              </article>
            </div>
          </section>

          {data.booking.surveyRefundNotice ? (
            <section className={`card ${styles.sideCard}`}>
              <div className={styles.sectionHead}>
                <div>
                  <p className={styles.sectionLabel}>退款说明</p>
                  <h2>先看清这笔定金怎么退</h2>
                </div>
              </div>
              <div className={styles.noticeCard}>
                <p>{data.booking.surveyRefundNotice}</p>
              </div>
            </section>
          ) : null}

          <section className={`card ${styles.sideCard}`}>
            <div className={styles.sectionHead}>
              <div>
                <p className={styles.sectionLabel}>填写建议</p>
                <h2>把关键情况交代清楚</h2>
              </div>
            </div>
            <ul className={styles.tipList}>
              {reasonTips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </section>

          <section className={`card ${styles.sideCard}`}>
            <div className={styles.sectionHead}>
              <div>
                <p className={styles.sectionLabel}>申请记录</p>
                <h2>{data.refunds.length > 0 ? '最近提交' : '当前还没有记录'}</h2>
              </div>
            </div>

            {data.refunds.length > 0 ? (
              <div className={styles.historyList}>
                {data.refunds.map((item) => (
                  <article className={styles.historyItem} key={item.id}>
                    <div className={styles.historyTitleRow}>
                      <strong>#{item.id}</strong>
                      <span className="status-chip" data-tone={readRefundTone(item.status)}>
                        {REFUND_STATUS_LABELS[item.status] || item.status}
                      </span>
                    </div>

                    <div className={styles.historyMeta}>
                      <span>{REFUND_TYPE_LABELS[item.refundType] || item.refundType}</span>
                      <span>{item.refundAmount > 0 ? formatCurrency(item.refundAmount) : '金额待确认'}</span>
                      <span>{formatDateTime(item.createdAt)}</span>
                    </div>

                    <p>{item.reason || '未填写原因'}</p>
                  </article>
                ))}
              </div>
            ) : (
              <div className={styles.emptyCard}>
                <strong>还没提交过退款申请</strong>
                <p>如果这次确实不再继续，可以直接在右侧填写原因后提交。</p>
              </div>
            )}
          </section>
        </div>

        <section className={`card ${styles.formCard}`}>
          <div className={styles.sectionHead}>
            <div>
              <p className={styles.sectionLabel}>提交申请</p>
              <h2>填写退款原因</h2>
            </div>
          </div>

          <div aria-live="polite" className={styles.feedbackStack}>
            {feedback ? (
              <div className="status-note" data-tone={feedback.tone} role={feedback.tone === 'danger' ? 'alert' : undefined}>
                {feedback.text}
              </div>
            ) : null}

            {hasOpenRefund ? (
              <div className="status-note" data-tone="warning">
                当前预约已有处理中退款申请，暂时不能重复提交。
              </div>
            ) : null}
          </div>

          <form className={styles.formShell} noValidate onSubmit={(event) => void handleSubmit(event)}>
            <div className={styles.typePanel}>
              <span>退款类型</span>
              <strong>{REFUND_TYPE_LABELS.intent_fee}</strong>
              <p>这一步只需要填写原因，后续如需补充材料会再通知你。</p>
            </div>

            <div className="field">
              <label htmlFor="refund-reason">申请原因</label>
              <textarea
                aria-describedby={reasonError ? 'refund-reason-help refund-reason-error' : 'refund-reason-help'}
                aria-invalid={Boolean(reasonError)}
                className={styles.reasonInput}
                id="refund-reason"
                maxLength={300}
                onBlur={() => setReasonTouched(true)}
                onChange={(event) => {
                  setReason(event.target.value);
                  if (feedback) {
                    setFeedback(null);
                  }
                }}
                placeholder="例如：服务商确认后长期未继续沟通，量房安排没有推进，申请退回已支付的量房定金。"
                value={reason}
              />
              <div className={styles.fieldFoot}>
                <p className="field-help" id="refund-reason-help">建议不少于 10 个字，最多 300 个字。</p>
                <p className={styles.counter}>{reasonLength}/300</p>
              </div>
              {reasonError ? (
                <p className="field-error" id="refund-reason-error" role="alert">{reasonError}</p>
              ) : null}
            </div>

            <div className={styles.actionRow}>
              <button className="button-secondary" disabled={!canSubmit} type="submit">
                {submitting ? '提交中…' : '提交退款申请'}
              </button>
              <Link className="button-outline" to={`/bookings/${bookingId}`}>返回预约详情</Link>
            </div>
          </form>
        </section>
      </section>
    </div>
  );
}
