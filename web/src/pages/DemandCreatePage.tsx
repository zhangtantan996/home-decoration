import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { StatusBanner } from '../components/StatusBanner';
import { createDemand, submitDemand, updateDemand, uploadDemandAttachment } from '../services/demands';

const demandTypeOptions = [
  { value: 'renovation', label: '整装/全案' },
  { value: 'design', label: '纯设计' },
  { value: 'partial', label: '局部翻新' },
  { value: 'material', label: '选材/主材' },
] as const;

const timelineOptions = [
  { value: 'urgent', label: '尽快启动' },
  { value: '1month', label: '1个月内' },
  { value: '3month', label: '3个月内' },
  { value: 'flexible', label: '时间灵活' },
] as const;

export function DemandCreatePage() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [draftId, setDraftId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    demandType: 'renovation',
    title: '',
    city: '',
    district: '',
    address: '',
    area: '',
    budgetMin: '',
    budgetMax: '',
    timeline: '3month',
    stylePref: '',
    description: '',
    attachments: [] as Array<{ url: string; name: string; size: number }>,
  });

  const payload = {
    demandType: form.demandType,
    title: form.title.trim(),
    city: form.city.trim(),
    district: form.district.trim(),
    address: form.address.trim(),
    area: Number(form.area || 0),
    budgetMin: Number(form.budgetMin || 0),
    budgetMax: Number(form.budgetMax || 0),
    timeline: form.timeline,
    stylePref: form.stylePref.trim(),
    description: form.description.trim(),
    attachments: form.attachments,
  };

  const persistDraft = async () => {
    if (draftId) {
      await updateDemand(draftId, payload);
      return draftId;
    }
    const created = await createDemand(payload);
    setDraftId(created.id);
    return created.id;
  };

  return (
    <div className="container page-stack">
      <StatusBanner
        description="这一步先把需求说清楚。你可以先保存草稿，补齐附件后再正式提交给平台审核。"
        label="需求提交"
        title="把你的装修需求整理成可匹配的任务"
      />

      <section className="split-shell">
        <section className="dashboard-shell">
          <section className="card section-card">
            <div className="panel-head">
              <div>
                <p className="kicker eyebrow-accent">基础信息</p>
                <h2 className="section-title">先把城市、预算、时间和类型说明白</h2>
              </div>
            </div>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="demand-type">需求类型</label>
                <select id="demand-type" onChange={(event) => setForm((prev) => ({ ...prev, demandType: event.target.value }))} value={form.demandType}>
                  {demandTypeOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="demand-title">需求标题</label>
                <input id="demand-title" onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} placeholder="例如：三室两厅老房翻新，希望重做收纳和动线" value={form.title} />
              </div>
              <div className="field">
                <label htmlFor="demand-city">城市</label>
                <input id="demand-city" onChange={(event) => setForm((prev) => ({ ...prev, city: event.target.value }))} placeholder="例如：西安" value={form.city} />
              </div>
              <div className="field">
                <label htmlFor="demand-district">区域</label>
                <input id="demand-district" onChange={(event) => setForm((prev) => ({ ...prev, district: event.target.value }))} placeholder="例如：雁塔区" value={form.district} />
              </div>
              <div className="field">
                <label htmlFor="demand-address">详细地址</label>
                <input id="demand-address" onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))} placeholder="用于平台匹配服务城市，提交后仅平台可见" value={form.address} />
              </div>
              <div className="field">
                <label htmlFor="demand-area">建筑面积（㎡）</label>
                <input id="demand-area" inputMode="decimal" onChange={(event) => setForm((prev) => ({ ...prev, area: event.target.value }))} placeholder="例如：98" value={form.area} />
              </div>
              <div className="field">
                <label htmlFor="budget-min">预算下限</label>
                <input id="budget-min" inputMode="decimal" onChange={(event) => setForm((prev) => ({ ...prev, budgetMin: event.target.value }))} placeholder="例如：100000" value={form.budgetMin} />
              </div>
              <div className="field">
                <label htmlFor="budget-max">预算上限</label>
                <input id="budget-max" inputMode="decimal" onChange={(event) => setForm((prev) => ({ ...prev, budgetMax: event.target.value }))} placeholder="例如：200000" value={form.budgetMax} />
              </div>
              <div className="field">
                <label htmlFor="demand-timeline">计划启动时间</label>
                <select id="demand-timeline" onChange={(event) => setForm((prev) => ({ ...prev, timeline: event.target.value }))} value={form.timeline}>
                  {timelineOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="style-pref">风格偏好</label>
                <input id="style-pref" onChange={(event) => setForm((prev) => ({ ...prev, stylePref: event.target.value }))} placeholder="例如：现代简约、原木、收纳优先" value={form.stylePref} />
              </div>
              <div className="field">
                <label htmlFor="demand-description">需求描述</label>
                <textarea id="demand-description" onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} placeholder="补充现状、重点诉求、家庭成员、痛点和禁忌，越具体越利于匹配。" value={form.description} />
              </div>
            </div>
          </section>

          <section className="card section-card">
            <div className="panel-head">
              <div>
                <p className="kicker eyebrow-accent">附件</p>
                <h2 className="section-title">上传户型图、现场图或参考图</h2>
              </div>
              <button
                className="button-outline"
                disabled={uploading}
                onClick={() => inputRef.current?.click()}
                type="button"
              >
                {uploading ? '上传中…' : '上传附件'}
              </button>
            </div>
            <input
              hidden
              multiple
              onChange={async (event) => {
                const files = Array.from(event.target.files || []);
                if (!files.length) {
                  return;
                }
                setUploading(true);
                setMessage('');
                try {
                  const uploaded = await Promise.all(files.map((file) => uploadDemandAttachment(file)));
                  setForm((prev) => ({
                    ...prev,
                    attachments: [
                      ...prev.attachments,
                      ...uploaded.map((item, index) => ({
                        url: item.url,
                        name: files[index]?.name || item.filename || '附件',
                        size: Number(files[index]?.size || item.size || 0),
                      })),
                    ],
                  }));
                } catch (error) {
                  setMessage(error instanceof Error ? error.message : '附件上传失败');
                } finally {
                  setUploading(false);
                  event.target.value = '';
                }
              }}
              ref={inputRef}
              type="file"
            />
            {form.attachments.length === 0 ? (
              <div className="status-note">还没有附件也可以先保存草稿，稍后再补充。</div>
            ) : (
              <div className="list-stack">
                {form.attachments.map((item) => (
                  <div className="list-card" key={item.url}>
                    <div>
                      <h3>{item.name}</h3>
                      <p>{item.url}</p>
                    </div>
                    <div className="list-meta">
                      <strong>{Math.max(1, Math.round(item.size / 1024))} KB</strong>
                      <button
                        className="button-link"
                        onClick={() => setForm((prev) => ({
                          ...prev,
                          attachments: prev.attachments.filter((attachment) => attachment.url !== item.url),
                        }))}
                        type="button"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </section>

        <aside className="dashboard-shell">
          <section className="card section-card">
            <div className="panel-head">
              <div>
                <p className="kicker eyebrow-accent">提交说明</p>
                <h2 className="section-title">平台会先审核，再匹配服务商</h2>
              </div>
            </div>
            {message ? <div className="status-note">{message}</div> : null}
            <div className="list-stack">
              <div className="surface-card">
                <div>
                  <h3>先保存草稿</h3>
                  <p>适合信息还没补齐，先把框架建起来。</p>
                </div>
              </div>
              <div className="surface-card">
                <div>
                  <h3>正式提交</h3>
                  <p>提交后进入平台审核，审核通过才会分配商家。</p>
                </div>
              </div>
              <div className="surface-card">
                <div>
                  <h3>当前状态</h3>
                  <p>{draftId ? `草稿已创建，需求 ID #${draftId}` : '还未保存草稿'}</p>
                </div>
              </div>
            </div>
            <div className="inline-actions" style={{ marginTop: 18 }}>
              <button
                className="button-outline"
                disabled={submitting || uploading}
                onClick={async () => {
                  setSubmitting(true);
                  setMessage('');
                  try {
                    const id = await persistDraft();
                    setMessage(`草稿已保存，需求 ID #${id}`);
                  } catch (error) {
                    setMessage(error instanceof Error ? error.message : '保存草稿失败');
                  } finally {
                    setSubmitting(false);
                  }
                }}
                type="button"
              >
                保存草稿
              </button>
              <button
                className="button-secondary"
                disabled={submitting || uploading}
                onClick={async () => {
                  setSubmitting(true);
                  setMessage('');
                  try {
                    const id = await persistDraft();
                    await submitDemand(id);
                    navigate(`/demands/${id}`);
                  } catch (error) {
                    setMessage(error instanceof Error ? error.message : '提交需求失败');
                  } finally {
                    setSubmitting(false);
                  }
                }}
                type="button"
              >
                正式提交
              </button>
            </div>
            <div className="inline-actions" style={{ marginTop: 12 }}>
              <Link className="button-link" to="/me/demands">查看我的需求</Link>
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}
