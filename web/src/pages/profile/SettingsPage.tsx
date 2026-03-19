import { useEffect, useState } from 'react';

import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/AsyncState';
import { useAsyncData } from '../../hooks/useAsyncData';
import { getUserSettings, updateUserSettings } from '../../services/settings';
import type { SettingsFormVM } from '../../types/viewModels';

const defaultSettings: SettingsFormVM = {
  notifySystem: true,
  notifyProject: true,
  notifyPayment: true,
  fontSize: 'medium',
  language: 'zh',
};

export function SettingsPage() {
  const { data, loading, error, reload } = useAsyncData(getUserSettings, []);
  const [form, setForm] = useState<SettingsFormVM>(defaultSettings);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  if (loading) return <LoadingBlock title="加载账户设置" />;
  if (error) return <ErrorBlock description={error} onRetry={() => void reload()} />;
  if (!data) return <EmptyBlock title="暂无设置" description="当前没有可编辑的设置项。" />;

  return (
    <section>
      <div className="section-head" style={{ marginBottom: 20 }}>
        <h2>账户设置</h2>
      </div>
      <div className="providers-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
        <label className="profile-stat">
          <div className="ps-label">系统通知</div>
          <div className="ps-sub">接收平台系统类提醒</div>
          <div style={{ marginTop: 12 }}><input checked={form.notifySystem} onChange={(event) => setForm((prev) => ({ ...prev, notifySystem: event.target.checked }))} type="checkbox" /></div>
        </label>
        <label className="profile-stat">
          <div className="ps-label">项目提醒</div>
          <div className="ps-sub">接收项目进度和验收提醒</div>
          <div style={{ marginTop: 12 }}><input checked={form.notifyProject} onChange={(event) => setForm((prev) => ({ ...prev, notifyProject: event.target.checked }))} type="checkbox" /></div>
        </label>
        <label className="profile-stat">
          <div className="ps-label">支付提醒</div>
          <div className="ps-sub">接收待付款和支付成功通知</div>
          <div style={{ marginTop: 12 }}><input checked={form.notifyPayment} onChange={(event) => setForm((prev) => ({ ...prev, notifyPayment: event.target.checked }))} type="checkbox" /></div>
        </label>
        <div className="profile-stat">
          <div className="ps-label">显示偏好</div>
          <div className="ps-sub">语言与字体大小</div>
          <div className="grid-2" style={{ marginTop: 12 }}>
            <select onChange={(event) => setForm((prev) => ({ ...prev, language: event.target.value }))} value={form.language}>
              <option value="zh">中文</option>
              <option value="en">English</option>
            </select>
            <select onChange={(event) => setForm((prev) => ({ ...prev, fontSize: event.target.value }))} value={form.fontSize}>
              <option value="small">小</option>
              <option value="medium">中</option>
              <option value="large">大</option>
            </select>
          </div>
        </div>
      </div>
      {message ? <div className="status-note" style={{ marginTop: 16 }}>{message}</div> : null}
      <div className="inline-actions" style={{ marginTop: 16 }}>
        <button
          className="button-secondary"
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            setMessage('');
            try {
              await updateUserSettings(form);
              setMessage('设置已保存。');
            } catch (saveError) {
              setMessage(saveError instanceof Error ? saveError.message : '保存失败，请稍后重试。');
            } finally {
              setSaving(false);
            }
          }}
          type="button"
        >
          {saving ? '保存中…' : '保存设置'}
        </button>
      </div>
    </section>
  );
}
