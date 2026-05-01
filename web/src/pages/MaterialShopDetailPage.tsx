import { Link, useParams } from 'react-router-dom';

import { ErrorBlock, LoadingBlock } from '../components/AsyncState';
import { useAsyncData } from '../hooks/useAsyncData';
import { getMaterialShopDetail } from '../services/materialShops';
import { formatCurrency } from '../utils/format';

export function MaterialShopDetailPage() {
  const params = useParams();
  const shopId = Number(params.id || 0);
  const { data, loading, error, reload } = useAsyncData(() => getMaterialShopDetail(shopId), [shopId]);

  if (!shopId) return <div className="top-detail"><ErrorBlock description="无效门店 ID" /></div>;
  if (loading) return <div className="top-detail"><LoadingBlock title="加载门店详情" /></div>;
  if (error || !data) return <div className="top-detail"><ErrorBlock description={error || '门店详情加载失败'} onRetry={() => void reload()} /></div>;

  const settled = data.isSettled !== false;

  return (
    <div className="top-detail">
      {!settled && (
        <section className="card section-card">
          <div className="pcard-reference-note">
            <span className="pcard-reference-note-label">平台整理</span>
            <span>待商家认领，信息仅供参考；不代表平台认证、合作或履约承诺。</span>
          </div>
        </section>
      )}
      <section className="detail-header">
        <div className="detail-header-row">
          <div className="material-shop-detail-heading">
            {data.brandLogo ? <img alt={`${data.name} 品牌标识`} className="material-shop-detail-logo" src={data.brandLogo} /> : null}
            <div>
              <p className="detail-kicker">主材门店</p>
              <h1>{data.name}</h1>
              <p>{data.address}</p>
            </div>
          </div>
          <div className="inline-actions">
            {!settled
              ? <span className="status-chip" data-tone="warning">待商家认领</span>
              : data.isVerified ? <span className="status-chip" data-tone="success">已认证</span> : null}
            <Link className="button-outline" to="/providers?category=material">返回主材列表</Link>
          </div>
        </div>
      </section>

      <section className="detail-layout">
        <div className="detail-main">
          <section className="card section-card">
            {data.cover ? (
              <img alt={data.name} className="detail-cover tall" src={data.cover} />
            ) : (
              <div aria-label={`${data.name} 暂无门店图片`} className="detail-cover detail-cover-empty tall" role="img">
                <strong>暂无门店图片</strong>
                <p>商家暂未上传门店封面，可先查看下方已公开商品。</p>
              </div>
            )}
          </section>
          <section className="card section-card">
            <div className="section-head">
              <h2>公开商品</h2>
              <span>{data.products.length} 款</span>
            </div>
            {data.products.length ? (
              <div className="material-shop-product-grid">
                {data.products.map((product) => (
                  <article className="material-shop-product-card" key={product.id}>
                    {product.coverImage ? (
                      <img alt={product.name} className="material-shop-product-cover" src={product.coverImage} />
                    ) : (
                      <div aria-label={`${product.name} 暂无商品图片`} className="material-shop-product-cover material-shop-product-cover-empty" role="img">
                        暂无商品图片
                      </div>
                    )}
                    <div className="material-shop-product-body">
                      <div className="material-shop-product-head">
                        <strong>{product.name}</strong>
                        <span>{formatCurrency(product.price)}{product.unit ? ` / ${product.unit}` : ''}</span>
                      </div>
                      <p>{product.description || '商家暂未补充商品说明，可到店进一步了解。'}</p>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="detail-empty-block">
                <strong>暂未公开商品</strong>
                <p>当前门店还没有可展示的公开商品，稍后再来看看。</p>
              </div>
            )}
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
            {data.description ? <p className="detail-note" style={{ marginTop: 16 }}>{data.description}</p> : null}
          </section>
        </aside>
      </section>
    </div>
  );
}
