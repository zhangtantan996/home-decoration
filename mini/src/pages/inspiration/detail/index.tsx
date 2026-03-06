import Taro, { useLoad } from '@tarojs/taro';
import { Image, ScrollView, Text, View } from '@tarojs/components';
import React, { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Empty } from '@/components/Empty';
import { Skeleton } from '@/components/Skeleton';
import type { InspirationCommentDTO, InspirationDetailDTO } from '@/services/dto';
import { inspirationService } from '@/services/inspiration';
import { useAuthStore } from '@/store/auth';
import { showErrorToast } from '@/utils/error';
import { getInspirationCoverImage, getInspirationGalleryImages } from '@/utils/inspirationImages';

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
    Taro.navigateTo({ url: '/pages/profile/index' });
    return false;
  };

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
      <View className="page bg-gray-50 min-h-screen p-md">
        <Skeleton height={280} className="mb-md" />
        <Skeleton height={120} className="mb-md" />
        <Skeleton height={180} />
      </View>
    );
  }

  if (!detail) {
    return (
      <View className="page bg-gray-50 min-h-screen p-md">
        <Empty description="未找到灵感内容" />
      </View>
    );
  }

  return (
    <View className="page page-inspiration-detail bg-gray-50 min-h-screen pb-xl">
      <ScrollView
        scrollY
        className="h-full"
        lowerThreshold={80}
        onScrollToLower={() => void loadMoreComments()}
      >
        <Card className="m-md" title={detail.title}>
          {coverImage ? (
            <Image
              src={coverImage}
              mode="aspectFill"
              style={{ width: '100%', height: '320rpx', borderRadius: '12rpx' }}
              onClick={() => handlePreviewImage(coverImage)}
            />
          ) : null}
          <View className="mt-md text-gray-500 text-sm">
            {detail.style || '未知风格'} · {detail.layout || '未知户型'} · {detail.area || '未知面积'}
          </View>
          <View className="mt-xs text-secondary text-sm">预算参考：¥{detail.price || 0}</View>
          {detail.author?.name ? <View className="mt-xs text-secondary text-sm">作者：{detail.author.name}</View> : null}
          {detail.description ? <View className="mt-md text-sm">{detail.description}</View> : null}

          {detail.images.length > 0 ? (
            <ScrollView scrollX className="mt-md" style={{ whiteSpace: 'nowrap' }}>
              {detail.images.map((image, index) => (
                <Image
                  key={`${image}-${index}`}
                  src={image}
                  mode="aspectFill"
                  style={{ width: '220rpx', height: '180rpx', borderRadius: '10rpx', display: 'inline-block', marginRight: '12rpx' }}
                  onClick={() => handlePreviewImage(image)}
                />
              ))}
            </ScrollView>
          ) : null}

          <View className="mt-md flex gap-sm">
            <Button size="sm" variant={detail.isLiked ? 'brand' : 'secondary'} onClick={handleLike} disabled={submitting}>
              点赞 {detail.likeCount || 0}
            </Button>
            <Button
              size="sm"
              variant={detail.isFavorited ? 'brand' : 'secondary'}
              onClick={handleFavorite}
              disabled={submitting}
            >
              {detail.isFavorited ? '已收藏' : '收藏'}
            </Button>
          </View>
        </Card>

        <Card className="m-md" title={`评论 (${detail.commentCount || 0})`}>
          <View className="mb-md">
            <View className="bg-gray-100 rounded p-sm mb-sm">
              <Text className="text-sm text-gray-700">{commentText || '输入评论内容后点击发布'}</Text>
            </View>
            <Button
              size="sm"
              variant="primary"
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
            >
              输入评论
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="ml-xs"
              onClick={() => void handleSubmitComment()}
              disabled={submitting}
              loading={submitting}
            >
              发布
            </Button>
          </View>

          {comments.length === 0 ? (
            <Empty description="暂无评论，快来抢沙发" />
          ) : (
            comments.map((item) => (
              <View key={item.id} className="mb-sm border-b border-gray-100 pb-sm">
                <View className="text-sm text-gray-700">{item.user?.name || '匿名用户'}</View>
                <View className="text-sm mt-xs">{item.content}</View>
                <View className="text-xs text-gray-500 mt-xs">
                  {item.createdAt ? new Date(item.createdAt).toLocaleString() : '-'}
                </View>
              </View>
            ))
          )}

          {loadingCommentsMore ? (
            <View className="text-center text-gray-400 text-xs py-sm">加载更多评论中...</View>
          ) : null}
          {!commentsHasMore && comments.length > 0 ? (
            <View className="text-center text-gray-400 text-xs py-sm">没有更多评论了</View>
          ) : null}
        </Card>
      </ScrollView>
    </View>
  );
}
