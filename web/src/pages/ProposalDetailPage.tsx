import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ErrorBlock, LoadingBlock } from '../components/AsyncState';
import { useAsyncData } from '../hooks/useAsyncData';
import { confirmProposal, getProposalDetail, rejectProposal } from '../services/proposals';
import type { ProposalDetailVM } from '../types/viewModels';
import styles from './ProposalDetailPage.module.scss';

type FeedbackTone = 'success' | 'danger';

type FeedbackState = {
  text: string;
  tone: FeedbackTone;
} | null;

type FactItem = {
  label: string;
  value: string;
};

type ActionDescriptor = {
  title: string;
  hint: string;
};

function buildHeadline(summary: string) {
  const source = String(summary || '').trim();
  if (!source) return '正式方案';
  const sentence = source.split(/[。！？!?]/).map((item) => item.trim()).find(Boolean) || source;
  const clause = sentence.split(/[，,；;：:]/).map((item) => item.trim()).find(Boolean) || sentence;
  return clause.length > 22 ? `${clause.slice(0, 22)}…` : clause;
}

function readStatusTone(data: ProposalDetailVM): 'warning' | 'success' | 'danger' | 'brand' {
  if (data.canConfirm) return 'warning';
  if (data.status === 2) return 'success';
  if (data.status === 3) return 'danger';
  return 'brand';
}

function readActionDescriptor(data: ProposalDetailVM): ActionDescriptor {
  if (data.canConfirm) {
    return {
      title: '待你确认正式方案',
      hint: '确认后会进入施工报价准备；如果方向不对，直接退回并补充修改意见即可。',
    };
  }
  if (data.status === 2) {
    return {
      title: '方案已确认',
      hint: data.hasOrder ? '当前只保留订单与项目入口，方便继续跟进履约。' : '当前方案已锁定，等待后续业务继续推进。',
    };
  }
  if (data.status === 3) {
    return {
      title: '等待设计师重新提交',
      hint: '最近一次退回意见已经记录，设计师更新后会再次通知你。',
    };
  }
  return {
    title: '查看当前进展',
    hint: data.blockingReason || '当前暂无可直接执行的用户动作。',
  };
}

function readStageLead(data: ProposalDetailVM) {
  if (data.canConfirm) return '正式方案已经提交，当前只需要确认方向与费用是否符合预期。';
  if (data.status === 2) return '方案已经确认，当前页面只保留后续跟进所需的关键信息。';
  if (data.status === 3) return '这版方案已经退回，等待设计师根据反馈重新整理。';
  return data.blockingReason || '当前可以先查看方案摘要、费用与关联订单。';
}

function readDeliveryStateText(data: ProposalDetailVM) {
  return data.deliveryUnlocked ? '已解锁' : '待补充';
}

function readOrderTone(orderStatus: number | null): 'warning' | 'success' | 'danger' | 'brand' {
  if (orderStatus === 1) return 'success';
  if (orderStatus === 0) return 'warning';
  if (orderStatus === 3) return 'danger';
  return 'brand';
}

function buildFacts(data: ProposalDetailVM): FactItem[] {
  const items: FactItem[] = [];
  if (data.submittedAt && data.submittedAt !== '待补充') items.push({ label: '提交时间', value: data.submittedAt });
  if (data.responseDeadline && data.responseDeadline !== '待补充') items.push({ label: '响应时限', value: data.responseDeadline });
  if (data.estimatedDays > 0) items.push({ label: '预计工期', value: `${data.estimatedDays} 天` });
  items.push({ label: '交付状态', value: readDeliveryStateText(data) });
  return items;
}

function renderLinkGroup(items: string[], label: string, className: string) {
  return items.map((url, index) => (
    <a className={className} href={url} key={`${label}-${index}-${url}`} rel="noreferrer" target="_blank">
      {label}
    </a>
  ));
}

function renderImageGallery(items: string[], altPrefix: string, className: string) {
  return items.map((url, index) => (
    <a className={className} href={url} key={`${altPrefix}-${index}-${url}`} rel="noreferrer" target="_blank">
      <img alt={`${altPrefix}${index + 1}`} loading="lazy" src={url} />
    </a>
  ));
}

export function ProposalDetailPage() {
  const params = useParams();
  const proposalId = Number(params.id || 0);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [acting, setActing] = useState(false);
  const [pendingAction, setPendingAction] = useState<'confirm' | 'reject' | null>(null);
  const { data, loading, error, reload } = useAsyncData<ProposalDetailVM>(() => getProposalDetail(proposalId), [proposalId]);

  const previewGallery = useMemo(() => {
    if (!data) return [];
    return [
      ...renderImageGallery(data.previewFloorPlanImages || [], '彩平预览 ', styles.galleryItem),
      ...renderImageGallery(data.previewEffectImages || [], '效果预览 ', styles.galleryItem),
    ];
  }, [data]);

  const previewLinks = useMemo(() => {
    if (!data) return [];
    return renderLinkGroup(data.previewEffectLinks || [], '效果参考', styles.assetLink);
  }, [data]);

  const deliveryGallery = useMemo(() => {
    if (!data) return [];
    return [
      ...renderImageGallery(data.deliveryFloorPlanImages || [], '正式彩平图 ', styles.galleryItem),
      ...renderImageGallery(data.deliveryEffectImages || [], '正式效果图 ', styles.galleryItem),
    ];
  }, [data]);

  const deliveryLinks = useMemo(() => {
    if (!data) return [];
    return [
      ...renderLinkGroup(data.deliveryEffectLinks || [], '效果图外链', styles.assetLink),
      ...renderLinkGroup(data.deliveryCadFiles || [], 'CAD 图纸', styles.assetLink),
      ...renderLinkGroup(data.deliveryAttachments || [], '交付附件', styles.assetLink),
    ];
  }, [data]);

  if (loading) return <div className={styles.page}><LoadingBlock title="加载正式方案" /></div>;
  if (error || !data) return <div className={styles.page}><ErrorBlock description={error || '方案详情不存在'} onRetry={() => void reload()} /></div>;

  const previewHasContent = Boolean(data.previewSummary) || previewGallery.length > 0 || previewLinks.length > 0 || data.previewHasCad || data.previewHasAttachments;
  const deliveryHasContent = Boolean(data.deliveryDescription) || deliveryGallery.length > 0 || deliveryLinks.length > 0;
  const hasAssetSection = previewHasContent || deliveryHasContent;
  const facts = buildFacts(data);
  const action = readActionDescriptor(data);
  const headline = buildHeadline(data.summary);
  const stageLead = readStageLead(data);
  const feeItems = [
    { label: '施工费参考', value: data.constructionFeeText },
    { label: '主材费参考', value: data.materialFeeText },
    { label: '总价估算', value: data.totalFeeText },
  ];
  const canShowOrderPanel = Boolean(data.hasOrder || data.orderId);
  const bridgeSummary = data.bridgeConversionSummary;

  const handleConfirm = async () => {
    setActing(true);
    setPendingAction('confirm');
    setFeedback(null);
    try {
      await confirmProposal(data.id);
      await reload();
      setFeedback({ text: '正式方案已确认。', tone: 'success' });
    } catch (submitError) {
      setFeedback({ text: submitError instanceof Error ? submitError.message : '确认方案失败', tone: 'danger' });
    } finally {
      setActing(false);
      setPendingAction(null);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return;
    setActing(true);
    setPendingAction('reject');
    setFeedback(null);
    try {
      await rejectProposal(data.id, rejectReason.trim());
      await reload();
      setShowReject(false);
      setRejectReason('');
      setFeedback({ text: '方案已退回，等待设计师重新整理。', tone: 'success' });
    } catch (submitError) {
      setFeedback({ text: submitError instanceof Error ? submitError.message : '驳回方案失败', tone: 'danger' });
    } finally {
      setActing(false);
      setPendingAction(null);
    }
  };

  return (
    <div className={styles.page}>
      <section className={styles.layout}>
        <section className={styles.overviewCard}>
          <div className={styles.headerMain}>
            <div className={styles.badgeRow}>
              <span className={styles.kicker}>正式方案</span>
              <span className={styles.infoChip} data-tone={readStatusTone(data)}>{data.statusText}</span>
              <span className={styles.infoChip}>V{data.version}</span>
            </div>
            <div className={styles.headlineBlock}>
              <h1 title={headline}>{headline}</h1>
              <p className={styles.lead}>{stageLead}</p>
            </div>
          </div>

          {facts.length ? (
            <div className={styles.factPanel}>
              {facts.map((item) => (
                <article className={styles.factItem} key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </article>
              ))}
            </div>
          ) : null}

          <section className={styles.feePanel}>
            <div className={styles.feePrimary}>
              <span>设计费</span>
              <strong>{data.designFeeText}</strong>
            </div>
            <div className={styles.feeMetaList}>
              {feeItems.map((item) => (
                <article className={styles.feeMetaItem} key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </article>
              ))}
            </div>
          </section>

          <div className={styles.summaryBlock}>
            <span className={styles.sectionLabel}>方案概述</span>
            <p>{data.summary}</p>
          </div>

          {bridgeSummary ? (
            <div className={styles.summaryBlock}>
              <span className={styles.sectionLabel}>施工桥接下一步</span>
              <p>{bridgeSummary.bridgeNextStep?.reason || data.flowSummary || '正式方案确认后，会继续进入施工主体选择与施工报价确认。'}</p>
              {bridgeSummary.bridgeNextStep?.actionHint ? <p>{bridgeSummary.bridgeNextStep.actionHint}</p> : null}
            </div>
          ) : null}
        </section>

        <aside className={styles.sideStack}>
          <section className={styles.sideCard}>
            <div className={styles.sideHead}>
              <span className={styles.sectionLabel}>当前动作</span>
              <strong>{action.title}</strong>
              <p>{action.hint}</p>
            </div>

            {feedback ? <div className="status-note" data-tone={feedback.tone}>{feedback.text}</div> : null}

            {data.rejectionReason ? (
              <div className={styles.sideNote}>
                <span className={styles.sectionLabel}>最近一次退回说明</span>
                <p>{data.rejectionReason}</p>
              </div>
            ) : null}

            <div className={styles.actionGroup}>
              {data.canConfirm ? (
                <>
                  <button className={styles.actionPrimary} disabled={acting} onClick={() => void handleConfirm()} type="button">
                    {pendingAction === 'confirm' ? '处理中…' : '确认方案'}
                  </button>
                  <button className={styles.actionSecondary} disabled={acting} onClick={() => setShowReject((prev) => !prev)} type="button">
                    {showReject ? '收起退回说明' : '退回方案'}
                  </button>
                </>
              ) : null}

              {!data.canConfirm && data.status === 2 && data.orderId ? (
                <Link className={styles.actionPrimary} to={`/orders/${data.orderId}`}>
                  查看订单
                </Link>
              ) : null}

              {!data.canConfirm && data.status === 2 && data.projectId ? (
                <Link className={styles.actionSecondary} to={`/projects/${data.projectId}`}>
                  查看项目
                </Link>
              ) : null}

              {!data.canConfirm && data.bookingId ? (
                <Link className={data.status === 2 ? styles.actionLink : styles.actionSecondary} to={`/bookings/${data.bookingId}`}>
                  返回预约详情
                </Link>
              ) : null}
            </div>

            {showReject && data.canReject ? (
              <div className={styles.rejectPanel}>
                <label className={styles.rejectLabel} htmlFor="proposal-reject-reason">退回说明</label>
                <textarea
                  className={styles.rejectTextarea}
                  id="proposal-reject-reason"
                  onChange={(event) => setRejectReason(event.target.value)}
                  placeholder="直接写明要调整的方向、预算或交付问题。"
                  rows={4}
                  value={rejectReason}
                />
                <button
                  className={styles.actionDanger}
                  disabled={acting || !rejectReason.trim()}
                  onClick={() => void handleReject()}
                  type="button"
                >
                  {pendingAction === 'reject' ? '处理中…' : '提交退回原因'}
                </button>
              </div>
            ) : null}
          </section>

          {canShowOrderPanel ? (
            <section className={styles.sideCard}>
              <div className={styles.sideHead}>
                <span className={styles.sectionLabel}>关联订单</span>
                <strong className={styles.orderNo} title={data.orderNo}>{data.orderNo}</strong>
                <p>用于继续查看支付进展、分期节点与后续履约状态。</p>
              </div>

              <div className={styles.orderSummary}>
                <div className={styles.orderSummaryItem}>
                  <span>付款节点</span>
                  <strong>{data.planItems.length ? `${data.planItems.length} 个` : '待补充'}</strong>
                </div>
                <span className={styles.infoChip} data-tone={readOrderTone(data.orderStatus)}>{data.orderStatusText}</span>
              </div>

              {data.planItems.length ? (
                <div className={styles.planList}>
                  {data.planItems.map((item) => (
                    <article className={styles.planItem} key={item.id}>
                      <div>
                        <strong>{item.name}</strong>
                        <p>{item.dueAt || '付款时间待补充'}</p>
                      </div>
                      <div className={styles.planMeta}>
                        <b>{item.amountText}</b>
                        <span>{item.statusText}</span>
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          {bridgeSummary ? (
            <section className={styles.sideCard}>
              <div className={styles.sideHead}>
                <span className={styles.sectionLabel}>桥接解释</span>
                <strong>{bridgeSummary.quoteBaselineSummary?.title || '报价基线待整理'}</strong>
                <p>{bridgeSummary.trustSignals?.officialReviewHint || '平台会在报价、验收与争议链路中持续留痕。'}</p>
              </div>
              {(bridgeSummary.responsibilityBoundarySummary?.items || []).length ? (
                <div className={styles.assetList}>
                  {bridgeSummary.responsibilityBoundarySummary?.items?.map((item) => <span className={styles.assetLink} key={item}>{item}</span>)}
                </div>
              ) : null}
              {(bridgeSummary.scheduleAndAcceptanceSummary?.items || []).length ? (
                <div className={styles.assetList}>
                  {bridgeSummary.scheduleAndAcceptanceSummary?.items?.map((item) => <span className={styles.assetLink} key={item}>{item}</span>)}
                </div>
              ) : null}
            </section>
          ) : null}
        </aside>
      </section>

      {hasAssetSection ? (
        <section className={styles.assetSection}>
          <div className={styles.sectionHead}>
            <h2>方案资料</h2>
            <p>预览资料与正式交付会按实际内容展示。</p>
          </div>

          <div className={styles.assetGrid}>
            {previewHasContent ? (
              <section className={styles.assetCard}>
                <div className={styles.assetHead}>
                  <h3>预览资料</h3>
                  {(data.previewHasCad || data.previewHasAttachments) ? (
                    <div className={styles.inlineTags}>
                      {data.previewHasCad ? <span className={styles.smallTag}>含 CAD</span> : null}
                      {data.previewHasAttachments ? <span className={styles.smallTag}>含附件</span> : null}
                    </div>
                  ) : null}
                </div>
                {data.previewSummary ? <p className={styles.assetCopy}>{data.previewSummary}</p> : null}
                {previewGallery.length ? <div className={styles.galleryGrid}>{previewGallery}</div> : null}
                {previewLinks.length ? <div className={styles.linkRow}>{previewLinks}</div> : null}
              </section>
            ) : null}

            {deliveryHasContent ? (
              <section className={styles.assetCard}>
                <div className={styles.assetHead}>
                  <h3>正式交付</h3>
                  <span className={styles.smallTag}>{data.deliveryUnlocked ? '已解锁' : '待补充'}</span>
                </div>
                {data.deliveryDescription ? <p className={styles.assetCopy}>{data.deliveryDescription}</p> : null}
                {deliveryGallery.length ? <div className={styles.galleryGrid}>{deliveryGallery}</div> : null}
                {deliveryLinks.length ? <div className={styles.linkRow}>{deliveryLinks}</div> : null}
              </section>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
