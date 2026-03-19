import React, { useEffect, useMemo, useState } from 'react';
import Taro, { useLoad } from '@tarojs/taro';
import { Input, ScrollView, Text, View } from '@tarojs/components';

import { Button } from '@/components/Button';
import { Empty } from '@/components/Empty';
import { Skeleton } from '@/components/Skeleton';
import { loadTinodeService } from '@/services/loadTinodeService';
import { refreshTinodeToken } from '@/services/tinode';
import { useAuthStore } from '@/store/auth';
import { showErrorToast } from '@/utils/error';

const safeDecode = (value?: string) => {
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export default function ChatPage() {
  const auth = useAuthStore();
  const [topicName, setTopicName] = useState('');
  const [title, setTitle] = useState('聊天');
  const [loading, setLoading] = useState(true);
  const [topic, setTopic] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [noMore, setNoMore] = useState(false);
  const [tinodeService, setTinodeService] = useState<Awaited<ReturnType<typeof loadTinodeService>> | null>(null);

  useLoad((options) => {
    const topicParam = typeof options.topic === 'string' ? safeDecode(options.topic) : '';
    const nameParam = typeof options.name === 'string' ? safeDecode(options.name) : '';

    setTopicName(topicParam);

    const nextTitle = nameParam || '聊天';
    setTitle(nextTitle);
    Taro.setNavigationBarTitle({ title: nextTitle });
  });

  const renderText = useMemo(() => {
    return (msg: any) => {
      const content = msg?.content;
      if (typeof content === 'string') return content;
      if (typeof content?.txt === 'string') return content.txt;
      return '[消息]';
    };
  }, []);

  useEffect(() => {
    if (!topicName) {
      setLoading(false);
      return;
    }

    if (!auth.token) {
      setLoading(false);
      return;
    }

    if (!auth.tinodeToken) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    let currentTopic: any | null = null;
    let service: Awaited<ReturnType<typeof loadTinodeService>> | null = null;

    const refreshMessages = () => {
      if (!currentTopic || !service) return;
      const next = service.getCachedMessages(currentTopic);
      setMessages(next);
    };

    const openConversation = async () => {
      setLoading(true);

      try {
        service = await loadTinodeService();
        if (!cancelled) {
          setTinodeService(service);
        }

        const ok = await service.init(auth.tinodeToken);
        if (!ok) {
          throw new Error('聊天服务初始化失败');
        }

        const loadedTopic = await service.subscribeToConversation(topicName, 50);
        if (cancelled) return;

        currentTopic = loadedTopic;
        setTopic(loadedTopic);

        loadedTopic.onData = () => {
          refreshMessages();
          service?.markAsRead(topicName).catch(() => {
            // best-effort
          });
        };

        refreshMessages();
        await service.markAsRead(topicName);
      } catch (error) {
        if (cancelled) return;
        showErrorToast(error, '加载失败');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    openConversation();

    return () => {
      cancelled = true;
      service?.markAsRead(topicName).catch(() => {
        // best-effort
      });

      if (currentTopic) {
        try {
          currentTopic.onData = null;
          currentTopic.leaveDelayed?.(false, 300);
        } catch {
          // ignore
        }
      }
    };
  }, [auth.token, auth.tinodeToken, topicName]);

  const handleRetryTinodeToken = async () => {
    if (!auth.token) {
      Taro.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    try {
      const res = await refreshTinodeToken();
      useAuthStore.getState().updateTinodeAuth(res);
      if (res.tinodeToken) {
        Taro.showToast({ title: '聊天已启用', icon: 'none' });
      } else {
        Taro.showToast({ title: res.tinodeError || '聊天暂不可用', icon: 'none' });
      }
    } catch (error) {
      showErrorToast(error, '操作失败');
    }
  };

  const handleSend = async () => {
    if (!topicName || !tinodeService) return;
    if (!auth.token) {
      Taro.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    if (!auth.tinodeToken) {
      Taro.showToast({ title: '聊天暂不可用', icon: 'none' });
      return;
    }

    const text = inputText.trim();
    if (!text) return;

    setSending(true);
    try {
      await tinodeService.sendTextMessage(topicName, text);
      setInputText('');
      await tinodeService.markAsRead(topicName);
    } catch (error) {
      showErrorToast(error, '发送失败');
    } finally {
      setSending(false);
    }
  };

  const handleLoadMore = async () => {
    if (!topic || !tinodeService || loadingMore || noMore) {
      return;
    }

    setLoadingMore(true);
    try {
      const beforeCount = messages.length;
      await tinodeService.loadEarlierMessages(topic, 30);
      const next = tinodeService.getCachedMessages(topic);
      setMessages(next);
      if (next.length <= beforeCount) {
        setNoMore(true);
      }
    } catch (error) {
      showErrorToast(error, '加载失败');
    } finally {
      setLoadingMore(false);
    }
  };

  if (!topicName) {
    return (
      <View className="page p-md">
        <Empty description="参数错误" />
      </View>
    );
  }

  if (!auth.token) {
    return (
      <View className="page p-md">
        <Empty
          description="请先登录后使用聊天"
          action={{ text: '去登录', onClick: () => Taro.switchTab({ url: '/pages/profile/index' }) }}
        />
      </View>
    );
  }

  if (!auth.tinodeToken) {
    return (
      <View className="page p-md">
        <Empty
          description={auth.tinodeError ? `聊天暂不可用：${auth.tinodeError}` : '聊天服务暂不可用'}
          action={{ text: '重试', onClick: handleRetryTinodeToken }}
        />
      </View>
    );
  }

  return (
    <View
      className="page bg-gray-50"
      style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}
    >
      <ScrollView scrollY style={{ flex: 1, padding: '24rpx' }} scrollWithAnimation>
        <View className="text-secondary" style={{ fontSize: '24rpx', marginBottom: '16rpx' }}>
          {title}
        </View>

        {messages.length > 0 ? (
          <View style={{ marginBottom: '16rpx' }}>
            {!noMore ? (
              <View style={{ display: 'flex', justifyContent: 'center', marginBottom: '16rpx' }}>
                <Button
                  size="sm"
                  variant="outline"
                  loading={loadingMore}
                  onClick={handleLoadMore}
                >
                  加载更多
                </Button>
              </View>
            ) : null}

            {messages.map((msg, index) => {
              const isMe = tinodeService?.isMe(msg?.from);
              const key = msg?.seq ? String(msg.seq) : msg?.id ? String(msg.id) : String(index);
              const text = renderText(msg);

              return (
                <View
                  key={key}
                  style={{
                    display: 'flex',
                    justifyContent: isMe ? 'flex-end' : 'flex-start',
                    marginBottom: '16rpx',
                  }}
                >
                  <View
                    style={{
                      maxWidth: '70%',
                      backgroundColor: isMe ? '#D4AF37' : '#FFFFFF',
                      borderRadius: '16rpx',
                      padding: '16rpx',
                      boxShadow: isMe ? 'none' : '0 6rpx 16rpx rgba(0,0,0,0.04)',
                    }}
                  >
                    <Text style={{ color: isMe ? '#FFFFFF' : '#111827', fontSize: '28rpx', lineHeight: '40rpx' }}>
                      {text}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        ) : loading ? (
          <View className="p-sm">
            <View className="mb-sm"><Skeleton width="80%" /></View>
            <View className="mb-sm"><Skeleton width="60%" /></View>
            <View><Skeleton width="70%" /></View>
          </View>
        ) : (
          <Empty description="暂无消息" />
        )}
      </ScrollView>

      <View
        className="bg-white border-t border-gray-100 safe-area-bottom"
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          padding: '16rpx',
          gap: '12rpx',
        }}
      >
        <Input
          value={inputText}
          onInput={(e) => setInputText(e.detail.value)}
          placeholder="输入消息"
          confirmType="send"
          onConfirm={handleSend}
          style={{
            flex: 1,
            backgroundColor: '#F8F9FA',
            borderRadius: '12rpx',
            padding: '10rpx 12rpx',
            fontSize: '28rpx',
          }}
        />
        <Button size="sm" variant="brand" disabled={sending || !inputText.trim()} onClick={handleSend}>
          发送
        </Button>
      </View>
    </View>
  );
}
