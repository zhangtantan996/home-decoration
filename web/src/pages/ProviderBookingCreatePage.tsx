import { useEffect, useMemo, useState } from 'react';
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

function readRole(value: string | undefined): ProviderRole | null {
  if (value === 'designer' || value === 'company' || value === 'foreman') return value;
  return null;
}

function tomorrowText() {
  const next = new Date();
  next.setDate(next.getDate() + 1);
  return next.toISOString().slice(0, 10);
}

function formatServiceArea(areas: string[]) {
  if (areas.length === 0) return '同城服务';
  if (areas.length <= 2) return areas.join(' / ');
  return `${areas.slice(0, 2).join(' / ')} 等 ${areas.length} 个区域`;
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

export function ProviderBookingCreatePage() {
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useSessionStore((state) => state.user);
  const role = readRole(params.role);
  const providerId = Number(params.id || 0);
  const [submitting, setSubmitting] = useState(false);
  const [submitNote, setSubmitNote] = useState<NoteState | null>(null);
  const [form, setForm] = useState({
    address: '',
    area: '90',
    renovationType: '全案设计服务',
    budgetRange: '20-50万',
    preferredDate: tomorrowText(),
    phone: user?.phone || '',
    notes: '希望先沟通需求，再安排量房或方案建议。',
  });

  useEffect(() => {
    if (user?.phone) {
      setForm((prev) => ({ ...prev, phone: prev.phone || user.phone }));
    }
  }, [user?.phone]);

  const { data, loading, error, reload } = useAsyncData(async () => {
    if (!user || !role || !providerId) {
      return null;
    }
    return getProviderDetail(role, providerId);
  }, [user?.phone, role, providerId]);

  const redirectPath = `${location.pathname}${location.search}`;
  const detailPath = role && providerId ? `/providers/${role}/${providerId}` : '/providers';
  const backPath = readBackPath(location.state, detailPath);
  const bookingDisabled = useMemo(() => !form.address.trim() || Number(form.area) < 10 || !form.phone.trim(), [form]);

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
  const serviceOptions = detail.role === 'foreman'
    ? ['施工服务', '半包施工', '局部改造']
    : detail.role === 'company'
      ? ['全案设计服务', '设计 + 施工协同', '整装施工']
      : ['全案设计服务', '设计 + 施工协同', '局部改造'];

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
      <div className="provider-detail-topbar provider-booking-topbar">
        <button className="button-link provider-detail-back" onClick={() => navigate(backPath)} type="button">返回详情页</button>
        <span className="provider-detail-topbar-label">填写预约需求</span>
      </div>

      <section className="card provider-booking-shell">
        <aside className="provider-booking-aside">
          <div className="provider-booking-cover">
            <img alt={detail.name} src={detail.coverImage} />
            <div className="provider-booking-cover-overlay">
              <span className="status-chip">{detail.orgLabel}</span>
              <h1>{detail.name}</h1>
              <p>{detail.summary}</p>
            </div>
          </div>

          <section className="provider-booking-summary-card">
            <p className="detail-kicker">预约对象</p>
            <div className="provider-booking-summary-grid">
              <article>
                <span>服务城市</span>
                <strong>{areaSummary}</strong>
              </article>
              <article>
                <span>价格参考</span>
                <strong>{detail.priceText}</strong>
              </article>
              <article>
                <span>从业经验</span>
                <strong>{detail.yearsExperience > 0 ? `${detail.yearsExperience} 年` : '待补充'}</strong>
              </article>
              <article>
                <span>电话提示</span>
                <strong>{detail.phoneHint || '提交后沟通'}</strong>
              </article>
            </div>
          </section>

          <section className="provider-booking-note-card">
            <p className="detail-kicker">流程说明</p>
            <div className="provider-booking-flow">
              <span>提交需求</span>
              <span>进入预约详情</span>
              <span>继续跟进报价</span>
            </div>
            <p className="detail-note">本页只负责填写预约信息，后续量房、预算确认和报价协同统一进入预约详情页处理。</p>
          </section>
        </aside>

        <div className="provider-booking-main">
          <div className="section-head provider-detail-panel-head">
            <div>
              <p className="detail-kicker">预约申请</p>
              <h2>提交给 {detail.name} 的服务需求</h2>
            </div>
            <Link className="button-outline" state={{ from: backPath }} to={detailPath}>返回服务商详情</Link>
          </div>

          {submitNote ? <div className="status-note provider-booking-status" data-tone={submitNote.tone}>{submitNote.text}</div> : null}

          <section className="provider-booking-form-card">
            <div className="provider-booking-form-grid">
              <div className="field">
                <label htmlFor="booking-address">项目地址</label>
                <input id="booking-address" onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))} placeholder="请输入小区和门牌号" value={form.address} />
                <p className="field-help">建议填写到小区或楼盘，便于服务商判断是否在服务范围内。</p>
              </div>

              <div className="provider-booking-grid-2">
                <div className="field">
                  <label htmlFor="booking-area">建筑面积</label>
                  <input id="booking-area" inputMode="numeric" onChange={(event) => setForm((prev) => ({ ...prev, area: event.target.value }))} value={form.area} />
                </div>
                <div className="field">
                  <label htmlFor="booking-budget">预算范围</label>
                  <select id="booking-budget" onChange={(event) => setForm((prev) => ({ ...prev, budgetRange: event.target.value }))} value={form.budgetRange}>
                    <option value="10万以内">10万以内</option>
                    <option value="10-20万">10-20万</option>
                    <option value="20-50万">20-50万</option>
                    <option value="50万以上">50万以上</option>
                  </select>
                </div>
              </div>

              <div className="provider-booking-grid-2">
                <div className="field">
                  <label htmlFor="booking-service">服务类型</label>
                  <select id="booking-service" onChange={(event) => setForm((prev) => ({ ...prev, renovationType: event.target.value }))} value={form.renovationType}>
                    {serviceOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="booking-date">期望时间</label>
                  <input id="booking-date" onChange={(event) => setForm((prev) => ({ ...prev, preferredDate: event.target.value }))} type="date" value={form.preferredDate} />
                </div>
              </div>

              <div className="field">
                <label htmlFor="booking-phone">联系电话</label>
                <input id="booking-phone" onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))} value={form.phone} />
              </div>

              <div className="field">
                <label htmlFor="booking-notes">补充说明</label>
                <textarea id="booking-notes" onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} value={form.notes} />
              </div>
            </div>
          </section>

          <section className="provider-booking-submit">
            <div className="provider-booking-submit-head">
              <div>
                <span>量房定金参考</span>
                <strong>{depositText}</strong>
              </div>
              <p>提交后会先生成预约单，再在预约详情页继续确认支付、退款与抵扣规则。</p>
            </div>
            <button className="button-secondary" disabled={bookingDisabled || submitting} onClick={() => void handleSubmit()} type="button">
              {submitting ? '提交中…' : '提交预约申请'}
            </button>
            <p className="provider-booking-helper">点击提交即代表该预约信息仅用于服务沟通、量房安排与后续报价协同。</p>
          </section>
        </div>
      </section>
    </div>
  );
}
