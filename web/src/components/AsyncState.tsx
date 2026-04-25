import type { ReactNode } from 'react';
import { toSafeUserFacingText } from '../utils/userFacingText';

interface StateProps {
  title: string;
  description: string;
  action?: ReactNode;
  tone?: 'loading' | 'empty' | 'error';
}

function StatePanel({ title, description, action, tone = 'empty' }: StateProps) {
  return (
    <section className="card">
      <div aria-live={tone === 'loading' || tone === 'error' ? 'polite' : undefined} className={`state-panel state-panel-${tone}`} role={tone === 'error' ? 'alert' : undefined}>
        {tone === 'loading' ? <div aria-hidden="true" className="loading-pulse" /> : null}
        <p className="kicker eyebrow-accent">{tone === 'loading' ? '加载中' : tone === 'error' ? '需要处理' : '当前状态'}</p>
        <strong className="section-title">{title}</strong>
        <span className="page-subtitle state-copy">{description}</span>
        {action}
      </div>
    </section>
  );
}

export function LoadingBlock({ title = '加载中' }: { title?: string }) {
  return <StatePanel description="正在同步页面数据，请稍候。" title={title} tone="loading" />;
}

export function EmptyBlock({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <StatePanel action={action} description={description} title={title} tone="empty" />;
}

export function ErrorBlock({ title = '加载失败', description, onRetry }: { title?: string; description: string; onRetry?: () => void }) {
  return (
    <StatePanel
      action={onRetry ? (
        <div className="inline-actions state-actions">
          <button className="button-secondary" onClick={onRetry} type="button">重试</button>
        </div>
      ) : null}
      description={toSafeUserFacingText(description, '页面暂时加载失败，请稍后重试。')}
      title={title}
      tone="error"
    />
  );
}
