import { Link } from 'react-router-dom';

import { ErrorBlock, LoadingBlock } from '../components/AsyncState';
import { useAsyncData } from '../hooks/useAsyncData';
import { getProfileHomeData } from '../services/profile';
import type { ProfileHomeVM } from '../types/viewModels';
import styles from './ProfileHomePage.module.scss';

const StatIcons = [
  <svg fill="none" key="0" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24"><path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  <svg fill="none" key="1" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  <svg fill="none" key="2" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  <svg fill="none" key="3" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>,
];

const colorClasses = ['blue', 'green', 'amber', 'rose', 'slate'];

export function ProfileHomePage() {
  const { data, loading, error, reload } = useAsyncData<ProfileHomeVM>(getProfileHomeData, []);

  if (loading) {
    return <LoadingBlock title="加载个人中心" />;
  }

  if (error || !data) {
    return <ErrorBlock description={error || '加载失败'} onRetry={() => void reload()} />;
  }

  return (
    <div className={styles.pageContainer}>
      <header className={styles.sectionHead}>
        <h2>概览</h2>
      </header>

      <section className={styles.heroCard}>
        <div className={styles.heroTitleRow}>
          <div className={styles.heroIdentity}>
            {data.avatar ? (
              <img alt={data.displayName} className={styles.heroAvatar} src={data.avatar} />
            ) : (
              <div className={styles.heroAvatar}>{data.displayName.slice(0, 1)}</div>
            )}
            <div className={styles.heroTitleBlock}>
              <p className={styles.heroEyebrow}>个人中心</p>
              <h3>{data.displayName}</h3>
            </div>
          </div>
          <Link className={styles.heroAction} to="/me/settings?tab=profile">
            编辑资料
          </Link>
        </div>
      </section>

      <section className={styles.surfaceCard}>
        <div className={styles.surfaceHead}>
          <h3>关键概览</h3>
        </div>
        <div className={styles.statGrid}>
          {data.summaryCards.slice(0, 4).map((item, index) => {
            const colorClass = styles[colorClasses[index % colorClasses.length]] || '';
            const content = (
              <>
                <div className={`${styles.statIconWrap} ${colorClass}`.trim()}>
                  {StatIcons[index % StatIcons.length]}
                </div>
                <strong className={styles.statCount}>{item.value}</strong>
                <span className={styles.statTitle}>{item.title}</span>
                <p className={styles.statDescription}>{item.description}</p>
              </>
            );

            if (item.href) {
              return (
                <Link className={`${styles.statCard} ${styles.statLink}`.trim()} key={item.title} to={item.href}>
                  {content}
                </Link>
              );
            }

            return <article className={styles.statCard} key={item.title}>{content}</article>;
          })}
        </div>
      </section>

      {data.latestMessages.length > 0 ? (
        <section className={styles.surfaceCard}>
          <div className={styles.surfaceHead}>
            <h3>最近动态</h3>
            <Link className={styles.surfaceLink} to="/me/messages">
              查看全部
            </Link>
          </div>
          <div className={styles.feedList}>
            {data.latestMessages.map((item) => (
              <Link className={styles.feedCard} key={item.id} to={item.href || '/me/messages'}>
                <div className={styles.feedIcon}>
                  <svg fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24"><path d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
                <div className={styles.feedContent}>
                  <strong>{item.title}</strong>
                  <p>{item.subtitle}</p>
                </div>
                <div className={styles.feedMeta}>{item.meta}</div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {data.pendingPayments.length > 0 ? (
        <section className={styles.surfaceCard}>
          <div className={styles.surfaceHead}>
            <h3>最近订单</h3>
            <Link className={styles.surfaceLink} to="/me/orders">
              查看全部
            </Link>
          </div>
          <div className={styles.orderList}>
            {data.pendingPayments.map((item) => (
              <Link className={styles.orderCard} key={item.id} to={item.href || '/me/orders'}>
                <div className={styles.orderContent}>
                  <div className={styles.orderHeadRow}>
                    <strong>{item.title}</strong>
                    <span className={styles.orderStatus}>{item.meta}</span>
                  </div>
                  <p className={styles.orderProvider}>{item.subtitle}</p>
                </div>
                <div className={styles.orderAmountBlock}>
                  <span className={styles.orderAmountLabel}>订单金额</span>
                  <em className={styles.orderAmount}>{item.amountText || item.meta}</em>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
