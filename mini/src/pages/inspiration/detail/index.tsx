import Taro, { useLoad, usePageScroll, useReachBottom, useShareAppMessage } from '@tarojs/taro';
import { Image, Text, View } from '@tarojs/components';
import { useEffect, useMemo, useState } from 'react';

import { Empty } from '@/components/Empty';
import MiniPageNav from '@/components/MiniPageNav';
import { Skeleton } from '@/components/Skeleton';
import type { InspirationCommentDTO, InspirationDetailDTO } from '@/services/dto';
import { inspirationService } from '@/services/inspiration';
import { useAuthStore } from '@/store/auth';
import { showErrorToast } from '@/utils/error';
import { getInspirationCoverImage, getInspirationGalleryImages } from '@/utils/inspirationImages';
import { formatServerDateTime } from '@/utils/serverTime';

import './index.scss';

const INSPIRATION_CASE_SYNC_KEY = 'inspiration_case_sync';
const COMMENT_DRAFT_KEY_PREFIX = 'inspiration_comment_draft_';
const COMMENT_PAGE_SIZE = 20;
const NAV_SCROLL_DISTANCE = 180;

interface InspirationCaseSyncPayload {
  id: number;
  isLiked?: boolean;
  likeCount?: number;
  isFavorited?: boolean;
  commentCount?: number;
}

const getCommentDraftKey = (inspirationId: number) => `${COMMENT_DRAFT_KEY_PREFIX}${inspirationId}`;

const mergeSyncPayload = (payload: InspirationCaseSyncPayload) => {
  const exists = Taro.getStorageSync(INSPIRATION_CASE_SYNC_KEY) as Partial<InspirationCaseSyncPayload> | undefined;
  if (exists && typeof exists.id === 'number' && exists.id === payload.id) {
    Taro.setStorageSync(INSPIRATION_CASE_SYNC_KEY, { ...exists, ...payload });
    return;
  }

  Taro.setStorageSync(INSPIRATION_CASE_SYNC_KEY, payload);
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const formatAreaText = (value?: string) => {
  if (!value) return '暂无';
  return value.includes('㎡') ? value : `${value}㎡`;
};

const buildFooterActionClass = (base: string, active?: boolean, primary?: boolean) => {
  return [
    base,
    active ? `${base}--active` : '',
    primary ? `${base}--primary` : '',
  ].filter(Boolean).join(' ');
};

export default function InspirationDetailPage() {
  const auth = useAuthStore();
  const [id, setId] = useState<number>(0);
  const [detail, setDetail] = useState<InspirationDetailDTO | null>(null);
  const [comments, setComments] = useState<InspirationCommentDTO[]>([]);
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [commentsPage, setCommentsPage] = useState(1);
  const [commentsHasMore, setCommentsHasMore] = useState(true);
  const [loadingCommentsMore, setLoadingCommentsMore] = useState(false);
  const [navProgress, setNavProgress] = useState(0);

  useLoad((options) => {
    if (options.id) {
      setId(Number(options.id));
    }
  });

  usePageScroll(({ scrollTop }) => {
    const next = clamp(scrollTop / NAV_SCROLL_DISTANCE, 0, 1);
    setNavProgress((prev) => (Math.abs(prev - next) < 0.01 ? prev : next));
  });

  const previewImages = useMemo(() => {
    if (!detail) return [];
    return getInspirationGalleryImages(detail);
  }, [detail]);

  const coverImage = useMemo(() => {
    if (!detail) return '';
    return getInspirationCoverImage(detail);
  }, [detail]);

  const handlePreviewImage = (current: string) => {
    if (!current || previewImages.length === 0) return;

    Taro.previewImage({
      current,
      urls: previewImages,
    });
  };

  const fetchDetail = async (): Promise<InspirationDetailDTO | null> => {
    if (!id) return null;

    setLoading(true);
    try {
      const [detailRes, commentsRes] = await Promise.all([
        inspirationService.detail(id),
        inspirationService.comments(id, { page: 1, pageSize: COMMENT_PAGE_SIZE }),
      ]);

      const firstComments = commentsRes.list || [];
      setDetail(detailRes);
      setComments(firstComments);
      setCommentsPage(2);

      const hasMoreByTotal = (commentsRes.total || 0) > COMMENT_PAGE_SIZE;
      setCommentsHasMore(hasMoreByTotal || firstComments.length === COMMENT_PAGE_SIZE);
      return detailRes;
    } catch (error) {
      showErrorToast(error, '加载失败');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const loadMoreComments = async () => {
    if (!id || !commentsHasMore || loadingCommentsMore || loading) return;

    const currentPage = commentsPage;
    setLoadingCommentsMore(true);

    try {
      const commentsRes = await inspirationService.comments(id, {
        page: currentPage,
        pageSize: COMMENT_PAGE_SIZE,
      });

      const incoming = commentsRes.list || [];
      setComments((prev) => [...prev, ...incoming]);
      setCommentsPage(currentPage + 1);

      const hasMoreByTotal = (commentsRes.total || 0) > currentPage * COMMENT_PAGE_SIZE;
      setCommentsHasMore(hasMoreByTotal || incoming.length === COMMENT_PAGE_SIZE);
    } catch (error) {
      showErrorToast(error, '加载更多评论失败');
    } finally {
      setLoadingCommentsMore(false);
    }
  };

  useEffect(() => {
    if (!id) return;

    const cachedDraft = Taro.getStorageSync(getCommentDraftKey(id));
    setCommentText(typeof cachedDraft === 'string' ? cachedDraft : '');
    void fetchDetail();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!id) return;

    const draftKey = getCommentDraftKey(id);
    if (!commentText.trim()) {
      Taro.removeStorageSync(draftKey);
      return;
    }

    Taro.setStorageSync(draftKey, commentText);
  }, [id, commentText]);

  useReachBottom(() => {
    void loadMoreComments();
  });

  const ensureAuth = () => {
    if (auth.token) return true;
    Taro.switchTab({ url: '/pages/profile/index' });
    return false;
  };

  const handleBack = () => {
    if (Taro.getCurrentPages().length > 1) {
      Taro.navigateBack();
      return;
    }
    Taro.switchTab({ url: '/pages/inspiration/index' });
  };

  useShareAppMessage(() => ({
    title: detail?.title || '灵感详情',
    path: `/pages/inspiration/detail/index?id=${id}`,
    imageUrl: coverImage || undefined,
  }));

  const handleLike = async () => {
    if (!detail || !ensureAuth() || submitting) return;

    setSubmitting(true);
    const originLiked = detail.isLiked;
    const originCount = detail.likeCount;
    const nextLiked = !originLiked;
    const nextLikeCount = originLiked ? Math.max(0, originCount - 1) : originCount + 1;

    setDetail({
      ...detail,
      isLiked: nextLiked,
      likeCount: nextLikeCount,
    });

    try {
      if (originLiked) {
        await inspirationService.unlike(detail.id);
      } else {
        await inspirationService.like(detail.id);
      }

      mergeSyncPayload({
        id: detail.id,
        isLiked: nextLiked,
        likeCount: nextLikeCount,
        isFavorited: detail.isFavorited,
        commentCount: detail.commentCount,
      });
    } catch (error) {
      setDetail({ ...detail, isLiked: originLiked, likeCount: originCount });
      showErrorToast(error, '点赞失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFavorite = async () => {
    if (!detail || !ensureAuth() || submitting) return;

    setSubmitting(true);
    const originFavorited = detail.isFavorited;
    const nextFavorited = !originFavorited;
    setDetail({ ...detail, isFavorited: nextFavorited });

    try {
      if (originFavorited) {
        await inspirationService.unfavorite(detail.id);
      } else {
        await inspirationService.favorite(detail.id);
      }

      mergeSyncPayload({
        id: detail.id,
        isFavorited: nextFavorited,
        isLiked: detail.isLiked,
        likeCount: detail.likeCount,
        commentCount: detail.commentCount,
      });
    } catch (error) {
      setDetail({ ...detail, isFavorited: originFavorited });
      showErrorToast(error, '收藏失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitComment = async (rawContent?: string) => {
    if (!detail || !ensureAuth() || submitting) return;

    const content = (rawContent ?? commentText).trim();
    if (!content) {
      Taro.showToast({ title: '请输入评论内容', icon: 'none' });
      return;
    }

    setSubmitting(true);
    try {
      await inspirationService.createComment(detail.id, content);
      setCommentText('');
      Taro.removeStorageSync(getCommentDraftKey(detail.id));
      Taro.showToast({ title: '评论成功', icon: 'success' });

      const latest = await fetchDetail();
      if (latest) {
        mergeSyncPayload({
          id: latest.id,
          isLiked: latest.isLiked,
          likeCount: latest.likeCount,
          isFavorited: latest.isFavorited,
          commentCount: latest.commentCount,
        });
      }
    } catch (error) {
      showErrorToast(error, '评论失败');
    } finally {
      setSubmitting(false);
    }
  };

  const openCommentComposer = () => {
    Taro.showModal({
      title: '发布评论',
      editable: true,
      placeholderText: commentText || '请输入评论内容',
      success: (res: { confirm: boolean; content?: string }) => {
        if (!res.confirm) return;

        const nextContent = (res.content || '').trim();
        if (!nextContent) {
          Taro.showToast({ title: '请输入评论内容', icon: 'none' });
          return;
        }

        setCommentText(nextContent);
        void handleSubmitComment(nextContent);
      },
    } as any);
  };

  const solidNav = <MiniPageNav title="灵感详情" onBack={handleBack} placeholder />;

  if (loading) {
    return (
      <View className="inspiration-detail-page inspiration-detail-page--loading">
        {solidNav}
        <Skeleton height={560} />
        <Skeleton height={240} className="inspiration-detail-page__loading-card inspiration-detail-page__loading-card--hero" />
        <Skeleton height={140} className="inspiration-detail-page__loading-card" />
        <Skeleton height={240} className="inspiration-detail-page__loading-card" />
      </View>
    );
  }

  if (!detail) {
    return (
      <View className="inspiration-detail-page inspiration-detail-page--empty">
        {solidNav}
        <Empty description="未找到灵感内容" action={{ text: '返回灵感页', onClick: handleBack }} />
      </View>
    );
  }

  const fixedNav = <MiniPageNav title={detail.title || '灵感详情'} onBack={handleBack} variant="overlay" progress={navProgress} />;
  const summaryItems = [
    { label: '户型', value: detail.layout || '暂无' },
    { label: '面积', value: formatAreaText(detail.area) },
    { label: '风格', value: detail.style || '暂无' },
  ];

  return (
    <View className="page-inspiration-detail inspiration-detail-page">
      {fixedNav}

      <View className="inspiration-detail-page__hero">
        {coverImage ? (
          <Image
            src={coverImage}
            mode="aspectFill"
            className="inspiration-detail-page__hero-image"
            onClick={() => handlePreviewImage(coverImage)}
          />
        ) : (
          <View className="inspiration-detail-page__hero-placeholder" />
        )}
        <View className="inspiration-detail-page__hero-mask" />
      </View>

      <View className="inspiration-detail-page__content">
        <View className="inspiration-detail-page__summary-card">
          <Text className="inspiration-detail-page__summary-kicker">灵感案例</Text>
          <Text className="inspiration-detail-page__title">{detail.title}</Text>

          <View className="inspiration-detail-page__price-row">
            <Text className="inspiration-detail-page__price-label">预算参考</Text>
            <Text className="inspiration-detail-page__price-value">¥{Number(detail.price || 0).toLocaleString()}</Text>
          </View>

          <View className="inspiration-detail-page__summary-divider" />

          <View className="inspiration-detail-page__summary-grid">
            {summaryItems.map((item, index) => (
              <View key={item.label} className="inspiration-detail-page__summary-grid-item">
                {index > 0 ? <View className="inspiration-detail-page__summary-grid-divider" /> : null}
                <Text className="inspiration-detail-page__summary-grid-label">{item.label}</Text>
                <Text className="inspiration-detail-page__summary-grid-value" numberOfLines={1}>{item.value}</Text>
              </View>
            ))}
          </View>
        </View>

        {detail.author?.name ? (
          <View className="inspiration-detail-page__module-card inspiration-detail-page__author-card">
            {detail.author.avatar ? (
              <Image className="inspiration-detail-page__author-avatar" src={detail.author.avatar} mode="aspectFill" lazyLoad />
            ) : (
              <View className="inspiration-detail-page__author-avatar inspiration-detail-page__author-avatar--placeholder" />
            )}
            <View className="inspiration-detail-page__author-main">
              <Text className="inspiration-detail-page__author-name">{detail.author.name}</Text>
              <Text className="inspiration-detail-page__author-subtitle">案例作者 · 灵感分享</Text>
            </View>
            <View className="inspiration-detail-page__author-badge">
              <Text className="inspiration-detail-page__author-badge-text">作者</Text>
            </View>
          </View>
        ) : null}

        {detail.description ? (
          <View className="inspiration-detail-page__module-card">
            <View className="inspiration-detail-page__section-head">
              <Text className="inspiration-detail-page__section-title">设计说明</Text>
              <Text className="inspiration-detail-page__section-caption">空间细节与思路</Text>
            </View>
            <Text className="inspiration-detail-page__description">{detail.description}</Text>
          </View>
        ) : null}

        {detail.images.length > 0 ? (
          <View className="inspiration-detail-page__module-card">
            <View className="inspiration-detail-page__section-head">
              <Text className="inspiration-detail-page__section-title">空间画廊</Text>
              <Text className="inspiration-detail-page__section-caption">{detail.images.length} 张图片</Text>
            </View>
            <View className="inspiration-detail-page__gallery">
              {detail.images.map((image, index) => (
                <View key={`${image}-${index}`} className="inspiration-detail-page__gallery-item">
                  <Text className="inspiration-detail-page__gallery-index">{String(index + 1).padStart(2, '0')}</Text>
                  <Image
                    src={image}
                    mode="aspectFill"
                    className="inspiration-detail-page__gallery-image"
                    onClick={() => handlePreviewImage(image)}
                  />
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View className="inspiration-detail-page__module-card inspiration-detail-page__comments-card">
          <View className="inspiration-detail-page__section-head">
            <Text className="inspiration-detail-page__section-title">评论区</Text>
            <Text className="inspiration-detail-page__section-caption">{detail.commentCount || 0} 条</Text>
          </View>

          <View className="inspiration-detail-page__comment-entry" onClick={openCommentComposer}>
            <Text className="inspiration-detail-page__comment-entry-text">
              {commentText || '说说你的看法，发布后会展示在评论区。'}
            </Text>
          </View>

          {comments.length === 0 ? (
            <Empty description="暂无评论，快来抢沙发" />
          ) : (
            comments.map((item) => (
              <View key={item.id} className="inspiration-detail-page__comment-card">
                <View className="inspiration-detail-page__comment-head">
                  {item.user?.avatar ? (
                    <Image className="inspiration-detail-page__comment-avatar" src={item.user.avatar} mode="aspectFill" lazyLoad />
                  ) : (
                    <View className="inspiration-detail-page__comment-avatar inspiration-detail-page__comment-avatar--placeholder" />
                  )}
                  <View className="inspiration-detail-page__comment-user-meta">
                    <Text className="inspiration-detail-page__comment-user">{item.user?.name || '匿名用户'}</Text>
                    <Text className="inspiration-detail-page__comment-time">
                      {formatServerDateTime(item.createdAt)}
                    </Text>
                  </View>
                </View>
                <Text className="inspiration-detail-page__comment-content">{item.content}</Text>
              </View>
            ))
          )}

          {loadingCommentsMore ? (
            <View className="inspiration-detail-page__comment-tip">加载更多评论中...</View>
          ) : null}
          {!commentsHasMore && comments.length > 0 ? (
            <View className="inspiration-detail-page__comment-tip">没有更多评论了</View>
          ) : null}
        </View>
      </View>

      <View className="inspiration-detail-page__footer">
        <View
          className={buildFooterActionClass('inspiration-detail-page__footer-action', detail.isLiked)}
          onClick={handleLike}
        >
          <Text className={buildFooterActionClass('inspiration-detail-page__footer-action-text', detail.isLiked)}>
            点赞 {detail.likeCount || 0}
          </Text>
        </View>
        <View
          className={buildFooterActionClass('inspiration-detail-page__footer-action', detail.isFavorited)}
          onClick={handleFavorite}
        >
          <Text className={buildFooterActionClass('inspiration-detail-page__footer-action-text', detail.isFavorited)}>
            {detail.isFavorited ? '已收藏' : '收藏'}
          </Text>
        </View>
        <View
          className={buildFooterActionClass('inspiration-detail-page__footer-action', false, true)}
          onClick={openCommentComposer}
        >
          <Text className={buildFooterActionClass('inspiration-detail-page__footer-action-text', false, true)}>
            评论
          </Text>
        </View>
      </View>
    </View>
  );
}
