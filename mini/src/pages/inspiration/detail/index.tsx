import Taro, { useLoad, useShareAppMessage } from '@tarojs/taro';
import { Button as TaroButton, Image, ScrollView, Text, View } from '@tarojs/components';
import React, { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Empty } from '@/components/Empty';
import { Icon } from '@/components/Icon';
import { Skeleton } from '@/components/Skeleton';
import { Tag } from '@/components/Tag';
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

  useLoad((options) => {
    if (options.id) {
      setId(Number(options.id));
    }
  });

  const previewImages = useMemo(() => {
    if (!detail) {
      return [];
    }

    return getInspirationGalleryImages(detail);
  }, [detail]);

  const coverImage = useMemo(() => {
    if (!detail) {
      return '';
    }

    return getInspirationCoverImage(detail);
  }, [detail]);

  const handlePreviewImage = (current: string) => {
    if (!current || previewImages.length === 0) {
      return;
    }

    Taro.previewImage({
      current,
      urls: previewImages,
    });
  };

  const fetchDetail = async (): Promise<InspirationDetailDTO | null> => {
    if (!id) {
      return null;
    }

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
    if (!id || !commentsHasMore || loadingCommentsMore || loading) {
      return;
    }

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
    if (!id) {
      return;
    }

    const cachedDraft = Taro.getStorageSync(getCommentDraftKey(id));
    setCommentText(typeof cachedDraft === 'string' ? cachedDraft : '');
    void fetchDetail();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!id) {
      return;
    }

    const draftKey = getCommentDraftKey(id);
    if (!commentText.trim()) {
      Taro.removeStorageSync(draftKey);
      return;
    }

    Taro.setStorageSync(draftKey, commentText);
  }, [id, commentText]);

  const ensureAuth = () => {
    if (auth.token) {
      return true;
    }
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
    if (!detail || !ensureAuth() || submitting) {
      return;
    }

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
    if (!detail || !ensureAuth() || submitting) {
      return;
    }

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
    if (!detail || !ensureAuth() || submitting) {
      return;
    }

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

  if (loading) {
    return (
      <View className="inspiration-detail-page inspiration-detail-page--loading">
        <Skeleton height={520} />
        <Skeleton height={180} className="inspiration-detail-page__loading-card" />
        <Skeleton height={260} className="inspiration-detail-page__loading-card" />
      </View>
    );
  }

  if (!detail) {
    return (
      <View className="inspiration-detail-page inspiration-detail-page--empty">
        <Empty description="未找到灵感内容" action={{ text: '返回灵感页', onClick: handleBack }} />
      </View>
    );
  }

  const detailTags = [detail.style, detail.layout, detail.area].filter(Boolean);

  return (
    <View className="page-inspiration-detail inspiration-detail-page">
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
        <View className="inspiration-detail-page__nav" style={{ paddingTop: `${(Taro.getSystemInfoSync().statusBarHeight || 24) + 12}px` }}>
          <View className="inspiration-detail-page__nav-button" onClick={handleBack}>
            <Icon name="arrow-left" size={26} color="#ffffff" />
          </View>
          <TaroButton className="inspiration-detail-page__nav-button" openType="share">
            <Icon name="share" size={24} color="#ffffff" />
          </TaroButton>
        </View>
      </View>

      <ScrollView
        scrollY
        className="inspiration-detail-page__scroll"
        lowerThreshold={80}
        onScrollToLower={() => void loadMoreComments()}
      >
        <View className="inspiration-detail-page__content">
          <Card className="inspiration-detail-page__card">
            <View className="inspiration-detail-page__section">
              <Text className="inspiration-detail-page__title">{detail.title}</Text>
              <View className="inspiration-detail-page__tag-row">
                {detailTags.map((item) => (
                  <Tag key={item} variant="secondary">{item}</Tag>
                ))}
              </View>
              <Text className="inspiration-detail-page__price">预算参考：¥{Number(detail.price || 0).toLocaleString()}</Text>
            </View>
          </Card>

          {detail.author?.name ? (
            <Card className="inspiration-detail-page__card">
              <View className="inspiration-detail-page__section inspiration-detail-page__author">
                {detail.author.avatar ? (
                  <Image className="inspiration-detail-page__author-avatar" src={detail.author.avatar} mode="aspectFill" lazyLoad />
                ) : (
                  <View className="inspiration-detail-page__author-avatar inspiration-detail-page__author-avatar--placeholder" />
                )}
                <View className="inspiration-detail-page__author-main">
                  <Text className="inspiration-detail-page__author-name">{detail.author.name}</Text>
                  <Text className="inspiration-detail-page__author-subtitle">案例作者 · 灵感分享</Text>
                </View>
              </View>
            </Card>
          ) : null}

          {detail.description ? (
            <Card className="inspiration-detail-page__card">
              <View className="inspiration-detail-page__section">
                <Text className="inspiration-detail-page__section-title">设计说明</Text>
                <Text className="inspiration-detail-page__description">{detail.description}</Text>
              </View>
            </Card>
          ) : null}

          {detail.images.length > 0 ? (
            <Card className="inspiration-detail-page__card">
              <View className="inspiration-detail-page__section">
                <Text className="inspiration-detail-page__section-title">空间画廊</Text>
                <View className="inspiration-detail-page__gallery">
                  {detail.images.map((image, index) => (
                    <Image
                      key={`${image}-${index}`}
                      src={image}
                      mode="aspectFill"
                      className="inspiration-detail-page__gallery-image"
                      onClick={() => handlePreviewImage(image)}
                    />
                  ))}
                </View>
              </View>
            </Card>
          ) : null}

          <Card className="inspiration-detail-page__card">
            <View className="inspiration-detail-page__section">
              <View className="inspiration-detail-page__comment-head">
                <Text className="inspiration-detail-page__section-title">评论区</Text>
                <Text className="inspiration-detail-page__comment-count">{detail.commentCount || 0} 条</Text>
              </View>

              <View className="inspiration-detail-page__comment-entry">
                <Text className="inspiration-detail-page__comment-entry-text">{commentText || '说说你的看法，发布后会展示在评论区。'}</Text>
              </View>

              {comments.length === 0 ? (
                <Empty description="暂无评论，快来抢沙发" />
              ) : (
                comments.map((item) => (
                  <View key={item.id} className="inspiration-detail-page__comment-card">
                    <Text className="inspiration-detail-page__comment-user">{item.user?.name || '匿名用户'}</Text>
                    <Text className="inspiration-detail-page__comment-content">{item.content}</Text>
                    <Text className="inspiration-detail-page__comment-time">
                      {formatServerDateTime(item.createdAt)}
                    </Text>
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
          </Card>
        </View>
      </ScrollView>

      <View className="inspiration-detail-page__footer">
        <Button
          size="sm"
          variant={detail.isLiked ? 'primary' : 'secondary'}
          className="inspiration-detail-page__footer-button"
          onClick={handleLike}
          disabled={submitting}
        >
          点赞 {detail.likeCount || 0}
        </Button>
        <Button
          size="sm"
          variant={detail.isFavorited ? 'primary' : 'secondary'}
          className="inspiration-detail-page__footer-button"
          onClick={handleFavorite}
          disabled={submitting}
        >
          {detail.isFavorited ? '已收藏' : '收藏'}
        </Button>
        <Button
          size="sm"
          className="inspiration-detail-page__footer-button"
          onClick={() => {
            Taro.showModal({
              title: '发布评论',
              editable: true,
              placeholderText: commentText || '请输入评论内容',
              success: (res) => {
                if (!res.confirm) {
                  return;
                }

                const nextContent = (res.content || '').trim();
                if (!nextContent) {
                  Taro.showToast({ title: '请输入评论内容', icon: 'none' });
                  return;
                }

                setCommentText(nextContent);
                void handleSubmitComment(nextContent);
              },
            });
          }}
          disabled={submitting}
        >
          评论
        </Button>
      </View>
    </View>
  );
}
