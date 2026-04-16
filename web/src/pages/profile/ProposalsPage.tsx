import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/AsyncState';
import { useAsyncData } from '../../hooks/useAsyncData';
import { listProposals } from '../../services/proposals';
import type { ProposalListItemVM } from '../../types/viewModels';
import styles from './ProposalsPage.module.scss';

const filters = [
  { key: 'all', label: '全部' },
  { key: 1, label: '待确认' },
  { key: 2, label: '已确认' },
  { key: 4, label: '已过期' },
] as const;

function buildFilterCountMap(list: ProposalListItemVM[]) {
  return list.reduce<Record<string, number>>((acc, item) => {
    const key = String(item.status);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function readStatusTone(status: number) {
  switch (status) {
    case 2:
      return 'confirmed';
    case 3:
    case 4:
      return 'expired';
    default:
      return 'pending';
  }
}

function readStatusToneLabel(status: number) {
  switch (status) {
    case 2:
      return 'success';
    case 3:
    case 4:
      return 'danger';
    default:
      return 'warning';
  }
}

function readActionLabel(item: ProposalListItemVM) {
  return item.href.startsWith('/demands/') ? '进入比稿' : '查看方案';
}

function readStageHint(item: ProposalListItemVM) {
  switch (item.status) {
    case 1:
      return '需要你确认本次正式方案';
    case 2:
      return '已确认，等待进入后续履约';
    case 3:
      return '已退回，等待设计师重新提交';
    case 4:
      return '已失效，可联系服务商更新';
    default:
      return '报价处理中';
  }
}

function readKindLabel(item: ProposalListItemVM) {
  return item.href.startsWith('/demands/') ? '比稿方案' : '正式方案';
}

function readHeroTitle(list: ProposalListItemVM[]) {
  const pending = list.find((item) => item.status === 1);
  if (pending) return pending.summary;
  return list[0]?.summary || '当前暂无待处理报价';
}

function readHeroMeta(list: ProposalListItemVM[]) {
  const pending = list.find((item) => item.status === 1);
  if (pending) {
    return {
      amount: pending.designFeeText,
      hint: pending.submittedAt ? `提交于 ${pending.submittedAt}` : '报价已生成，等待你确认',
      href: pending.href,
      action: readActionLabel(pending),
    };
  }

  const latest = list[0];
  if (!latest) {
    return {
      amount: '--',
      hint: '设计师提交正式方案后，会在这里统一查看。',
      href: '',
      action: '',
    };
  }

  return {
    amount: latest.designFeeText,
    hint: latest.submittedAt ? `最近更新于 ${latest.submittedAt}` : '最近一次报价已归档',
    href: latest.href,
    action: readActionLabel(latest),
  };
}

export function ProposalsPage() {
  const [activeFilter, setActiveFilter] = useState<(typeof filters)[number]['key']>('all');
  const { data, loading, error, reload } = useAsyncData(listProposals, []);

  const filterCounts = useMemo(() => buildFilterCountMap(data || []), [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    if (activeFilter === 'all') return data;
    return data.filter((item) => item.status === activeFilter);
  }, [activeFilter, data]);

  if (loading) return <LoadingBlock title="加载报价列表" />;
  if (error || !data) return <ErrorBlock description={error || '报价列表加载失败'} onRetry={() => void reload()} />;

  const heroMeta = readHeroMeta(data);

  return (
    <div className={styles.pageContainer}>
      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>个人中心</p>
          <h2>我的报价</h2>
          <p className={styles.subtitle}>这里收口查看设计师提交的正式方案与当前待办，确认动作直接跟着对应报价走。</p>
        </div>

        <div className={styles.heroAside}>
          <div className={styles.quickActionCard}>
            <div className={styles.quickActionCopy}>
              <span>{data.some((item) => item.status === 1) ? '优先处理' : '最近报价'}</span>
              <strong title={readHeroTitle(data)}>{readHeroTitle(data)}</strong>
              <p>{heroMeta.hint}</p>
            </div>
            <div className={styles.quickActionMeta}>
              <b>{heroMeta.amount}</b>
              {heroMeta.href ? (
                <Link className={styles.quickActionButton} to={heroMeta.href}>
                  {heroMeta.action}
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <div className={styles.filterTabs} role="tablist" aria-label="报价筛选">
        {filters.map((item) => {
          const count = item.key === 'all' ? data.length : filterCounts[String(item.key)] || 0;
          const active = activeFilter === item.key;
          return (
            <button
              aria-selected={active}
              className={`${styles.filterTab} ${active ? styles.filterTabActive : ''}`.trim()}
              key={String(item.key)}
              onClick={() => setActiveFilter(item.key)}
              role="tab"
              type="button"
            >
              <span>{item.label}</span>
              <em>{count}</em>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <EmptyBlock title="当前筛选下暂无报价" description="" />
      ) : (
        <div className={styles.quoteList}>
          {filtered.map((item) => {
            const statusTone = readStatusTone(item.status);
            const actionLabel = readActionLabel(item);

            return (
              <article className={`${styles.quoteCard} ${styles[`card${statusTone[0].toUpperCase()}${statusTone.slice(1)}`]}`.trim()} key={item.id}>
                <div className={styles.cardMain}>
                  <div className={styles.cardTop}>
                    <div className={styles.identityBlock}>
                      <div className={styles.badgeRow}>
                        <span className={styles.kindBadge}>{readKindLabel(item)}</span>
                        <span className="status-chip" data-tone={readStatusToneLabel(item.status)}>{item.statusText}</span>
                      </div>
                      <h3 title={item.summary}>{item.summary}</h3>
                      <p>{readStageHint(item)}</p>
                    </div>
                  </div>

                  <div className={styles.metaGrid}>
                    <div className={styles.metaItem}>
                      <span>提交时间</span>
                      <strong>{item.submittedAt || '待补充'}</strong>
                    </div>
                    <div className={styles.metaItem}>
                      <span>当前判断</span>
                      <strong>{item.statusText}</strong>
                    </div>
                    <div className={styles.metaItem}>
                      <span>下一步</span>
                      <strong>{readStageHint(item)}</strong>
                    </div>
                  </div>
                </div>

                <div className={styles.actionColumn}>
                  <div className={styles.amountBlock}>
                    <span>设计费</span>
                    <strong>{item.designFeeText}</strong>
                  </div>
                  <Link className={styles.primaryAction} to={item.href}>
                    {actionLabel}
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
