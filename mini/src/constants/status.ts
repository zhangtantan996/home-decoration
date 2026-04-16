import type { TagProps } from '@/components/Tag';

export type TagVariant = NonNullable<TagProps['variant']>;

export const proposalStatusMap: Record<number, { label: string; variant: TagVariant }> = {
  0: { label: '待确认', variant: 'warning' },
  1: { label: '待确认', variant: 'warning' },
  2: { label: '已确认', variant: 'success' },
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
  [-1]: { label: '待确认施工报价', variant: 'warning' },
  0: { label: '进行中', variant: 'brand' },
  1: { label: '已完工', variant: 'success' },
  2: { label: '已暂停', variant: 'warning' },
  3: { label: '已关闭', variant: 'default' },
};

export const projectPhaseStatusMap: Record<string, { label: string; variant: TagVariant }> = {
  pending: { label: '待开始', variant: 'default' },
  in_progress: { label: '进行中', variant: 'brand' },
  completed: { label: '已完成', variant: 'success' },
};

export const businessStageMap: Record<string, { label: string; variant: TagVariant }> = {
  lead_pending: { label: '线索待推进', variant: 'default' },
  survey_deposit_pending: { label: '量房服务推进中', variant: 'warning' },
  negotiating: { label: '沟通中', variant: 'default' },
  design_quote_pending: { label: '待确认设计报价', variant: 'warning' },
  design_fee_paying: { label: '待支付设计费', variant: 'warning' },
  design_pending_submission: { label: '待设计师提交方案', variant: 'warning' },
  design_delivery_pending: { label: '待交付设计成果', variant: 'warning' },
  design_acceptance_pending: { label: '待验收设计成果', variant: 'warning' },
  design_pending_confirmation: { label: '设计方案待确认', variant: 'warning' },
  construction_party_pending: { label: '施工桥接中', variant: 'warning' },
  construction_quote_pending: { label: '施工报价待确认', variant: 'warning' },
  ready_to_start: { label: '待监理协调开工', variant: 'warning' },
  in_construction: { label: '施工中', variant: 'brand' },
  node_acceptance_in_progress: { label: '节点验收中', variant: 'warning' },
  completed: { label: '已完工待验收', variant: 'success' },
  archived: { label: '已归档', variant: 'default' },
  disputed: { label: '争议中', variant: 'error' },
  cancelled: { label: '已取消', variant: 'default' },
};

export const refundStatusMap: Record<string, { label: string; variant: TagVariant }> = {
  pending: { label: '待审核', variant: 'warning' },
  approved: { label: '已通过', variant: 'brand' },
  rejected: { label: '已驳回', variant: 'error' },
  completed: { label: '已完成', variant: 'success' },
};

export const orderTypeLabelMap: Record<string, string> = {
  design: '设计费订单',
  construction: '施工费订单',
  material: '主材费订单',
};

export const pendingPaymentTypeLabelMap: Record<string, string> = {
  intent_fee: '量房费',
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

export const getBusinessStageStatus = (stage?: string) => {
  const normalized = String(stage || '').trim().toLowerCase();
  return businessStageMap[normalized] || { label: stage || '处理中', variant: 'default' as TagVariant };
};

export const getProjectPhaseStatus = (status: string) => {
  return projectPhaseStatusMap[status] || { label: '待开始', variant: 'default' as TagVariant };
};

export const getRefundStatus = (status?: string) => {
  if (!status) {
    return { label: '未申请', variant: 'default' as TagVariant };
  }
  return refundStatusMap[status] || { label: status, variant: 'default' as TagVariant };
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
