## F4 Scope Fidelity Audit (merchant-auth-flow-fix)

- Verdict: **NO-GO** for closure.
- In-scope baseline (Tasks 1-13 target files) is mostly present, but scope bleed exists in merchant target area:
  - New routes/pages introduced beyond plan: `admin/src/pages/merchant/MaterialShopProducts.tsx`, `admin/src/pages/merchant/MaterialShopSettings.tsx`, and route entries in `admin/src/merchant-router.tsx`.
  - Unplanned API surface added in `admin/src/services/merchantApi.ts` (`materialShopCenterApi`, `/material-shop/me*` product/profile CRUD).
  - Additional out-of-plan touched merchant/admin files: `admin/src/pages/merchant/MerchantBankAccounts.tsx`, `admin/src/pages/merchant/MerchantWithdraw.tsx`, `admin/src/services/api.ts`.
- Planned-but-missing/partial items:
  - Theme unification not fully applied on registration pages: `admin/src/pages/merchant/MerchantRegister.tsx` and `admin/src/pages/merchant/MaterialShopRegister.tsx` do not use `MERCHANT_THEME`.
- F4 hard checks status:
  - `admin/src/stores/authStore.ts` unchanged ✅
  - `admin/package.json` unchanged; React remains `18.3.1`/`18.3.1` ✅
  - No admin dependency drift detected ✅
