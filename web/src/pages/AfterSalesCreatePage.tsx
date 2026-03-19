import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { EmptyBlock, ErrorBlock, LoadingBlock } from '../components/AsyncState';
import { StatusBanner } from '../components/StatusBanner';
import { useAsyncData } from '../hooks/useAsyncData';
import { createAfterSales } from '../services/afterSales';
import { listBookings } from '../services/bookings';

const typeOptions = [
  { value: 'complaint', label: '投诉争议' },
  { value: 'refund', label: '退款申请' },
  { value: 'repair', label: '返修申请' },
] as const;

export function AfterSalesCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const presetType = searchParams.get('type');
  const presetBookingId = Number(searchParams.get('bookingId') || 0);
  const { data, loading, error, reload } = useAsyncData(listBookings, []);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    bookingId: presetBookingId || 0,
    type: (presetType === 'refund' || presetType === 'repair' || presetType === 'complaint' ? presetType : 'complaint') as 'refund' | 'complaint' | 'repair',
    reason: '',
    description: '',
    amount: '',
    images: '',
  });

  const currentBooking = useMemo(() => data?.find((item) => item.id === form.bookingId) || null, [data, form.bookingId]);

  if (loading) {
    return <div className="container page-stack"><LoadingBlock title="加载售后申请表" /></div>;
  }

  if (error || !data) {
    return <div className="container page-stack"><ErrorBlock description={error || '售后申请表加载失败'} onRetry={() => void reload()} /></div>;
  }

  return (
    <div className="container page-stack">
      <StatusBanner
        description="当前支持基于预约记录发起退款、投诉或返修申请。提交后可在售后中心持续查看处理状态。"
        label="发起售后申请"
        title="把问题说清楚，平台才更容易介入"
      />

      <section className="split-shell">
        <section className="dashboard-shell">
          <section className="card section-card">
            <div className="panel-head">
              <div>
                <p className="kicker eyebrow-accent">选择关联预约</p>
                <h2 className="section-title">先把问题挂到正确的业务记录上</h2>
              </div>
            </div>
            {data.length === 0 ? <EmptyBlock title="暂无可关联预约" description="先创建预约后，才能发起售后或争议申请。" action={<Link className="button-secondary" to="/providers?category=designer">去找服务商</Link>} /> : (
              <div className="list-stack">
                {data.map((item) => (
                  <button className="list-card" key={item.id} onClick={() => setForm((prev) => ({ ...prev, bookingId: item.id }))} type="button">
                    <div>
                      <div className="inline-actions" style={{ marginBottom: 10 }}>
                        <span className="status-chip" data-tone={form.bookingId === item.id ? 'brand' : 'warning'}>{form.bookingId === item.id ? '已选择' : item.statusText}</span>
                        <span className="status-chip">{item.providerTypeText}</span>
                      </div>
                      <h3>{item.title}</h3>
                      <p>{item.address}</p>
                    </div>
                    <div className="list-meta">
                      <strong>{item.preferredDate}</strong>
                      <span>{item.budgetRange}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        </section>

        <section className="card section-card">
          <div className="panel-head">
            <div>
              <p className="kicker eyebrow-accent">填写申请</p>
              <h2 className="section-title">说明问题、金额和证据</h2>
            </div>
          </div>
          {message ? <div className="status-note" style={{ marginBottom: 16 }}>{message}</div> : null}
          <div className="form-grid">
            <div className="field">
              <label htmlFor="after-sales-type">申请类型</label>
              <select id="after-sales-type" onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value as 'refund' | 'complaint' | 'repair' }))} value={form.type}>
                {typeOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="after-sales-reason">申请原因</label>
              <input id="after-sales-reason" onChange={(event) => setForm((prev) => ({ ...prev, reason: event.target.value }))} placeholder="例如：服务商长期未响应，要求退款" value={form.reason} />
            </div>
            <div className="field">
              <label htmlFor="after-sales-description">详细描述</label>
              <textarea id="after-sales-description" onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} placeholder="把问题经过、期望平台怎么处理、已经和服务商沟通过什么写清楚。" value={form.description} />
            </div>
            <div className="field">
              <label htmlFor="after-sales-amount">涉及金额</label>
              <input id="after-sales-amount" inputMode="decimal" onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))} placeholder="没有可填 0" value={form.amount} />
            </div>
            <div className="field">
              <label htmlFor="after-sales-images">证据图片 URL</label>
              <textarea id="after-sales-images" onChange={(event) => setForm((prev) => ({ ...prev, images: event.target.value }))} placeholder="每行一条图片 URL，可留空。" value={form.images} />
            </div>
          </div>
          {currentBooking ? <div className="status-note" style={{ marginTop: 16 }}>当前关联预约：{currentBooking.title}</div> : null}
          <div className="inline-actions" style={{ marginTop: 18 }}>
            <button
              className="button-secondary"
              disabled={submitting || !form.bookingId || !form.reason.trim()}
              onClick={async () => {
                setSubmitting(true);
                setMessage('');
                try {
                  const created = await createAfterSales({
                    bookingId: form.bookingId,
                    type: form.type,
                    reason: form.reason.trim(),
                    description: form.description.trim(),
                    amount: Number(form.amount || 0),
                    images: JSON.stringify(form.images.split(/\n|,|，/).map((item) => item.trim()).filter(Boolean)),
                  });
                  navigate(`/after-sales/${created.id}`);
                } catch (submitError) {
                  setMessage(submitError instanceof Error ? submitError.message : '提交失败');
                } finally {
                  setSubmitting(false);
                }
              }}
              type="button"
            >
              {submitting ? '提交中…' : '提交申请'}
            </button>
            <Link className="button-outline" to="/after-sales">返回售后中心</Link>
          </div>
        </section>
      </section>
    </div>
  );
}
