# Current Surface Inventory

## Purpose

This document freezes the **current surface ownership** in the repository so future implementation work can stop drifting between Admin Web and Merchant Web.

It is based on the current code reality, not on future ideal architecture.

---

## 1. Current reality summary

The repository does **not** have a fully separate Merchant app package yet, but Merchant is also **not** merely an unstructured folder under Admin routes anymore.

Current reality is:

- Admin Web mainline routes are defined in `admin/src/router.tsx`
- Merchant already has its own dedicated router in `admin/src/merchant-router.tsx`
- Merchant already has its own app entry in `admin/src/merchant-main.tsx`
- `admin/vite.config.ts` already contains a dual-entry setup for `index.html` and `merchant.html`

So the correct current description is:

> Merchant already has an independent route shell and entry shell, but it is still physically packaged inside the `admin/` frontend app and has not yet completed package-level split.

This matters because future planning should not assume merchant is starting from zero.

---

## 2. Current Admin Web-owned surface

These surfaces are currently and should continue to be treated as **Admin Web-owned**.

## P0 — mainline Admin ownership

### Admin entry and control surface

- `admin/src/pages/dashboard/index.tsx`
- `admin/src/pages/user/Login.tsx`
- `admin/src/pages/admins/AdminList.tsx`
- `admin/src/pages/users/UserList.tsx`

### Review / audit mainline

- `admin/src/pages/audits/AuditCenter.tsx`
- `admin/src/pages/audits/ProviderAudit.tsx`
- `admin/src/pages/audits/MaterialShopAudit.tsx`
- `admin/src/pages/audits/IdentityApplicationAudit.tsx`

### Merchant / provider oversight from platform side

- `admin/src/pages/providers/ProviderList.tsx`
- `admin/src/pages/materials/MaterialShopList.tsx`

### Project / booking / transaction oversight

- `admin/src/pages/projects/list.tsx`
- `admin/src/pages/projects/ProjectDetail.tsx`
- `admin/src/pages/projects/ProjectMap.tsx`
- `admin/src/pages/bookings/BookingList.tsx`
- `admin/src/pages/bookings/DisputedBookings.tsx`
- `admin/src/pages/finance/EscrowAccountList.tsx`
- `admin/src/pages/finance/TransactionList.tsx`

### Governance / case / risk / system control

- `admin/src/pages/cases/CaseManagement.tsx`
- `admin/src/pages/risk/RiskWarningList.tsx`
- `admin/src/pages/risk/ArbitrationCenter.tsx`
- `admin/src/pages/reviews/ReviewList.tsx`
- `admin/src/pages/settings/SystemSettings.tsx`
- `admin/src/pages/system/DictionaryManagement.tsx`
- `admin/src/pages/system/LogList.tsx`
- `admin/src/pages/system/RegionManagement.tsx`
- `admin/src/pages/permissions/RoleList.tsx`
- `admin/src/pages/permissions/MenuList.tsx`

## P1 — supporting but not central Admin surface

- reporting-style or operational support views that help admin work but are not the primary trusted-transaction loop
- low-frequency configuration views currently needed for operations

Current concrete examples already inside Admin mainline:

- `admin/src/pages/system/DictionaryManagement.tsx`
- `admin/src/pages/system/RegionManagement.tsx`
- `admin/src/pages/system/LogList.tsx`
- `admin/src/pages/settings/SystemSettings.tsx`

These should remain Admin-owned, but should not dominate the product story.

---

## 3. Current Merchant Web-owned surface

These surfaces are currently and should continue to be treated as **Merchant Web-owned**.

They already have an independent route shell under `admin/src/merchant-router.tsx` with basename `/merchant`.

## P0 — mainline Merchant ownership

### Merchant auth / entry / onboarding

- `admin/src/pages/merchant/MerchantEntry.tsx`
- `admin/src/pages/merchant/MerchantLogin.tsx`
- `admin/src/pages/merchant/MerchantRegister.tsx`
- `admin/src/pages/merchant/MaterialShopRegister.tsx`
- `admin/src/pages/merchant/MerchantApplyStatus.tsx`

### Merchant workspace / fulfillment

- `admin/src/pages/merchant/MerchantDashboard.tsx`
- `admin/src/pages/merchant/MerchantBookings.tsx`
- `admin/src/pages/merchant/MerchantProposals.tsx`
- `admin/src/pages/merchant/MerchantOrders.tsx`
- `admin/src/pages/merchant/MerchantCases.tsx`
- `admin/src/pages/merchant/MerchantSettings.tsx`
- `admin/src/pages/merchant/MerchantIncome.tsx`
- `admin/src/pages/merchant/MerchantWithdraw.tsx`
- `admin/src/pages/merchant/MerchantBankAccounts.tsx`
- `admin/src/pages/merchant/MerchantChat.tsx`

### Material-shop merchant ownership

- `admin/src/pages/merchant/MaterialShopSettings.tsx`
- `admin/src/pages/merchant/MaterialShopProducts.tsx`

### Merchant legal / onboarding-doc surfaces

- `admin/src/pages/merchant/legal/OnboardingAgreementPage.tsx`
- `admin/src/pages/merchant/legal/PlatformRulesPage.tsx`
- `admin/src/pages/merchant/legal/PrivacyDataProcessingPage.tsx`

### Merchant-specific supporting components (remain Merchant-owned unless proven pure)

- `admin/src/pages/merchant/components/BusinessHoursEditor.tsx`
- `admin/src/pages/merchant/components/MerchantOnboardingShell.tsx`
- `admin/src/pages/merchant/legal/LegalDocumentLayout.tsx`

## P1 — supporting Merchant surface

These remain Merchant-owned but are not first-priority MVP highlights:

- `admin/src/pages/merchant/MerchantChat.tsx`

Reason:
- chat can support fulfillment, but is not the defining center of the current trusted transaction-loop MVP.

---

## 4. Current deprioritized / hidden candidates

These surfaces either should not be promoted in the current MVP surface or should be hidden/kept internal.

## P2 — hide or restrict

### Merchant test surface

- `admin/src/pages/merchant/IMTest.tsx`

Reason:
- clearly a test/debug page
- currently exposed in `admin/src/merchant-router.tsx`
- should not be a promoted merchant capability in the current phase

Recommended action:
- remove from normal merchant navigation
- gate behind internal flag/permission or remove route exposure from mainline

### Admin orphan / non-mainline audit page

- `admin/src/pages/audits/CaseAudits.tsx`

Reason:
- page file exists
- not currently registered in `admin/src/router.tsx`
- current mainline has already converged more toward `CaseManagement.tsx`

Recommended action:
- treat as non-mainline / legacy candidate until explicitly reclaimed
- do not expose as a new parallel audit path by default

---

## 5. Current route ownership reality

## Admin route shell

The current Admin route shell lives in:

- `admin/src/router.tsx`

This is the current platform-control mainline.

## Merchant route shell

The current Merchant route shell lives in:

- `admin/src/merchant-router.tsx`

with merchant app entry at:

- `admin/src/merchant-main.tsx`

and merchant-serving dual-entry build setup currently reflected in:

- `admin/vite.config.ts`

This means the repository already has a **merchant route boundary**, but not yet a **merchant package boundary**.

---

## 6. Ownership freeze conclusion

Effective immediately for future planning:

### Admin Web owns

- review / audit center
- provider/material management from platform side
- project / booking / finance / risk / system control surfaces
- admin/user/permission/config surfaces

### Merchant Web owns

- merchant auth and onboarding
- merchant workspace / profile / proposals / cases / fulfillment / finance
- material-shop merchant operations
- merchant legal/onboarding documents

### Deprioritized / hidden candidates

- merchant test pages
- orphan/non-mainline legacy pages

---

## 7. What this changes for next-step planning

The next-step split work should **not** be framed as “inventing a merchant app from nothing”.

Instead, it should be framed as:

> extracting the already-existing merchant route shell and merchant-owned pages from the current `admin/` package into an independently owned Merchant Web app.

This is the correct basis for the next implementation stage.
EOF