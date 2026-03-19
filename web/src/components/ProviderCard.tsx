import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';

import type { ProviderListItemVM } from '../types/viewModels';
import { buildCoverLabel, extractPlaceholderTone, isGeneratedPlaceholder, resolveCardPalette } from '../utils/cardPlaceholder';

interface ProviderCardProps {
  provider: ProviderListItemVM;
}

export function ProviderCard({ provider }: ProviderCardProps) {
  const locationText = provider.serviceArea.slice(0, 1).join(' / ') || '同城服务';
  const isUnsettled = provider.role === 'company' && provider.isSettled === false;
  const [coverLoadFailed, setCoverLoadFailed] = useState(false);
  const useFallbackCover = coverLoadFailed || isGeneratedPlaceholder(provider.avatar) || !provider.avatar;
  const palette = resolveCardPalette(`${provider.orgLabel} ${provider.tags.join(' ')}`, extractPlaceholderTone(provider.avatar) || (isUnsettled ? '#F59E0B' : '#DBEAFE'));
  const coverStyle = {
    '--pcard-cover-accent': palette.primary,
    '--pcard-cover-ink': palette.secondary,
  } as CSSProperties;

  return (
    <Link className="pcard" data-reference={isUnsettled ? 'true' : 'false'} to={`/providers/${provider.role}/${provider.id}`}>
      <div className={`pcard-cover ${useFallbackCover ? 'pcard-cover-fallback' : ''}`} style={useFallbackCover ? coverStyle : undefined}>
        {useFallbackCover ? (
          <div className="pcard-cover-placeholder" aria-hidden="true">
            <div className="pcard-cover-topline">
              <span className="pcard-cover-placeholder-chip">{provider.orgLabel}</span>
            </div>
            <div className="pcard-cover-placeholder-copy">
              <strong>{buildCoverLabel(provider.name, 8)}</strong>
              <div className="pcard-cover-placeholder-meta">
                <span>{isUnsettled ? '公开线索主体' : '服务类商家'}</span>
                <span>{provider.priceText}</span>
              </div>
            </div>
          </div>
        ) : (
          <img
            alt={provider.name}
            className="pcard-cover-image"
            onError={() => setCoverLoadFailed(true)}
            src={provider.avatar}
          />
        )}
        {isUnsettled
          ? <div className="pcard-verified pcard-verified-reference">公开资料</div>
          : provider.verified ? <div className="pcard-verified">已认证</div> : null}
      </div>
      <div className="pcard-body">
        {isUnsettled ? (
          <div className="pcard-reference-note">
            <span className="pcard-reference-note-label">参考信息</span>
            <span>公开渠道整理，仅供对比参考，非平台签约或履约承诺</span>
          </div>
        ) : null}
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
          <span>{isUnsettled ? '公开资料参考' : `${provider.reviewCount} 条评价`}</span>
        </div>
      </div>
    </Link>
  );
}
