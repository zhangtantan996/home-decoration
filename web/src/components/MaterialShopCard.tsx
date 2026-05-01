import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';

import type { MaterialShopListItemVM } from '../types/viewModels';
import { buildCoverLabel, extractPlaceholderTone, isGeneratedPlaceholder, resolveCardPalette } from '../utils/cardPlaceholder';

interface MaterialShopCardProps {
  shop: MaterialShopListItemVM;
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

export function MaterialShopCard({ shop }: MaterialShopCardProps) {
  const isUnsettled = shop.isSettled === false;
  const [coverLoadFailed, setCoverLoadFailed] = useState(false);
  const useFallbackCover = coverLoadFailed || isGeneratedPlaceholder(shop.cover) || !shop.cover;
  const uniqueCategories = uniqueTexts(shop.productCategories);
  const uniqueProducts = uniqueTexts(shop.mainProducts);
  const uniqueTags = uniqueTexts(shop.tags);
  const coverCategory = uniqueCategories[0] || uniqueProducts[0] || '主材品牌';
  const supportingItems = uniqueTexts([...uniqueProducts, ...uniqueCategories]).filter((item) => item !== coverCategory);
  const supportingText = supportingItems.slice(0, 2).join(' · ');
  const displayTags = uniqueTags
    .filter((tag) => tag !== coverCategory && !supportingItems.includes(tag))
    .slice(0, 2);
  const palette = resolveCardPalette(`${coverCategory} ${shop.mainProducts.join(' ')} ${shop.tags.join(' ')}`, extractPlaceholderTone(shop.cover));
  const coverStyle = {
    '--pcard-cover-accent': palette.primary,
    '--pcard-cover-ink': palette.secondary,
  } as CSSProperties;

  return (
    <Link className="pcard pcard-shop" data-reference={isUnsettled ? 'true' : 'false'} to={`/material-shops/${shop.id}`}>
      <div className={`pcard-cover ${useFallbackCover ? 'pcard-cover-fallback' : ''}`} style={useFallbackCover ? coverStyle : undefined}>
        {useFallbackCover ? (
          <div className="pcard-cover-placeholder" aria-hidden="true">
            <div className="pcard-cover-topline">
              <span className="pcard-cover-placeholder-chip">{coverCategory}</span>
            </div>
            <div className="pcard-cover-placeholder-copy">
              <strong>{buildCoverLabel(shop.name, 8)}</strong>
              <div className="pcard-cover-placeholder-meta">
                <span>{isUnsettled ? '平台整理门店' : '主材品牌门店'}</span>
                <span>{supportingText || '支持到店选材'}</span>
              </div>
            </div>
          </div>
        ) : (
          <img
            alt={shop.name}
            className="pcard-cover-image"
            onError={() => setCoverLoadFailed(true)}
            src={shop.cover}
          />
        )}
        {isUnsettled
          ? <div className="pcard-verified pcard-verified-reference">平台整理</div>
          : shop.isVerified ? <div className="pcard-verified">已认证</div> : null}
      </div>
      <div className="pcard-body">
        <div className="pcard-head">
          <div className="pcard-name">{shop.name}</div>
          <span className="pcard-badge">{isUnsettled ? '待商家认领' : '主材门店'}</span>
        </div>
        {isUnsettled ? (
          <div className="pcard-reference-note">
            <span className="pcard-reference-note-label">信息仅供参考</span>
            <span>平台整理公开资料，商家尚未认领入驻。</span>
          </div>
        ) : null}
        <div className="pcard-org">{shop.rating.toFixed(1)} 分 · {shop.reviewCount} 条评价 · {shop.distance || '到店咨询'}</div>
        <div className="pcard-supporting pcard-supporting-fixed">{supportingText || '支持到店选材'}</div>
        <div className="pcard-tags pcard-tags-fixed" aria-hidden={displayTags.length === 0}>
          {displayTags.map((tag) => <span className="pcard-tag" key={tag}>{tag}</span>)}
        </div>
        <div className="pcard-foot">
          <div className="pcard-foot-row pcard-foot-row-hint">
            <span className="pcard-foot-label">营业提示</span>
            <span className="pcard-foot-value">{shop.openTime || '到店前请先确认'}</span>
          </div>
          <div className="pcard-foot-row pcard-foot-row-address">
            <span className="pcard-foot-label">门店地址</span>
            <span className="pcard-foot-value">{shop.address || '门店地址待补充'}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
