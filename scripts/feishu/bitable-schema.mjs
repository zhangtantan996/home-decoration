export const PROJECT_MODULES = [
  'server',
  'admin',
  'merchant',
  'web',
  'mobile',
  'mini',
  'deploy',
  'tests/e2e',
  'ops',
];

export const RISK_DOMAINS = [
  'auth',
  'identity',
  'payment/escrow',
  'im',
  'public-web',
  'deploy',
  'other',
];

export const VERIFY_COMMANDS = [
  'npm run verify:user-web',
  'npm run test:identity:acceptance',
  'npm run test:e2e:merchant:smoke',
  'cd server && make test',
];

export const FIELD_TYPES = {
  text: 1,
  number: 2,
  singleSelect: 3,
  multiSelect: 4,
  dateTime: 5,
  checkbox: 7,
  user: 11,
  phone: 13,
  url: 15,
  multiLineText: 23,
};

function singleSelectOptions(options) {
  return {
    options: options.map((name) => ({ name })),
  };
}

function multiSelectOptions(options) {
  return {
    options: options.map((name) => ({ name })),
  };
}

export const baseSchema = {
  baseName: 'home-decoration 问题提报与协同底座',
  tables: [
    {
      name: '问题池',
      fields: [
        { field_name: '编号', type: FIELD_TYPES.text },
        { field_name: '标题', type: FIELD_TYPES.text },
        {
          field_name: '类型',
          type: FIELD_TYPES.singleSelect,
          property: singleSelectOptions(['问题提报', '缺陷', '任务', '风险', '需求澄清']),
        },
        {
          field_name: '来源',
          type: FIELD_TYPES.singleSelect,
          property: singleSelectOptions(['手工提报', '会议', '测试', '用户反馈', '自动巡检']),
        },
        {
          field_name: '模块',
          type: FIELD_TYPES.multiSelect,
          property: multiSelectOptions(PROJECT_MODULES),
        },
        {
          field_name: '业务域',
          type: FIELD_TYPES.multiSelect,
          property: multiSelectOptions(['认证', '身份', '支付结算', 'IM', '公网 Web', '部署', '多端一致性', '其他']),
        },
        {
          field_name: '优先级',
          type: FIELD_TYPES.singleSelect,
          property: singleSelectOptions(['P0', 'P1', 'P2', 'P3']),
        },
        {
          field_name: '严重度',
          type: FIELD_TYPES.singleSelect,
          property: singleSelectOptions(['阻断', '高', '中', '低']),
        },
        {
          field_name: '状态',
          type: FIELD_TYPES.singleSelect,
          property: singleSelectOptions(['待分派', '进行中', '待验证', '已解决', '已关闭', '阻塞']),
        },
        { field_name: '提交人', type: FIELD_TYPES.user },
        { field_name: '指派给', type: FIELD_TYPES.user },
        { field_name: '协作者', type: FIELD_TYPES.user },
        { field_name: '计划开始时间', type: FIELD_TYPES.dateTime },
        { field_name: '截止时间', type: FIELD_TYPES.dateTime },
        { field_name: '实际完成时间', type: FIELD_TYPES.dateTime },
        { field_name: '当前结果', type: FIELD_TYPES.multiLineText },
        { field_name: '复现步骤', type: FIELD_TYPES.multiLineText },
        { field_name: '期望结果', type: FIELD_TYPES.multiLineText },
        { field_name: '实际结果', type: FIELD_TYPES.multiLineText },
        { field_name: '相关链接', type: FIELD_TYPES.url },
        { field_name: '关联项目任务', type: FIELD_TYPES.text },
        {
          field_name: '验证状态',
          type: FIELD_TYPES.singleSelect,
          property: singleSelectOptions(['未验证', '验证中', '验证通过', '验证失败']),
        },
        { field_name: '验证人', type: FIELD_TYPES.user },
        { field_name: '备注', type: FIELD_TYPES.multiLineText },
      ],
      views: [
        { view_name: '全部问题', view_type: 'grid' },
        { view_name: '待我处理', view_type: 'grid' },
        { view_name: '待我验证', view_type: 'grid' },
        { view_name: '本周到期', view_type: 'grid' },
        { view_name: 'P0/P1', view_type: 'grid' },
        { view_name: '按模块看板', view_type: 'kanban' },
        { view_name: '阻塞项', view_type: 'grid' },
        { view_name: '已解决待关闭', view_type: 'grid' },
      ],
    },
    {
      name: '项目协同',
      fields: [
        { field_name: '项目项名称', type: FIELD_TYPES.text },
        {
          field_name: '所属模块',
          type: FIELD_TYPES.multiSelect,
          property: multiSelectOptions(PROJECT_MODULES),
        },
        {
          field_name: '阶段',
          type: FIELD_TYPES.singleSelect,
          property: singleSelectOptions(['待开始', '进行中', '待验收', '已完成', '阻塞']),
        },
        { field_name: '负责人', type: FIELD_TYPES.user },
        { field_name: '计划日期', type: FIELD_TYPES.dateTime },
        { field_name: '截止日期', type: FIELD_TYPES.dateTime },
        {
          field_name: '风险等级',
          type: FIELD_TYPES.singleSelect,
          property: singleSelectOptions(['高', '中', '低']),
        },
        { field_name: '依赖项', type: FIELD_TYPES.multiLineText },
        { field_name: '验收标准', type: FIELD_TYPES.multiLineText },
        { field_name: '关联问题', type: FIELD_TYPES.text },
      ],
      views: [
        { view_name: '项目总览', view_type: 'grid' },
        { view_name: '按负责人', view_type: 'grid' },
        { view_name: '按模块', view_type: 'kanban' },
        { view_name: '阻塞与风险', view_type: 'grid' },
      ],
    },
    {
      name: '成员目录',
      fields: [
        { field_name: '成员名', type: FIELD_TYPES.text },
        {
          field_name: '角色',
          type: FIELD_TYPES.singleSelect,
          property: singleSelectOptions(['产品', '设计', '前端', '后端', '测试', '运维', '管理']),
        },
        {
          field_name: '负责模块',
          type: FIELD_TYPES.multiSelect,
          property: multiSelectOptions(PROJECT_MODULES),
        },
        { field_name: '飞书用户标识', type: FIELD_TYPES.text },
        { field_name: '可指派状态', type: FIELD_TYPES.checkbox },
      ],
      views: [
        { view_name: '成员目录', view_type: 'grid' },
      ],
    },
    {
      name: '验证记录',
      fields: [
        { field_name: '验证名称', type: FIELD_TYPES.text },
        { field_name: '关联问题', type: FIELD_TYPES.text },
        { field_name: '关联项目项', type: FIELD_TYPES.text },
        {
          field_name: '验证类型',
          type: FIELD_TYPES.singleSelect,
          property: singleSelectOptions(['手工', '冒烟', 'E2E', '回归', '接口']),
        },
        { field_name: '验证人', type: FIELD_TYPES.user },
        {
          field_name: '结果',
          type: FIELD_TYPES.singleSelect,
          property: singleSelectOptions(['通过', '失败', '阻塞']),
        },
        { field_name: '失败摘要', type: FIELD_TYPES.multiLineText },
        { field_name: '执行时间', type: FIELD_TYPES.dateTime },
        {
          field_name: '相关命令/入口',
          type: FIELD_TYPES.singleSelect,
          property: singleSelectOptions(VERIFY_COMMANDS),
        },
      ],
      views: [
        { view_name: '待验证', view_type: 'grid' },
        { view_name: '验证失败', view_type: 'grid' },
        { view_name: '最近通过', view_type: 'grid' },
      ],
    },
  ],
  permissions: {
    default_allow: ['提交问题', '编辑自己创建的问题', '查看全局视图'],
    default_restrict: [
      '只有负责人/管理员可改状态、指派给、截止时间',
      '只有验证角色可改验证状态',
    ],
  },
};

export function summarizeSchema(schema = baseSchema) {
  return {
    baseName: schema.baseName,
    permissions: schema.permissions,
    tableCount: schema.tables.length,
    tables: schema.tables.map((table) => ({
      name: table.name,
      fieldCount: table.fields.length,
      viewCount: table.views.length,
      fields: table.fields.map((field) => field.field_name),
      views: table.views.map((view) => view.view_name),
    })),
  };
}
