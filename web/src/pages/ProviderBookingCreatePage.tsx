/* @refresh reset */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';

import { ErrorBlock, LoadingBlock } from '../components/AsyncState';
import { useAsyncData } from '../hooks/useAsyncData';
import { useSessionStore } from '../modules/session/sessionStore';
import { createBooking } from '../services/bookings';
import { getProviderDetail } from '../services/providers';
import type { ProviderRole } from '../types/viewModels';

interface NoteState {
  text: string;
  tone: 'brand' | 'success' | 'warning' | 'danger';
}

interface LocationState {
  from?: string;
}

type DatePresetKey = 'soon' | 'week' | 'month' | 'custom';

interface DateDraft {
  year: string;
  month: string;
  day: string;
}

const budgetOptions = ['10万以内', '10-20万', '20-50万', '50万以上'];
const areaQuickOptions = ['60', '90', '120', '150'];
const datePresetOptions: Array<{ key: DatePresetKey; label: string }> = [
  { key: 'soon', label: '尽快沟通' },
  { key: 'week', label: '本周内' },
  { key: 'month', label: '本月内' },
  { key: 'custom', label: '自定义日期' },
];
const noteSuggestionMap = [
  { label: '旧房翻新', text: '当前项目偏向旧房翻新，希望先沟通改造重点。' },
  { label: '准备先量房', text: '希望先安排量房，再继续确认方案方向。' },
  { label: '想先看报价', text: '希望先了解报价结构与大致区间。' },
];

function readRole(value: string | undefined): ProviderRole | null {
  if (value === 'designer' || value === 'company' || value === 'foreman') return value;
  return null;
}

function futureDateText(offsetDays: number) {
  const next = new Date();
  next.setDate(next.getDate() + offsetDays);
  return next.toISOString().slice(0, 10);
}

function tomorrowText() {
  return futureDateText(1);
}

function padDateUnit(value: string) {
  return value.padStart(2, '0');
}

function getMonthDayCount(year: string, month: string) {
  const safeYear = Number(year) || new Date().getFullYear();
  const safeMonth = Number(month) || 1;
  return new Date(safeYear, safeMonth, 0).getDate();
}

function createDateDraft(value: string): DateDraft {
  const fallback = tomorrowText();
  const target = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback;
  const [year, month, day] = target.split('-');
  return {
    year,
    month: String(Number(month)),
    day: String(Number(day)),
  };
}

function buildDateValue(draft: DateDraft) {
  const year = draft.year || String(new Date().getFullYear());
  const month = draft.month || '1';
  const maxDay = getMonthDayCount(year, month);
  const day = String(Math.min(Math.max(Number(draft.day) || 1, 1), maxDay));
  return `${year}-${padDateUnit(month)}-${padDateUnit(day)}`;
}

function formatServiceArea(areas: string[]) {
  if (areas.length === 0) return '同城服务';
  if (areas.length <= 2) return areas.join(' / ');
  return `${areas.slice(0, 2).join(' / ')} 等 ${areas.length} 个城市`;
}

function readBackPath(state: unknown, fallback: string) {
  if (state && typeof state === 'object' && 'from' in state) {
    const from = (state as LocationState).from;
    if (from && typeof from === 'string') {
      return from;
    }
  }
  return fallback;
}

function resolveDatePresetValue(key: Exclude<DatePresetKey, 'custom'>) {
  if (key === 'week') return futureDateText(3);
  if (key === 'month') return futureDateText(14);
  return tomorrowText();
}

function formatPreferredDateSummary(value: string, datePreset: DatePresetKey) {
  if (datePreset === 'soon') return '尽快沟通';
  if (datePreset === 'week') return '本周内';
  if (datePreset === 'month') return '本月内';
  return value || '待选择';
}

function formatCustomDateLabel(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return '待选择';
  }
  const [year, month, day] = value.split('-');
  return `${year} 年 ${month} 月 ${day} 日`;
}

function getServiceOptions(role: ProviderRole | null) {
  if (role === 'foreman') {
    return ['施工服务', '半包施工', '局部改造'];
  }
  if (role === 'company') {
    return ['全案设计服务', '设计 + 施工协同', '整装施工'];
  }
  return ['全案设计服务', '设计 + 施工协同', '局部改造'];
}

export function ProviderBookingCreatePage() {
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useSessionStore((state) => state.user);
  const customDateYearListRef = useRef<HTMLDivElement>(null);
  const customDateMonthListRef = useRef<HTMLDivElement>(null);
  const customDateDayListRef = useRef<HTMLDivElement>(null);
  const role = readRole(params.role);
  const providerId = Number(params.id || 0);
  const [submitting, setSubmitting] = useState(false);
  const [submitNote, setSubmitNote] = useState<NoteState | null>(null);
  const [datePreset, setDatePreset] = useState<DatePresetKey>('soon');
  const [customDatePickerOpen, setCustomDatePickerOpen] = useState(false);
  const [form, setForm] = useState({
    address: '',
    area: '90',
    renovationType: '全案设计服务',
    budgetRange: '20-50万',
    preferredDate: tomorrowText(),
    phone: user?.phone || '',
    notes: '希望先沟通需求，再安排量房或方案建议。',
  });
  const [customDateDraft, setCustomDateDraft] = useState<DateDraft>(createDateDraft(tomorrowText()));

  const serviceOptions = useMemo(() => getServiceOptions(role), [role]);
  const currentYear = new Date().getFullYear();
  const customDateYearOptions = useMemo(
    () => Array.from({ length: 4 }, (_, index) => String(currentYear + index)),
    [currentYear],
  );
  const customDateMonthOptions = useMemo(
    () => Array.from({ length: 12 }, (_, index) => String(index + 1)),
    [],
  );
  const customDateDayOptions = useMemo(
    () => Array.from({ length: getMonthDayCount(customDateDraft.year, customDateDraft.month) }, (_, index) => String(index + 1)),
    [customDateDraft.month, customDateDraft.year],
  );

  useEffect(() => {
    if (user?.phone) {
      setForm((prev) => ({ ...prev, phone: prev.phone || user.phone }));
    }
  }, [user?.phone]);

  useEffect(() => {
    setForm((prev) => {
      if (serviceOptions.includes(prev.renovationType)) {
        return prev;
      }
      return { ...prev, renovationType: serviceOptions[0] };
    });
  }, [serviceOptions]);

  useEffect(() => {
    if (!customDatePickerOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setCustomDatePickerOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [customDatePickerOpen]);

  useEffect(() => {
    if (!customDatePickerOpen) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      [customDateYearListRef.current, customDateMonthListRef.current, customDateDayListRef.current].forEach((container) => {
        const activeButton = container?.querySelector<HTMLButtonElement>('[data-selected="true"]');
        activeButton?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [customDateDraft.day, customDateDraft.month, customDateDraft.year, customDatePickerOpen]);

  const { data, loading, error, reload } = useAsyncData(async () => {
    if (!user || !role || !providerId) {
      return null;
    }
    return getProviderDetail(role, providerId);
  }, [user?.phone, role, providerId]);

  const redirectPath = `${location.pathname}${location.search}`;
  const detailPath = role && providerId ? `/providers/${role}/${providerId}` : '/providers';
  const backPath = readBackPath(location.state, detailPath);
  const bookingDisabled = useMemo(
    () => !form.address.trim() || Number(form.area) < 10 || !form.phone.trim(),
    [form.address, form.area, form.phone],
  );

  if (!user) {
    return <Navigate replace to={`/login?redirect=${encodeURIComponent(redirectPath)}`} />;
  }

  if (loading) {
    return <div className="container page-stack"><LoadingBlock title="加载预约页" /></div>;
  }

  if (error || !role || !providerId || !data) {
    return (
      <div className="container page-stack">
        <ErrorBlock description={error || '预约页面加载失败'} onRetry={() => void reload()} />
      </div>
    );
  }

  const detail = data;
  const areaSummary = formatServiceArea(detail.serviceArea);
  const depositText = detail.surveyDepositPrice ? `¥${detail.surveyDepositPrice}` : '按平台流程确认';
  const completionPercent = Math.round(([
    form.address.trim(),
    Number(form.area) >= 10 ? form.area : '',
    form.budgetRange,
    form.renovationType,
    form.preferredDate,
    form.phone.trim(),
  ].filter(Boolean).length / 6) * 100);

  const handlePickDatePreset = (nextPreset: DatePresetKey) => {
    if (nextPreset === 'custom') {
      setCustomDateDraft(createDateDraft(form.preferredDate));
      setCustomDatePickerOpen(true);
      return;
    }
    setDatePreset(nextPreset);
    setForm((prev) => ({ ...prev, preferredDate: resolveDatePresetValue(nextPreset) }));
  };

  const handleToggleNote = (text: string) => {
    setForm((prev) => {
      const lines = prev.notes
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
      const exists = lines.includes(text);
      const nextLines = exists ? lines.filter((line) => line !== text) : [...lines, text];
      return {
        ...prev,
        notes: nextLines.join('\n'),
      };
    });
  };

  const handleCustomDateDraftChange = (field: keyof DateDraft, value: string) => {
    setCustomDateDraft((current) => {
      const next = { ...current, [field]: value };
      const maxDay = getMonthDayCount(next.year, next.month);
      if (Number(next.day) > maxDay) {
        next.day = String(maxDay);
      }
      return next;
    });
  };

  const applyCustomDate = () => {
    const nextValue = buildDateValue(customDateDraft);
    setDatePreset('custom');
    setForm((prev) => ({ ...prev, preferredDate: nextValue }));
    setCustomDatePickerOpen(false);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitNote(null);
    try {
      const bookingId = await createBooking({
        providerId: detail.id,
        providerType: role,
        address: form.address.trim(),
        area: Number(form.area),
        renovationType: form.renovationType,
        budgetRange: form.budgetRange,
        preferredDate: form.preferredDate,
        phone: form.phone.trim(),
        notes: form.notes.trim(),
      });
      setSubmitNote({ text: '预约已创建，正在进入预约详情。', tone: 'success' });
      navigate(`/bookings/${bookingId}`);
    } catch (submitError) {
      setSubmitNote({
        text: submitError instanceof Error ? submitError.message : '预约提交失败，请稍后重试。',
        tone: 'danger',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container page-stack provider-booking-page">
      <section className="card provider-booking-hero-card">
        <div className="provider-booking-hero-media">
          <img alt={detail.name} src={detail.coverImage} />
        </div>
        <div className="provider-booking-hero-content">
          <div className="provider-booking-hero-head">
            <div className="provider-booking-hero-title-block">
              <p className="provider-booking-hero-eyebrow">预约需求单</p>
              <div className="provider-booking-hero-badges">
                <span className="status-chip">{detail.orgLabel}</span>
                {detail.verified ? <span className="status-chip" data-tone="success">平台认证</span> : null}
              </div>
              <h1>{detail.name}</h1>
              <p>{detail.summary}</p>
            </div>
            <Link className="button-outline provider-booking-return" state={{ from: backPath }} to={detailPath}>
              返回服务商详情
            </Link>
          </div>

          <div className="provider-booking-hero-metrics">
            <article>
              <span>服务城市</span>
              <strong>{areaSummary}</strong>
            </article>
            <article>
              <span>参考报价</span>
              <strong>{detail.priceText}</strong>
            </article>
            <article>
              <span>从业经验</span>
              <strong>{detail.yearsExperience > 0 ? `${detail.yearsExperience} 年经验` : '待补充'}</strong>
            </article>
            <article>
              <span>沟通方式</span>
              <strong>{detail.phoneHint || '提交后沟通'}</strong>
            </article>
          </div>
        </div>
      </section>

      <section className="card provider-booking-shell">
        <div className="provider-booking-main">
          {submitNote ? <div className="status-note provider-booking-status" data-tone={submitNote.tone}>{submitNote.text}</div> : null}

          <section className="provider-booking-section-card">
            <div className="provider-booking-section-head">
              <div>
                <p className="detail-kicker">第一步</p>
                <h2>项目信息</h2>
              </div>
              <span>先补齐地址、面积和预算</span>
            </div>
            <div className="provider-booking-form-grid">
              <div className="field">
                <label htmlFor="booking-address">项目地址</label>
                <input
                  id="booking-address"
                  onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
                  placeholder="请输入小区 / 楼盘 / 门牌号"
                  value={form.address}
                />
                <p className="field-help">建议至少填写到小区或楼盘，便于服务商快速判断是否可上门。</p>
              </div>

              <div className="provider-booking-grid-2 provider-booking-grid-2-refined">
                <div className="field">
                  <label htmlFor="booking-area">建筑面积</label>
                  <div className="provider-booking-input-wrap">
                    <input
                      id="booking-area"
                      inputMode="numeric"
                      onChange={(event) => setForm((prev) => ({ ...prev, area: event.target.value }))}
                      value={form.area}
                    />
                    <span>㎡</span>
                  </div>
                  <div className="provider-booking-pill-row">
                    {areaQuickOptions.map((item) => (
                      <button
                        className={`provider-booking-pill ${form.area === item ? 'active' : ''}`}
                        key={item}
                        onClick={() => setForm((prev) => ({ ...prev, area: item }))}
                        type="button"
                      >
                        {item}㎡
                      </button>
                    ))}
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="booking-budget">预算范围</label>
                  <div className="provider-booking-pill-grid">
                    {budgetOptions.map((item) => (
                      <button
                        className={`provider-booking-pill ${form.budgetRange === item ? 'active' : ''}`}
                        key={item}
                        onClick={() => setForm((prev) => ({ ...prev, budgetRange: item }))}
                        type="button"
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="field">
                <label htmlFor="booking-service">服务类型</label>
                <div className="provider-booking-pill-grid provider-booking-pill-grid-wide">
                  {serviceOptions.map((option) => (
                    <button
                      className={`provider-booking-pill ${form.renovationType === option ? 'active' : ''}`}
                      key={option}
                      onClick={() => setForm((prev) => ({ ...prev, renovationType: option }))}
                      type="button"
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="provider-booking-section-card provider-booking-section-card-soft">
            <div className="provider-booking-section-head">
              <div>
                <p className="detail-kicker">第二步</p>
                <h2>联系与时间</h2>
              </div>
              <span>确认联系信息和预计沟通时间</span>
            </div>
            <div className="provider-booking-form-grid">
              <div className="field">
                <label htmlFor="booking-date">期望时间</label>
                <div className="provider-booking-pill-grid provider-booking-pill-grid-tight">
                  {datePresetOptions.map((item) => (
                    <button
                      className={`provider-booking-pill ${datePreset === item.key ? 'active' : ''}`}
                      key={item.key}
                      onClick={() => handlePickDatePreset(item.key)}
                      type="button"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                {datePreset === 'custom' ? (
                  <button className="provider-booking-custom-date-card" onClick={() => handlePickDatePreset('custom')} type="button">
                    <div>
                      <span>已选日期</span>
                      <strong>{formatCustomDateLabel(form.preferredDate)}</strong>
                    </div>
                    <em>重新选择</em>
                  </button>
                ) : null}
              </div>

              <div className="field">
                <label htmlFor="booking-phone">联系电话</label>
                <input
                  id="booking-phone"
                  onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
                  placeholder="请输入可联系手机号"
                  value={form.phone}
                />
              </div>
            </div>
          </section>

          <section className="provider-booking-section-card">
            <div className="provider-booking-section-head">
              <div>
                <p className="detail-kicker">第三步</p>
                <h2>需求补充</h2>
              </div>
              <span>写清楚你想先聊什么</span>
            </div>
            <div className="provider-booking-form-grid">
              <div className="provider-booking-pill-row">
                {noteSuggestionMap.map((item) => (
                  <button
                    className={`provider-booking-pill ${form.notes.includes(item.text) ? 'active' : ''}`}
                    key={item.label}
                    onClick={() => handleToggleNote(item.text)}
                    type="button"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <div className="field">
                <label htmlFor="booking-notes">补充说明</label>
                <textarea
                  id="booking-notes"
                  onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                  placeholder="例如：房屋现状、风格方向、是否准备先量房、是否需要先看报价等。"
                  value={form.notes}
                />
              </div>
            </div>
          </section>
        </div>

        <aside className="provider-booking-sidepanel">
          <section className="provider-booking-submit">
            <div className="provider-booking-submit-head provider-booking-submit-head-refined">
              <div className="provider-booking-submit-headline">
                <div>
                  <p className="detail-kicker">预约摘要</p>
                  <h3>提交前确认</h3>
                </div>
                <strong>{completionPercent}%</strong>
              </div>
              <div className="provider-booking-progressbar" aria-hidden="true">
                <span style={{ width: `${completionPercent}%` }} />
              </div>
            </div>

            <div className="provider-booking-submit-summary">
              <article>
                <span>服务类型</span>
                <strong>{form.renovationType}</strong>
              </article>
              <article>
                <span>预算范围</span>
                <strong>{form.budgetRange}</strong>
              </article>
              <article>
                <span>期望时间</span>
                <strong>{formatPreferredDateSummary(form.preferredDate, datePreset)}</strong>
              </article>
              <article>
                <span>联系电话</span>
                <strong>{form.phone.trim() || '待填写'}</strong>
              </article>
            </div>

            <div className="provider-booking-submit-meta">
              <span>量房定金参考</span>
              <strong>{depositText}</strong>
              <p>提交后先生成预约单，再在预约详情页继续确认后续流程。</p>
            </div>

            <button className="button-secondary" disabled={bookingDisabled || submitting} onClick={() => void handleSubmit()} type="button">
              {submitting ? '提交中…' : '提交预约申请'}
            </button>
            <p className="provider-booking-helper">提交后该信息仅用于服务沟通、量房安排与后续报价协同。</p>
          </section>

          <section className="provider-booking-note-card provider-booking-sidecard">
            <div className="provider-booking-sidecard-head">
              <p className="detail-kicker">提交流程</p>
              <h3>提交后会发生什么</h3>
            </div>
            <div className="provider-booking-step-list">
              <article>
                <strong>01</strong>
                <div>
                  <h4>平台生成预约单</h4>
                  <p>地址、面积、预算和联系信息会进入预约详情。</p>
                </div>
              </article>
              <article>
                <strong>02</strong>
                <div>
                  <h4>服务商确认沟通</h4>
                  <p>后续量房、报价和状态推进都在预约单里继续处理。</p>
                </div>
              </article>
              <article>
                <strong>03</strong>
                <div>
                  <h4>继续推进报价流程</h4>
                  <p>双方确认后，再进入报价、支付与签约等后续环节。</p>
                </div>
              </article>
            </div>
          </section>
        </aside>
      </section>

      {customDatePickerOpen ? (
        <div
          aria-hidden="true"
          className="provider-booking-date-backdrop"
          onClick={() => setCustomDatePickerOpen(false)}
          role="presentation"
        >
          <div
            aria-modal="true"
            className="provider-booking-date-sheet"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="provider-booking-date-handle" />
            <div className="provider-booking-date-header">
              <div>
                <p>预约时间</p>
                <h3>选择期望沟通日期</h3>
              </div>
            </div>

            <div className="provider-booking-date-preview">
              <span>当前预览</span>
              <strong>{formatCustomDateLabel(buildDateValue(customDateDraft))}</strong>
              <em>确认后会用于预约单时间安排</em>
            </div>

            <div className="provider-booking-date-grid">
              <section className="provider-booking-date-column">
                <span>年份</span>
                <div className="provider-booking-date-list" ref={customDateYearListRef}>
                  {customDateYearOptions.map((year) => {
                    const active = customDateDraft.year === year;
                    return (
                      <button
                        className={`provider-booking-date-option ${active ? 'active' : ''}`}
                        data-selected={active}
                        key={year}
                        onClick={() => handleCustomDateDraftChange('year', year)}
                        type="button"
                      >
                        {year} 年
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="provider-booking-date-column">
                <span>月份</span>
                <div className="provider-booking-date-list" ref={customDateMonthListRef}>
                  {customDateMonthOptions.map((month) => {
                    const active = customDateDraft.month === month;
                    return (
                      <button
                        className={`provider-booking-date-option ${active ? 'active' : ''}`}
                        data-selected={active}
                        key={month}
                        onClick={() => handleCustomDateDraftChange('month', month)}
                        type="button"
                      >
                        {padDateUnit(month)} 月
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="provider-booking-date-column">
                <span>日期</span>
                <div className="provider-booking-date-list" ref={customDateDayListRef}>
                  {customDateDayOptions.map((day) => {
                    const active = customDateDraft.day === day;
                    return (
                      <button
                        className={`provider-booking-date-option ${active ? 'active' : ''}`}
                        data-selected={active}
                        key={day}
                        onClick={() => handleCustomDateDraftChange('day', day)}
                        type="button"
                      >
                        {padDateUnit(day)} 日
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>

            <div className="provider-booking-date-actions">
              <button className="button-outline" onClick={() => setCustomDatePickerOpen(false)} type="button">
                取消
              </button>
              <button className="button-secondary" onClick={applyCustomDate} type="button">
                确认日期
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
