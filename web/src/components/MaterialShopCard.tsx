import { Link } from 'react-router-dom';

import type { MaterialShopListItemVM } from '../types/viewModels';

interface MaterialShopCardProps {
  shop: MaterialShopListItemVM;
}

export function MaterialShopCard({ shop }: MaterialShopCardProps) {
  return (
    <Link className="pcard" to={`/material-shops/${shop.id}`}>
      <div className="pcard-cover">
        {shop.cover ? <img alt={shop.name} className="pcard-cover-image" src={shop.cover} /> : null}
        {shop.isVerified ? <div className="pcard-verified">已认证</div> : null}
      </div>
      <div className="pcard-body">
        <div className="pcard-head">
          <div className="pcard-name">{shop.name}</div>
          <span className="pcard-badge">主材门店</span>
        </div>
        <div className="pcard-org">{shop.rating.toFixed(1)} 分 · {shop.reviewCount} 条评价 · {shop.distance || '到店咨询'}</div>
        <div className="pcard-supporting">{shop.mainProducts.slice(0, 2).join(' · ') || '品牌直供 · 到店可看样'}</div>
        {shop.productCategories.length > 0 ? (
          <div className="pcard-tags">
            {shop.productCategories.slice(0, 2).map((tag) => <span className="pcard-tag" key={tag}>{tag}</span>)}
          </div>
        ) : null}
        <div className="pcard-price">
          <strong>{shop.openTime || '营业中'}</strong>
          <span>{shop.address || '门店地址待补充'}</span>
        </div>
      </div>
    </Link>
  );
}
