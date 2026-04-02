// 设计方案与订单相关类型

// 方案状态
export const ProposalStatus = {
    PENDING: 1,   // 待确认
    CONFIRMED: 2, // 已确认
    REJECTED: 3,  // 已拒绝
} as const;

export type ProposalStatusType = typeof ProposalStatus[keyof typeof ProposalStatus];

// 订单状态
export const OrderStatus = {
    PENDING: 0,   // 待支付
    PAID: 1,      // 已支付
    CANCELLED: 2, // 已取消
    REFUNDED: 3,  // 已退款
} as const;

export type OrderStatusType = typeof OrderStatus[keyof typeof OrderStatus];

// 订单类型
export const OrderType = {
    DESIGN: 'design',           // 设计费
    CONSTRUCTION: 'construction', // 施工费
    MATERIAL: 'material',       // 主材费
} as const;

export type OrderTypeValue = typeof OrderType[keyof typeof OrderType];

export const ProjectStatus = {
    PENDING_CONSTRUCTION_CONFIRM: -1,
    ACTIVE: 0,
    COMPLETED: 1,
    PAUSED: 2,
    CLOSED: 3,
} as const;

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

const PROJECT_STATUS_LABELS: Record<number, string> = {
    [ProjectStatus.PENDING_CONSTRUCTION_CONFIRM]: '待确认施工报价',
    [ProjectStatus.ACTIVE]: '进行中',
    [ProjectStatus.COMPLETED]: '已完工',
    [ProjectStatus.PAUSED]: '已暂停',
    [ProjectStatus.CLOSED]: '已关闭',
};

// 设计方案
export interface Proposal {
    id: number;
    bookingId: number;
    designerId: number;
    summary: string;
    designFee: number;
    constructionFee: number;
    materialFee: number;
    estimatedDays: number;
    attachments: string; // JSON array
    status: ProposalStatusType;
    confirmedAt: string | null;
    createdAt: string;
    updatedAt: string;
}

// 订单
export interface Order {
    id: number;
    projectId: number;
    bookingId: number;
    orderNo: string;
    orderType: OrderTypeValue;
    totalAmount: number;
    paidAmount: number;
    discount: number; // 意向金抵扣
    status: OrderStatusType;
    paidAt: string | null;
    createdAt: string;
    updatedAt: string;
}

// 支付计划
export interface PaymentPlan {
    id: number;
    orderId: number;
    type: 'milestone' | 'onetime';
    seq: number;
    name: string;
    amount: number;
    percentage: number;
    status: 0 | 1; // 0:待支付 1:已支付
    dueAt: string | null;
    paidAt: string | null;
    createdAt: string;
    updatedAt: string;
}

// 账单数据
export interface BillItem {
    order: Order;
    paymentPlans: PaymentPlan[];
}

// 账单生成请求
export interface GenerateBillRequest {
    projectId: number;
    designFee: number;
    constructionFee: number;
    materialFee: number;
    paymentType?: 'milestone' | 'onetime';
}

// 账单生成响应
export interface BillResult {
    designOrder: Order;
    constructionOrder: Order;
    paymentPlans: PaymentPlan[];
}

// 工具函数：获取方案状态文本
export const getProposalStatusText = (status: ProposalStatusType): string => {
    switch (status) {
        case ProposalStatus.PENDING:
            return '待确认';
        case ProposalStatus.CONFIRMED:
            return '已确认';
        case ProposalStatus.REJECTED:
            return '已拒绝';
        default:
            return '未知';
    }
};

// 工具函数：获取订单状态文本
export const getOrderStatusText = (status: OrderStatusType): string => {
    switch (status) {
        case OrderStatus.PENDING:
            return '待支付';
        case OrderStatus.PAID:
            return '已支付';
        case OrderStatus.CANCELLED:
            return '已取消';
        case OrderStatus.REFUNDED:
            return '已退款';
        default:
            return '未知';
    }
};

// 工具函数：获取订单类型文本
export const getOrderTypeText = (type: OrderTypeValue): string => {
    switch (type) {
        case OrderType.DESIGN:
            return '设计费';
        case OrderType.CONSTRUCTION:
            return '施工费';
        case OrderType.MATERIAL:
            return '主材费';
        default:
            return '未知';
    }
};

export const getProjectStatusText = (status?: number): string => {
    if (typeof status !== 'number') {
        return '处理中';
    }
    return PROJECT_STATUS_LABELS[status] || '处理中';
};

export const getBusinessStageText = (stage?: string): string => {
    const normalized = String(stage || '').trim().toLowerCase();
    return BUSINESS_STAGE_LABELS[normalized] || stage || '-';
};
