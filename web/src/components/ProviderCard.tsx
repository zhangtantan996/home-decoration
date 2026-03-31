import { useState, type CSSProperties } from 'react';
import { Link, useLocation } from 'react-router-dom';

import type { ProviderListItemVM } from '../types/viewModels';
import { extractPlaceholderTone, isGeneratedPlaceholder, resolveCardPalette } from '../utils/cardPlaceholder';
import { getProviderRatingMeta, parseTextArray } from '../utils/provider';

interface ProviderCardProps {
  provider: ProviderListItemVM;
}

function uniqueTexts(items: string[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const normalized = item.trim();
    if (!normalized || seen.has(normalized)) {
      return false;
    }
    seen.add(normalized);
    return true;
  });
}

function pickCompanyRecommendation(tags: string[]) {
  return tags.find((tag) => /[A-Z]级推荐$/i.test(tag.trim()));
}

function deriveDisplayTags(tags: string[], summary: string) {
  const normalizedTags = uniqueTexts(tags);
  if (normalizedTags.length > 0) {
    return normalizedTags;
  }

  const summaryTags = uniqueTexts(parseTextArray(summary)).filter((item) => item !== '支持前期沟通、现场勘测与分项报价。');
  return summaryTags;
}

export function ProviderCard({ provider }: ProviderCardProps) {
  const location = useLocation();
  const locationText = provider.serviceArea.slice(0, 1).join(' / ') || '同城服务';
  const isUnsettled = provider.role === 'company' && provider.isSettled === false;
  const [coverLoadFailed, setCoverLoadFailed] = useState(false);
  const useFallbackCover = coverLoadFailed || isGeneratedPlaceholder(provider.avatar) || !provider.avatar;
  const uniqueTagsList = deriveDisplayTags(provider.tags, provider.summary);
  const recommendationTag = provider.role === 'company' ? pickCompanyRecommendation(uniqueTagsList) : undefined;
  const companyTags = uniqueTagsList.filter((tag) => tag !== recommendationTag);
  const displayTags = provider.role === 'company' ? companyTags : uniqueTagsList;
  const secondLine = [provider.role === 'company' ? recommendationTag : '', provider.yearsExperience > 0 ? `${provider.yearsExperience}年经验` : '']
    .filter(Boolean)
    .join(' · ') || '经验待补充';
  const thirdLine = displayTags.join(' · ') || '风格标签待补充';
  const ratingMeta = getProviderRatingMeta(provider.rating, provider.reviewCount);
  const firstLine = ratingMeta.hasRating ? `${ratingMeta.inlineText} · ${locationText}` : `${ratingMeta.inlineText} · ${locationText}`;
  const displayPriceText = provider.priceText;
  const palette = resolveCardPalette(`${provider.orgLabel} ${provider.tags.join(' ')}`, extractPlaceholderTone(provider.avatar) || (isUnsettled ? '#F59E0B' : '#DBEAFE'));
  const coverStyle = {
    '--pcard-cover-accent': palette.primary,
    '--pcard-cover-ink': palette.secondary,
  } as CSSProperties;

  return (
    <Link
      className={`pcard pcard-provider ${provider.role === 'company' ? 'pcard-company' : ''}`.trim()}
      data-reference={isUnsettled ? 'true' : 'false'}
      state={{ from: `${location.pathname}${location.search}` }}
      to={`/providers/${provider.role}/${provider.id}`}
    >
      <div className={`pcard-cover ${useFallbackCover ? 'pcard-cover-fallback' : ''}`} style={useFallbackCover ? coverStyle : undefined}>
        {useFallbackCover ? (
          <div className="pcard-cover-placeholder pcard-cover-placeholder-portrait" aria-hidden="true">
            <div className="pcard-cover-avatar-fallback">
              <span>{provider.name.trim().charAt(0) || provider.orgLabel.trim().charAt(0) || '匠'}</span>
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
        <div className="pcard-head">
          <div className="pcard-name">{provider.name}</div>
          <span className="pcard-badge">{provider.orgLabel}</span>
        </div>
        <div className="pcard-provider-lines">
          <div className="pcard-provider-line">{firstLine}</div>
          <div className="pcard-provider-line">{secondLine}</div>
          <div className="pcard-provider-line pcard-provider-line-muted">{thirdLine}</div>
        </div>
        <div className="pcard-price">
          <strong>{displayPriceText}</strong>
          <span>{ratingMeta.detailText}</span>
        </div>
      </div>
    </Link>
  );
}
