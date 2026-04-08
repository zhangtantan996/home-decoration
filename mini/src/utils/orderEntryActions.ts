import type { OrderCenterRefundSummary, OrderCenterStatusGroup } from '@/services/orderCenter';

export type OrderListPrimaryActionKey = 'pay' | 'detail';
export type OrderDetailActionKey = 'view_refund' | 'apply_refund';
export type OrderActionVariant = 'primary' | 'outline';

export interface OrderListPrimaryAction {
  key: OrderListPrimaryActionKey;
  label: string;
  variant: OrderActionVariant;
}

export interface OrderDetailAction {
  key: OrderDetailActionKey;
  label: string;
  variant: OrderActionVariant;
}

interface DeriveOrderEntryActionsInput {
  statusGroup: OrderCenterStatusGroup;
  refundSummary?: Pick<OrderCenterRefundSummary, 'canApplyRefund' | 'latestRefundId'> | null;
  canCancel?: boolean;
  canPay?: boolean;
}

export interface DerivedOrderEntryActions {
  listPrimaryAction: OrderListPrimaryAction;
  showFooterPayBar: boolean;
  showFooterCancel: boolean;
  showRefundSection: boolean;
  detailActions: OrderDetailAction[];
  canApplyRefund: boolean;
  hasRefundRecord: boolean;
}

const DETAIL_ACTIONS: Record<OrderDetailActionKey, OrderDetailAction> = {
  view_refund: { key: 'view_refund', label: '查看记录', variant: 'outline' },
  apply_refund: { key: 'apply_refund', label: '申请退款', variant: 'primary' },
};

export const deriveOrderEntryActions = ({
  statusGroup,
  refundSummary,
  canCancel = false,
  canPay = false,
}: DeriveOrderEntryActionsInput): DerivedOrderEntryActions => {
  const canApplyRefund = Boolean(refundSummary?.canApplyRefund);
  const hasRefundRecord = Number(refundSummary?.latestRefundId || 0) > 0;
  const listPrimaryAction: OrderListPrimaryAction = statusGroup === 'pending_payment'
    ? { key: 'pay', label: '去支付', variant: 'primary' }
    : { key: 'detail', label: '查看详情', variant: 'outline' };

  switch (statusGroup) {
    case 'pending_payment':
      return {
        listPrimaryAction,
        showFooterPayBar: true,
        showFooterCancel: canCancel,
        showRefundSection: false,
        detailActions: [],
        canApplyRefund,
        hasRefundRecord,
      };
    case 'cancelled':
      return {
        listPrimaryAction,
        showFooterPayBar: false,
        showFooterCancel: false,
        showRefundSection: hasRefundRecord,
        detailActions: hasRefundRecord ? [DETAIL_ACTIONS.view_refund] : [],
        canApplyRefund: false,
        hasRefundRecord,
      };
    case 'refund':
      return {
        listPrimaryAction,
        showFooterPayBar: false,
        showFooterCancel: false,
        showRefundSection: true,
        detailActions: hasRefundRecord ? [DETAIL_ACTIONS.view_refund] : [],
        canApplyRefund: false,
        hasRefundRecord,
      };
    case 'paid': {
      const detailActions: OrderDetailAction[] = [];

      if (hasRefundRecord) {
        detailActions.push(DETAIL_ACTIONS.view_refund);
      }
      if (canApplyRefund) {
        detailActions.push(DETAIL_ACTIONS.apply_refund);
      }

      return {
        listPrimaryAction,
        showFooterPayBar: false,
        showFooterCancel: false,
        showRefundSection: canApplyRefund || hasRefundRecord,
        detailActions,
        canApplyRefund,
        hasRefundRecord,
      };
    }
    default:
      return {
        listPrimaryAction,
        showFooterPayBar: false,
        showFooterCancel: false,
        showRefundSection: false,
        detailActions: [],
        canApplyRefund,
        hasRefundRecord,
      };
  }
};
