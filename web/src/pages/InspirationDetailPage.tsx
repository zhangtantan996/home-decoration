import { Link, useParams } from 'react-router-dom';

import { ErrorBlock, LoadingBlock } from '../components/AsyncState';
import { useAsyncData } from '../hooks/useAsyncData';
import { getInspirationDetail } from '../services/inspiration';

export function InspirationDetailPage() {
  const params = useParams();
  const inspirationId = Number(params.id || 0);
  const { data, loading, error, reload } = useAsyncData(() => getInspirationDetail(inspirationId), [inspirationId]);

  if (!inspirationId) return <div className="top-detail"><ErrorBlock description="无效灵感 ID" /></div>;
  if (loading) return <div className="top-detail"><LoadingBlock title="加载灵感详情" /></div>;
  if (error || !data) return <div className="top-detail"><ErrorBlock description={error || '灵感详情加载失败'} onRetry={() => void reload()} /></div>;

  return (
    <div className="top-detail">
      <section className="detail-header">
        <div className="detail-header-row">
          <div>
            <p className="detail-kicker">案例详情</p>
            <h1>{data.title}</h1>
            <p>{data.description}</p>
          </div>
          <div className="inline-actions">
            <Link className="button-outline" to="/inspiration">返回灵感列表</Link>
          </div>
        </div>
      </section>

      <section className="detail-main">
        <section className="card section-card">
          <img alt={data.title} className="detail-cover tall" src={data.coverImage} />
          <div className="detail-stat-grid" style={{ marginTop: 16 }}>
            <article className="detail-stat"><span>作者</span><strong>{data.authorName}</strong></article>
            <article className="detail-stat"><span>风格 / 户型</span><strong>{data.style} · {data.layout}</strong></article>
            <article className="detail-stat"><span>面积</span><strong>{data.area}</strong></article>
            <article className="detail-stat"><span>互动</span><strong>{data.likeCount} 赞 · {data.commentCount} 评</strong></article>
          </div>
        </section>

        <section className="card section-card">
          <div className="section-head"><h2>图集</h2></div>
          <div className="detail-gallery">
            {data.galleryImages.map((image) => (
              <img alt={data.title} key={image} src={image} />
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}
