import { Link, useParams } from 'react-router-dom';

import { ErrorBlock, LoadingBlock } from '../components/AsyncState';
import { useAsyncData } from '../hooks/useAsyncData';
import { getBookingDetail, payIntentFee } from '../services/bookings';

export function BookingDetailPage() {
  const params = useParams();
  const bookingId = Number(params.id || 0);
  const { data, loading, error, reload } = useAsyncData(() => getBookingDetail(bookingId), [bookingId]);

  if (loading) return <div className="top-detail"><LoadingBlock title="加载预约详情" /></div>;
  if (error || !data) return <div className="top-detail"><ErrorBlock description={error || '预约详情不存在'} onRetry={() => void reload()} /></div>;

  return (
    <div className="top-detail">
      <section className="detail-header">
        <div className="detail-header-row">
          <div>
            <p className="detail-kicker">预约详情</p>
            <h1>{data.address}</h1>
            <p>查看当前状态、量房定金和下一步动作。</p>
          </div>
          <div className="inline-actions">
            <span className="status-chip" data-tone={data.intentFeePaid ? 'success' : 'warning'}>{data.intentFeePaid ? '量房定金已支付' : '待支付量房定金'}</span>
            <span className="status-chip">{data.statusText}</span>
          </div>
        </div>
      </section>

      <section className="detail-layout">
        <div className="detail-main">
          <section className="card section-card">
            <div className="section-head"><h2>预约信息</h2></div>
            <div className="detail-stat-grid">
              <article className="detail-stat"><span>装修类型</span><strong>{data.renovationType}</strong></article>
              <article className="detail-stat"><span>建筑面积</span><strong>{data.areaText}</strong></article>
              <article className="detail-stat"><span>预算范围</span><strong>{data.budgetRange}</strong></article>
              <article className="detail-stat"><span>期望时间</span><strong>{data.preferredDate}</strong></article>
            </div>
            <p className="detail-note" style={{ marginTop: 16 }}>{data.notes}</p>
          </section>

          <section className="card section-card">
            <div className="section-head"><h2>状态时间线</h2></div>
            <div className="project-list">
              {data.timeline.map((item, index) => (
                <div className="proj-card" key={item.title}>
                  <div>
                    <div className="proj-name">{item.title}</div>
                    <div className="proj-phase">{item.description}</div>
                    <div className="proj-bar"><div className="proj-bar-fill" style={{ width: `${Math.max(20, (index + 1) * 25)}%` }} /></div>
                  </div>
                  <div className="proj-percent">{item.state === 'done' ? '完成' : item.state === 'active' ? '当前' : '待处理'}</div>
                </div>
              ))}
            </div>
            {data.flowSummary ? <p className="detail-note" style={{ marginTop: 16 }}>{data.flowSummary}</p> : null}
          </section>

          {data.siteSurveySummary ? (
            <section className="card section-card">
              <div className="section-head"><h2>量房进度</h2></div>
              <div className="detail-stat-grid">
                <article className="detail-stat"><span>状态</span><strong>{data.siteSurveySummary.status}</strong></article>
                <article className="detail-stat"><span>提交</span><strong>{data.siteSurveySummary.submittedAt || '待提交'}</strong></article>
                <article className="detail-stat"><span>确认</span><strong>{data.siteSurveySummary.confirmedAt || '待确认'}</strong></article>
                <article className="detail-stat"><span>重测</span><strong>{data.siteSurveySummary.revisionRequestedAt || '无'}</strong></article>
              </div>
              {data.siteSurveySummary.revisionRequestReason ? <p className="detail-note" style={{ marginTop: 16 }}>退回原因：{data.siteSurveySummary.revisionRequestReason}</p> : null}
              <div className="detail-actions" style={{ marginTop: 16 }}>
                <Link className="button-outline" to={`/bookings/${data.id}/site-survey`}>查看量房记录</Link>
              </div>
            </section>
          ) : null}

          {data.budgetConfirmSummary ? (
            <section className="card section-card">
              <div className="section-head"><h2>预算与设计意向</h2></div>
              <div className="detail-stat-grid">
                <article className="detail-stat"><span>状态</span><strong>{data.budgetConfirmSummary.status}</strong></article>
                <article className="detail-stat"><span>预算区间</span><strong>{data.budgetConfirmSummary.budgetMin} - {data.budgetConfirmSummary.budgetMax}</strong></article>
              </div>
              <p className="detail-note" style={{ marginTop: 16 }}>{data.budgetConfirmSummary.designIntent || '未填写设计意向'}</p>
              <div className="detail-actions" style={{ marginTop: 16 }}>
                <Link className="button-outline" to={`/bookings/${data.id}/budget-confirm`}>查看预算确认</Link>
              </div>
            </section>
          ) : null}
        </div>

        <aside className="detail-aside">
          <section className="card section-card">
            <div className="section-head"><h2>下一步动作</h2></div>
            <div className="project-list">
              <div className="proj-card">
                <div>
                  <div className="proj-name">服务商</div>
                  <div className="proj-phase">{data.providerName}</div>
                </div>
              </div>
              <div className="proj-card">
                <div>
                  <div className="proj-name">量房定金</div>
                  <div className="proj-phase">{data.intentFeeText}</div>
                </div>
              </div>
            </div>
            {data.surveyRefundNotice ? <div className="status-note" style={{ marginTop: 16 }}>{data.surveyRefundNotice}</div> : null}
            <div className="detail-actions" style={{ marginTop: 16 }}>
              <button className={data.intentFeePaid ? 'button-ghost' : 'button-secondary'} disabled={data.intentFeePaid} onClick={async () => {
                if (!data.intentFeePaid) {
                  const confirmed = window.confirm(`确认支付量房定金 ${data.intentFeeText}？\n\n${data.surveyRefundNotice || '量房完成后若不继续设计，默认退回 60% 给用户；后续确认设计方案后，量房定金转为设计费抵扣。'}`);
                  if (!confirmed) return;
                }
                await payIntentFee(data.id);
                await reload();
              }} type="button">
                {data.intentFeePaid ? '量房定金已支付' : '支付量房定金'}
              </button>
              <Link className="button-outline" to={`/bookings/${data.id}/site-survey`}>量房记录</Link>
              <Link className="button-outline" to={`/bookings/${data.id}/budget-confirm`}>预算确认</Link>
              <Link className="button-outline" to={`/bookings/${data.id}/refund`}>申请退款</Link>
              {data.proposalId ? <Link className="button-outline" to={`/proposals/${data.proposalId}`}>查看报价详情</Link> : null}
              <Link className="button-outline" to={`/after-sales/new?bookingId=${data.id}&type=complaint`}>发起投诉/争议</Link>
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}
