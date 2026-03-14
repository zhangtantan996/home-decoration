export const STATUS_CONFIG = {
  pending: { color: '#d97706', bg: 'rgba(217,119,6,0.08)', text: '待审核' },
  approved: { color: '#059669', bg: 'rgba(5,150,105,0.08)', text: '已通过' },
  rejected: { color: '#dc2626', bg: 'rgba(220,38,38,0.08)', text: '已拒绝' },
  verified: { color: '#059669', bg: 'rgba(5,150,105,0.08)', text: '已认证' },
  unverified: { color: '#d97706', bg: 'rgba(217,119,6,0.08)', text: '待认证' },
  disabled: { color: '#64748b', bg: 'rgba(100,116,139,0.08)', text: '已停用' },
  active: { color: '#059669', bg: 'rgba(5,150,105,0.08)', text: '进行中' },
  completed: { color: '#2563eb', bg: 'rgba(37,99,235,0.08)', text: '已完成' },
  warning: { color: '#d97706', bg: 'rgba(217,119,6,0.08)', text: '待处理' },
  info: { color: '#2563eb', bg: 'rgba(37,99,235,0.08)', text: '信息' },
} as const;

export type StatusKey = keyof typeof STATUS_CONFIG;
