import type { ReactNode } from 'react';

interface UserPageFrameProps {
  sidebar: ReactNode;
  children: ReactNode;
  header?: ReactNode;
  wrapClassName?: string;
  frameClassName?: string;
  sidebarClassName?: string;
  mainClassName?: string;
  contentClassName?: string;
}

function joinClassNames(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(' ');
}

export function UserPageFrame({
  sidebar,
  children,
  header,
  wrapClassName,
  frameClassName,
  sidebarClassName,
  mainClassName,
  contentClassName,
}: UserPageFrameProps) {
  const hasSidebar = sidebar !== null && sidebar !== undefined && sidebar !== false;

  return (
    <div className={joinClassNames('user-page-wrap', wrapClassName)}>
      <div
        className={joinClassNames('user-page-frame', frameClassName)}
        style={hasSidebar ? undefined : { gridTemplateColumns: 'minmax(0, 1fr)' }}
      >
        {hasSidebar ? <aside className={joinClassNames('user-page-sidebar', sidebarClassName)}>{sidebar}</aside> : null}
        <section
          className={joinClassNames('user-page-main', mainClassName)}
          style={hasSidebar ? undefined : { width: '100%', maxWidth: 'none', justifySelf: 'stretch' }}
        >
          {header ? <header className="user-page-head">{header}</header> : null}
          <div className={joinClassNames('user-page-content', contentClassName)}>{children}</div>
        </section>
      </div>
    </div>
  );
}
