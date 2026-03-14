import { Link } from 'react-router-dom';

import type { ProviderListItemVM } from '../types/viewModels';

interface ProviderCardProps {
  provider: ProviderListItemVM;
}

export function ProviderCard({ provider }: ProviderCardProps) {
  const locationText = provider.serviceArea.slice(0, 1).join(' / ') || '同城服务';

  return (
    <Link className="pcard" to={`/providers/${provider.role}/${provider.id}`}>
      <div className="pcard-cover">
        {provider.avatar ? <img alt={provider.name} className="pcard-cover-image" src={provider.avatar} /> : null}
        {provider.verified ? <div className="pcard-verified">已认证</div> : null}
      </div>
      <div className="pcard-body">
        <div className="pcard-head">
          <div className="pcard-name">{provider.name}</div>
          <span className="pcard-badge">{provider.orgLabel}</span>
        </div>
        <div className="pcard-org">{provider.yearsExperience} 年经验 · {provider.rating.toFixed(1)} 分 · {locationText}</div>
        <div className="pcard-supporting">{provider.summary}</div>
        {provider.tags.length > 0 ? (
          <div className="pcard-tags">
            {provider.tags.slice(0, 2).map((tag) => <span className="pcard-tag" key={tag}>{tag}</span>)}
          </div>
        ) : null}
        <div className="pcard-price">
          <strong>{provider.priceText}</strong>
          <span>{provider.reviewCount} 条评价</span>
        </div>
      </div>
    </Link>
  );
}
