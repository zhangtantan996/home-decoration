import { Link, useParams } from 'react-router-dom';

import { ActionPanel } from '../components/ActionPanel';
import { ErrorBlock, LoadingBlock } from '../components/AsyncState';
import { StatusBanner } from '../components/StatusBanner';
import { useAsyncData } from '../hooks/useAsyncData';
import { getDemandDetail } from '../services/demands';
import { getProviderRatingMeta } from '../utils/provider';

function statusTone(status: string) {
  if (status === 'matched') return 'success';
  if (status === 'closed') return 'warning';
  if (status === 'submitted' || status === 'reviewing') return 'warning';
  return 'brand';
}

export function DemandDetailPage() {
  const params = useParams();
  const demandId = Number(params.id || 0);
  const { data, loading, error, reload } = useAsyncData(() => getDemandDetail(demandId), [demandId]);

  if (loading) return <div className="container page-stack"><LoadingBlock title="加载需求详情" /></div>;
  if (error || !data) return <div className="container page-stack"><ErrorBlock description={error || '需求详情加载失败'} onRetry={() => void reload()} /></div>;

  const quotedCount = data.matches.filter((item) => item.proposal).length;

  return (
    <div className="container page-stack">
      <StatusBanner
        description="这里的重点是让你知道：需求现在处在哪个阶段，平台是否已经审核，以及已经有多少商家开始响应。"
        label="需求详情"
        meta={
          <>
            <span className="status-chip" data-tone={statusTone(data.status)}>{data.status}</span>
            <span className="status-chip">{quotedCount} 份方案</span>
          </>
        }
        title={data.title}
        tone={quotedCount > 0 ? 'success' : 'info'}
      />

      <section className="split-shell">
        <section className="dashboard-shell">
          <section className="card section-card">
            <div className="panel-head">
              <div>
                <p className="kicker eyebrow-accent">需求概览</p>
                <h2 className="section-title">房屋信息、预算与意向说明</h2>
              </div>
            </div>
            <div className="data-grid detail-grid-two">
              <article><span>城市 / 区域</span><strong>{data.city} {data.district}</strong></article>
              <article><span>详细地址</span><strong>{data.address || '未填写'}</strong></article>
              <article><span>面积</span><strong>{data.area > 0 ? `${data.area}㎡` : '待补充'}</strong></article>
              <article><span>预算</span><strong>{Math.round(data.budgetMin)} - {Math.round(data.budgetMax)}</strong></article>
              <article><span>启动时间</span><strong>{data.timeline || '未填写'}</strong></article>
              <article><span>风格偏好</span><strong>{data.stylePref || '未填写'}</strong></article>
            </div>
            <div className="status-note" style={{ marginTop: 18 }}>{data.description || '暂无详细描述。'}</div>
          </section>

          <section className="card section-card">
            <div className="panel-head">
              <div>
                <p className="kicker eyebrow-accent">匹配进度</p>
                <h2 className="section-title">平台分配和商家响应情况</h2>
              </div>
              {quotedCount > 0 ? <Link className="button-link" to={`/demands/${data.id}/compare`}>去对比方案</Link> : null}
            </div>
            {data.matches.length === 0 ? (
              <div className="status-note">需求提交后，这里会显示平台分配的商家与响应状态。</div>
            ) : (
              <div className="list-stack">
                {data.matches.map((item) => {
                  const ratingMeta = getProviderRatingMeta(item.provider.rating, item.provider.reviewCount);
                  return (
                    <div className="list-card" key={item.id}>
                      <div>
                        <div className="inline-actions" style={{ marginBottom: 10 }}>
                          <span className="status-chip" data-tone={item.proposal ? 'success' : item.status === 'declined' ? 'warning' : 'brand'}>{item.status}</span>
                          <span className="status-chip">{ratingMeta.inlineText}</span>
                        </div>
                        <h3>{item.provider.name}</h3>
                        <p>{item.provider.specialty || '平台认证服务商'}</p>
                        {item.declineReason ? <p>拒绝原因：{item.declineReason}</p> : null}
                      </div>
                      <div className="list-meta">
                        <strong>{item.proposal ? '已提交方案' : '待响应'}</strong>
                        <span>{item.responseDeadline || '等待平台同步'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {data.attachments.length > 0 ? (
            <section className="card section-card">
              <div className="panel-head">
                <div>
                  <p className="kicker eyebrow-accent">需求附件</p>
                  <h2 className="section-title">户型图、现场图与参考资料</h2>
                </div>
              </div>
              <div className="list-stack">
                {data.attachments.map((item) => (
                  <a className="surface-card" href={item.url} key={item.url} rel="noreferrer" target="_blank">
                    <div>
                      <h3>{item.name}</h3>
                      <p>{Math.max(1, Math.round(item.size / 1024))} KB</p>
                    </div>
                  </a>
                ))}
              </div>
            </section>
          ) : null}
        </section>

        <ActionPanel
          description={data.reviewNote || '审核通过后平台会分配商家，商家提交方案后可进入对比页查看。'}
          eyebrow="当前动作"
          sticky
          title="下一步怎么走"
        >
          <div className="list-stack">
            <div className="surface-card">
              <div>
                <h3>需求状态</h3>
                <p>{data.status}</p>
              </div>
            </div>
            <div className="surface-card">
              <div>
                <h3>已匹配商家</h3>
                <p>{data.matchedCount}/{data.maxMatch}</p>
              </div>
            </div>
            <div className="surface-card">
              <div>
                <h3>审核备注</h3>
                <p>{data.reviewNote || '平台暂未补充审核备注。'}</p>
              </div>
            </div>
          </div>
          <div className="inline-actions">
            <Link className="button-outline" to="/me/demands">返回我的需求</Link>
            {quotedCount > 0 ? <Link className="button-secondary" to={`/demands/${data.id}/compare`}>查看方案对比</Link> : null}
          </div>
        </ActionPanel>
      </section>
    </div>
  );
}
