import { useCallback, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import { ErrorBlock, LoadingBlock } from '../components/AsyncState';
import { useAsyncData } from '../hooks/useAsyncData';
import {
  getDesignFeeQuote,
  confirmDesignFeeQuote,
  rejectDesignFeeQuote,
  type DesignFeeQuoteVM,
} from '../services/bookings';

const STATUS_MAP: Record<string, { label: string; tone: string }> = {
  pending: { label: '待确认', tone: 'warning' },
  confirmed: { label: '已确认', tone: 'success' },
  rejected: { label: '已拒绝', tone: 'danger' },
  expired: { label: '已过期', tone: 'muted' },
};

export function DesignFeeQuotePage() {
  const params = useParams();
  const navigate = useNavigate();
  const bookingId = Number(params.id || 0);

  const { data, loading, error, reload } = useAsyncData(
    () => getDesignFeeQuote(bookingId),
    [bookingId],
  );

  const [acting, setActing] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  const quote = data?.quote as DesignFeeQuoteVM | null | undefined;

  const handleConfirm = useCallback(async () => {
    if (!quote) return;
    setActing(true);
    try {
      await confirmDesignFeeQuote(quote.id);
      void reload();
    } catch {
      /* error handled by async data */
    } finally {
      setActing(false);
    }
  }, [quote, reload]);

  const handleReject = useCallback(async () => {
    if (!quote || !rejectReason.trim()) return;
    setActing(true);
    try {
      await rejectDesignFeeQuote(quote.id, rejectReason.trim());
      setShowRejectInput(false);
      void reload();
    } catch {
      /* error handled by async data */
    } finally {
      setActing(false);
    }
  }, [quote, rejectReason, reload]);

  if (loading) return <div className="top-detail"><LoadingBlock title="加载设计费报价" /></div>;
  if (error) return <div className="top-detail"><ErrorBlock description={error} onRetry={() => void reload()} /></div>;

  if (!quote) {
    return (
      <div className="top-detail">
        <section className="detail-header">
          <h1>设计费报价</h1>
          <p>设计师尚未发送报价，请耐心等待。</p>
        </section>
      </div>
    );
  }

  const status = STATUS_MAP[quote.status] || { label: quote.status, tone: 'muted' };

  return (
    <div className="top-detail">
      <section className="detail-header">
        <div className="detail-header-row">
          <div>
            <p className="detail-kicker">预约 #{bookingId}</p>
            <h1>设计费报价</h1>
          </div>
          <span className="status-chip" data-tone={status.tone}>{status.label}</span>
        </div>
      </section>

      <section className="detail-layout">
        <div className="detail-main">
          <section className="card section-card">
            <div className="section-head"><h2>费用明细</h2></div>
            <div className="detail-stat-grid">
              <article className="detail-stat">
                <span>设计费总额</span>
                <strong>¥{quote.totalFee?.toLocaleString()}</strong>
              </article>
              <article className="detail-stat">
                <span>定金抵扣</span>
                <strong>-¥{quote.depositDeduction?.toLocaleString()}</strong>
              </article>
              <article className="detail-stat">
                <span>实付金额</span>
                <strong style={{ color: 'var(--accent)' }}>¥{quote.netAmount?.toLocaleString()}</strong>
              </article>
              <article className="detail-stat">
                <span>支付方式</span>
                <strong>{quote.paymentMode === 'staged' ? '分阶段' : '一次性'}</strong>
              </article>
            </div>
            {quote.description && <p className="detail-note" style={{ marginTop: 16 }}>{quote.description}</p>}
            {quote.expireAt && <p style={{ color: '#999', marginTop: 8 }}>报价有效期至 {quote.expireAt.slice(0, 16).replace('T', ' ')}</p>}
          </section>

          {quote.rejectionReason && (
            <section className="card section-card" style={{ borderLeft: '3px solid var(--danger)' }}>
              <div className="section-head"><h2>拒绝原因</h2></div>
              <p>{quote.rejectionReason}</p>
            </section>
          )}

          {quote.status === 'pending' && (
            <section className="card section-card">
              <div className="section-head"><h2>操作</h2></div>
              <div className="inline-actions" style={{ gap: 12 }}>
                <button className="btn btn-primary" disabled={acting} onClick={() => void handleConfirm()}>
                  {acting ? '处理中…' : '确认报价'}
                </button>
                <button className="btn btn-outline" disabled={acting} onClick={() => setShowRejectInput(true)}>
                  拒绝
                </button>
              </div>
              {showRejectInput && (
                <div style={{ marginTop: 12 }}>
                  <textarea
                    className="form-input"
                    placeholder="请填写拒绝原因"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={3}
                    style={{ width: '100%' }}
                  />
                  <button className="btn btn-danger" disabled={acting || !rejectReason.trim()} onClick={() => void handleReject()} style={{ marginTop: 8 }}>
                    提交拒绝
                  </button>
                </div>
              )}
            </section>
          )}
        </div>
      </section>

      <div style={{ marginTop: 24 }}>
        <button className="btn btn-outline" onClick={() => navigate(-1)}>返回</button>
      </div>
    </div>
  );
}
