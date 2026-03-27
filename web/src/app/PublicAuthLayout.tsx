import { Outlet } from 'react-router-dom';

import { RouteScrollReset } from '../components/RouteScrollReset';
import styles from './PublicAuthLayout.module.scss';

export function PublicAuthLayout() {
  return (
    <div className={styles.shell}>
      <RouteScrollReset />
      <a className="skip-link" href="#public-auth-main">跳到正文</a>
      <main className={styles.main} id="public-auth-main">
        <Outlet />
      </main>
    </div>
  );
}
