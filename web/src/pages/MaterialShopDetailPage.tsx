import { Link, useParams } from 'react-router-dom';

import { ErrorBlock, LoadingBlock } from '../components/AsyncState';
import { useAsyncData } from '../hooks/useAsyncData';
import { getMaterialShopDetail } from '../services/materialShops';

export function MaterialShopDetailPage() {
  const params = useParams();
  const shopId = Number(params.id || 0);
  const { data, loading, error, reload } = useAsyncData(() => getMaterialShopDetail(shopId), [shopId]);

  if (!shopId) return <div className="top-detail"><ErrorBlock description="无效门店 ID" /></div>;
  if (loading) return <div className="top-detail"><LoadingBlock title="加载门店详情" /></div>;
  if (error || !data) return <div className="top-detail"><ErrorBlock description={error || '门店详情加载失败'} onRetry={() => void reload()} /></div>;

  return (
    <div className="top-detail">
      <section className="detail-header">
        <div className="detail-header-row">
          <div>
            <p className="detail-kicker">主材门店</p>
            <h1>{data.name}</h1>
            <p>{data.address}</p>
          </div>
          <div className="inline-actions">
            {data.isVerified ? <span className="status-chip" data-tone="success">已认证</span> : null}
            <Link className="button-outline" to="/providers?category=material">返回主材列表</Link>
          </div>
        </div>
      </section>

      <section className="detail-layout">
        <div className="detail-main">
          <section className="card section-card">
            <img alt={data.name} className="detail-cover tall" src={data.cover} />
          </section>
        </div>
        <aside className="detail-aside">
          <section className="card section-card">
            <div className="section-head"><h2>门店信息</h2></div>
            <div className="detail-stat-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
              <article className="detail-stat"><span>评分</span><strong>{data.rating.toFixed(1)}</strong></article>
              <article className="detail-stat"><span>门店距离</span><strong>{data.distance}</strong></article>
              <article className="detail-stat"><span>营业时间</span><strong>{data.openTime}</strong></article>
              <article className="detail-stat"><span>主打品类</span><strong>{data.productCategories.slice(0, 2).join(' / ') || '待补充'}</strong></article>
            </div>
            <div className="inline-actions" style={{ marginTop: 16 }}>
              {data.mainProducts.map((item) => <span className="tag" key={item}>{item}</span>)}
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}
