import Taro, { useLoad, useReachBottom } from '@tarojs/taro';
import { Image, Text, View } from '@tarojs/components';
import { useEffect, useState } from 'react';

import { Empty } from '@/components/Empty';
import MiniPageNav from '@/components/MiniPageNav';
import { Skeleton } from '@/components/Skeleton';
import type { InspirationCommentDTO } from '@/services/dto';
import { inspirationService } from '@/services/inspiration';
import { useAuthStore } from '@/store/auth';
import { showErrorToast } from '@/utils/error';
import { formatServerDateTime } from '@/utils/serverTime';

import './index.scss';

const REPLY_PAGE_SIZE = 20;

export default function CommentDetailPage() {
  const auth = useAuthStore();
  const [commentId, setCommentId] = useState<number>(0);
  const [caseId, setCaseId] = useState<number>(0);
  const [comment, setComment] = useState<InspirationCommentDTO | null>(null);
  const [replies, setReplies] = useState<InspirationCommentDTO[]>([]);
  const [replyText, setReplyText] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [repliesPage, setRepliesPage] = useState(1);
  const [repliesHasMore, setRepliesHasMore] = useState(true);
  const [loadingRepliesMore, setLoadingRepliesMore] = useState(false);
  const [replyToUser, setReplyToUser] = useState<{ id: number; name: string } | null>(null);

  useLoad((options) => {
    if (options.id && options.caseId) {
      setCommentId(Number(options.id));
      setCaseId(Number(options.caseId));
    }
  });

  useEffect(() => {
    if (commentId && caseId) {
      void fetchCommentDetail();
    }
  }, [commentId, caseId]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchCommentDetail = async () => {
    if (!commentId || !caseId) return;

    setLoading(true);
    try {
      const [commentRes, repliesRes] = await Promise.all([
        inspirationService.getCommentDetail(commentId),
        inspirationService.getCommentReplies(commentId, { page: 1, pageSize: REPLY_PAGE_SIZE }),
      ]);

      const firstReplies = repliesRes.list || [];
      setComment(commentRes);
      setReplies(firstReplies);
      setRepliesPage(2);

      const hasMoreByTotal = (repliesRes.total || 0) > REPLY_PAGE_SIZE;
      setRepliesHasMore(hasMoreByTotal || firstReplies.length === REPLY_PAGE_SIZE);
    } catch (error) {
      showErrorToast(error, '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const loadMoreReplies = async () => {
    if (!commentId || !repliesHasMore || loadingRepliesMore || loading) return;

    const currentPage = repliesPage;
    setLoadingRepliesMore(true);

    try {
      const repliesRes = await inspirationService.getCommentReplies(commentId, {
        page: currentPage,
        pageSize: REPLY_PAGE_SIZE,
      });

      const incoming = repliesRes.list || [];
      setReplies((prev) => [...prev, ...incoming]);
      setRepliesPage(currentPage + 1);

      const hasMoreByTotal = (repliesRes.total || 0) > currentPage * REPLY_PAGE_SIZE;
      setRepliesHasMore(hasMoreByTotal || incoming.length === REPLY_PAGE_SIZE);
    } catch (error) {
      showErrorToast(error, '加载更多回复失败');
    } finally {
      setLoadingRepliesMore(false);
    }
  };

  useReachBottom(() => {
    void loadMoreReplies();
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

  const handleReplyTo = (user: { id: number; name: string }) => {
    setReplyToUser(user);
    openReplyComposer();
  };

  const handleSubmitReply = async (content: string) => {
    if (!comment || !ensureAuth() || submitting) return;

    const trimmedContent = content.trim();
    if (!trimmedContent) {
      Taro.showToast({ title: '请输入回复内容', icon: 'none' });
      return;
    }

    setSubmitting(true);
    try {
      await inspirationService.replyComment(comment.id, {
        content: trimmedContent,
        replyToUserId: replyToUser?.id,
      });

      Taro.showToast({ title: '回复成功', icon: 'success' });
      setReplyText('');
      setReplyToUser(null);

      // 刷新回复列表
      await fetchCommentDetail();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('敏感词')) {
        Taro.showToast({ title: '回复包含敏感词，请修改后重试', icon: 'none', duration: 2500 });
      } else {
        showErrorToast(error, '回复失败');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const openReplyComposer = () => {
    const placeholder = replyToUser ? `回复 @${replyToUser.name}` : '请输入回复内容';

    Taro.showModal({
      title: '发布回复',
      editable: true,
      placeholderText: placeholder,
      success: (res: { confirm: boolean; content?: string }) => {
        if (!res.confirm) {
          setReplyToUser(null);
          return;
        }

        const nextContent = (res.content || '').trim();
        if (!nextContent) {
          Taro.showToast({ title: '请输入回复内容', icon: 'none' });
          setReplyToUser(null);
          return;
        }

        void handleSubmitReply(nextContent);
      },
    } as any);
  };

  if (loading) {
    return (
      <View className="comment-detail-page comment-detail-page--loading">
        <MiniPageNav title="评论详情" onBack={handleBack} placeholder />
        <Skeleton height={200} className="comment-detail-page__loading-card" />
        <Skeleton height={140} className="comment-detail-page__loading-card" />
        <Skeleton height={140} className="comment-detail-page__loading-card" />
      </View>
    );
  }

  if (!comment) {
    return (
      <View className="comment-detail-page comment-detail-page--empty">
        <MiniPageNav title="评论详情" onBack={handleBack} placeholder />
        <Empty description="未找到评论" action={{ text: '返回', onClick: handleBack }} />
      </View>
    );
  }

  return (
    <View className="page-comment-detail comment-detail-page">
      <MiniPageNav title="评论详情" onBack={handleBack} placeholder />

      <View className="comment-detail-page__content">
        <View className="comment-detail-page__original-comment">
          <View className="comment-detail-page__comment-head">
            {comment.user?.avatar ? (
              <Image className="comment-detail-page__comment-avatar" src={comment.user.avatar} mode="aspectFill" lazyLoad />
            ) : (
              <View className="comment-detail-page__comment-avatar comment-detail-page__comment-avatar--placeholder" />
            )}
            <View className="comment-detail-page__comment-user-meta">
              <Text className="comment-detail-page__comment-user">{comment.user?.name || '匿名用户'}</Text>
              <Text className="comment-detail-page__comment-time">
                {formatServerDateTime(comment.createdAt)}
              </Text>
            </View>
          </View>
          <Text className="comment-detail-page__comment-content">{comment.content}</Text>
        </View>

        <View className="comment-detail-page__replies-section">
          <Text className="comment-detail-page__section-title">全部回复 ({replies.length})</Text>

          {replies.length === 0 ? (
            <Empty description="暂无回复" />
          ) : (
            replies.map((reply) => (
              <View key={reply.id} className="comment-detail-page__reply-card">
                <View className="comment-detail-page__comment-head">
                  {reply.user?.avatar ? (
                    <Image className="comment-detail-page__comment-avatar" src={reply.user.avatar} mode="aspectFill" lazyLoad />
                  ) : (
                    <View className="comment-detail-page__comment-avatar comment-detail-page__comment-avatar--placeholder" />
                  )}
                  <View className="comment-detail-page__comment-user-meta">
                    <Text className="comment-detail-page__comment-user">{reply.user?.name || '匿名用户'}</Text>
                    <Text className="comment-detail-page__comment-time">
                      {formatServerDateTime(reply.createdAt)}
                    </Text>
                  </View>
                </View>
                <Text className="comment-detail-page__comment-content">{reply.content}</Text>
                <View className="comment-detail-page__reply-footer">
                  <View
                    className="comment-detail-page__reply-btn"
                    onClick={() => handleReplyTo({ id: reply.user?.id || 0, name: reply.user?.name || '匿名用户' })}
                  >
                    <Text className="comment-detail-page__reply-text">回复</Text>
                  </View>
                </View>
              </View>
            ))
          )}

          {loadingRepliesMore ? (
            <View className="comment-detail-page__tip">加载更多回复中...</View>
          ) : null}
          {!repliesHasMore && replies.length > 0 ? (
            <View className="comment-detail-page__tip">没有更多回复了</View>
          ) : null}
        </View>
      </View>

      <View className="comment-detail-page__footer">
        <View className="comment-detail-page__footer-action" onClick={openReplyComposer}>
          <Text className="comment-detail-page__footer-action-text">发布回复</Text>
        </View>
      </View>
    </View>
  );
}

