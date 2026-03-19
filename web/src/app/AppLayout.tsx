import { NavLink, Outlet } from 'react-router-dom';

import { useSessionStore } from '../modules/session/sessionStore';
import styles from './AppLayout.module.scss';

const navItems = [
  { to: '/', label: '首页', end: true },
  { to: '/providers', label: '找服务商' },
  { to: '/me', label: '个人中心' },
];

export function AppLayout() {
  const user = useSessionStore((state) => state.user);
  const accessToken = useSessionStore((state) => state.accessToken);
  const clearSession = useSessionStore((state) => state.clearSession);

  return (
    <div className={styles.shell}>
      <a className="skip-link" href="#main-content">跳到正文</a>
      <header className={styles.header}>
        <div className={`container ${styles.headerInner}`}>
          <div className={styles.brandWrap}>
            <NavLink className={styles.brand} to="/">
              <span className={styles.brandMark}>Hezeyun User Web</span>
              <strong className={styles.brandTitle}>装修用户前台</strong>
            </NavLink>
            <p className={styles.brandNote}>找服务商、留资预约、确认报价、盯项目进度，一条链路先跑顺。</p>
          </div>

          <nav className={styles.nav} aria-label="主导航">
            {navItems.map((item) => (
              <NavLink key={item.to} end={item.end} to={item.to}>
                {({ isActive }) => (
                  <span className={styles.navLink} data-active={isActive}>
                    {item.label}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>

          <div className={styles.headerActions}>
            {accessToken ? (
              <>
                <div className={styles.userPanel}>
                  <span className={styles.userLabel}>当前会话</span>
                  <strong className={styles.userValue}>{user?.nickname || user?.phone || '已登录用户'}</strong>
                </div>
                <button className="button-outline" type="button" onClick={clearSession}>
                  退出登录
                </button>
              </>
            ) : (
              <NavLink className="button-secondary" to="/login">
                短信登录
              </NavLink>
            )}
          </div>
        </div>
      </header>

      <main id="main-content">
        <Outlet />
      </main>

      <footer className={styles.footer}>
        <div className="container">
          <section className={`card ${styles.footerCard}`} data-tone="warm">
            <div className={styles.footerGrid}>
              <div>
                <p className="kicker eyebrow-accent">Trust & Authority</p>
                <h2 className={styles.footerTitle}>用户前台不是营销页，也不是后台壳</h2>
                <p className={styles.footerText}>这一轮的目标是让用户从首页开始就能感受到服务可信、信息清楚、下一步明确，而不是被迫自己拼流程。</p>
              </div>
              <div>
                <h3 className={styles.footerTitle}>一期重点</h3>
                <p className={styles.footerText}>公开发现、个人中心、轻登录门禁、预约详情、报价确认、项目看板、里程碑验收。</p>
              </div>
              <div>
                <h3 className={styles.footerTitle}>边界保持</h3>
                <p className={styles.footerText}>`/merchant` 仍是商家端，`/admin` 仍是后台。用户前台只接管根路径 `/`。</p>
              </div>
            </div>
          </section>
        </div>
      </footer>
    </div>
  );
}
