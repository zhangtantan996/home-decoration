import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { EmptyBlock, ErrorBlock, LoadingBlock } from '../components/AsyncState';
import { useAsyncData } from '../hooks/useAsyncData';
import { useSessionStore } from '../modules/session/sessionStore';
import { createBooking } from '../services/bookings';
import { favoriteProvider, followProvider, getProviderDetail, getProviderUserStatus, unfavoriteProvider, unfollowProvider } from '../services/providers';
import type { ProviderRole } from '../types/viewModels';

function readRole(value: string | undefined): ProviderRole | null {
  if (value === 'designer' || value === 'company' || value === 'foreman') return value;
  return null;
}

function tomorrowText() {
  const next = new Date();
  next.setDate(next.getDate() + 1);
  return next.toISOString().slice(0, 10);
}

export function ProviderDetailPage() {
  const params = useParams();
  const navigate = useNavigate();
  const user = useSessionStore((state) => state.user);
  const role = readRole(params.role);
  const providerId = Number(params.id || 0);
  const [submitting, setSubmitting] = useState(false);
  const [actionNote, setActionNote] = useState('');
  const [successNote, setSuccessNote] = useState('');
  const [form, setForm] = useState({
    address: '',
    area: '90',
    renovationType: '全案设计服务',
    budgetRange: '20-50万',
    preferredDate: tomorrowText(),
    phone: user?.phone || '',
    notes: '希望先沟通需求，再安排量房或线上方案建议。',
  });

  const { data, loading, error, reload } = useAsyncData(async () => {
    if (!role || !providerId) throw new Error('服务商参数无效');
    const [detail, status] = await Promise.all([
      getProviderDetail(role, providerId),
      getProviderUserStatus(providerId).catch(() => ({ isFollowed: false, isFavorited: false })),
    ]);
    return { detail, status };
  }, [role, providerId]);

  const bookingDisabled = useMemo(() => !form.address.trim() || Number(form.area) < 10 || !form.phone.trim(), [form]);

  if (loading) return <div className="top-detail"><LoadingBlock title="加载服务商详情" /></div>;
  if (error || !data || !role) return <div className="top-detail"><ErrorBlock description={error || '服务商详情不存在'} onRetry={() => void reload()} /></div>;

  const detail = data.detail;

  return (
    <div className="top-detail">
      <section className="detail-header">
        <div className="detail-header-row">
          <div>
            <p className="detail-kicker">服务商详情</p>
            <h1>{detail.name}</h1>
            <p>{detail.serviceIntro}</p>
          </div>
          <div className="inline-actions">
            <span className="status-chip" data-tone="brand">{detail.orgLabel}</span>
            {detail.verified ? <span className="status-chip" data-tone="success">已认证</span> : null}
            <span className="status-chip">{detail.priceText}</span>
          </div>
        </div>
        <div className="detail-tabs">
          <a className="detail-tab" href="#cases">作品案例</a>
          <a className="detail-tab" href="#services">服务内容</a>
          <a className="detail-tab" href="#reviews">评价</a>
          <a className="detail-tab" href="#about">关于我们</a>
        </div>
      </section>

      <section className="detail-layout">
        <div className="detail-main">
          <section className="card section-card">
            <img alt={detail.name} className="detail-cover tall" src={detail.coverImage} />
            <div className="detail-stat-grid" style={{ marginTop: 16 }}>
              <article className="detail-stat"><span>评分</span><strong>{detail.rating.toFixed(1)}</strong></article>
              <article className="detail-stat"><span>评价数</span><strong>{detail.reviewCount}</strong></article>
              <article className="detail-stat"><span>完成项目</span><strong>{detail.completedCount}</strong></article>
              <article className="detail-stat"><span>服务区域</span><strong>{detail.serviceArea.slice(0, 1).join(' / ') || '同城'}</strong></article>
            </div>
          </section>

          <section className="card section-card" id="cases">
            <div className="section-head"><h2>作品案例</h2></div>
            <div className="providers-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
              {detail.cases.length === 0 ? <EmptyBlock title="暂无公开案例" description="当前还没有可展示的作品案例。" /> : detail.cases.map((item) => (
                <article className="icard" key={item.id}>
                  <div className="icard-cover"><img alt={item.title} src={item.coverImage} /></div>
                  <div className="icard-body">
                    <div className="icard-title">{item.title}</div>
                    <div className="icard-author"><div className="icard-av">案</div><span>{item.style} · {item.area}</span></div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="card section-card" id="services">
            <div className="section-head"><h2>服务内容</h2></div>
            <div className="detail-stat-grid">
              <article className="detail-stat"><span>团队规模</span><strong>{detail.teamSize > 0 ? `${detail.teamSize} 人` : '待补充'}</strong></article>
              <article className="detail-stat"><span>机构信息</span><strong>{detail.establishedText}</strong></article>
              <article className="detail-stat"><span>联系提示</span><strong>{detail.phoneHint || '预约后展示'}</strong></article>
              <article className="detail-stat"><span>办公地址</span><strong>{detail.officeAddress}</strong></article>
            </div>
            <div className="project-list" style={{ marginTop: 16 }}>
              {detail.priceDetails.map((item) => (
                <div className="proj-card" key={item}>
                  <div>
                    <div className="proj-name">报价说明</div>
                    <div className="proj-phase">{item}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="card section-card" id="reviews">
            <div className="section-head"><h2>业主评价</h2></div>
            <div className="project-list">
              {detail.reviews.length === 0 ? <EmptyBlock title="暂无评价" description="当前还没有公开评价。" /> : detail.reviews.map((review) => (
                <div className="proj-card" key={review.id}>
                  <div>
                    <div className="proj-name">{review.userName}</div>
                    <div className="proj-phase">{review.createdAt} · 评分 {review.rating.toFixed(1)}</div>
                    <p className="detail-note" style={{ marginTop: 10 }}>{review.content}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="card section-card" id="about">
            <div className="section-head"><h2>关于我们</h2></div>
            <p className="detail-note">{detail.summary}</p>
          </section>
        </div>

        <aside className="detail-aside">
          <section className="card section-card">
            <div className="section-head"><h2>操作</h2></div>
            {actionNote ? <div className="status-note">{actionNote}</div> : null}
            <div className="detail-actions" style={{ marginBottom: 16 }}>
              <button
                className={data.status.isFollowed ? 'button-ghost' : 'button-outline'}
                onClick={async () => {
                  setActionNote('');
                  if (data.status.isFollowed) {
                    await unfollowProvider(detail.id, detail.role);
                    setActionNote('已取消关注。');
                  } else {
                    await followProvider(detail.id, detail.role);
                    setActionNote('已关注该服务商。');
                  }
                  await reload();
                }}
                type="button"
              >
                {data.status.isFollowed ? '取消关注' : '关注机构'}
              </button>
              <button
                className={data.status.isFavorited ? 'button-ghost' : 'button-secondary'}
                onClick={async () => {
                  setActionNote('');
                  if (data.status.isFavorited) {
                    await unfavoriteProvider(detail.id);
                    setActionNote('已取消收藏。');
                  } else {
                    await favoriteProvider(detail.id);
                    setActionNote('已收藏。');
                  }
                  await reload();
                }}
                type="button"
              >
                {data.status.isFavorited ? '已收藏' : '立即咨询'}
              </button>
            </div>
          </section>

          <section className="card section-card">
            <div className="section-head"><h2>预约免费咨询</h2></div>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="booking-address">项目地址</label>
                <input id="booking-address" onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))} placeholder="请输入小区和门牌号" value={form.address} />
              </div>
              <div className="grid-2">
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
              <div className="field">
                <label htmlFor="booking-service">服务类型</label>
                <select id="booking-service" onChange={(event) => setForm((prev) => ({ ...prev, renovationType: event.target.value }))} value={form.renovationType}>
                  <option value="全案设计服务">全案设计服务</option>
                  <option value="设计 + 施工协同">设计 + 施工协同</option>
                  <option value="局部改造">局部改造</option>
                  <option value="主材咨询">主材咨询</option>
                </select>
              </div>
              <div className="grid-2">
                <div className="field">
                  <label htmlFor="booking-date">期望时间</label>
                  <input id="booking-date" onChange={(event) => setForm((prev) => ({ ...prev, preferredDate: event.target.value }))} type="date" value={form.preferredDate} />
                </div>
                <div className="field">
                  <label htmlFor="booking-phone">联系电话</label>
                  <input id="booking-phone" onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))} value={form.phone} />
                </div>
              </div>
              <div className="field">
                <label htmlFor="booking-notes">备注</label>
                <textarea id="booking-notes" onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} value={form.notes} />
              </div>
            </div>
            {successNote ? <div className="status-note" style={{ marginTop: 16 }}>{successNote}</div> : null}
            <div className="detail-actions" style={{ marginTop: 16 }}>
              <button
                className="button-secondary"
                disabled={bookingDisabled || submitting}
                onClick={async () => {
                  setSubmitting(true);
                  setSuccessNote('');
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
                    setSuccessNote('预约已提交，正在跳转预约详情。');
                    navigate(`/bookings/${bookingId}`);
                  } catch (submitError) {
                    setSuccessNote(submitError instanceof Error ? submitError.message : '预约提交失败，请稍后重试。');
                  } finally {
                    setSubmitting(false);
                  }
                }}
                type="button"
              >
                {submitting ? '提交中…' : '提交预约'}
              </button>
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}
