import { Link } from 'react-router-dom';

import styles from './UserWebUnavailablePage.module.scss';

export function UserWebUnavailablePage() {
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <p className={styles.kicker}>USER WEB</p>
        <h1 className={styles.title}>用户端暂未开放</h1>
        <p className={styles.description}>当前线上仅保留运营维护侧，用户浏览、预约、交易与项目流程功能暂时关闭。</p>
        <p className={styles.legal}>
          法务文档仍可查看：
          {' '}
          <Link to="/legal/user-agreement">用户协议</Link>
          {' '}·{' '}
          <Link to="/legal/privacy-policy">隐私政策</Link>
          {' '}·{' '}
          <Link to="/legal/transaction-rules">交易规则</Link>
        </p>
        <a href="/" className={styles.button}>返回官网</a>
      </section>
    </main>
  );
}
