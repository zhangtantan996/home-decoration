export const ADMIN_PROJECT_STATUS_META: Record<number, { text: string; color: string }> = {
  0: { text: '进行中', color: 'blue' },
  1: { text: '已完工', color: 'green' },
  2: { text: '已暂停', color: 'orange' },
  3: { text: '已关闭', color: 'default' },
};

export const ADMIN_BOOKING_STATUS_META: Record<number, { text: string; tagStatus: 'warning' | 'info' | 'completed' | 'rejected' }> = {
  1: { text: '待处理', tagStatus: 'warning' },
  2: { text: '已确认', tagStatus: 'info' },
  3: { text: '已完成', tagStatus: 'completed' },
  4: { text: '已取消', tagStatus: 'rejected' },
};

export const ADMIN_BOOKING_STATUS_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 1, label: '待处理' },
  { value: 2, label: '已确认' },
  { value: 3, label: '已完成' },
  { value: 4, label: '已取消' },
];

export const ADMIN_BUSINESS_STAGE_META: Record<string, { text: string; color: string }> = {
  lead_pending: { text: '线索待推进', color: 'default' },
  negotiating: { text: '沟通中', color: 'processing' },
  design_pending_submission: { text: '待设计师提交方案', color: 'gold' },
  design_pending_confirmation: { text: '设计方案待确认', color: 'processing' },
  construction_party_pending: { text: '待确定施工方（可干预）', color: 'gold' },
  construction_quote_pending: { text: '施工报价待确认（可干预）', color: 'processing' },
  ready_to_start: { text: '待开工', color: 'gold' },
  in_construction: { text: '施工中', color: 'blue' },
  node_acceptance_in_progress: { text: '节点验收中', color: 'orange' },
  completed: { text: '已完工待验收', color: 'success' },
  archived: { text: '已归档', color: 'default' },
  disputed: { text: '争议中', color: 'error' },
  cancelled: { text: '已取消', color: 'default' },
};

export const ADMIN_PROJECT_STAGE_FILTERS: Array<{ value: string; label: string }> = [
  { value: 'construction_party_pending', label: '待确定施工方（可干预）' },
  { value: 'construction_quote_pending', label: '施工报价待确认（可干预）' },
  { value: 'ready_to_start', label: '待开工' },
  { value: 'in_construction', label: '施工中' },
  { value: 'node_acceptance_in_progress', label: '节点验收中' },
  { value: 'completed', label: '已完工待验收' },
  { value: 'archived', label: '已归档' },
];

export const PROJECT_AUDIT_STATUS_META: Record<string, { text: string; color: string }> = {
  pending: { text: '待处理', color: 'gold' },
  in_progress: { text: '处理中', color: 'blue' },
  completed: { text: '已完成', color: 'green' },
};

export const PROJECT_AUDIT_STATUS_OPTIONS: Array<{ label: string; value: string }> = [
  { label: '待处理', value: 'pending' },
  { label: '处理中', value: 'in_progress' },
  { label: '已完成', value: 'completed' },
];

export const PROJECT_AUDIT_TYPE_LABELS: Record<string, string> = {
  dispute: '争议审计',
  refund: '退款审计',
  close: '关闭审计',
};

export const PROJECT_AUDIT_CONCLUSION_LABELS: Record<string, string> = {
  continue: '继续履约',
  refund: '退款关闭',
  partial_refund: '部分退款继续施工',
  close: '直接关闭',
};

export const REFUND_STATUS_META: Record<string, { text: string; color: string }> = {
  pending: { text: '待审核', color: 'gold' },
  approved: { text: '已批准', color: 'blue' },
  rejected: { text: '已拒绝', color: 'red' },
  completed: { text: '已完成', color: 'green' },
};

export const REFUND_STATUS_OPTIONS: Array<{ label: string; value: string }> = [
  { label: '待审核', value: 'pending' },
  { label: '已批准', value: 'approved' },
  { label: '已拒绝', value: 'rejected' },
  { label: '已完成', value: 'completed' },
];

export const REFUND_TYPE_LABELS: Record<string, string> = {
  intent_fee: '意向金',
  design_fee: '设计费',
  construction_fee: '施工费',
  full: '全额退款',
};

export const AUDIT_RECORD_KIND_LABELS: Record<string, { text: string; status: 'approved' | 'info' }> = {
  business: { text: '业务审计', status: 'approved' },
  request: { text: '请求日志', status: 'info' },
};

export const COMPLAINT_STATUS_META: Record<string, { text: string; color: string }> = {
  submitted: { text: '待处理', color: 'gold' },
  processing: { text: '处理中', color: 'blue' },
  resolved: { text: '已解决', color: 'green' },
  closed: { text: '已关闭', color: 'default' },
};

export const RISK_LEVEL_META: Record<string, { text: string; color: string }> = {
  low: { text: '低风险', color: 'blue' },
  medium: { text: '中风险', color: 'orange' },
  high: { text: '高风险', color: 'red' },
  critical: { text: '紧急', color: 'purple' },
};

export const RISK_LEVEL_OPTIONS: Array<{ label: string; value: string }> = [
  { label: '低风险', value: 'low' },
  { label: '中风险', value: 'medium' },
  { label: '高风险', value: 'high' },
  { label: '紧急', value: 'critical' },
];

export const RISK_WARNING_STATUS_META: Record<number, { text: string; color: string }> = {
  0: { text: '待处理', color: 'orange' },
  1: { text: '处理中', color: 'blue' },
  2: { text: '已处理', color: 'green' },
  3: { text: '已忽略', color: 'default' },
};

export const RISK_WARNING_STATUS_OPTIONS: Array<{ label: string; value: number }> = [
  { label: '处理中', value: 1 },
  { label: '已处理', value: 2 },
  { label: '忽略', value: 3 },
];

export const ARBITRATION_STATUS_META: Record<number, { text: string; color: string }> = {
  0: { text: '待受理', color: 'orange' },
  1: { text: '审理中', color: 'blue' },
  2: { text: '已裁决', color: 'green' },
  3: { text: '已驳回', color: 'red' },
};

export const ARBITRATION_STATUS_OPTIONS: Array<{ label: string; value: number }> = [
  { label: '待受理', value: 0 },
  { label: '审理中', value: 1 },
  { label: '已裁决', value: 2 },
  { label: '已驳回', value: 3 },
];

export const ARBITRATION_HANDLE_STATUS_OPTIONS: Array<{ label: string; value: number }> = [
  { label: '标记为审理中', value: 1 },
  { label: '裁决通过', value: 2 },
  { label: '驳回申请', value: 3 },
];

export const APPLICATION_AUDIT_STATUS_META: Record<number, { text: string; color: string }> = {
  0: { text: '待审核', color: 'orange' },
  1: { text: '已通过', color: 'green' },
  2: { text: '已拒绝', color: 'red' },
};

export const APPLICATION_AUDIT_STATUS_OPTIONS: Array<{ label: string; value: number | 'all' }> = [
  { label: '待审核', value: 0 },
  { label: '已通过', value: 1 },
  { label: '已拒绝', value: 2 },
  { label: '全部', value: 'all' },
];

export const IDENTITY_APPLICATION_STATUS_META: Record<number, { text: string; color: string }> = {
  ...APPLICATION_AUDIT_STATUS_META,
  3: { text: '已停用', color: 'default' },
};

export const IDENTITY_APPLICATION_STATUS_OPTIONS: Array<{ label: string; value: number | 'all' }> = [
  { label: '待审核', value: 0 },
  { label: '已通过', value: 1 },
  { label: '已拒绝', value: 2 },
  { label: '已停用', value: 3 },
  { label: '全部', value: 'all' },
];

export const ESCROW_ACCOUNT_STATUS_META: Record<number, { text: string; tagStatus: 'warning' | 'approved' | 'rejected' | 'info' }> = {
  0: { text: '待激活', tagStatus: 'warning' },
  1: { text: '正常', tagStatus: 'approved' },
  2: { text: '冻结', tagStatus: 'rejected' },
  3: { text: '已清算', tagStatus: 'info' },
};

export const FINANCE_TRANSACTION_TYPE_LABELS: Record<string, string> = {
  deposit: '充值',
  withdraw: '提现',
  transfer: '转账',
  refund: '退款',
  release: '放款',
  freeze: '冻结',
  unfreeze: '解冻',
};

export const FINANCE_TRANSACTION_STATUS_META: Record<number, { text: string; tagStatus: 'warning' | 'approved' | 'rejected' | 'info' }> = {
  0: { text: '处理中', tagStatus: 'warning' },
  1: { text: '成功', tagStatus: 'approved' },
  2: { text: '失败', tagStatus: 'rejected' },
};

export const CASE_AUDIT_ACTION_META: Record<string, { text: string; color: string }> = {
  create: { text: '新增', color: 'orange' },
  update: { text: '修改', color: 'blue' },
  delete: { text: '删除', color: 'red' },
};

export const CASE_AUDIT_SOURCE_META: Record<string, { text: string; color: string }> = {
  project_completion: { text: '项目沉淀', color: 'purple' },
  manual: { text: '手动提交', color: 'default' },
};

export const CASE_AUDIT_STATUS_META: Record<number, { text: string; color: string }> = {
  0: { text: '待审核', color: 'orange' },
  1: { text: '已通过', color: 'success' },
  2: { text: '已拒绝', color: 'error' },
};

export const PROVIDER_ROLE_META: Record<string, { text: string; color: string }> = {
  designer: { text: '设计师', color: 'purple' },
  company: { text: '装修公司', color: 'blue' },
  foreman: { text: '工长', color: 'gold' },
};

export const IDENTITY_TYPE_LABELS: Record<string, string> = {
  provider: '服务类商家',
};

export const ENTITY_TYPE_LABELS: Record<string, string> = {
  personal: '个人主体',
  company: '公司主体',
  studio: '工作室主体',
  individual_business: '个体工商户',
};

export const APPLICANT_TYPE_LABELS: Record<string, string> = {
  personal: '个人主体入驻',
  studio: '工作室主体入驻',
  company: '公司主体入驻',
  foreman: '工长入驻',
};

export const MERCHANT_KIND_LABELS: Record<string, string> = {
  provider: '服务类商家',
  material_shop: '主材商',
};

export const PRICING_LABELS: Record<string, string> = {
  flat: '平层报价',
  duplex: '复式报价',
  other: '其他报价',
  perSqm: '施工报价',
  fullPackage: '全包报价',
  halfPackage: '半包报价',
};

export const MATERIAL_PRODUCT_PARAM_LABELS: Record<string, string> = {
  brand: '品牌',
  spec: '规格',
  specification: '规格',
  model: '型号',
  series: '系列',
  material: '材质',
  color: '颜色',
  size: '尺寸',
  weight: '重量',
  unit: '单位',
  origin: '产地',
  sku: 'SKU',
};

export const AUDIT_MODULE_OPTIONS: Array<{ key: 'all' | 'provider' | 'material' | 'identity' | 'case'; label: string }> = [
  { key: 'all', label: '待审核' },
  { key: 'provider', label: '服务类商家' },
  { key: 'material', label: '主材商' },
  { key: 'identity', label: '身份申请' },
  { key: 'case', label: '案例' },
];

export const ADMIN_PROVIDER_TYPE_META: Record<number, { text: string; color: string }> = {
  1: { text: '设计师', color: 'blue' },
  2: { text: '装修公司', color: 'green' },
  3: { text: '工长', color: 'orange' },
};

export const ADMIN_PROVIDER_TYPE_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 1, label: '设计师' },
  { value: 2, label: '装修公司' },
  { value: 3, label: '工长' },
];

export const PROVIDER_SUBTYPE_LABELS: Record<string, string> = {
  personal: '个人主体',
  studio: '工作室主体',
  company: '公司主体',
};

export const VERIFIED_FILTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'true', label: '已认证' },
  { value: 'false', label: '未认证' },
];

export const VERIFICATION_STATUS_META: Record<string, { text: string; color: string }> = {
  true: { text: '已认证', color: 'green' },
  false: { text: '未认证', color: 'red' },
};

export const ADMIN_PROVIDER_STATUS_META: Record<number, { text: string; color: string }> = {
  1: { text: '正常', color: 'green' },
  0: { text: '封禁', color: 'red' },
};

export const ADMIN_PROVIDER_STATUS_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 1, label: '正常' },
  { value: 0, label: '封禁' },
];

export const PUBLIC_VISIBILITY_META: Record<string, { text: string; color: string }> = {
  true: { text: '可见', color: 'success' },
  false: { text: '不可见', color: 'warning' },
  unknown: { text: '未知', color: 'default' },
};

export const LEGACY_PATH_BADGE = { text: 'legacy', color: 'gold' } as const;

export const MATERIAL_SHOP_TYPE_META: Record<string, { text: string; color: string }> = {
  brand: { text: '品牌店', color: 'blue' },
  showroom: { text: '展示店', color: 'green' },
};

export const MATERIAL_SHOP_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'brand', label: '品牌店' },
  { value: 'showroom', label: '展示店' },
];

export const ACCOUNT_BOUND_STATUS_META: Record<string, { text: string; color: string }> = {
  true: { text: '已绑定账号', color: 'green' },
  false: { text: '未绑定账号', color: 'default' },
};

export const LOGIN_ENABLED_STATUS_META: Record<string, { text: string; color: string }> = {
  true: { text: '可登录', color: 'success' },
  false: { text: '不可登录', color: 'warning' },
};

export const SETTLED_STATUS_META: Record<string, { text: string; color: string }> = {
  true: { text: '已入驻', color: 'green' },
  false: { text: '未入驻', color: 'orange' },
};

export const SETTLED_FILTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'true', label: '已入驻' },
  { value: 'false', label: '未入驻' },
];
