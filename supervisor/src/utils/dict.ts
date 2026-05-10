export const businessStageLabel: Record<string, string> = {
  draft: "草稿",
  design: "设计阶段",
  contract: "合同阶段",
  construction_pending: "待施工",
  construction: "施工中",
  completed: "已竣工",
  cancelled: "已取消",
};

export const kickoffStatusLabel: Record<string, string> = {
  pending: "未开工",
  started: "已开工",
};

export const phaseStatusLabel: Record<string, string> = {
  pending: "待开始",
  in_progress: "进行中",
  completed: "已完成",
  paused: "已暂停",
};

export const phaseStatusColor: Record<string, string> = {
  pending: "default",
  in_progress: "processing",
  completed: "success",
  paused: "warning",
};

export const riskLevelLabel: Record<string, string> = {
  low: "低风险",
  medium: "中风险",
  high: "高风险",
  critical: "紧急情况",
};

export const riskLevelColor: Record<string, string> = {
  low: "blue",
  medium: "orange",
  high: "red",
  critical: "magenta",
};

export const riskTypeLabel: Record<string, string> = {
  delay: "进度延期",
  quality: "质量异常",
  payment: "款项争议",
  dispute: "服务纠纷",
  safety: "安全隐患",
  other: "其他异常",
};

export const phaseTypeLabel: Record<string, string> = {
  preparation: "开工准备",
  water_electricity: "水电施工",
  mud_wood: "泥木施工",
  paint: "油漆施工",
  installation: "安装竣工",
  type: "未命名阶段", // fallback for old seed data
};

export const dicts = {
  businessStage: (key?: string) =>
    key ? businessStageLabel[key] || key : "未知",
  kickoffStatus: (key?: string) =>
    key ? kickoffStatusLabel[key] || key : "未知",
  phaseStatus: (key?: string) => (key ? phaseStatusLabel[key] || key : "未知"),
  phaseColor: (key?: string) =>
    key ? phaseStatusColor[key] || "default" : "default",
  riskLevel: (key?: string) => (key ? riskLevelLabel[key] || key : "未知"),
  riskLevelColor: (key?: string) =>
    key ? riskLevelColor[key] || "default" : "default",
  riskType: (key?: string) => (key ? riskTypeLabel[key] || key : "未知"),
  phaseType: (key?: string) => (key ? phaseTypeLabel[key] || key : "未知"),
};
