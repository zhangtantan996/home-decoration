import type { OrderCenterSourceKind } from '@/services/orderCenter';

export const mapPendingRouteTypeToSourceKind = (type?: string): OrderCenterSourceKind | undefined => {
  switch (String(type || '').trim()) {
    case 'intent_fee':
    case 'survey_deposit':
    case 'survey_deposit_fee':
      return 'survey_deposit';
    case 'design_fee':
      return 'design_order';
    case 'construction_fee':
      return 'construction_order';
    case 'material_fee':
      return 'material_order';
    default:
      return undefined;
  }
};
