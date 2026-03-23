
import { NotificationCenter } from '../components/NotificationCenter';

export function MessagesHubPage() {
  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <NotificationCenter pageSize={10} showHeader={false} title="通知列表" />
    </div>
  );
}
