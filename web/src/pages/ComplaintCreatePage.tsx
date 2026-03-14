import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { StatusBanner } from '../components/StatusBanner';
import { createComplaint } from '../services/complaints';

const categories = [
  { value: 'quality', label: '施工质量' },
  { value: 'delay', label: '工期延期' },
  { value: 'price', label: '价格争议' },
  { value: 'attitude', label: '服务态度' },
  { value: 'safety', label: '安全风险' },
  { value: 'other', label: '其他' },
] as const;

export function ComplaintCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    projectId: searchParams.get('projectId') || '',
    category: 'quality',
    title: '',
    description: '',
    evidenceUrls: '',
  });

  return (
    <div className="container page-stack">
      <StatusBanner
        description="投诉链路从这里开始。先把项目、问题类别、证据和诉求说明清楚，平台才有介入依据。"
        label="发起投诉"
        title="把争议单独沉淀成可处理记录"
      />

      <section className="split-shell">
        <section className="dashboard-shell">
          <section className="card section-card">
            <div className="panel-head">
              <div>
                <p className="kicker eyebrow-accent">投诉信息</p>
                <h2 className="section-title">项目、类别、标题和详细说明</h2>
              </div>
            </div>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="complaint-project">项目 ID</label>
                <input id="complaint-project" inputMode="numeric" onChange={(event) => setForm((prev) => ({ ...prev, projectId: event.target.value }))} placeholder="例如：99140" value={form.projectId} />
              </div>
              <div className="field">
                <label htmlFor="complaint-category">投诉类别</label>
                <select id="complaint-category" onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))} value={form.category}>
                  {categories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="complaint-title">投诉标题</label>
                <input id="complaint-title" onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} placeholder="例如：泥木阶段质量问题，需要平台介入" value={form.title} />
              </div>
              <div className="field">
                <label htmlFor="complaint-description">详细说明</label>
                <textarea id="complaint-description" onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} placeholder="描述问题经过、已沟通内容、当前诉求和希望平台怎么处理。" value={form.description} />
              </div>
              <div className="field">
                <label htmlFor="complaint-evidence">证据 URL</label>
                <textarea id="complaint-evidence" onChange={(event) => setForm((prev) => ({ ...prev, evidenceUrls: event.target.value }))} placeholder="每行一个附件 URL，可留空。" value={form.evidenceUrls} />
              </div>
            </div>
          </section>
        </section>

        <section className="card section-card">
          <div className="panel-head">
            <div>
              <p className="kicker eyebrow-accent">提交动作</p>
              <h2 className="section-title">投诉会进入平台处理队列</h2>
            </div>
          </div>
          {message ? <div className="status-note">{message}</div> : null}
          <div className="inline-actions" style={{ marginTop: 12 }}>
            <button
              className="button-secondary"
              disabled={submitting}
              onClick={async () => {
                setSubmitting(true);
                setMessage('');
                try {
                  const created = await createComplaint({
                    projectId: Number(form.projectId || 0),
                    category: form.category,
                    title: form.title.trim(),
                    description: form.description.trim(),
                    evidenceUrls: form.evidenceUrls.split(/\n|,|，/).map((item) => item.trim()).filter(Boolean),
                  });
                  navigate(`/me/complaints?created=${created.id}`);
                } catch (submitError) {
                  setMessage(submitError instanceof Error ? submitError.message : '投诉提交失败');
                } finally {
                  setSubmitting(false);
                }
              }}
              type="button"
            >
              {submitting ? '提交中…' : '提交投诉'}
            </button>
            <Link className="button-outline" to="/me/complaints">查看我的投诉</Link>
          </div>
        </section>
      </section>
    </div>
  );
}
