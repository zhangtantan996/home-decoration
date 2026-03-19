export const BUSINESS_STAGE_META: Record<string, { text: string; color: string }> = {
  lead_pending: { text: '线索待推进', color: 'default' },
  negotiating: { text: '沟通中', color: 'processing' },
  design_pending_submission: { text: '待设计师提交方案', color: 'gold' },
  design_pending_confirmation: { text: '设计方案待确认', color: 'processing' },
  construction_party_pending: { text: '待确认施工方', color: 'gold' },
  construction_quote_pending: { text: '施工报价待确认', color: 'processing' },
  ready_to_start: { text: '待开工', color: 'gold' },
  in_construction: { text: '施工中', color: 'blue' },
  node_acceptance_in_progress: { text: '节点验收中', color: 'orange' },
  completed: { text: '已完工待验收', color: 'success' },
  archived: { text: '已归档', color: 'default' },
  disputed: { text: '争议中', color: 'error' },
  cancelled: { text: '已取消', color: 'default' },
};

export const BOOKING_STATUS_META: Record<number, { text: string; color: string }> = {
  1: { text: '待处理', color: 'gold' },
  2: { text: '已确认', color: 'blue' },
  3: { text: '已完成', color: 'green' },
  4: { text: '已取消', color: 'default' },
};

export const SITE_SURVEY_STATUS_META: Record<string, { text: string; color: string }> = {
  submitted: { text: '已提交', color: 'processing' },
  confirmed: { text: '已确认', color: 'success' },
  revision_requested: { text: '待重新量房', color: 'warning' },
};

export const BUDGET_CONFIRM_STATUS_META: Record<string, { text: string; color: string }> = {
  submitted: { text: '待用户确认', color: 'processing' },
  accepted: { text: '用户已接受', color: 'success' },
  rejected: { text: '用户已拒绝', color: 'error' },
};

export const PROPOSAL_STATUS_META: Record<number, { text: string; color: string }> = {
  1: { text: '待确认', color: 'gold' },
  2: { text: '已确认', color: 'green' },
  3: { text: '已拒绝', color: 'red' },
  4: { text: '已被替代', color: 'default' },
};

export const ORDER_STATUS_META: Record<number, { text: string; color: string }> = {
  0: { text: '待支付', color: 'gold' },
  1: { text: '已支付', color: 'green' },
  2: { text: '已取消', color: 'default' },
  3: { text: '已退款', color: 'red' },
};

export const MILESTONE_STATUS_META: Record<number, { text: string; color: string }> = {
  0: { text: '待开始', color: 'default' },
  1: { text: '施工中', color: 'processing' },
  2: { text: '待验收', color: 'warning' },
  3: { text: '已验收', color: 'success' },
  4: { text: '已放款', color: 'success' },
  5: { text: '已驳回', color: 'error' },
};

export const PROJECT_STATUS_META: Record<number, { text: string; color: string }> = {
  0: { text: '进行中', color: 'blue' },
  1: { text: '已完工', color: 'green' },
  2: { text: '已暂停', color: 'orange' },
  3: { text: '已关闭', color: 'default' },
};

export const COMPLAINT_STATUS_META: Record<string, { text: string; color: string }> = {
  submitted: { text: '待处理', color: 'gold' },
  processing: { text: '处理中', color: 'blue' },
  resolved: { text: '已解决', color: 'green' },
  closed: { text: '已关闭', color: 'default' },
};

export const QUOTE_LIST_STATUS_META: Record<string, { text: string; color: string }> = {
  draft: { text: '草稿', color: 'default' },
  quoting: { text: '报价中', color: 'processing' },
  pricing_in_progress: { text: '报价填写中', color: 'processing' },
  submitted: { text: '已正式提交', color: 'blue' },
  merchant_reviewing: { text: '修改中', color: 'gold' },
  submitted_to_user: { text: '已提交给用户', color: 'cyan' },
  user_confirmed: { text: '用户已确认', color: 'success' },
  rejected: { text: '已驳回', color: 'error' },
  superseded: { text: '已作废', color: 'default' },
  locked: { text: '已锁定', color: 'warning' },
  awarded: { text: '已定标', color: 'success' },
  closed: { text: '已归档', color: 'default' },
};

export const MERCHANT_NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  'booking.intent_paid': '预约提醒',
  'proposal.submitted': '方案提醒',
  'proposal.confirmed': '方案提醒',
  'proposal.rejected': '方案提醒',
  'project.paused': '项目提醒',
  'project.resumed': '项目提醒',
  'project.dispute.created': '争议提醒',
  'project.audit.completed': '审计结果',
  'project.finance.frozen': '财务提醒',
  'project.finance.unfrozen': '财务提醒',
  'project.finance.released': '财务提醒',
  'refund.application.created': '退款提醒',
  'refund.application.approved': '退款提醒',
  'refund.application.rejected': '退款提醒',
  'withdraw.approved': '财务提醒',
  'withdraw.rejected': '财务提醒',
};
