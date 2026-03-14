import { NavLink, Outlet } from 'react-router-dom';

import styles from './ProfileWorkspaceLayout.module.scss';

const navItems = [
  { to: '/me', label: '概览', end: true },
  { to: '/me/bookings', label: '我的预约' },
  { to: '/me/demands', label: '我的需求' },
  { to: '/me/proposals', label: '我的报价' },
  { to: '/me/projects', label: '我的项目' },
  { to: '/me/orders', label: '我的订单' },
  { to: '/me/messages', label: '我的消息' },
  { to: '/me/complaints', label: '我的投诉' },
  { to: '/me/after-sales', label: '售后/争议' },
  { to: '/me/settings', label: '账户设置' },
];

export function ProfileWorkspaceLayout() {
  return (
    <div className="top-page">
      <div className={styles.navWrap}>
        {navItems.map((item) => (
          <NavLink className={styles.navItem} end={item.end} key={item.to} to={item.to}>
            {({ isActive }) => <span data-active={isActive}>{item.label}</span>}
          </NavLink>
        ))}
      </div>

      <Outlet />
    </div>
  );
}
