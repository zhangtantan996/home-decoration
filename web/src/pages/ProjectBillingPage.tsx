import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ErrorBlock, LoadingBlock } from '../components/AsyncState';
import { UserPageFrame } from '../components/UserPageFrame';
import shellStyles from '../components/UserWorkspaceShell.module.scss';
import { useAsyncData } from '../hooks/useAsyncData';
import { getProjectBill, getProjectDetail, getProjectEscrow } from '../services/projects';
import type { ProjectBillingItemVM, ProjectEscrowTransactionVM } from '../types/viewModels';
import styles from './ProjectBillingPage.module.scss';

function parseMoneyValue(text?: string) {
  if (!text) return 0;
  const normalized = text.replace(/,/g, '');
  const matched = normalized.match(/(\d+(?:\.\d+)?)/);
  return matched ? Number(matched[1]) : 0;
}

function formatMoney(value: number) {
  if (!value) return '¥0';
  return `¥${Math.round(value).toLocaleString('zh-CN')}`;
}

function getStatusTone(statusText: string) {
  if (statusText.includes('已支付') || statusText.includes('成功')) return 'paid';
  if (statusText.includes('待支付') || statusText.includes('处理中')) return 'pending';
  if (statusText.includes('已退款') || statusText.includes('已取消') || statusText.includes('失败')) return 'muted';
  return 'neutral';
}

function sortPlans(items: ProjectBillingItemVM[]) {
  return [...items].sort((left, right) => left.id - right.id);
}

function sortTransactions(items: ProjectEscrowTransactionVM[]) {
  return [...items].sort((left, right) => right.id - left.id);
}

export function ProjectBillingPage() {
  const params = useParams();
  const projectId = Number(params.id || 0);

  const { data, loading, error, reload } = useAsyncData(async () => {
    const [detail, escrow, bill] = await Promise.all([
      getProjectDetail(projectId),
      getProjectEscrow(projectId).catch(() => null),
      getProjectBill(projectId).catch(() => []),
    ]);
    return { detail, escrow, bill };
  }, [projectId]);

  const summary = useMemo(() => {
    const billItems = sortPlans(data?.bill || []);
    const pendingAmount = billItems.reduce((total, item) => {
      return total + item.planItems.reduce((sum, plan) => {
        if (plan.statusText !== '待支付') return sum;
        return sum + parseMoneyValue(plan.amountText);
      }, 0);
    }, 0);

    return {
      totalBudget: data?.detail?.budgetText || '预算待补充',
      paidAmount: data?.escrow?.releasedAmountText || '待同步',
      pendingAmount: billItems.length > 0 ? formatMoney(pendingAmount) : '待同步',
      escrowBalance: data?.escrow?.balanceText || '待同步',
    };
  }, [data]);

  if (loading) {
    return (
      <UserPageFrame contentClassName={shellStyles.content} header={null} mainClassName={shellStyles.main} sidebar={null} wrapClassName={shellStyles.wrap}>
        <LoadingBlock title="加载费用清单" />
      </UserPageFrame>
    );
  }

  if (error || !data) {
    return (
      <UserPageFrame contentClassName={shellStyles.content} header={null} mainClassName={shellStyles.main} sidebar={null} wrapClassName={shellStyles.wrap}>
        <ErrorBlock description={error || '费用清单加载失败'} onRetry={() => void reload()} />
      </UserPageFrame>
    );
  }

  const projectCode = `DM-${String(projectId).padStart(5, '0')}`;
  const billItems = sortPlans(data.bill);
  const transactions = sortTransactions(data.escrow?.transactions || []);

  return (
    <UserPageFrame contentClassName={shellStyles.content} header={null} mainClassName={shellStyles.main} sidebar={null} wrapClassName={shellStyles.wrap}>
      <main className={styles.mainContainer}>
        <header className={styles.pageHeader}>
          <div>
            <div className={styles.headerActions}>
              <Link className="button-outline" to={`/projects/${projectId}`}>返回项目</Link>
            </div>
            <h1>费用清单</h1>
            <p>{data.detail.name} · {projectCode}</p>
          </div>
          <div className={styles.headerMeta}>
            <span>{data.detail.statusText}</span>
            <span>{data.detail.currentPhase || '待同步'}</span>
            <span>{data.detail.expectedEndText || '交付时间待同步'}</span>
          </div>
        </header>

        <section className={styles.summaryGrid}>
          <article className={styles.summaryCard}>
            <span>项目总预算</span>
            <strong>{summary.totalBudget}</strong>
          </article>
          <article className={styles.summaryCard}>
            <span>已支付</span>
            <strong>{summary.paidAmount}</strong>
          </article>
          <article className={styles.summaryCard}>
            <span>待支付</span>
            <strong>{summary.pendingAmount}</strong>
          </article>
          <article className={styles.summaryCard}>
            <span>托管余额</span>
            <strong>{summary.escrowBalance}</strong>
          </article>
        </section>

        <section className={styles.sectionCard}>
          <div className={styles.sectionHead}>
            <div>
              <h2>费用清单</h2>
              <p>按订单与付款计划查看当前项目的应付费用。</p>
            </div>
            <span className={styles.sectionCount}>{billItems.length} 笔</span>
          </div>

          {billItems.length === 0 ? (
            <div className={styles.emptyState}>当前项目还没有生成费用清单。</div>
          ) : (
            <div className={styles.billList}>
              {billItems.map((item) => (
                <article key={item.id} className={styles.billCard}>
                  <div className={styles.billTop}>
                    <div>
                      <h3>{item.orderNo}</h3>
                      <p>订单金额 {item.amountText}</p>
                    </div>
                    <span className={`${styles.statusChip} ${styles[getStatusTone(item.statusText)]}`}>{item.statusText}</span>
                  </div>

                  {item.planItems.length === 0 ? (
                    <div className={styles.inlineEmpty}>该订单暂未生成付款计划。</div>
                  ) : (
                    <div className={styles.planList}>
                      {item.planItems.map((plan) => (
                        <div key={plan.id} className={styles.planRow}>
                          <div>
                            <strong>{plan.name}</strong>
                            <p>{plan.dueAt || '支付时间待同步'}</p>
                          </div>
                          <div className={styles.planMeta}>
                            <span>{plan.amountText}</span>
                            <span className={`${styles.statusChip} ${styles[getStatusTone(plan.statusText)]}`}>{plan.statusText}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className={styles.sectionCard}>
          <div className={styles.sectionHead}>
            <div>
              <h2>托管流水</h2>
              <p>这里只展示项目托管账户已产生的资金流水。</p>
            </div>
            <span className={styles.sectionCount}>{transactions.length} 条</span>
          </div>

          {transactions.length === 0 ? (
            <div className={styles.emptyState}>当前项目还没有托管流水记录。</div>
          ) : (
            <div className={styles.transactionList}>
              {transactions.map((item) => (
                <div key={item.id} className={styles.transactionRow}>
                  <div>
                    <strong>{item.type}</strong>
                    <p>{item.createdAt || '时间待同步'}</p>
                  </div>
                  <div className={styles.transactionMeta}>
                    <span>{item.amountText}</span>
                    <span className={`${styles.statusChip} ${styles[getStatusTone(item.statusText)]}`}>{item.statusText}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </UserPageFrame>
  );
}
