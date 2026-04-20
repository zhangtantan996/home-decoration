import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ErrorBlock, LoadingBlock } from '../components/AsyncState';
import { useAsyncData } from '../hooks/useAsyncData';
import { getOrderCenterEntryDetail, startOrderCenterEntryPayment, type OrderCenterEntryDetail } from '../services/orderCenter';
import { getOrderDetail, payOrder } from '../services/orders';
import type { OrderDetailPlanVM, OrderDetailVM } from '../types/viewModels';
import { formatCurrency, formatDateTime } from '../utils/format';
import { startAlipayWebPayment } from '../utils/paymentLaunch';
import styles from './OrderDetailPage.module.scss';

const LEGACY_STATUS_TONES: Record<number, Tone> = {
  0: 'warning',
  1: 'success',
  2: 'danger',
  3: 'danger',
};

const ENTRY_STATUS_TONES: Record<string, Tone> = {
  pending_payment: 'warning',
  paid: 'success',
  cancelled: 'danger',
  refund: 'danger',
};

const SOURCE_KIND_LABELS: Record<string, string> = {
  survey_deposit: '量房定金',
  design_order: '设计费订单',
  construction_order: '施工订单',
  material_order: '主材订单',
  refund_record: '退款记录',
  merchant_bond: '保证金记录',
};

const DONE_STATUS_PATTERN = /(done|completed|paid|success|confirmed|已完成|已支付|完成|确认)/i;
const DANGER_STATUS_PATTERN = /(danger|fail|failed|cancel|cancelled|refund|异常|取消|退款|驳回)/i;
const WARNING_STATUS_PATTERN = /(warning|pending|processing|待支付|待确认|待处理|处理中|进行中|未支付)/i;
const ME_ORDERS_PATH = '/me/orders';

type DetailState =
  | { mode: 'legacy'; detail: OrderDetailVM }
  | { mode: 'entry'; detail: OrderCenterEntryDetail };

type Tone = 'brand' | 'warning' | 'success' | 'danger';

interface DetailFact {
  label: string;
  value: string;
  mono?: boolean;
}

interface HeaderAction {
  kind: 'pay' | 'link';
  label: string;
  path?: string;
}

interface PaymentHighlight {
  title: string;
  summary: string;
  tone: Tone;
  facts: DetailFact[];
}

interface PaymentPlanItem {
  id: string;
  name: string;
  note: string;
  statusText: string;
  statusTone: Tone;
  amountText: string;
}

interface RecordItem {
  id: string;
  title: string;
  description: string;
  meta: string;
  statusText: string;
  statusTone: Tone;
}

interface RelatedItem {
  id: string;
  label: string;
  title: string;
  note: string;
  path?: string;
}

interface UnifiedOrderDetail {
  orderTypeLabel: string;
  statusText: string;
  statusTone: Tone;
  statusSummary: string;
  referenceNo: string;
  amountLabel: string;
  amountText: string;
  amountHint: string;
  amountAssist?: string;
  heroMetaFacts: DetailFact[];
  primaryAction?: HeaderAction;
  secondaryAction: HeaderAction;
  associationItems: RelatedItem[];
  infoFacts: DetailFact[];
  paymentHighlight?: PaymentHighlight;
  paymentPlans: PaymentPlanItem[];
  records: RecordItem[];
  businessNote?: string;
}

function pickPrimaryAssociation(items: RelatedItem[]) {
  if (!items.length) {
    return undefined;
  }

  const score = (item: RelatedItem) => {
    const joined = `${item.label} ${item.title} ${item.path || ''}`;
    if (/项目|project/i.test(joined)) return 3;
    if (/预约|booking/i.test(joined)) return 2;
    if (/方案|proposal/i.test(joined)) return 1;
    return 0;
  };

  return [...items].sort((left, right) => score(right) - score(left))[0];
}

interface OrderInfoRow {
  key: string;
  label: string;
  value: string;
  mono?: boolean;
  path?: string;
  tone?: Tone;
  helper?: string;
  compact?: boolean;
  copyable?: boolean;
}

interface SummaryMetric {
  label: string;
  value: string;
  tone?: 'default' | 'success' | 'accent';
  total?: boolean;
}

function formatLiveClock(date: Date) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date).replace(/\//g, '-');
}

function splitCurrencyText(value: string) {
  const amount = String(value || '').trim().replace(/[¥￥]/g, '').trim() || '0';
  return {
    symbol: '¥',
    amount,
  };
}

function getPrimaryTimeFact(items: DetailFact[]) {
  return items.find((item) => /支付时间|支付截止/.test(item.label)) || items[0];
}

function getDiscountText(view: UnifiedOrderDetail, detailPaymentFacts: DetailFact[]) {
  return pickMeaningfulText([
    view.amountAssist?.replace(/^已抵扣\s*/, ''),
    detailPaymentFacts.find((item) => /优惠|抵扣/.test(item.label))?.value,
  ], formatCurrency(0));
}

function getBaseAmountText(data: DetailState, fallback: string) {
  if (data.mode === 'legacy') {
    return moneyTextHasAmount(data.detail.totalAmountText) ? data.detail.totalAmountText : fallback;
  }
  return data.detail.order?.totalAmount ? formatCurrency(data.detail.order.totalAmount) : fallback;
}

function getPaymentMethodLabel(data: DetailState) {
  if (data.mode === 'entry') {
    return pickMeaningfulText([
      findSectionValue(data.detail, ['支付方式', '支付渠道', '付款方式']),
    ], data.detail.statusGroup === 'paid' ? '在线支付' : '待选择支付方式');
  }
  return data.detail.canPay ? '待选择支付方式' : '在线支付';
}

function parseRecordTime(value: string) {
  const normalized = String(value || '').trim().replace(/\//g, '-').replace(' ', 'T');
  const parsed = Date.parse(normalized);
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

function sortRecordsForDisplay(records: RecordItem[]) {
  return [...records].sort((left, right) => parseRecordTime(right.meta) - parseRecordTime(left.meta));
}

function decodeRouteToken(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function hasText(value: unknown) {
  return String(value ?? '').trim().length > 0;
}

function isReferenceLike(value: unknown) {
  return /^[A-Za-z]{0,6}\d{8,}$/.test(String(value ?? '').trim());
}

function pickText(values: unknown[], fallback = '') {
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (text) {
      return text;
    }
  }
  return fallback;
}

function pickMeaningfulText(values: unknown[], fallback = '') {
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (!text || isReferenceLike(text) || text === '-' || text === '待补充') {
      continue;
    }
    return text;
  }
  return fallback;
}

function normalizeStatusText(value: unknown, fallback: string) {
  const text = String(value ?? '').trim();
  if (!text) {
    return fallback;
  }
  const normalized = text.toLowerCase();
  if (normalized === 'paid') return '已支付';
  if (normalized === 'pending_payment' || normalized === 'pending' || normalized === 'unpaid') return '待支付';
  if (normalized === 'cancelled') return '已取消';
  if (normalized === 'refund') return '已退款';
  if (normalized === 'completed') return '已完成';
  if (normalized === 'processing') return '处理中';
  return text;
}

function formatTimeWithFallback(value: string | null | undefined, fallback: string) {
  return hasText(value) ? formatDateTime(value) : fallback;
}

function buildAmountHintText(label: string, value: string, pendingPayment: boolean) {
  if (!hasText(value) || value === '待支付完成后更新') {
    return pendingPayment ? '支付完成后将更新支付时间。' : '订单支付时间待同步。';
  }
  if (pendingPayment) {
    return `请在 ${value} 前完成支付。`;
  }
  return `${label} ${value}`;
}

function statusToneFromText(value: unknown, fallback: Tone = 'brand') {
  const text = String(value ?? '').trim();
  if (!text) {
    return fallback;
  }
  if (DANGER_STATUS_PATTERN.test(text)) return 'danger';
  if (DONE_STATUS_PATTERN.test(text)) return 'success';
  if (WARNING_STATUS_PATTERN.test(text)) return 'warning';
  return fallback;
}

function compactFacts(rows: DetailFact[]) {
  return rows.filter((item) => hasText(item.value) && item.value !== '-');
}

function dedupeFacts(rows: DetailFact[]) {
  const seen = new Set<string>();
  return rows.filter((item) => {
    const key = `${item.label}:${item.value}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function excludeFactLabels(rows: DetailFact[], labels: string[]) {
  const hidden = new Set(labels);
  return rows.filter((item) => !hidden.has(item.label));
}

function findSectionValue(detail: OrderCenterEntryDetail, labels: string[]) {
  const normalized = new Set(labels.map((item) => item.trim()));
  for (const section of detail.descriptionSections || []) {
    for (const item of section.items || []) {
      if (normalized.has(String(item.label || '').trim()) && String(item.value || '').trim()) {
        return item.value;
      }
    }
  }
  return '';
}

function moneyTextHasAmount(value: string | null | undefined) {
  const digits = String(value ?? '').replace(/[^\d]/g, '');
  return /[1-9]/.test(digits);
}

function pathActionLabel(path: string, fallback = '查看关联业务') {
  if (/\/projects\/\d+/.test(path)) return '查看项目进度';
  if (/\/bookings\/\d+\/design-quote/.test(path)) return '查看设计报价';
  if (/\/bookings\/\d+/.test(path)) return '查看预约详情';
  if (/\/proposals\/\d+/.test(path)) return '查看方案详情';
  return fallback;
}

function entryProposalId(detail: OrderCenterEntryDetail) {
  return detail.booking?.proposalId || detail.order?.proposalId || 0;
}

function entryBusinessActionPath(detail: OrderCenterEntryDetail) {
  if (hasText(detail.legacyActionPath) && !String(detail.legacyActionPath).startsWith('/orders/')) {
    return String(detail.legacyActionPath);
  }
  if (detail.project?.id) {
    return `/projects/${detail.project.id}`;
  }
  if (detail.sourceKind === 'survey_deposit' && detail.booking?.id) {
    return `/bookings/${detail.booking.id}`;
  }
  if (detail.sourceKind === 'design_order') {
    const proposalId = entryProposalId(detail);
    if (proposalId > 0) {
      return `/proposals/${proposalId}`;
    }
    if (detail.booking?.id) {
      return `/bookings/${detail.booking.id}`;
    }
  }
  if (detail.booking?.id) {
    return `/bookings/${detail.booking.id}`;
  }
  const proposalId = entryProposalId(detail);
  if (proposalId > 0) {
    return `/proposals/${proposalId}`;
  }
  return '';
}

function buildStatusSummary(statusText: string) {
  if (WARNING_STATUS_PATTERN.test(statusText)) {
    return '订单已生成，当前需要先完成支付。';
  }
  if (DANGER_STATUS_PATTERN.test(statusText)) {
    return '当前订单存在异常记录，请优先核对订单动态。';
  }
  return '';
}

function buildBusinessNote(orderTypeLabel: string) {
  if (orderTypeLabel === '设计费订单') {
    return '设计费支付后进入正式设计交付，不代表施工成交。';
  }
  return '';
}

function buildLegacyPaymentSection(detail: OrderDetailVM, statusText: string): { paymentHighlight?: PaymentHighlight; paymentPlans: PaymentPlanItem[] } {
  const plans = detail.planItems || [];
  const discountFact = moneyTextHasAmount(detail.discountText)
    ? [{ label: '优惠抵扣', value: detail.discountText, mono: true }]
    : [];

  if (plans.length === 1) {
    const plan = plans[0];
    return {
      paymentHighlight: {
        title: '资金与支付明细',
        summary: DONE_STATUS_PATTERN.test(plan.statusText || statusText) ? '本笔订单支付已完成。' : '当前订单仍有待支付项。',
        tone: statusToneFromText(plan.statusText || statusText, statusToneFromText(statusText, 'brand')),
        facts: compactFacts([
          { label: '支付金额', value: plan.amountText || detail.totalAmountText, mono: true },
          { label: '支付状态', value: normalizeStatusText(plan.statusText, statusText) },
          { label: '应付时间', value: hasText(plan.dueAt) && plan.dueAt !== '待补充' ? plan.dueAt : '应付时间未设置' },
          { label: '支付时间', value: hasText(detail.paidAt) ? detail.paidAt : '待支付完成后更新' },
          ...discountFact,
        ]),
      },
      paymentPlans: [],
    };
  }

  if (!plans.length) {
    return {
      paymentHighlight: {
        title: '资金与支付明细',
        summary: hasText(detail.paidAt) ? '当前订单支付结果已记录。' : '当前暂无更多支付记录。',
        tone: statusToneFromText(statusText, 'brand'),
        facts: compactFacts([
          { label: '订单金额', value: moneyTextHasAmount(detail.paidAmountText) ? detail.paidAmountText : detail.totalAmountText, mono: true },
          { label: '支付状态', value: statusText },
          { label: '支付时间', value: hasText(detail.paidAt) ? detail.paidAt : '待支付完成后更新' },
          ...discountFact,
        ]),
      },
      paymentPlans: [],
    };
  }

  return {
    paymentPlans: plans.map((item: OrderDetailPlanVM) => ({
      id: `legacy-plan-${item.id}`,
      name: item.name,
      note: hasText(item.dueAt) && item.dueAt !== '待补充' ? `应付时间 ${item.dueAt}` : '应付时间未设置',
      statusText: normalizeStatusText(item.statusText, '处理中'),
      statusTone: statusToneFromText(item.statusText, 'brand'),
      amountText: item.amountText,
    })),
  };
}

function buildEntryPaymentSection(detail: OrderCenterEntryDetail, statusText: string, amountText: string): { paymentHighlight?: PaymentHighlight; paymentPlans: PaymentPlanItem[] } {
  const plans = detail.paymentPlans || [];
  const discountFact = detail.order?.discount && detail.order.discount > 0
    ? [{ label: '优惠抵扣', value: formatCurrency(detail.order.discount), mono: true }]
    : [];

  if (plans.length === 1) {
    const plan = plans[0];
    return {
      paymentHighlight: {
        title: '资金与支付明细',
        summary: DONE_STATUS_PATTERN.test(plan.status || statusText) ? '本笔订单支付已完成。' : '当前订单仍有待支付项。',
        tone: statusToneFromText(plan.status || statusText, statusToneFromText(statusText, 'brand')),
        facts: compactFacts([
          { label: '支付金额', value: formatCurrency(plan.amount) || amountText, mono: true },
          { label: '支付状态', value: normalizeStatusText(plan.status, statusText) },
          { label: '应付时间', value: hasText(plan.dueAt) ? formatDateTime(plan.dueAt) : '应付时间未设置' },
          { label: '支付时间', value: hasText(plan.paidAt) ? formatDateTime(plan.paidAt) : formatTimeWithFallback(getEntryPaidAt(detail), '待支付完成后更新') },
          ...discountFact,
        ]),
      },
      paymentPlans: [],
    };
  }

  if (!plans.length) {
    return {
      paymentHighlight: {
        title: '资金与支付明细',
        summary: detail.statusGroup === 'paid' ? '当前订单支付结果已记录。' : '当前暂无更多支付明细。',
        tone: statusToneFromText(statusText, 'brand'),
        facts: compactFacts([
          { label: '订单金额', value: amountText, mono: true },
          { label: '支付状态', value: statusText },
          { label: '支付时间', value: formatTimeWithFallback(getEntryPaidAt(detail), '待支付完成后更新') },
          ...discountFact,
        ]),
      },
      paymentPlans: [],
    };
  }

  return {
    paymentPlans: plans.map((item) => ({
      id: `entry-plan-${item.id}`,
      name: item.name,
      note: hasText(item.paidAt)
        ? `支付时间 ${formatDateTime(item.paidAt)}`
        : hasText(item.dueAt)
          ? `应付时间 ${formatDateTime(item.dueAt)}`
          : '应付时间未设置',
      statusText: normalizeStatusText(item.status, '处理中'),
      statusTone: statusToneFromText(item.status, 'brand'),
      amountText: formatCurrency(item.amount),
    })),
  };
}

function buildLegacyRecords(detail: OrderDetailVM): RecordItem[] {
  const records: RecordItem[] = [
    {
      id: 'legacy-created',
      title: '订单创建',
      description: '系统已生成当前订单记录。',
      meta: detail.createdAt,
      statusText: '已创建',
      statusTone: 'brand',
    },
  ];

  if (hasText(detail.paidAt)) {
    records.push({
      id: 'legacy-paid',
      title: '订单已支付',
      description: '支付结果已同步到当前订单。',
      meta: detail.paidAt,
      statusText: '已支付',
      statusTone: 'success',
    });
  }

  const stage = pickMeaningfulText([detail.businessStage]);
  const summary = pickMeaningfulText([detail.flowSummary, detail.closureSummary?.nextPendingAction]);
  if (stage || summary) {
    records.push({
      id: 'legacy-status',
      title: stage || '状态已更新',
      description: summary || '订单相关进度已更新。',
      meta: '最新记录',
      statusText: stage ? '流转中' : '已记录',
      statusTone: stage ? 'warning' : 'brand',
    });
  }

  return records;
}

function buildEntryRecords(detail: OrderCenterEntryDetail): RecordItem[] {
  const timeline = (detail.timeline || []).map((item, index) => ({
    id: `entry-record-${index}`,
    title: pickText([item.title], '订单记录'),
    description: pickText([item.description], '状态已记录。'),
    meta: formatTimeWithFallback(item.at, '时间待补充'),
    statusText: normalizeStatusText(item.status, '已记录'),
    statusTone: statusToneFromText(item.status, 'brand'),
  }));

  if (timeline.length) {
    return timeline;
  }

  const fallback: RecordItem[] = [
    {
      id: 'entry-created',
      title: '订单创建',
      description: '系统已生成当前订单记录。',
      meta: formatTimeWithFallback(detail.createdAt, '时间待补充'),
      statusText: '已创建',
      statusTone: 'brand',
    },
  ];

  const paidAt = getEntryPaidAt(detail);
  if (hasText(paidAt)) {
    fallback.push({
      id: 'entry-paid',
      title: '订单已支付',
      description: '支付结果已同步到当前订单。',
      meta: formatDateTime(paidAt),
      statusText: '已支付',
      statusTone: 'success',
    });
  }

  const stage = pickMeaningfulText([
    findSectionValue(detail, ['当前阶段']),
    detail.businessStage,
  ]);
  const summary = pickMeaningfulText([
    findSectionValue(detail, ['进度说明']),
    detail.flowSummary,
    detail.subtitle,
  ]);
  if (stage || summary) {
    fallback.push({
      id: 'entry-status',
      title: stage || '状态已更新',
      description: summary || '相关进度已更新。',
      meta: '最新记录',
      statusText: stage ? '流转中' : '已记录',
      statusTone: stage ? 'warning' : 'brand',
    });
  }

  return fallback;
}

function getEntryPaidAt(detail: OrderCenterEntryDetail) {
  if (detail.sourceKind === 'survey_deposit') {
    return detail.booking?.surveyDepositPaidAt || detail.order?.paidAt || '';
  }

  const paidPlan = (detail.paymentPlans || []).find((item) => hasText(item.paidAt));
  return detail.order?.paidAt || paidPlan?.paidAt || '';
}

function getEntryReferenceNo(detail: OrderCenterEntryDetail) {
  return detail.referenceNo || detail.order?.orderNo || '待同步';
}

function buildLegacyAssociations(detail: OrderDetailVM): RelatedItem[] {
  const items: RelatedItem[] = [];

  if (detail.projectId) {
    items.push({
      id: `legacy-project-${detail.projectId}`,
      label: '关联项目',
      title: `项目 #${detail.projectId}`,
      note: '查看对应履约项目与进度。',
      path: `/projects/${detail.projectId}`,
    });
  }
  if (detail.bookingId) {
    items.push({
      id: `legacy-booking-${detail.bookingId}`,
      label: '关联预约',
      title: `预约记录 #${detail.bookingId}`,
      note: '查看预约详情与服务上下文。',
      path: `/bookings/${detail.bookingId}`,
    });
  }
  if (detail.proposalId) {
    items.push({
      id: `legacy-proposal-${detail.proposalId}`,
      label: '关联方案',
      title: `设计方案 #${detail.proposalId}`,
      note: '查看正式方案与后续确认。',
      path: `/proposals/${detail.proposalId}`,
    });
  }

  return items;
}

function buildEntryAssociations(detail: OrderCenterEntryDetail): RelatedItem[] {
  const items: RelatedItem[] = [];
  const proposalId = entryProposalId(detail);

  if (detail.project?.id) {
    items.push({
      id: `entry-project-${detail.project.id}`,
      label: '关联项目',
      title: pickMeaningfulText([detail.project.name], `项目 #${detail.project.id}`),
      note: pickMeaningfulText([
        detail.project.address,
        detail.project.flowSummary,
        detail.project.businessStage,
      ], '查看项目进度与履约状态。'),
      path: `/projects/${detail.project.id}`,
    });
  }

  if (detail.booking?.id) {
    items.push({
      id: `entry-booking-${detail.booking.id}`,
      label: detail.sourceKind === 'survey_deposit' ? '对应预约' : '关联预约',
      title: detail.provider?.name ? `预约 · ${detail.provider.name}` : `预约记录 #${detail.booking.id}`,
      note: pickMeaningfulText([
        detail.booking.address,
        detail.booking.preferredDate ? `预约时间 ${formatTimeWithFallback(detail.booking.preferredDate, '待同步')}` : '',
        detail.booking.createdAt ? `创建于 ${formatTimeWithFallback(detail.booking.createdAt, '待同步')}` : '',
      ], '查看预约详情与服务信息。'),
      path: `/bookings/${detail.booking.id}`,
    });
  }

  if (proposalId > 0) {
    items.push({
      id: `entry-proposal-${proposalId}`,
      label: '关联方案',
      title: `设计方案 #${proposalId}`,
      note: '查看正式方案与确认结果。',
      path: `/proposals/${proposalId}`,
    });
  }

  return items;
}

function buildLegacyPrimaryAction(detail: OrderDetailVM): HeaderAction | undefined {
  if (detail.canPay) {
    return { kind: 'pay', label: '去支付' };
  }
  if (hasText(detail.primaryActionPath) && detail.primaryActionPath !== ME_ORDERS_PATH) {
    return {
      kind: 'link',
      label: detail.primaryActionLabel || pathActionLabel(detail.primaryActionPath),
      path: detail.primaryActionPath,
    };
  }
  return undefined;
}

function buildEntryPrimaryAction(detail: OrderCenterEntryDetail): HeaderAction | undefined {
  if (detail.statusGroup === 'pending_payment') {
    return { kind: 'pay', label: '去支付' };
  }
  const path = entryBusinessActionPath(detail);
  if (!hasText(path) || path === ME_ORDERS_PATH) {
    return undefined;
  }
  return {
    kind: 'link',
    label: pathActionLabel(path),
    path,
  };
}

function buildLegacyView(detail: OrderDetailVM): UnifiedOrderDetail {
  const statusText = normalizeStatusText(detail.statusText, detail.canPay ? '待支付' : '处理中');
  const statusTone = LEGACY_STATUS_TONES[detail.status] || statusToneFromText(statusText, 'brand');
  const paymentSection = buildLegacyPaymentSection(detail, statusText);
  const associations = buildLegacyAssociations(detail);
  const keyTimeLabel = detail.canPay ? '支付截止' : '支付时间';
  const keyTimeValue = detail.canPay
    ? formatTimeWithFallback(detail.expireAt, '待支付完成后更新')
    : formatTimeWithFallback(detail.paidAt, '待支付完成后更新');
  const amountText = !detail.canPay && moneyTextHasAmount(detail.paidAmountText)
    ? detail.paidAmountText
    : detail.totalAmountText;
  const heroMetaFacts = compactFacts([
    { label: keyTimeLabel, value: keyTimeValue },
    { label: '下单时间', value: formatTimeWithFallback(detail.createdAt, '待同步') },
  ]);
  const infoFacts = excludeFactLabels(dedupeFacts(compactFacts([
    { label: '下单时间', value: formatTimeWithFallback(detail.createdAt, '待同步') },
    { label: keyTimeLabel, value: keyTimeValue },
    { label: '优惠抵扣', value: moneyTextHasAmount(detail.discountText) ? detail.discountText : '', mono: moneyTextHasAmount(detail.discountText) },
  ])), heroMetaFacts.map((item) => item.label));

  return {
    orderTypeLabel: detail.orderTypeText,
    statusText,
    statusTone,
    statusSummary: buildStatusSummary(statusText),
    referenceNo: detail.orderNo,
    amountLabel: detail.canPay ? '待支付金额' : '订单金额',
    amountText,
    amountHint: buildAmountHintText(keyTimeLabel, keyTimeValue, detail.canPay),
    amountAssist: moneyTextHasAmount(detail.discountText) ? `已抵扣 ${detail.discountText}` : '',
    heroMetaFacts,
    primaryAction: buildLegacyPrimaryAction(detail),
    secondaryAction: { kind: 'link', label: '返回订单列表', path: ME_ORDERS_PATH },
    associationItems: associations,
    infoFacts,
    paymentHighlight: paymentSection.paymentHighlight,
    paymentPlans: paymentSection.paymentPlans,
    records: buildLegacyRecords(detail),
    businessNote: buildBusinessNote(detail.orderTypeText),
  };
}

function buildEntryView(detail: OrderCenterEntryDetail): UnifiedOrderDetail {
  const orderTypeLabel = SOURCE_KIND_LABELS[detail.sourceKind] || '订单';
  const statusText = normalizeStatusText(detail.statusText, detail.statusGroup === 'pending_payment' ? '待支付' : '处理中');
  const statusTone = ENTRY_STATUS_TONES[detail.statusGroup] || statusToneFromText(statusText, 'brand');
  const amountValue = detail.statusGroup === 'pending_payment' && detail.payableAmount > 0 ? detail.payableAmount : detail.amount;
  const amountText = formatCurrency(amountValue);
  const paidAt = getEntryPaidAt(detail);
  const keyTimeLabel = detail.statusGroup === 'pending_payment' ? '支付截止' : '支付时间';
  const keyTimeValue = detail.statusGroup === 'pending_payment'
    ? formatTimeWithFallback(detail.expireAt, '待支付完成后更新')
    : formatTimeWithFallback(paidAt, '待支付完成后更新');
  const paymentSection = buildEntryPaymentSection(detail, statusText, amountText);
  const associations = buildEntryAssociations(detail);
  const referenceNo = getEntryReferenceNo(detail);
  const addressText = pickMeaningfulText([
    detail.booking?.address,
    detail.project?.address,
    findSectionValue(detail, ['项目地址']),
  ]);
  const providerText = pickMeaningfulText([detail.provider?.name]);
  const nextPaymentName = pickMeaningfulText([findSectionValue(detail, ['应付名称'])]);
  const nextPaymentPeriod = pickMeaningfulText([findSectionValue(detail, ['应付期数'])]);
  const paymentNodeText = pickMeaningfulText([
    nextPaymentName && nextPaymentPeriod ? `${nextPaymentPeriod} · ${nextPaymentName}` : nextPaymentName,
  ]);
  const surveyTimeText = pickMeaningfulText([
    findSectionValue(detail, ['预约量房时间']),
    detail.booking?.preferredDate ? formatTimeWithFallback(detail.booking.preferredDate, '待同步') : '',
  ]);
  const goodsSummaryText = pickMeaningfulText([
    findSectionValue(detail, ['商品摘要', '商品名称']),
    detail.title,
  ]);
  const contextFacts = dedupeFacts(compactFacts([
    { label: '服务提供方', value: providerText },
    { label: '服务地址', value: addressText },
    { label: '支付节点', value: paymentNodeText },
    { label: '预约时间', value: detail.sourceKind === 'survey_deposit' ? surveyTimeText : '' },
    { label: '商品摘要', value: detail.sourceKind === 'material_order' ? goodsSummaryText : '' },
  ]));

  const heroMetaFacts = (() => {
    switch (detail.sourceKind) {
      case 'survey_deposit':
        return compactFacts([
          { label: keyTimeLabel, value: keyTimeValue },
          { label: '下单时间', value: formatTimeWithFallback(detail.createdAt, '待同步') },
          { label: '预约时间', value: surveyTimeText },
        ]);
      case 'construction_order':
        return compactFacts([
          { label: keyTimeLabel, value: keyTimeValue },
          { label: '下单时间', value: formatTimeWithFallback(detail.createdAt, '待同步') },
          { label: '支付节点', value: paymentNodeText },
        ]);
      case 'material_order':
        return compactFacts([
          { label: keyTimeLabel, value: keyTimeValue },
          { label: '下单时间', value: formatTimeWithFallback(detail.createdAt, '待同步') },
          { label: '服务地址', value: addressText },
          { label: '商品摘要', value: goodsSummaryText },
        ]);
      default:
        return compactFacts([
          { label: keyTimeLabel, value: keyTimeValue },
          { label: '下单时间', value: formatTimeWithFallback(detail.createdAt, '待同步') },
          { label: '服务提供方', value: providerText },
        ]);
    }
  })();

  return {
    orderTypeLabel,
    statusText,
    statusTone,
    statusSummary: buildStatusSummary(statusText),
    referenceNo,
    amountLabel: detail.statusGroup === 'pending_payment' ? '待支付金额' : '订单金额',
    amountText,
    amountHint: buildAmountHintText(keyTimeLabel, keyTimeValue, detail.statusGroup === 'pending_payment'),
    amountAssist: detail.order?.discount && detail.order.discount > 0 ? `已抵扣 ${formatCurrency(detail.order.discount)}` : '',
    heroMetaFacts,
    primaryAction: buildEntryPrimaryAction(detail),
    secondaryAction: { kind: 'link', label: '返回订单列表', path: ME_ORDERS_PATH },
    associationItems: associations,
    infoFacts: excludeFactLabels(contextFacts, heroMetaFacts.map((item) => item.label)),
    paymentHighlight: paymentSection.paymentHighlight,
    paymentPlans: paymentSection.paymentPlans,
    records: buildEntryRecords(detail),
    businessNote: buildBusinessNote(orderTypeLabel),
  };
}

function buildViewModel(data: DetailState) {
  return data.mode === 'legacy' ? buildLegacyView(data.detail) : buildEntryView(data.detail);
}

function CopyIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
      <path d="M5.5 2.5h6a1 1 0 0 1 1 1v7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.25" />
      <rect height="9" rx="1.5" stroke="currentColor" strokeWidth="1.25" width="8" x="2.5" y="4.5" />
    </svg>
  );
}

function OrderGlyph() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 18.5h12" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <path d="M7.5 15.5l6.9-6.9a1.8 1.8 0 0 1 2.5 0l.5.5a1.8 1.8 0 0 1 0 2.5l-6.9 6.9-3.6.6.6-3.6Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M14.2 8.8l3 3" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function CheckGlyph() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
      <path d="M3.5 8.2 6.5 11l6-6.4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

export function OrderDetailPage() {
  const params = useParams();
  const rawToken = String(params.id || '').trim();
  const numericOrderId = /^\d+$/.test(rawToken) ? Number(rawToken) : 0;
  const entryKey = useMemo(
    () => (rawToken && !numericOrderId ? decodeRouteToken(rawToken) : ''),
    [numericOrderId, rawToken],
  );
  const { data, loading, error, reload } = useAsyncData<DetailState>(
    async () => {
      if (entryKey) {
        const detail = await getOrderCenterEntryDetail(entryKey);
        return { mode: 'entry', detail };
      }
      if (numericOrderId > 0) {
        const detail = await getOrderDetail(numericOrderId);
        return { mode: 'legacy', detail };
      }
      throw new Error('缺少订单交易凭证，请返回我的订单重新查看。');
    },
    [entryKey, numericOrderId],
  );
  const [actionError, setActionError] = useState('');
  const [paying, setPaying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => formatLiveClock(new Date()));

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(formatLiveClock(new Date())), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!copied) {
      return undefined;
    }
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  if (!rawToken) {
    return (
      <main className="container page-stack">
        <ErrorBlock description="缺少订单编号，请返回我的订单重新查看。" />
      </main>
    );
  }

  if (loading && !data) {
    return (
      <main className="container page-stack">
        <LoadingBlock title="正在加载订单详情" />
      </main>
    );
  }

  if (error && !data) {
    return (
      <main className="container page-stack">
        <ErrorBlock description={error} onRetry={() => void reload()} />
      </main>
    );
  }

  if (!data) {
    return null;
  }

  const view = buildViewModel(data);

  const handlePay = async () => {
    setActionError('');
    setPaying(true);
    try {
      if (data.mode === 'entry') {
        await startAlipayWebPayment((request) => startOrderCenterEntryPayment(data.detail.entryKey, request), { onPaid: reload });
      } else {
        await startAlipayWebPayment((request) => payOrder(data.detail.id, request), { onPaid: reload });
      }
    } catch (payError) {
      setActionError(payError instanceof Error ? payError.message : '发起支付失败，请稍后重试。');
    } finally {
      setPaying(false);
    }
  };

  const handleCopyReferenceNo = async () => {
    if (!hasText(view.referenceNo) || view.referenceNo === '待同步' || typeof document === 'undefined') {
      return;
    }

    const fallbackCopy = () => {
      const textArea = document.createElement('textarea');
      textArea.value = view.referenceNo;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    };

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(view.referenceNo);
      } else {
        fallbackCopy();
      }
      setCopied(true);
    } catch {
      try {
        fallbackCopy();
        setCopied(true);
      } catch {
        setActionError('复制订单编号失败，请稍后重试。');
      }
    }
  };

  const renderAction = (action: HeaderAction | undefined, isPrimary: boolean) => {
    if (!action) {
      return null;
    }
    const className = isPrimary ? styles.actionPrimary : styles.actionSecondary;
    if (action.kind === 'pay') {
      return (
        <button className={className} disabled={paying} onClick={() => void handlePay()} type="button">
          {paying ? '拉起支付中…' : action.label}
        </button>
      );
    }
    return (
      <Link className={className} to={action.path || ME_ORDERS_PATH}>
        {action.label}
      </Link>
    );
  };

  const primaryAssociation = pickPrimaryAssociation(view.associationItems);
  const secondaryAssociations = view.associationItems.filter((item) => item.id !== primaryAssociation?.id);
  const primaryTimeFact = getPrimaryTimeFact(view.heroMetaFacts);
  const detailPaymentFacts = view.paymentHighlight
    ? view.paymentHighlight.facts.filter((item) => {
      const duplicatedInHero = view.heroMetaFacts.some((fact) => fact.label === item.label && fact.value === item.value);
      const duplicatedAmount = /金额/.test(item.label) && item.value === view.amountText;
      const duplicatedStatus = /状态/.test(item.label) && item.value === view.statusText;
      return !duplicatedInHero && !duplicatedAmount && !duplicatedStatus;
    })
    : [];
  const amountParts = splitCurrencyText(view.amountText);
  const baseAmountText = getBaseAmountText(data, view.amountText);
  const discountText = getDiscountText(view, detailPaymentFacts);
  const summaryMetrics: SummaryMetric[] = [
    { label: '订单金额', value: baseAmountText },
    { label: '优惠抵扣', value: moneyTextHasAmount(discountText) ? `-${discountText}` : `-${formatCurrency(0)}`, tone: moneyTextHasAmount(discountText) ? 'success' : 'default' },
    { label: view.primaryAction?.kind === 'pay' ? '待支付金额' : '实付金额', value: view.amountText, tone: 'accent', total: true },
  ];
  const orderInfoRows: OrderInfoRow[] = [
    { key: 'reference-no', label: '订单编号', value: view.referenceNo, mono: true, copyable: true },
    primaryAssociation
      ? {
        key: `association-${primaryAssociation.id}`,
        label: primaryAssociation.label,
        value: primaryAssociation.title,
        path: primaryAssociation.path,
        compact: true,
      }
      : {
        key: 'association-empty',
        label: '关联业务',
        value: '业务对象待同步',
      },
    {
      key: 'primary-time',
      label: primaryTimeFact?.label || (view.primaryAction?.kind === 'pay' ? '支付截止' : '支付时间'),
      value: primaryTimeFact?.value || '待同步',
      mono: true,
    },
    {
      key: 'status',
      label: '订单状态',
      value: view.statusText,
      tone: view.statusTone,
    },
    {
      key: 'payment-method',
      label: '支付方式',
      value: getPaymentMethodLabel(data),
    },
    ...view.infoFacts.map((item, index) => ({
      key: `fact-${index}-${item.label}`,
      label: item.label,
      value: item.value,
      mono: item.mono,
    })),
    ...secondaryAssociations.map((item, index) => ({
      key: `secondary-${index}-${item.id}`,
      label: item.label,
      value: item.title,
      path: item.path,
    })),
  ];
  const displayRecords = sortRecordsForDisplay(view.records);
  const actionDescription = view.primaryAction?.kind === 'pay'
    ? '完成当前订单支付，或返回订单列表。'
    : view.primaryAction
      ? '查看关联业务，或返回订单列表。'
      : '当前没有更多操作，可返回订单列表。';

  return (
    <main className={styles.pageShell}>
      <div aria-hidden="true" className={styles.bgAtmosphere}>
        <div className={`${styles.bgBlob} ${styles.bgBlobOne}`}></div>
        <div className={`${styles.bgBlob} ${styles.bgBlobTwo}`}></div>
        <div className={`${styles.bgBlob} ${styles.bgBlobThree}`}></div>
      </div>
      <div aria-hidden="true" className={styles.bgGrid}></div>

      <div className={styles.page}>
        <nav aria-label="面包屑导航" className={styles.topNav}>
          <div className={styles.breadcrumb}>
            <Link to={ME_ORDERS_PATH}>订单管理</Link>
            <span className={styles.breadcrumbSep}>/</span>
            <span className={styles.breadcrumbCurrent}>订单详情</span>
          </div>
          <div className={styles.navTime}>{currentTime}</div>
        </nav>

        <section aria-label="订单概览" className={styles.heroSection}>
          <div aria-hidden="true" className={styles.heroGlowOne}></div>
          <div aria-hidden="true" className={styles.heroGlowTwo}></div>

          <div className={styles.heroTop}>
            <div className={styles.heroLabelGroup}>
              <div className={styles.heroIconWrap}>
                <OrderGlyph />
              </div>
              <div>
                <div className={styles.heroTitle}>{view.orderTypeLabel}</div>
                <div className={styles.heroSubtitle}>订单详情</div>
                {hasText(view.statusSummary) ? <p className={styles.heroDescription}>{view.statusSummary}</p> : null}
              </div>
            </div>

            <div className={styles.statusBadge} data-tone={view.statusTone}>
              <span className={styles.statusDot}></span>
              {view.statusText}
            </div>
          </div>

          <div className={styles.heroAmountRow}>
            <span className={styles.amountCurrency}>{amountParts.symbol}</span>
            <span className={styles.amountValue}>{amountParts.amount}</span>
            <span className={styles.amountLabel}>{view.amountLabel}</span>
          </div>
        </section>

        <div className={styles.contentGrid}>
          <div className={styles.leftContent}>
            <article className={styles.infoCard}>
              <div className={styles.cardHeader}>
                <span className={styles.cardMarker}></span>
                <span>订单信息</span>
              </div>

              <div className={styles.cardBody}>
                {orderInfoRows.map((row) => (
                  <div className={styles.infoRow} key={row.key}>
                    <div className={styles.infoLabel}>{row.label}</div>
                    <div className={`${styles.infoValue}${row.mono ? ` ${styles.mono}` : ''}`}>
                      {row.copyable ? (
                        <div className={styles.copyValueRow}>
                          <span>{row.value}</span>
                          <button
                            aria-label="复制订单编号"
                            className={`${styles.copyInlineButton}${copied ? ` ${styles.copyInlineButtonCopied}` : ''}`}
                            onClick={() => void handleCopyReferenceNo()}
                            type="button"
                          >
                            <CopyIcon />
                            {copied ? '已复制' : '复制'}
                          </button>
                        </div>
                      ) : row.path && row.compact ? (
                        <>
                          <Link className={styles.appointmentTag} to={row.path}>
                            {row.value}
                          </Link>
                          {row.helper ? <div className={styles.infoHelper}>{row.helper}</div> : null}
                        </>
                      ) : row.path ? (
                        <>
                          <Link className={styles.inlineLink} to={row.path}>
                            {row.value}
                          </Link>
                          {row.helper ? <div className={styles.infoHelper}>{row.helper}</div> : null}
                        </>
                      ) : row.tone ? (
                        <span className={styles.rowStatus} data-tone={row.tone}>{row.value}</span>
                      ) : (
                        <>
                          <span>{row.value}</span>
                          {row.helper ? <div className={styles.infoHelper}>{row.helper}</div> : null}
                        </>
                      )}
                    </div>
                  </div>
                ))}

                {view.businessNote ? (
                  <div className={styles.infoNote}>
                    <span>业务说明</span>
                    <p>{view.businessNote}</p>
                  </div>
                ) : null}
              </div>

              {displayRecords.length ? (
                <div className={styles.cardSubsection}>
                  <div className={styles.cardSubsectionHead}>
                    <span className={styles.cardSubsectionTitle}>订单动态</span>
                  </div>

                  <div className={styles.cardSubsectionBody}>
                    <div className={styles.timeline}>
                      {displayRecords.map((item, index) => {
                        const finished = item.statusTone === 'success' || item.statusTone === 'brand' || /已支付|已创建|已完成/.test(item.statusText);
                        const muted = item.statusTone === 'danger';
                        const showDescription = item.description && !/状态已记录。|系统已生成当前订单记录。|支付结果已同步到当前订单。/.test(item.description);

                        return (
                          <div className={styles.timelineItem} key={item.id}>
                            <div className={styles.timelineLineArea}>
                              <div className={styles.timelineDot} data-tone={finished ? 'success' : item.statusTone}>
                                {finished ? (
                                  <span className={styles.timelineCheck}>
                                    <CheckGlyph />
                                  </span>
                                ) : null}
                              </div>
                              {index < displayRecords.length - 1 ? (
                                <div className={styles.timelineConnector} data-tone={finished ? 'success' : 'brand'}></div>
                              ) : null}
                            </div>

                            <div className={styles.timelineContent}>
                              <div className={`${styles.timelineTitle}${muted ? ` ${styles.timelineTitleMuted}` : ''}`}>
                                {item.title}
                              </div>
                              <div className={styles.timelineTime}>{item.meta}</div>
                              {showDescription ? <div className={styles.timelineDescription}>{item.description}</div> : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : null}
            </article>
          </div>

          <aside className={styles.sidePanel}>
            <section className={styles.actionCard}>
              <div className={styles.cardTitle}>快捷操作</div>
              <div className={styles.cardDesc}>{actionDescription}</div>
              {view.primaryAction ? renderAction(view.primaryAction, true) : null}
              {renderAction(view.secondaryAction, false)}
              {actionError ? <div className={styles.actionError}>{actionError}</div> : null}
            </section>

            <section className={styles.summaryCard}>
              <div className={styles.summaryTitle}>费用摘要</div>
              <div className={styles.summaryItems}>
                {summaryMetrics.map((item, index) => (
                  <div className={`${styles.summaryItem}${item.total ? ` ${styles.summaryItemTotal}` : ''}`} key={`${item.label}-${index}`}>
                    <span className={styles.summaryItemLabel}>{item.label}</span>
                    <span className={styles.summaryItemValue} data-tone={item.tone || 'default'}>
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {view.paymentPlans.length ? (
              <section className={styles.paymentCard}>
                <div className={styles.summaryTitle}>支付计划</div>
                <div className={styles.planMiniList}>
                  {view.paymentPlans.map((item) => (
                    <div className={styles.planMiniItem} key={item.id}>
                      <div className={styles.planMiniHeader}>
                        <strong>{item.name}</strong>
                        <span className={styles.rowStatus} data-tone={item.statusTone}>{item.statusText}</span>
                      </div>
                      <div className={styles.planMiniMeta}>
                        <span>{item.note}</span>
                        <strong className={styles.mono}>{item.amountText}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </aside>
        </div>
      </div>
    </main>
  );
}
