import { NavLink, Outlet } from 'react-router-dom';

import { UserPageFrame } from '../components/UserPageFrame';
import shellStyles from '../components/UserWorkspaceShell.module.scss';
import styles from './ProfileWorkspaceLayout.module.scss';

const navItems = [
  { to: '/me', label: '概览', end: true },
  { to: '/me/bookings', label: '我的预约' },
  { to: '/me/demands', label: '我的需求' },
  { to: '/me/proposals', label: '我的报价' },
  { to: '/me/projects', label: '我的项目' },
  { to: '/me/orders', label: '我的订单' },
  { to: '/me/messages', label: '我的通知' },
  { to: '/me/complaints', label: '我的投诉' },
  { to: '/me/after-sales', label: '售后/争议' },
  { to: '/me/settings', label: '账户设置' },
];

export function ProfileWorkspaceLayout() {
  const sidebar = (
    <div className={shellStyles.sidebarInner}>
      <section className="user-page-panel compact">
        <p className="user-page-label">个人中心导航</p>
        <nav className={styles.navList}>
          {navItems.map((item) => (
            <NavLink className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`.trim()} end={item.end} key={item.to} to={item.to}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </section>
    </div>
  );

  return (
    <UserPageFrame
      contentClassName={`${shellStyles.content} ${styles.content}`}
      frameClassName={shellStyles.frame}
      mainClassName={shellStyles.main}
      sidebar={sidebar}
      sidebarClassName={shellStyles.sidebar}
      wrapClassName={shellStyles.wrap}
    >
      <Outlet />
    </UserPageFrame>
  );
}
