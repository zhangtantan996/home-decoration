import { useMemo, useState } from 'react';

import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/AsyncState';
import { useAsyncData } from '../../hooks/useAsyncData';
import { listNotifications } from '../../services/notifications';

const filters = [
  { key: 'all', label: '全部' },
  { key: 'booking', label: '预约提醒' },
  { key: 'proposal', label: '报价提醒' },
  { key: 'order', label: '支付提醒' },
  { key: 'system', label: '系统通知' },
] as const;

function mapType(type: string) {
  if (type.startsWith('booking')) return 'booking';
  if (type.startsWith('proposal')) return 'proposal';
  if (type.startsWith('order')) return 'order';
  return 'system';
}

function MessageIcon({ type }: { type: string }) {
  if (type.startsWith('proposal')) return <div className="msg-icon mi-green">文</div>;
  if (type.startsWith('booking')) return <div className="msg-icon mi-blue">约</div>;
  if (type.startsWith('order')) return <div className="msg-icon mi-amber">付</div>;
  return <div className="msg-icon mi-purple">系</div>;
}

export function MessagesPage() {
  const [activeFilter, setActiveFilter] = useState<(typeof filters)[number]['key']>('all');
  const { data, loading, error, reload } = useAsyncData(() => listNotifications({ page: 1, pageSize: 12 }), []);

  const filtered = useMemo(() => {
    if (!data) return [];
    if (activeFilter === 'all') return data.list;
    return data.list.filter((item) => mapType(item.type) === activeFilter);
  }, [activeFilter, data]);

  if (loading) return <LoadingBlock title="加载消息列表" />;
  if (error || !data) return <ErrorBlock description={error || '消息列表加载失败'} onRetry={() => void reload()} />;

  return (
    <section>
      <div className="section-head" style={{ marginBottom: 20 }}>
        <h2>我的消息</h2>
      </div>
      <div className="ptabs" style={{ marginBottom: 16 }}>
        {filters.map((item) => (
          <button className={`ptab ${activeFilter === item.key ? 'active' : ''}`} key={item.key} onClick={() => setActiveFilter(item.key)} type="button">
            {item.label}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? <EmptyBlock title="暂无消息" description="当前筛选条件下没有系统或业务通知。" /> : (
        <div className="msg-list">
          {filtered.map((item) => (
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
    </section>
  );
}
