import type { TagProps } from '@/components/Tag';

export type TagVariant = NonNullable<TagProps['variant']>;

export const proposalStatusMap: Record<number, { label: string; variant: TagVariant }> = {
  0: { label: '待确认', variant: 'warning' },
  1: { label: '待确认', variant: 'warning' },
  2: { label: '已接受', variant: 'success' },
  3: { label: '已拒绝', variant: 'error' },
  4: { label: '已替代', variant: 'default' },
};

export const orderStatusMap: Record<number, { label: string; variant: TagVariant; desc: string }> = {
  0: { label: '待付款', variant: 'warning', desc: '请尽快完成支付' },
  1: { label: '已支付', variant: 'success', desc: '订单已支付，等待履约' },
  2: { label: '已取消', variant: 'default', desc: '订单已取消' },
  3: { label: '已退款', variant: 'brand', desc: '订单已退款' },
};

export const projectStatusMap: Record<number, { label: string; variant: TagVariant }> = {
  0: { label: '待准备', variant: 'default' },
  1: { label: '施工中', variant: 'brand' },
  2: { label: '验收中', variant: 'warning' },
  3: { label: '已完工', variant: 'success' },
  4: { label: '已取消', variant: 'default' },
};

export const projectPhaseStatusMap: Record<string, { label: string; variant: TagVariant }> = {
  pending: { label: '待开始', variant: 'default' },
  in_progress: { label: '进行中', variant: 'brand' },
  completed: { label: '已完成', variant: 'success' },
};

export const orderTypeLabelMap: Record<string, string> = {
  design: '设计费订单',
  construction: '施工费订单',
  material: '主材费订单',
};

export const pendingPaymentTypeLabelMap: Record<string, string> = {
  intent_fee: '意向金',
  design_fee: '设计费',
  construction_fee: '施工费',
};

export const getProposalStatus = (status: number) => {
  return proposalStatusMap[status] || { label: '未知状态', variant: 'default' as TagVariant };
};

export const getOrderStatus = (status: number) => {
  return orderStatusMap[status] || { label: '未知状态', variant: 'default' as TagVariant, desc: '-' };
};

export const getProjectStatus = (status?: number) => {
  if (typeof status !== 'number') {
    return { label: '未开始', variant: 'default' as TagVariant };
  }
  return projectStatusMap[status] || { label: '未知状态', variant: 'default' as TagVariant };
};

export const getProjectPhaseStatus = (status: string) => {
  return projectPhaseStatusMap[status] || { label: '待开始', variant: 'default' as TagVariant };
};

export const getOrderTypeLabel = (type?: string) => {
  if (!type) {
    return '普通订单';
  }
  return orderTypeLabelMap[type] || type;
};

export const getPendingPaymentTypeLabel = (type?: string) => {
  if (!type) {
    return '待付款项';
  }
  return pendingPaymentTypeLabelMap[type] || type;
};
