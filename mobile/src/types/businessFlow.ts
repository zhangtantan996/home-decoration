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
