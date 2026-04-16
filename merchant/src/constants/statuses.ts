export const BUSINESS_STAGE_META: Record<string, { text: string; color: string }> = {
  lead_pending: { text: '线索待推进', color: 'default' },
  negotiating: { text: '沟通中', color: 'processing' },
  survey_deposit_pending: { text: '量房费待支付', color: 'gold' },
  design_quote_pending: { text: '设计费报价待确认', color: 'processing' },
  design_fee_paying: { text: '设计费支付中', color: 'gold' },
  design_pending_submission: { text: '待设计师提交方案', color: 'gold' },
  design_delivery_pending: { text: '设计交付件待上传', color: 'gold' },
  design_acceptance_pending: { text: '设计成果待验收', color: 'processing' },
  design_pending_confirmation: { text: '设计方案待确认', color: 'processing' },
  construction_party_pending: { text: '施工桥接中', color: 'gold' },
  construction_quote_pending: { text: '施工报价待确认', color: 'processing' },
  ready_to_start: { text: '待监理协调开工', color: 'gold' },
  in_construction: { text: '施工中', color: 'blue' },
  node_acceptance_in_progress: { text: '节点验收中', color: 'orange' },
  completed: { text: '已完工待验收', color: 'success' },
  case_pending_generation: { text: '案例生成中', color: 'processing' },
  archived: { text: '已归档', color: 'default' },
  disputed: { text: '争议中', color: 'error' },
  cancelled: { text: '已取消', color: 'default' },
  payment_paused: { text: '支付冻结', color: 'error' },
};

export const BUSINESS_ACTION_LABELS: Record<string, string> = {
  create_proposal: '提交方案',
  confirm_proposal: '确认设计方案',
  reject_proposal: '驳回设计方案',
  submit_site_survey: '提交量房资料',
  confirm_site_survey: '查看量房资料',
  request_site_survey_revision: '重新上传量房资料',
  submit_budget: '提交沟通确认',
  accept_budget: '确认沟通结果',
  reject_budget: '退回沟通结果',
  submit_design_quote: '发送设计费报价',
  confirm_design_quote: '确认设计费报价',
  reject_design_quote: '驳回设计费报价',
  submit_design_delivery: '提交设计交付件',
  approve_design_delivery: '通过设计验收',
  reject_design_delivery: '驳回设计验收',
  create_quote_task: '创建施工报价任务',
  select_constructor: '选择施工主体',
  submit_construction_quote: '提交施工报价',
  confirm_construction_quote: '确认施工报价',
  reject_construction_quote: '驳回施工报价',
  start_project: '发起开工',
  submit_milestone: '提交节点验收',
  approve_milestone: '通过节点验收',
  reject_milestone: '驳回节点验收',
  submit_completion: '提交完工材料',
  approve_completion: '通过整体验收',
  reject_completion: '驳回整体验收',
  generate_inspiration_draft: '生成案例草稿',
};

export const BOOKING_STATUS_META: Record<number, { text: string; color: string }> = {
  1: { text: '待处理', color: 'gold' },
  2: { text: '已确认', color: 'blue' },
  3: { text: '已完成', color: 'green' },
  4: { text: '已取消', color: 'default' },
};

export const SITE_SURVEY_STATUS_META: Record<string, { text: string; color: string }> = {
  submitted: { text: '已上传', color: 'processing' },
  confirmed: { text: '已完成', color: 'success' },
  revision_requested: { text: '已退回', color: 'warning' },
};

export const BUDGET_CONFIRM_STATUS_META: Record<string, { text: string; color: string }> = {
  submitted: { text: '待用户确认', color: 'processing' },
  accepted: { text: '已完成', color: 'success' },
  rejected: { text: '已退回', color: 'error' },
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
  'merchant.application.approved': '入驻提醒',
  'merchant.application.rejected': '入驻提醒',
  'case_audit.approved': '案例审核',
  'case_audit.rejected': '案例审核',
  'booking.created': '预约提醒',
  'booking.confirmed': '预约提醒',
  'booking.cancelled': '预约提醒',
  'booking.intent_paid': '预约提醒',
  'proposal.submitted': '方案提醒',
  'proposal.confirmed': '方案提醒',
  'proposal.rejected': '方案提醒',
  'proposal.timeout': '方案提醒',
  'order.paid': '支付提醒',
  'order.expiring': '支付提醒',
  'order.expired': '支付提醒',
  'quote.confirmed': '报价提醒',
  'quote.submitted': '报价提醒',
  'quote.rejected': '报价提醒',
  'quote.awarded': '报价提醒',
  'project.milestone.submitted': '节点提醒',
  'project.milestone.approved': '节点提醒',
  'project.milestone.rejected': '节点提醒',
  'project.completion.submitted': '完工提醒',
  'project.completion.approved': '完工提醒',
  'project.completion.rejected': '完工提醒',
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
  'refund.succeeded': '退款提醒',
  'payment.construction.pending': '施工付款',
  'payment.construction.stage_pending': '施工付款',
  'payment.construction.final_pending': '施工付款',
  'payment.construction.expiring': '施工付款',
  'payment.construction.expired': '施工付款',
  'change_order.created': '项目变更',
  'change_order.confirmed': '项目变更',
  'change_order.rejected': '项目变更',
  'change_order.payment_pending': '项目变更',
  'change_order.settlement_required': '项目变更',
  'change_order.settled': '项目变更',
  'complaint.created': '投诉提醒',
  'complaint.resolved': '投诉提醒',
  'withdraw.created': '财务提醒',
  'withdraw.approved': '财务提醒',
  'withdraw.rejected': '财务提醒',
  'withdraw.completed': '财务提醒',
};

export const getMerchantNotificationTagColor = (type: string): string => {
  if (type.startsWith('payment.') || type.startsWith('order.') || type.startsWith('refund.') || type.startsWith('withdraw.')) {
    return 'gold';
  }
  if (type.startsWith('change_order.') || type.startsWith('project.') || type.startsWith('complaint.')) {
    return 'blue';
  }
  if (type.startsWith('quote.') || type.startsWith('proposal.')) {
    return 'cyan';
  }
  if (type.startsWith('booking.')) {
    return 'purple';
  }
  if (type.startsWith('merchant.application.') || type.startsWith('case_audit.')) {
    return 'geekblue';
  }
  return 'default';
};
