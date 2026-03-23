import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';

import { EmptyBlock, ErrorBlock } from '../components/AsyncState';
import { useAsyncData } from '../hooks/useAsyncData';
import { useSessionStore } from '../modules/session/sessionStore';
import { favoriteProvider, followProvider, getProviderDetail, getProviderUserStatus, unfavoriteProvider, unfollowProvider } from '../services/providers';
import type { ProviderDetailVM, ProviderRole } from '../types/viewModels';

interface NoteState {
  text: string;
  tone: 'brand' | 'success' | 'warning' | 'danger';
}

interface ProviderUserStatus {
  isFollowed: boolean;
  isFavorited: boolean;
}

const fallbackStatus: ProviderUserStatus = {
  isFollowed: false,
  isFavorited: false,
};

const baseTabItems = [
  { id: 'services', label: '服务内容' },
  { id: 'cases', label: '作品案例' },
  { id: 'scene', label: '案例实景' },
  { id: 'reviews', label: '业主评价' },
  { id: 'about', label: '关于我们' },
] as const;

type ProviderDetailTabId = (typeof baseTabItems)[number]['id'];
type IconKind = 'design' | 'guide' | 'value' | 'shield';

function readRole(value: string | undefined): ProviderRole | null {
  if (value === 'designer' || value === 'company' || value === 'foreman') return value;
  return null;
}

function formatRating(value: number) {
  return value > 0 ? value.toFixed(1) : '暂无';
}

function formatPercent(value: number) {
  return value > 0 ? `${value.toFixed(1)}%` : '待补充';
}

function formatServiceArea(areas: string[]) {
  if (areas.length === 0) return '同城服务';
  return areas.join(' / ');
}

function clampText(value: string, maxLength: number, fallback: string) {
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (!normalized) return fallback;
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).trim()}…`;
}

function extractLeadText(value: string, sentenceCount: number, maxLength: number, fallback: string) {
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (!normalized) return fallback;

  const sentences = normalized.match(/[^。！？!?]+[。！？!?]?/g)?.map((item) => item.trim()).filter(Boolean) ?? [];
  const lead = sentences.slice(0, sentenceCount).join('');

  if (lead) {
    return clampText(lead, maxLength, fallback);
  }

  return clampText(normalized, maxLength, fallback);
}

function getTopReviewTags(reviews: Array<{ tags: string[] }>, limit: number) {
  const counts = new Map<string, number>();
  reviews.forEach((review) => {
    review.tags.forEach((tag) => {
      const normalized = tag.trim();
      if (!normalized) return;
      counts.set(normalized, (counts.get(normalized) || 0) + 1);
    });
  });

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'zh-CN'))
    .slice(0, limit)
    .map(([tag, count]) => ({ tag, count }));
}

function collectDisplayTags(detail: ProviderDetailVM, reviewHighlights: Array<{ tag: string; count: number }>) {
  const deduped = new Set<string>();
  const pushTag = (value: string) => {
    const normalized = value.trim();
    if (!normalized) return;
    deduped.add(normalized);
  };

  detail.tags.forEach(pushTag);

  if (deduped.size === 0 && detail.summary.includes('·')) {
    detail.summary.split('·').forEach(pushTag);
  }

  if (deduped.size === 0) {
    reviewHighlights.forEach((item) => pushTag(item.tag));
  }

  return [...deduped].slice(0, 6);
}

function uniqTexts(values: string[]) {
  const result: string[] = [];
  const seen = new Set<string>();
  values.forEach((value) => {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    result.push(normalized);
  });
  return result;
}

function takeWithFallback(values: string[], fallback: string[], limit: number) {
  const result = [...values];
  for (const item of fallback) {
    if (result.length >= limit) break;
    if (!result.includes(item)) {
      result.push(item);
    }
  }
  return result.slice(0, limit);
}

function renderStars(value: number) {
  const score = Math.max(0, Math.min(5, Math.round(value)));
  return Array.from({ length: 5 }, (_, index) => (
    <span aria-hidden="true" className={`provider-detail-star ${index < score ? 'is-active' : ''}`} key={index}>★</span>
  ));
}

function IconGlyph({ kind }: { kind: IconKind }) {
  switch (kind) {
    case 'design':
      return (
        <svg fill="none" height="24" viewBox="0 0 24 24" width="24">
          <path d="M12 3v18M7.5 7.5 12 3l4.5 4.5M8.5 21l3.5-6 3.5 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
        </svg>
      );
    case 'guide':
      return (
        <svg fill="none" height="24" viewBox="0 0 24 24" width="24">
          <path d="M4 18h16M7 18v-5.5a5 5 0 1 1 10 0V18M10 8h4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
        </svg>
      );
    case 'value':
      return (
        <svg fill="none" height="24" viewBox="0 0 24 24" width="24">
          <path d="M3 6h18l-2 10H5L3 6Zm0 0-1-2M9 20a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm8 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
        </svg>
      );
    case 'shield':
      return (
        <svg fill="none" height="24" viewBox="0 0 24 24" width="24">
          <path d="m12 3 7 3v6c0 4.5-2.9 7.8-7 9-4.1-1.2-7-4.5-7-9V6l7-3Zm-2.5 9 1.8 1.8L15 10.1" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
        </svg>
      );
    default:
      return null;
  }
}

function ProviderDetailSkeleton() {
  return (
    <div className="top-detail provider-detail-page provider-detail-skeleton-page">
      <section className="card provider-detail-skeleton-card" aria-hidden="true">
        <div className="provider-detail-skeleton-copy">
          <div className="provider-detail-skeleton-line short provider-detail-skeleton-shimmer" />
          <div className="provider-detail-skeleton-line long provider-detail-skeleton-shimmer" />
          <div className="provider-detail-skeleton-grid">
            <div className="provider-detail-skeleton-tile provider-detail-skeleton-shimmer" />
            <div className="provider-detail-skeleton-tile provider-detail-skeleton-shimmer" />
            <div className="provider-detail-skeleton-tile provider-detail-skeleton-shimmer" />
            <div className="provider-detail-skeleton-tile provider-detail-skeleton-shimmer" />
          </div>
        </div>
      </section>

      <div className="provider-detail-skeleton-tabs" aria-hidden="true">
        <span className="provider-detail-skeleton-tab provider-detail-skeleton-shimmer" />
        <span className="provider-detail-skeleton-tab provider-detail-skeleton-shimmer" />
        <span className="provider-detail-skeleton-tab provider-detail-skeleton-shimmer" />
        <span className="provider-detail-skeleton-tab provider-detail-skeleton-shimmer" />
      </div>
    </div>
  );
}

export function ProviderDetailPage() {
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useSessionStore((state) => state.user);
  const role = readRole(params.role);
  const providerId = Number(params.id || 0);
  const [actionSubmitting, setActionSubmitting] = useState<'follow' | 'favorite' | null>(null);
  const [actionNote, setActionNote] = useState<NoteState | null>(null);
  const [activeTab, setActiveTab] = useState<ProviderDetailTabId>('services');
  const [avatarSrc, setAvatarSrc] = useState('');

  const { data, loading, error, reload } = useAsyncData(async () => {
    if (!role || !providerId) throw new Error('服务商参数无效');
    const detail = await getProviderDetail(role, providerId);
    const status = user
      ? await getProviderUserStatus(providerId).catch(() => fallbackStatus)
      : fallbackStatus;
    return { detail, status };
  }, [role, providerId, user?.phone]);

  const detail = data?.detail;
  const status = data?.status || fallbackStatus;
  const currentPath = `${location.pathname}${location.search}`;
  const isForeman = detail?.role === 'foreman';
  const showAboutSection = detail ? detail.role !== 'foreman' : true;
  const tabItems = baseTabItems
    .filter((item) => {
      if (!detail) {
        return item.id !== 'scene';
      }
      if (!isForeman && item.id === 'scene') return false;
      if (!showAboutSection && item.id === 'about') return false;
      return true;
    })
    .map((item) => (item.id === 'cases' && isForeman ? { ...item, label: '工艺展示' } : item));
  const hasActiveTab = tabItems.some((item) => item.id === activeTab);

  useEffect(() => {
    if (!hasActiveTab) {
      setActiveTab('services');
    }
  }, [activeTab, hasActiveTab]);

  useEffect(() => {
    if (detail) {
      setAvatarSrc(detail.avatar || detail.coverImage);
    }
  }, [detail]);

  if (loading) return <ProviderDetailSkeleton />;

  if (error || !data || !role || !detail) {
    return (
      <div className="top-detail provider-detail-page">
        <section className="provider-detail-error">
          <ErrorBlock description={error || '服务商详情不存在'} onRetry={() => void reload()} />
        </section>
      </div>
    );
  }

  const isReferenceCompany = detail.role === 'company' && detail.isSettled === false;
  const canShowInteractiveActions = detail.role === 'designer' || (detail.role === 'company' && detail.isSettled !== false);
  const showBookingAction = canShowInteractiveActions && !isReferenceCompany;
  const areaSummary = formatServiceArea(detail.serviceArea);
  const totalReviewCount = detail.reviewStats.totalCount || detail.reviewCount || detail.reviews.length;
  const reviewCountText = totalReviewCount > 0 ? `${totalReviewCount} 条真实评价` : '暂无真实评价';
  const caseSectionTitle = isForeman ? '工艺展示' : '作品案例';
  const caseCountText = detail.cases.length > 0
    ? (isForeman ? `工艺展示 ${detail.cases.length} 项` : `公开案例 ${detail.cases.length} 套`)
    : (isForeman ? '当前暂无更多工艺展示' : '当前暂无更多公开案例');
  const summaryIntro = extractLeadText(detail.serviceIntro, 1, 88, detail.summary);
  const aboutCopy = extractLeadText(detail.serviceIntro, 3, 220, detail.summary);
  const reviewHighlights = getTopReviewTags(detail.reviews, 4);
  const displayTags = collectDisplayTags(detail, reviewHighlights);
  const bookingPath = `/providers/${detail.role}/${detail.id}/booking`;
  const serviceStageConfig = detail.role === 'designer'
    ? {
        firstTitle: '设计师能帮你做什么',
        firstItems: takeWithFallback(uniqTexts([
          '先梳理户型、动线、收纳与风格偏好',
          '围绕预算和生活方式明确空间重点',
          displayTags.length > 0 ? `重点可继续沟通 ${displayTags.slice(0, 3).join(' / ')}` : '',
        ]), [
          '支持功能布局和重点空间梳理',
          '支持风格方向与生活需求对齐',
          '支持围绕真实案例继续细化沟通',
        ], 3),
        secondTitle: '沟通与推进方式',
        secondItems: takeWithFallback(uniqTexts([
          '可按户型、预算、风格偏好逐步确认方案方向',
          '结合需求继续沟通平面、效果与交付深度',
          showBookingAction ? '确认意向后可提交预约需求继续一对一沟通' : '当前先以公开资料和案例作为决策参考',
        ]), [
          '先看案例，再进入具体沟通会更高效',
          '适合围绕重点空间逐步推进方案',
          '确认意向后再继续下一步沟通',
        ], 3),
        wideTitle: '合作流程与设计协作',
        wideBadge: '沟通流程',
        wideItems: [
          {
            title: '前期需求沟通',
            description: '围绕户型、常住人数、预算和想解决的问题先完成需求对齐。',
          },
          {
            title: '方案确认与修改',
            description: '在沟通中逐步确认平面、重点空间、材质和风格取舍，不需要一次说完所有细节。',
          },
          {
            title: '落地配合',
            description: '如继续合作，可继续衔接施工交底、材料建议与关键节点反馈。',
          },
        ],
      }
    : detail.role === 'company'
      ? {
          firstTitle: '装修公司能协助什么',
          firstItems: takeWithFallback(uniqTexts([
            '可先确认装修范围、交付方式与施工边界',
            '可结合户型、预算与工期评估整体推进方向',
            displayTags.length > 0 ? `可继续重点沟通 ${displayTags.slice(0, 3).join(' / ')}` : '',
          ]), [
            '支持前期需求梳理与范围确认',
            '支持设计、施工与交付方式判断',
            '支持围绕公开案例继续沟通',
          ], 3),
          secondTitle: '合作与推进方式',
          secondItems: takeWithFallback(uniqTexts([
            '适合先确认设计、施工、主材是否需要整体协同',
            '沟通中可继续明确预算边界、工期预期和交付分工',
            showBookingAction ? '确认意向后可提交预约需求继续推进' : '当前先浏览公开资料与案例做决策参考',
          ]), [
            '先明确合作边界，再继续推进更高效',
            '适合对照案例和评价判断是否匹配',
            '确认意向后再进入下一步沟通',
          ], 3),
          wideTitle: '合作流程与项目推进',
          wideBadge: '沟通流程',
          wideItems: [
            {
              title: '前期需求确认',
              description: '先明确装修范围、预算区间、工期预期以及是否需要设计施工一体化。',
            },
            {
              title: '方案与报价沟通',
              description: '围绕交付范围、节点安排和价格结构继续沟通，避免只看总价做判断。',
            },
            {
              title: '开工前对齐',
              description: '如继续合作，再把进场节奏、关键节点和验收方式提前说清楚。',
            },
          ],
        }
      : {
          firstTitle: '工长能推进什么',
          firstItems: takeWithFallback(uniqTexts([
            '可先核对现场条件、施工节点与工艺重点',
            '可围绕工期安排、进场顺序和配合边界继续沟通',
            displayTags.length > 0 ? `重点可继续确认 ${displayTags.slice(0, 3).join(' / ')}` : '',
          ]), [
            '支持施工范围与节点梳理',
            '支持工艺重点与现场问题沟通',
            '支持结合工艺展示继续判断',
          ], 3),
          secondTitle: '施工沟通方式',
          secondItems: takeWithFallback(uniqTexts([
            '适合先确认现场情况、关键工种衔接和验收节点',
            '施工中可持续围绕进度、整改和现场问题继续反馈',
            showBookingAction ? '确认意向后可提交预约需求继续沟通施工安排' : '当前先浏览公开资料和工艺展示做决策参考',
          ]), [
            '先看工艺展示，再谈施工安排更直接',
            '适合围绕节点验收持续沟通',
            '确认意向后再推进下一步安排',
          ], 3),
          wideTitle: '施工协同与沟通流程',
          wideBadge: '沟通流程',
          wideItems: [
            {
              title: '施工前沟通',
              description: '先确认施工范围、工艺重点、现场条件以及需要提前准备的事项。',
            },
            {
              title: '进场与节点协同',
              description: '围绕水电、泥木、油漆等关键节点继续确认现场安排和完成标准。',
            },
            {
              title: '验收与整改反馈',
              description: '施工过程中发现问题可及时回看节点、补充反馈并推动整改。',
            },
          ],
        };

  const scheduleBadge = isReferenceCompany
    ? '公开资料'
    : showBookingAction
      ? detail.surveyDepositPrice && detail.surveyDepositPrice > 0
        ? `意向金 ¥${detail.surveyDepositPrice}`
        : '支持预约'
      : '资料浏览';

  const scheduleDescription = isReferenceCompany
    ? '该商家尚未在平台入驻，当前仅展示公开整理后的资料，适合先做决策参考。'
    : detail.completedCount > 0
      ? `${detail.orgLabel}当前已公开完成 ${detail.completedCount} 个项目，可先提交预约需求，再继续确认合作细节。`
      : '当前可先浏览案例、服务内容和评价，再决定是否继续提交预约需求。';

  const favoriteLabel = status.isFavorited ? '已收藏' : `收藏该${detail.orgLabel}`;
  const followLabel = status.isFollowed ? '已关注该服务商' : '关注该服务商';

  const handleRequireAuth = () => {
    navigate(`/login?redirect=${encodeURIComponent(currentPath)}`);
  };

  const handleFollow = async () => {
    if (!user) {
      handleRequireAuth();
      return;
    }

    setActionNote(null);
    setActionSubmitting('follow');
    try {
      if (status.isFollowed) {
        await unfollowProvider(detail.id, detail.role);
        setActionNote({ text: '已取消关注。', tone: 'brand' });
      } else {
        await followProvider(detail.id, detail.role);
        setActionNote({ text: '已关注该服务商。', tone: 'success' });
      }
      await reload();
    } catch (actionError) {
      setActionNote({
        text: actionError instanceof Error ? actionError.message : '关注操作失败，请稍后重试。',
        tone: 'danger',
      });
    } finally {
      setActionSubmitting(null);
    }
  };

  const handleFavorite = async () => {
    if (!user) {
      handleRequireAuth();
      return;
    }

    setActionNote(null);
    setActionSubmitting('favorite');
    try {
      if (status.isFavorited) {
        await unfavoriteProvider(detail.id);
        setActionNote({ text: '已取消收藏。', tone: 'brand' });
      } else {
        await favoriteProvider(detail.id);
        setActionNote({ text: '已加入收藏。', tone: 'success' });
      }
      await reload();
    } catch (actionError) {
      setActionNote({
        text: actionError instanceof Error ? actionError.message : '收藏操作失败，请稍后重试。',
        tone: 'danger',
      });
    } finally {
      setActionSubmitting(null);
    }
  };

  const renderServicesPanel = () => (
    <div className="provider-detail-services-panel">
      <div className="provider-detail-service-grid">
        <article className="provider-detail-stage-card">
          <div className="provider-detail-stage-head">
            <span className="provider-detail-stage-icon"><IconGlyph kind="design" /></span>
            <h3>{serviceStageConfig.firstTitle}</h3>
          </div>
          <ul className="provider-detail-bullet-list">
            {serviceStageConfig.firstItems.map((item) => (
              <li key={item}>
                <span className="provider-detail-bullet-check">✓</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </article>

        <article className="provider-detail-stage-card">
          <div className="provider-detail-stage-head">
            <span className="provider-detail-stage-icon"><IconGlyph kind="guide" /></span>
            <h3>{serviceStageConfig.secondTitle}</h3>
          </div>
          <ul className="provider-detail-bullet-list">
            {serviceStageConfig.secondItems.map((item) => (
              <li key={item}>
                <span className="provider-detail-bullet-check">✓</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </article>

        <article className="provider-detail-stage-card provider-detail-stage-card--wide">
          <div className="provider-detail-stage-wide-head">
            <div className="provider-detail-stage-head provider-detail-stage-head--wide">
              <span className="provider-detail-stage-icon provider-detail-stage-icon--dark"><IconGlyph kind="value" /></span>
              <h3>{serviceStageConfig.wideTitle}</h3>
            </div>
            <span className="provider-detail-stage-badge">{serviceStageConfig.wideBadge}</span>
          </div>

          <div className="provider-detail-stage-feature-grid">
            {serviceStageConfig.wideItems.map((item) => (
              <article className="provider-detail-stage-feature" key={item.title}>
                <strong>{item.title}</strong>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </article>
      </div>
    </div>
  );

  const renderCasesPanel = () => {
    if (detail.cases.length === 0) {
      return (
        <div className="provider-detail-panel-card provider-detail-empty">
          <EmptyBlock description={isForeman ? '当前还没有可展示的施工节点或工艺图片。' : '当前还没有可展示的更多作品案例。'} title={isForeman ? '暂无工艺展示' : '暂无公开案例'} />
        </div>
      );
    }

    return (
      <div className="provider-detail-panel-stack">
        <div className="provider-detail-panel-headline">
          <h2>{caseSectionTitle}</h2>
          <p>{caseCountText}</p>
        </div>
        <div className="provider-detail-case-grid provider-detail-case-grid--uniform">
          {detail.cases.map((item) => (
            <article className="provider-detail-case-card provider-detail-case-card--uniform" key={item.id}>
              <div className="provider-detail-case-card-media">
                <img alt={item.title} className="provider-detail-case-card-image" src={item.coverImage} />
              </div>
              <div className="provider-detail-case-card-body provider-detail-case-card-body--plain">
                <h3>{item.title}</h3>
                <p>{isForeman ? '施工节点 · 现场工艺' : `${item.style} · ${item.area}`}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    );
  };

  const renderScenePanel = () => {
    if (!isForeman) {
      return null;
    }

    if (detail.cases.length === 0) {
      return (
        <div className="provider-detail-panel-card provider-detail-empty">
          <EmptyBlock description="当前还没有可展示的现场实拍图片。" title="暂无案例实景" />
        </div>
      );
    }

    return (
      <div className="provider-detail-panel-stack">
        <div className="provider-detail-panel-headline">
          <h2>案例实景</h2>
          <p>仅在商家详情页展示，不进入灵感图库</p>
        </div>
        <div className="provider-detail-case-grid provider-detail-case-grid--uniform">
          {detail.cases.map((item) => (
            <article className="provider-detail-case-card provider-detail-case-card--uniform" key={`scene-${item.id}`}>
              <div className="provider-detail-case-card-media">
                <img alt={item.title} className="provider-detail-case-card-image" src={item.coverImage} />
              </div>
              <div className="provider-detail-case-card-body provider-detail-case-card-body--plain">
                <h3>{item.title}</h3>
                <p>现场实拍 · 工艺节点</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    );
  };

  const renderReviewsPanel = () => (
    <div className="provider-detail-panel-stack">
      <div className="provider-detail-panel-headline">
        <h2>业主评价</h2>
        <p>{reviewCountText}</p>
      </div>

      <div className="provider-detail-review-summary">
        <article className="summary-card provider-detail-summary-card" data-highlight="true">
          <span>综合评分</span>
          <strong>{formatRating(detail.reviewStats.rating || detail.rating)}</strong>
          <p>{reviewCountText}</p>
        </article>
        <article className="summary-card provider-detail-summary-card">
          <span>累计评价</span>
          <strong>{totalReviewCount > 0 ? totalReviewCount : '暂无'}</strong>
          <p>持续沉淀口碑反馈</p>
        </article>
        <article className="summary-card provider-detail-summary-card">
          <span>还原度</span>
          <strong>{formatPercent(detail.reviewStats.restoreRate)}</strong>
          <p>基于现有评价统计</p>
        </article>
        <article className="summary-card provider-detail-summary-card">
          <span>预算控制</span>
          <strong>{formatPercent(detail.reviewStats.budgetControl)}</strong>
          <p>预算匹配表现</p>
        </article>
      </div>

      {reviewHighlights.length > 0 ? (
        <div className="provider-detail-review-highlights">
          <span className="provider-detail-review-highlights-label">高频反馈</span>
          {reviewHighlights.map((item) => (
            <span className="status-chip" key={item.tag}>
              {item.tag}
              <small>{item.count}</small>
            </span>
          ))}
        </div>
      ) : null}

      {detail.reviews.length === 0 ? (
        <div className="provider-detail-panel-card provider-detail-empty">
          <EmptyBlock description="当前还没有公开评价，后续签约业主反馈会展示在这里。" title="暂无业主评价" />
        </div>
      ) : null}

      <div className="provider-detail-review-list">
        {detail.reviews.map((review) => (
          <article className="provider-detail-review-card" key={review.id}>
            <div className="provider-detail-review-head">
              <div className="provider-detail-review-user">
                {review.userAvatar ? (
                  <img alt={review.userName} className="provider-detail-review-avatar" src={review.userAvatar} />
                ) : (
                  <div className="provider-detail-review-fallback">{review.userName.trim().charAt(0) || '禾'}</div>
                )}
                <div className="provider-detail-review-user-copy">
                  <h3>{review.userName}</h3>
                  <p>{review.createdAt || '评价时间待补充'}</p>
                </div>
              </div>
              <div className="provider-detail-review-rating">
                <strong>{formatRating(review.rating)}</strong>
                <span>口碑评分</span>
              </div>
            </div>
            <p className="provider-detail-review-content">{review.content}</p>
            {review.tags.length > 0 ? (
              <div className="provider-detail-review-tags">
                {review.tags.map((tag) => <span className="status-chip" key={tag}>{tag}</span>)}
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );

  const renderAboutPanel = () => (
    <div className="provider-detail-panel-stack">
      <div className="provider-detail-panel-headline">
        <h2>关于我们</h2>
      </div>
      <article className="provider-detail-panel-card provider-detail-about-card--single">
        <p className="provider-detail-about-copy">{aboutCopy}</p>
        {displayTags.length > 0 ? (
          <div className="provider-detail-certifications">
            {displayTags.map((item) => <span className="status-chip" key={item}>{item}</span>)}
          </div>
        ) : null}
      </article>
    </div>
  );

  const renderActivePanel = () => {
    switch (activeTab) {
      case 'services':
        return renderServicesPanel();
      case 'cases':
        return renderCasesPanel();
      case 'scene':
        return renderScenePanel();
      case 'reviews':
        return renderReviewsPanel();
      case 'about':
        return renderAboutPanel();
      default:
        return renderServicesPanel();
    }
  };

  return (
    <div className="top-detail provider-detail-page">
      <section className="provider-detail-summary">
        <div className="provider-detail-summary-inner">
          <div className="provider-detail-summary-avatar-wrap">
            <img
              alt={detail.name}
              className="provider-detail-summary-avatar"
              onError={() => {
                if (avatarSrc !== detail.coverImage) {
                  setAvatarSrc(detail.coverImage);
                }
              }}
              src={avatarSrc || detail.coverImage}
            />
          </div>

          <div className="provider-detail-summary-main">
            <div className="provider-detail-summary-copy">
              <div className="provider-detail-summary-heading-row">
                <h1>{detail.name}</h1>
                <div className="provider-detail-summary-badges">
                  <span className="status-chip provider-detail-chip-primary">{detail.orgLabel}</span>
                  {isReferenceCompany ? <span className="status-chip" data-tone="warning">公开资料</span> : null}
                  {!isReferenceCompany && detail.verified ? <span className="status-chip" data-tone="success">已实名认证</span> : null}
                </div>
              </div>
              <p>{summaryIntro}</p>
            </div>

            <div className="provider-detail-summary-stats">
              <article className="provider-detail-summary-stat provider-detail-summary-stat--rating">
                <span>综合评分</span>
                <div className="provider-detail-rating-line">
                  <strong>{formatRating(detail.reviewStats.rating || detail.rating)}</strong>
                  <div className="provider-detail-stars">{renderStars(detail.reviewStats.rating || detail.rating)}</div>
                </div>
              </article>

              <article className="provider-detail-summary-stat">
                <span>服务城市</span>
                <strong>{areaSummary}</strong>
              </article>

              <article className="provider-detail-summary-stat">
                <span>{detail.role === 'company' ? '机构信息' : '从业年限'}</span>
                <strong>{detail.role === 'company' ? detail.establishedText || '持续补充' : detail.yearsExperience > 0 ? `${detail.yearsExperience}年专业经验` : '经验待补充'}</strong>
              </article>

              <article className="provider-detail-summary-stat provider-detail-summary-stat--price">
                <span>价格参考</span>
                <strong>{detail.priceText}</strong>
              </article>
            </div>
          </div>
        </div>
      </section>

      <div className="provider-detail-shell">
        <div className="provider-detail-main-column">
          <section className="provider-detail-main-surface">
            <nav aria-label="详情切换" className="provider-detail-tabs-shell">
              <div className="provider-detail-tabs" role="tablist">
                {tabItems.map((item) => (
                  <button
                    aria-selected={activeTab === item.id}
                    className="provider-detail-tab"
                    data-active={activeTab === item.id}
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    role="tab"
                    type="button"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </nav>

            <section className="provider-detail-panel">
              {renderActivePanel()}
            </section>
          </section>
        </div>

        <aside className="provider-detail-side-column">
          <div className="provider-detail-side-sticky">
            <section className="provider-detail-aside-card provider-detail-aside-card--action">
              <div className="provider-detail-aside-head">
                <h2>预约档期</h2>
                <span className="provider-detail-aside-badge">{scheduleBadge}</span>
              </div>

              <p className="provider-detail-aside-copy">{scheduleDescription}</p>

              {showBookingAction ? (
                <div className="provider-detail-aside-actions">
                  <Link className="provider-detail-primary-action" state={{ from: currentPath }} to={bookingPath}>提交预约需求</Link>
                  <button className="provider-detail-secondary-action" disabled={actionSubmitting !== null} onClick={() => void handleFavorite()} type="button">
                    {actionSubmitting === 'favorite' ? '处理中…' : favoriteLabel}
                  </button>
                </div>
              ) : null}

              {actionNote ? <div className="status-note provider-detail-action-note" data-tone={actionNote.tone}>{actionNote.text}</div> : null}

              {!isReferenceCompany ? (
                <button className="button-link provider-detail-follow-link" disabled={actionSubmitting !== null} onClick={() => void handleFollow()} type="button">
                  {actionSubmitting === 'follow' ? '处理中…' : followLabel}
                </button>
              ) : null}

              <div className="provider-detail-aside-cert">
                <span className="provider-detail-aside-cert-icon"><IconGlyph kind="shield" /></span>
                <div>
                  <strong>{detail.verified ? '平台认证' : '资料说明'}</strong>
                  <p>{isReferenceCompany ? '资料已整理为公开参考信息。' : '资料已由平台核验，受平台保障协议保护。'}</p>
                </div>
              </div>
            </section>

            <section className="provider-detail-aside-card provider-detail-aside-card--address">
              <div className="provider-detail-aside-head">
                <h2>工作地址</h2>
              </div>

              <p className="provider-detail-address-text">{detail.officeAddress || `${areaSummary} · 线上沟通 / 同城到场`}</p>
            </section>
          </div>
        </aside>
      </div>
    </div>
  );
}
