import type { ComponentType } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';

const lazyRoute = (loader: () => Promise<{ default: ComponentType<any> }>) => async () => {
    const mod = await loader();
    return { Component: mod.default };
};

const merchantRouter = createBrowserRouter([
    { path: '/', lazy: lazyRoute(() => import('./pages/merchant/MerchantEntry')) },
    { path: '/login', lazy: lazyRoute(() => import('./pages/merchant/MerchantLogin')) },
    { path: '/register', lazy: lazyRoute(() => import('./pages/merchant/MerchantRegister')) },
    { path: '/material-shop/register', lazy: lazyRoute(() => import('./pages/merchant/MaterialShopRegister')) },
    { path: '/apply-status', lazy: lazyRoute(() => import('./pages/merchant/MerchantApplyStatus')) },
    { path: '/legal/onboarding-agreement', lazy: lazyRoute(() => import('./pages/merchant/legal/OnboardingAgreementPage')) },
    { path: '/legal/platform-rules', lazy: lazyRoute(() => import('./pages/merchant/legal/PlatformRulesPage')) },
    { path: '/legal/privacy-data-processing', lazy: lazyRoute(() => import('./pages/merchant/legal/PrivacyDataProcessingPage')) },
    {
        lazy: lazyRoute(() => import('./components/MerchantAuthGuard')),
        children: [
            {
                lazy: lazyRoute(() => import('./layouts/MerchantLayout')),
                children: [
                    { path: '/dashboard', lazy: lazyRoute(() => import('./pages/merchant/MerchantDashboard')) },
                    { path: '/bookings', lazy: lazyRoute(() => import('./pages/merchant/MerchantBookings')) },
                    { path: '/proposals', lazy: lazyRoute(() => import('./pages/merchant/MerchantProposals')) },
                    { path: '/orders', lazy: lazyRoute(() => import('./pages/merchant/MerchantOrders')) },
                    { path: '/chat', lazy: lazyRoute(() => import('./pages/merchant/MerchantChat')) },
                    { path: '/im-test', lazy: lazyRoute(() => import('./pages/merchant/IMTest')) },
                    { path: '/income', lazy: lazyRoute(() => import('./pages/merchant/MerchantIncome')) },
                    { path: '/withdraw', lazy: lazyRoute(() => import('./pages/merchant/MerchantWithdraw')) },
                    { path: '/bank-accounts', lazy: lazyRoute(() => import('./pages/merchant/MerchantBankAccounts')) },
                    { path: '/cases', lazy: lazyRoute(() => import('./pages/merchant/MerchantCases')) },
                    { path: '/settings', lazy: lazyRoute(() => import('./pages/merchant/MerchantSettings')) },
                    { path: '/material-shop/settings', lazy: lazyRoute(() => import('./pages/merchant/MaterialShopSettings')) },
                    { path: '/material-shop/products', lazy: lazyRoute(() => import('./pages/merchant/MaterialShopProducts')) },
                ],
            },
        ],
    },
    { path: '*', element: <Navigate to='/' replace /> },
], {
    basename: '/merchant',
});

export default merchantRouter;
