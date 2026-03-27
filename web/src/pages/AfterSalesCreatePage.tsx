import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { EmptyBlock, ErrorBlock, LoadingBlock } from '../components/AsyncState';
import { useAsyncData } from '../hooks/useAsyncData';
import { createAfterSales } from '../services/afterSales';
import { listBookings } from '../services/bookings';
import styles from './AfterSalesCreatePage.module.scss';

const typeOptions = [
  { value: 'complaint', label: '投诉争议', description: '沟通失联、服务态度、履约分歧等问题。' },
  { value: 'refund', label: '退款申请', description: '涉及费用退回、定金或款项争议。' },
  { value: 'repair', label: '返修申请', description: '施工或交付问题，需要返工返修。' },
] as const;

type FormState = {
  bookingId: number;
  type: 'refund' | 'complaint' | 'repair';
  reason: string;
  description: string;
  amount: string;
};

type FeedbackState =
  | { tone: 'success' | 'danger'; text: string }
  | null;

function sanitizeAmount(value: string) {
  const cleaned = value.replace(/[^\d.]/g, '');
  const [integer = '', ...rest] = cleaned.split('.');
  const decimal = rest.join('').slice(0, 2);
  if (!rest.length) {
    return integer;
  }
  return `${integer}.${decimal}`;
}

export function AfterSalesCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const presetType = searchParams.get('type');
  const presetBookingId = Number(searchParams.get('bookingId') || 0);
  const { data, loading, error, reload } = useAsyncData(listBookings, []);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [reasonTouched, setReasonTouched] = useState(false);
  const [form, setForm] = useState<FormState>({
    bookingId: presetBookingId || 0,
    type: (presetType === 'refund' || presetType === 'repair' || presetType === 'complaint' ? presetType : 'complaint') as FormState['type'],
    reason: '',
    description: '',
    amount: '',
  });

  const currentBooking = useMemo(() => data?.find((item) => item.id === form.bookingId) || null, [data, form.bookingId]);
  const reasonLength = form.reason.trim().length;
  const descriptionLength = form.description.trim().length;
  const reasonError = reasonTouched
    ? reasonLength === 0
      ? '请先写明申请原因。'
      : reasonLength < 4
        ? '原因再写具体一点，至少 4 个字。'
        : ''
    : '';
  const canSubmit = Boolean(form.bookingId) && reasonLength >= 4 && !submitting;

  if (loading) {
    return <div className="container page-stack"><LoadingBlock title="加载售后申请表" /></div>;
  }

  if (error || !data) {
    return <div className="container page-stack"><ErrorBlock description={error || '售后申请表加载失败'} onRetry={() => void reload()} /></div>;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setReasonTouched(true);
    setFeedback(null);

    if (!form.bookingId) {
      setFeedback({ tone: 'danger', text: '请先选择关联预约。' });
      return;
    }

    if (reasonLength < 4) {
      return;
    }

    setSubmitting(true);

    try {
      const created = await createAfterSales({
        bookingId: form.bookingId,
        type: form.type,
        reason: form.reason.trim(),
        description: form.description.trim(),
        amount: Number(form.amount || 0),
        images: '[]',
      });
      navigate(`/after-sales/${created.id}`);
    } catch (submitError) {
      setFeedback({
        tone: 'danger',
        text: submitError instanceof Error ? submitError.message : '提交失败',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`container page-stack ${styles.page}`}>
      <header className={`card ${styles.hero}`}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>发起售后申请</p>
          <h1>把问题挂到正确预约，再把情况写清楚</h1>
          <p>这一步先提交核心情况。后续如果还需要补充材料，平台会再通知你。</p>
        </div>
        <div className={styles.heroMeta}>
          <span className="status-chip" data-tone="brand">售后中心</span>
          <span className="status-chip">{typeOptions.find((item) => item.value === form.type)?.label}</span>
          {currentBooking ? <span className="status-chip">已关联预约 #{currentBooking.id}</span> : null}
        </div>
      </header>

      <section className={styles.layout}>
        <div className={styles.selectionColumn}>
          <section className={`card ${styles.selectionPanel}`}>
            <div className={styles.sectionHead}>
              <div>
                <p className={styles.sectionLabel}>关联预约</p>
                <h2>先选一条对应的业务记录</h2>
              </div>
            </div>

            {data.length === 0 ? (
              <EmptyBlock
                action={<Link className="button-secondary" to="/providers?category=designer">去找服务商</Link>}
                description="先创建预约后，才能发起售后或争议申请。"
                title="暂无可关联预约"
              />
            ) : (
              <div className={styles.bookingList}>
                {data.map((item) => {
                  const selected = form.bookingId === item.id;
                  return (
                    <button
                      aria-pressed={selected}
                      className={`${styles.bookingCard} ${selected ? styles.bookingCardSelected : ''}`}
                      key={item.id}
                      onClick={() => {
                        setForm((prev) => ({ ...prev, bookingId: item.id }));
                        if (feedback) {
                          setFeedback(null);
                        }
                      }}
                      type="button"
                    >
                      <div className={styles.bookingCardMain}>
                        <div className={styles.bookingCardTop}>
                          <div className={styles.bookingChips}>
                            <span className="status-chip" data-tone={selected ? 'brand' : 'warning'}>
                              {selected ? '已选择' : item.statusText}
                            </span>
                            <span className="status-chip">{item.providerTypeText}</span>
                          </div>
                          <span className={styles.selectionMark}>{selected ? '当前关联' : '点此选择'}</span>
                        </div>
                        <h3>{item.title}</h3>
                        <p>{item.address}</p>
                        <div className={styles.bookingMeta}>
                          <span>期望时间 {item.preferredDate}</span>
                          <span>{item.budgetRange}</span>
                          <span>更新于 {item.updatedAt}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <section className={`card ${styles.formCard}`}>
          <div className={styles.sectionHead}>
            <div>
              <p className={styles.sectionLabel}>填写申请</p>
              <h2>把核心情况写清楚就行</h2>
            </div>
          </div>

          <div aria-live="polite" className={styles.feedbackStack}>
            {feedback ? (
              <div className="status-note" data-tone={feedback.tone} role={feedback.tone === 'danger' ? 'alert' : undefined}>
                {feedback.text}
              </div>
            ) : null}
          </div>

          <form className={styles.formShell} noValidate onSubmit={(event) => void handleSubmit(event)}>
            <div className={styles.typeGrid}>
              {typeOptions.map((option) => {
                const active = form.type === option.value;
                return (
                  <button
                    className={`${styles.typeCard} ${active ? styles.typeCardActive : ''}`}
                    key={option.value}
                    onClick={() => {
                      setForm((prev) => ({ ...prev, type: option.value }));
                      if (feedback) {
                        setFeedback(null);
                      }
                    }}
                    type="button"
                  >
                    <strong>{option.label}</strong>
                    <p>{option.description}</p>
                  </button>
                );
              })}
            </div>

            {currentBooking ? (
              <div className={styles.bookingInlineNote}>
                已关联预约 <strong>#{currentBooking.id}</strong>，提交后会直接进入对应业务记录处理。
              </div>
            ) : null}

            <div className="field">
              <label htmlFor="after-sales-reason">申请原因</label>
              <input
                aria-describedby={reasonError ? 'after-sales-reason-help after-sales-reason-error' : 'after-sales-reason-help'}
                aria-invalid={Boolean(reasonError)}
                id="after-sales-reason"
                onBlur={() => setReasonTouched(true)}
                onChange={(event) => {
                  setForm((prev) => ({ ...prev, reason: event.target.value }));
                  if (feedback) {
                    setFeedback(null);
                  }
                }}
                placeholder="例如：服务商长期未响应，申请退款处理。"
                value={form.reason}
              />
              <div className={styles.fieldFoot}>
                <p className="field-help" id="after-sales-reason-help">用一句话概括问题，至少 4 个字。</p>
                <p className={styles.counter}>{reasonLength}</p>
              </div>
              {reasonError ? <p className="field-error" id="after-sales-reason-error" role="alert">{reasonError}</p> : null}
            </div>

            <div className="field">
              <label htmlFor="after-sales-description">详细描述</label>
              <textarea
                id="after-sales-description"
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="把问题经过、你和服务商沟通过什么、希望平台怎么协助处理写清楚。"
                value={form.description}
              />
              <div className={styles.fieldFoot}>
                <p className="field-help">建议补充完整经过，平台判断会更快。</p>
                <p className={styles.counter}>{descriptionLength}</p>
              </div>
            </div>

            <div className="field">
              <label htmlFor="after-sales-amount">涉及金额</label>
              <input
                id="after-sales-amount"
                inputMode="decimal"
                onChange={(event) => setForm((prev) => ({ ...prev, amount: sanitizeAmount(event.target.value) }))}
                placeholder="没有可填 0"
                value={form.amount}
              />
              <p className="field-help">如果这次不涉及金额，可以直接填 0。</p>
            </div>

            <div className="status-note">
              暂不需要你手动上传图片证据。后续如需补充，平台会再联系你。
            </div>

            <div className={styles.actionRow}>
              <button className="button-secondary" disabled={!canSubmit} type="submit">
                {submitting ? '提交中…' : '提交申请'}
              </button>
              <Link className="button-outline" to="/me/after-sales">返回售后中心</Link>
            </div>
          </form>
        </section>
      </section>
    </div>
  );
}
