import { create } from 'zustand';

import type { PaymentLaunchPayload } from '../../services/payments';

type PaymentDialogPaidCallback = () => void | Promise<void>;

interface PaymentDialogOpenOptions {
  onPaid?: PaymentDialogPaidCallback;
}

interface PaymentDialogState {
  open: boolean;
  payload: PaymentLaunchPayload | null;
  onPaid: PaymentDialogPaidCallback | null;
  paidHandled: boolean;
  openDialog: (payload: PaymentLaunchPayload, options?: PaymentDialogOpenOptions) => void;
  closeDialog: () => void;
  markPaidHandled: () => void;
}

export const usePaymentDialogStore = create<PaymentDialogState>()((set) => ({
  open: false,
  payload: null,
  onPaid: null,
  paidHandled: false,
  openDialog: (payload, options) =>
    set((state) => ({
      open: true,
      payload,
      onPaid: options?.onPaid || state.onPaid,
      paidHandled: false,
    })),
  closeDialog: () =>
    set({
      open: false,
      payload: null,
      onPaid: null,
      paidHandled: false,
    }),
  markPaidHandled: () => set({ paidHandled: true }),
}));
