import { useMemo } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';

import companyLogo from '../assets/company-logo.png';
import { useAsyncData } from '../hooks/useAsyncData';
import { useSessionStore } from '../modules/session/sessionStore';
import { getNotificationUnreadCount } from '../services/notifications';
import styles from './AuthenticatedAppLayout.module.scss';

const navItems = [
  { to: '/', label: '首页', end: true },
  { to: '/providers', label: '找服务' },
  { to: '/progress', label: '我的项目' },
  { to: '/messages', label: '消息' },
  { to: '/me', label: '个人中心' },
];

function BellIcon() {
  return (
    <svg fill="none" height="20" viewBox="0 0 24 24" width="20">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

export function AuthenticatedAppLayout() {
  const navigate = useNavigate();
  const clearSession = useSessionStore((state) => state.clearSession);
  const user = useSessionStore((state) => state.user);
  const { data: unreadCount } = useAsyncData(getNotificationUnreadCount, []);

  const displayName = useMemo(() => user?.nickname || user?.phone || '用户', [user]);
  const avatarLetter = useMemo(() => displayName.slice(0, 1).toUpperCase(), [displayName]);

  return (
    <div className={styles.shell}>
      <a className="skip-link" href="#app-main">跳到正文</a>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link className={styles.brand} to="/">
            <img alt="禾泽云公司 Logo" className={styles.brandLogo} src={companyLogo} />
            <span>家装管家</span>
          </Link>

          <nav aria-label="主导航" className={styles.nav}>
            {navItems.map((item) => (
              <NavLink
                className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`.trim()}
                end={item.end}
                key={item.to}
                to={item.to}
              >
                <span>
                  {item.label}
                  {item.to === '/messages' && unreadCount && unreadCount > 0 ? <em className={styles.navBadge}>{unreadCount}</em> : null}
                </span>
              </NavLink>
            ))}
          </nav>

          <div className={styles.right}>
            <button className={styles.notiBtn} onClick={() => navigate('/messages')} title="通知" type="button">
              <BellIcon />
              {unreadCount && unreadCount > 0 ? <span className={styles.notiDot} /> : null}
            </button>
            <Link className={styles.avatar} to="/me" title={displayName}>
              {user?.avatar ? <img alt={`${displayName}头像`} src={user.avatar} /> : avatarLetter}
            </Link>
            <button
              className={styles.logoutBtn}
              onClick={() => {
                clearSession();
                navigate('/login', { replace: true });
              }}
              type="button"
            >
              退出
            </button>
          </div>
        </div>
      </header>

      <main className={styles.main} id="app-main">
        <Outlet />
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerLeft}>© 2026 禾泽云科技 · 家装管家</div>
          <div className={styles.footerLinks}>
            <Link to="/legal/user-agreement">用户协议</Link>
            <Link to="/legal/privacy-policy">隐私政策</Link>
            <Link to="/me/settings">账户设置</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
