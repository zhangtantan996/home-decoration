import { Link, useParams } from 'react-router-dom';

import { ErrorBlock, LoadingBlock } from '../components/AsyncState';
import { StatusBanner } from '../components/StatusBanner';
import { useAsyncData } from '../hooks/useAsyncData';
import { getDemandDetail } from '../services/demands';
import { formatCurrency } from '../utils/format';

export function DemandComparePage() {
  const params = useParams();
  const demandId = Number(params.id || 0);
  const { data, loading, error, reload } = useAsyncData(() => getDemandDetail(demandId), [demandId]);

  if (loading) return <div className="container page-stack"><LoadingBlock title="加载方案对比" /></div>;
  if (error || !data) return <div className="container page-stack"><ErrorBlock description={error || '方案对比加载失败'} onRetry={() => void reload()} /></div>;

  const quotedMatches = data.matches.filter((item) => item.proposal);

  return (
    <div className="container page-stack">
      <StatusBanner
        description="这里只做一件事：把已提交的方案按总价、工期、说明和附件放在同一视图里，方便快速比较。"
        label="方案对比"
        meta={<span className="status-chip" data-tone="brand">{quotedMatches.length} 份可对比方案</span>}
        title={data.title}
        tone={quotedMatches.length > 0 ? 'success' : 'warning'}
      />

      {quotedMatches.length === 0 ? (
        <section className="card section-card">
          <div className="status-note">当前还没有商家提交正式方案，平台分配商家后会在这里自动汇总。</div>
          <div className="inline-actions" style={{ marginTop: 16 }}>
            <Link className="button-outline" to={`/demands/${data.id}`}>返回需求详情</Link>
          </div>
        </section>
      ) : (
        <section className="grid-3">
          {quotedMatches.map((item) => {
            const proposal = item.proposal!;
            const total = proposal.designFee + proposal.constructionFee + proposal.materialFee;
            return (
              <article className="card section-card" key={item.id}>
                <div className="panel-head">
                  <div>
                    <p className="kicker eyebrow-accent">服务商方案</p>
                    <h2 className="section-title">{item.provider.name}</h2>
                  </div>
                  <span className="status-chip" data-tone="success">v{proposal.version}</span>
                </div>
                <div className="data-grid">
                  <article><span>总价估算</span><strong>{formatCurrency(total)}</strong></article>
                  <article><span>设计费</span><strong>{formatCurrency(proposal.designFee)}</strong></article>
                  <article><span>施工费</span><strong>{formatCurrency(proposal.constructionFee)}</strong></article>
                  <article><span>主材费</span><strong>{formatCurrency(proposal.materialFee)}</strong></article>
                  <article><span>预计工期</span><strong>{proposal.estimatedDays > 0 ? `${proposal.estimatedDays} 天` : '待补充'}</strong></article>
                  <article><span>响应时间</span><strong>{proposal.submittedAt || '待同步'}</strong></article>
                </div>
                <div className="status-note" style={{ marginTop: 18 }}>{proposal.summary}</div>
                <div className="list-stack" style={{ marginTop: 18 }}>
                  <div className="surface-card">
                    <div>
                      <h3>服务商评分</h3>
                      <p>{item.provider.rating.toFixed(1)} 分 · 完工 {item.provider.completedCnt} 单</p>
                    </div>
                  </div>
                  <div className="surface-card">
                    <div>
                      <h3>擅长方向</h3>
                      <p>{item.provider.specialty || '平台认证服务商'}</p>
                    </div>
                  </div>
                  {proposal.attachments.length > 0 ? (
                    <div className="surface-card">
                      <div>
                        <h3>方案附件</h3>
                        <p>{proposal.attachments.length} 个附件</p>
                      </div>
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
