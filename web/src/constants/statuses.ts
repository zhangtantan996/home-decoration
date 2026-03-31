export const PROJECT_STATUS_LABELS: Record<number, string> = {
  0: '进行中',
  1: '已完工',
  2: '已暂停',
  3: '已关闭',
  [-1]: '待完善',
};

export const BUSINESS_STAGE_LABELS: Record<string, string> = {
  lead_pending: '线索待推进',
  negotiating: '沟通中',
  design_pending_submission: '待设计师提交方案',
  design_pending_confirmation: '设计方案待确认',
  construction_party_pending: '待确认施工方',
  construction_quote_pending: '施工报价待确认',
  ready_to_start: '待开工',
  in_construction: '施工中',
  node_acceptance_in_progress: '节点验收中',
  completed: '已完工待验收',
  archived: '已归档',
  disputed: '争议中',
  cancelled: '已取消',
};

export const BOOKING_STATUS_LABELS: Record<number, string> = {
  1: '待沟通',
  2: '已确认',
  3: '已完成',
  4: '已取消',
};

export const SITE_SURVEY_STATUS_LABELS: Record<string, string> = {
  submitted: '已提交',
  confirmed: '已确认',
  revision_requested: '待重新量房',
};

export const BUDGET_CONFIRM_STATUS_LABELS: Record<string, string> = {
  submitted: '待确认',
  accepted: '已接受',
  rejected: '已拒绝',
};

export const PROPOSAL_STATUS_LABELS: Record<number, string> = {
  1: '待业主确认',
  2: '已确认',
  3: '已拒绝',
  4: '已被新版本替代',
};

export const PHASE_STATUS_LABELS: Record<string, string> = {
  pending: '未开始',
  in_progress: '进行中',
  completed: '已完成',
};

export const MILESTONE_STATUS_LABELS: Record<string, string> = {
  '0': '待开始',
  '1': '施工中',
  '2': '待验收',
  '3': '已验收',
  '4': '已放款',
  '5': '已驳回',
  pending: '待开始',
  in_progress: '施工中',
  submitted: '待验收',
  accepted: '已验收',
  paid: '已放款',
  rejected: '已驳回',
  completed: '已验收',
};

export const ORDER_STATUS_LABELS: Record<number, string> = {
  0: '待支付',
  1: '已支付',
  2: '已取消',
  3: '已退款',
};

export const REFUND_STATUS_LABELS: Record<string, string> = {
  pending: '待审核',
  approved: '已通过',
  rejected: '已驳回',
  completed: '已完成',
};

export const REFUND_TYPE_LABELS: Record<string, string> = {
  intent_fee: '量房定金退款',
  design_fee: '设计费退款',
  construction_fee: '施工费退款',
  full: '全部可退金额',
};

export const BUDGET_INCLUDE_LABELS: Record<string, string> = {
  design_fee: '设计费',
  construction_fee: '施工费',
  material_fee: '主材费',
  furniture_fee: '家具软装',
};

export const TRANSACTION_STATUS_LABELS: Record<number, string> = {
  0: '处理中',
  1: '成功',
  2: '失败',
};

export function getBusinessStageLabel(stage?: string) {
  const normalized = String(stage || '').trim().toLowerCase();
  return BUSINESS_STAGE_LABELS[normalized] || stage || '-';
}
