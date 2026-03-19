import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';

import type { MaterialShopListItemVM } from '../types/viewModels';
import { buildCoverLabel, extractPlaceholderTone, isGeneratedPlaceholder, resolveCardPalette } from '../utils/cardPlaceholder';

interface MaterialShopCardProps {
  shop: MaterialShopListItemVM;
}

export function MaterialShopCard({ shop }: MaterialShopCardProps) {
  const isUnsettled = shop.isSettled === false;
  const [coverLoadFailed, setCoverLoadFailed] = useState(false);
  const useFallbackCover = coverLoadFailed || isGeneratedPlaceholder(shop.cover) || !shop.cover;
  const coverCategory = shop.productCategories[0] || shop.mainProducts[0] || '主材品牌';
  const palette = resolveCardPalette(`${coverCategory} ${shop.mainProducts.join(' ')} ${shop.tags.join(' ')}`, extractPlaceholderTone(shop.cover));
  const coverStyle = {
    '--pcard-cover-accent': palette.primary,
    '--pcard-cover-ink': palette.secondary,
  } as CSSProperties;
  const displayTags = shop.productCategories.slice(0, 3);

  return (
    <Link className="pcard" data-reference={isUnsettled ? 'true' : 'false'} to={`/material-shops/${shop.id}`}>
      <div className={`pcard-cover ${useFallbackCover ? 'pcard-cover-fallback' : ''}`} style={useFallbackCover ? coverStyle : undefined}>
        {useFallbackCover ? (
          <div className="pcard-cover-placeholder" aria-hidden="true">
            <div className="pcard-cover-topline">
              <span className="pcard-cover-placeholder-chip">{coverCategory}</span>
            </div>
            <div className="pcard-cover-placeholder-copy">
              <strong>{buildCoverLabel(shop.name, 8)}</strong>
              <div className="pcard-cover-placeholder-meta">
                <span>{isUnsettled ? '公开线索门店' : '主材品牌门店'}</span>
                <span>{shop.mainProducts.slice(0, 2).join(' · ') || '支持到店选材'}</span>
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
          ? <div className="pcard-verified pcard-verified-reference">公开资料</div>
          : shop.isVerified ? <div className="pcard-verified">已认证</div> : null}
      </div>
      <div className="pcard-body">
        {isUnsettled ? (
          <div className="pcard-reference-note">
            <span className="pcard-reference-note-label">参考信息</span>
            <span>公开渠道整理，仅供选店参考，非平台合作或履约承诺</span>
          </div>
        ) : null}
        <div className="pcard-head">
          <div className="pcard-name">{shop.name}</div>
          <span className="pcard-badge">主材门店</span>
        </div>
        <div className="pcard-org">{shop.rating.toFixed(1)} 分 · {shop.reviewCount} 条评价 · {shop.distance || '到店咨询'}</div>
        <div className="pcard-supporting">{shop.mainProducts.slice(0, 2).join(' · ') || '品牌直供 · 到店可看样'}</div>
        {displayTags.length > 0 ? (
          <div className="pcard-tags">
            {displayTags.map((tag) => <span className="pcard-tag" key={tag}>{tag}</span>)}
          </div>
        ) : null}
        <div className="pcard-foot">
          <div className="pcard-foot-row">
            <span className="pcard-foot-label">营业提示</span>
            <span className="pcard-foot-value">{shop.openTime || '到店前请先确认'}</span>
          </div>
          <div className="pcard-foot-row">
            <span className="pcard-foot-label">门店地址</span>
            <span className="pcard-foot-value">{shop.address || '门店地址待补充'}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
