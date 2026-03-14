import { useMemo } from 'react';

import { EmptyBlock, ErrorBlock, LoadingBlock } from '../components/AsyncState';
import { useAsyncData } from '../hooks/useAsyncData';
import { listNotifications } from '../services/notifications';

function MessageIcon({ type }: { type: string }) {
  if (type.startsWith('proposal')) {
    return <div className="msg-icon mi-green">文</div>;
  }
  if (type.startsWith('booking')) {
    return <div className="msg-icon mi-blue">约</div>;
  }
  if (type.startsWith('order')) {
    return <div className="msg-icon mi-amber">付</div>;
  }
  return <div className="msg-icon mi-purple">系</div>;
}

export function MessagesHubPage() {
  const { data, loading, error, reload } = useAsyncData(() => listNotifications({ page: 1, pageSize: 20 }), []);

  const list = useMemo(() => data?.list || [], [data]);

  if (loading) {
    return <div className="top-page"><LoadingBlock title="加载消息中心" /></div>;
  }

  if (error || !data) {
    return <div className="top-page"><ErrorBlock description={error || '消息中心加载失败'} onRetry={() => void reload()} /></div>;
  }

  return (
    <div className="top-page">
      <div className="section-head" style={{ marginBottom: 20 }}>
        <h2>消息中心</h2>
      </div>
      {list.length === 0 ? <EmptyBlock title="暂无消息" description="当前没有新的通知提醒。" /> : (
        <div className="msg-list">
          {list.map((item) => (
            <article className="msg-item" key={item.id}>
              <MessageIcon type={item.type} />
              <div className="msg-body">
                <strong>{item.title}</strong>
                <p>{item.content}</p>
              </div>
              <div className="msg-time">{item.createdAt}</div>
              {!item.isRead ? <div className="msg-unread" /> : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
