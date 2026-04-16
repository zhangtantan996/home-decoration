import { useCallback, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import { ErrorBlock, LoadingBlock } from '../components/AsyncState';
import { useAsyncData } from '../hooks/useAsyncData';
import {
  getBookingDesignDeliverable,
  getDesignDeliverable,
  acceptDesignDeliverable,
  rejectDesignDeliverable,
  type DesignDeliverableVM,
} from '../services/bookings';

const STATUS_MAP: Record<string, { label: string; tone: string }> = {
  draft: { label: '草稿', tone: 'muted' },
  submitted: { label: '待审查', tone: 'warning' },
  accepted: { label: '已通过', tone: 'success' },
  rejected: { label: '已驳回', tone: 'danger' },
};

function parseJsonArray(raw: string): string[] {
  try {
    const arr = JSON.parse(raw || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function FileGallery({ title, files }: { title: string; files: string[] }) {
  if (files.length === 0) return null;
  return (
    <div style={{ marginBottom: 16 }}>
      <h3 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600 }}>{title}</h3>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {files.map((url, i) => (
          <a key={i} href={url} target="_blank" rel="noopener noreferrer">
            <img src={url} alt={`${title} ${i + 1}`} style={{ width: 120, height: 90, objectFit: 'cover', borderRadius: 4, border: '1px solid #eee' }} />
          </a>
        ))}
      </div>
    </div>
  );
}

export function DesignDeliverableReviewPage() {
  const params = useParams();
  const navigate = useNavigate();
  const bookingId = Number(params.bookingId || 0);
  const projectId = Number(params.projectId || 0);
  const scopeLabel = bookingId > 0 ? `预约单 #${bookingId}` : `项目 #${projectId}`;

  const { data, loading, error, reload } = useAsyncData(
    () => (bookingId > 0 ? getBookingDesignDeliverable(bookingId) : getDesignDeliverable(projectId)),
    [bookingId, projectId],
  );

  const [acting, setActing] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  const deliverable = data as DesignDeliverableVM | undefined;

  const handleAccept = useCallback(async () => {
    if (!deliverable) return;
    setActing(true);
    try {
      await acceptDesignDeliverable(deliverable.id);
      void reload();
    } catch {
      /* retry */
    } finally {
      setActing(false);
    }
  }, [deliverable, reload]);

  const handleReject = useCallback(async () => {
    if (!deliverable || !rejectReason.trim()) return;
    setActing(true);
    try {
      await rejectDesignDeliverable(deliverable.id, rejectReason.trim());
      setShowRejectInput(false);
      void reload();
    } catch {
      /* retry */
    } finally {
      setActing(false);
    }
  }, [deliverable, rejectReason, reload]);

  if (loading) return <div className="top-detail"><LoadingBlock title="加载设计交付件" /></div>;
  if (error) return <div className="top-detail"><ErrorBlock description={error} onRetry={() => void reload()} /></div>;

  if (!deliverable) {
    return (
      <div className="top-detail">
        <section className="detail-header">
          <h1>设计交付件</h1>
          <p>设计师尚未提交交付件。</p>
        </section>
      </div>
    );
  }

  const status = STATUS_MAP[deliverable.status] || { label: deliverable.status, tone: 'muted' };
  const colorFloorPlan = parseJsonArray(deliverable.colorFloorPlan);
  const renderings = parseJsonArray(deliverable.renderings);
  const cadDrawings = parseJsonArray(deliverable.cadDrawings);
  const attachments = parseJsonArray(deliverable.attachments);

  return (
    <div className="top-detail">
      <section className="detail-header">
        <div className="detail-header-row">
          <div>
            <p className="detail-kicker">{scopeLabel}</p>
            <h1>设计交付件审查</h1>
          </div>
          <span className="status-chip" data-tone={status.tone}>{status.label}</span>
        </div>
      </section>

      <section className="detail-layout">
        <div className="detail-main">
          <section className="card section-card">
            <div className="section-head"><h2>交付内容</h2></div>
            <FileGallery title="彩平图" files={colorFloorPlan} />
            <FileGallery title="效果图" files={renderings} />
            {deliverable.renderingLink && (
              <p style={{ marginBottom: 16 }}>
                <strong>效果图链接：</strong>
                <a href={deliverable.renderingLink} target="_blank" rel="noopener noreferrer">{deliverable.renderingLink}</a>
              </p>
            )}
            <FileGallery title="CAD施工图" files={cadDrawings} />
            <FileGallery title="其他附件" files={attachments} />
            {deliverable.textDescription && (
              <div style={{ marginTop: 16 }}>
                <h3 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600 }}>设计说明</h3>
                <p style={{ whiteSpace: 'pre-wrap' }}>{deliverable.textDescription}</p>
              </div>
            )}
          </section>

          {deliverable.rejectionReason && (
            <section className="card section-card" style={{ borderLeft: '3px solid var(--danger)' }}>
              <div className="section-head"><h2>驳回原因</h2></div>
              <p>{deliverable.rejectionReason}</p>
            </section>
          )}

          {deliverable.status === 'submitted' && (
            <section className="card section-card">
              <div className="section-head"><h2>验收操作</h2></div>
              <div className="inline-actions" style={{ gap: 12 }}>
                <button className="button-secondary" disabled={acting} onClick={() => void handleAccept()} type="button">
                  {acting ? '处理中…' : '验收通过'}
                </button>
                <button className="button-outline" disabled={acting} onClick={() => setShowRejectInput(true)} type="button">
                  驳回
                </button>
              </div>
              {showRejectInput && (
                <div className="field" style={{ marginTop: 12 }}>
                  <label htmlFor="deliverable-reject-reason">驳回原因</label>
                  <textarea
                    id="deliverable-reject-reason"
                    placeholder="请说明驳回原因"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={3}
                  />
                  <p className="field-help">说明需要调整的内容，设计师会按这条反馈重新提交。</p>
                  <button className="button-danger" disabled={acting || !rejectReason.trim()} onClick={() => void handleReject()} style={{ marginTop: 8 }} type="button">
                    提交驳回
                  </button>
                </div>
              )}
            </section>
          )}
        </div>
      </section>

      <div style={{ marginTop: 24 }}>
        <button
          className="button-outline"
          onClick={() => {
            if (bookingId > 0) {
              navigate(`/bookings/${bookingId}`);
              return;
            }
            navigate(-1);
          }}
          type="button"
        >
          返回
        </button>
      </div>
    </div>
  );
}
