import type { ComponentType } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';

interface RouteGuardOptions {
    permission?: string | string[];
    requireAll?: boolean;
}

const lazyRoute = (loader: () => Promise<{ default: ComponentType<any> }>) => async () => {
    const mod = await loader();
    return { Component: mod.default };
};

const lazyProtectedRoute = (
    loader: () => Promise<{ default: ComponentType<any> }>,
    options?: RouteGuardOptions,
) => async () => {
    const mod = await loader();
    const LoadedComponent = mod.default;

    const WrappedComponent = () => (
        <ProtectedRoute permission={options?.permission} requireAll={options?.requireAll}>
            <LoadedComponent />
        </ProtectedRoute>
    );

    return { Component: WrappedComponent };
};

const router = createBrowserRouter([
    { path: '/login', lazy: lazyRoute(() => import('./pages/user/Login')) },
    {
        path: '/',
        lazy: lazyProtectedRoute(() => import('./layouts/BasicLayout')),
        children: [
            { index: true, element: <Navigate to="/dashboard" replace /> },
            { path: 'dashboard', lazy: lazyProtectedRoute(() => import('./pages/dashboard'), { permission: 'dashboard:view' }) },

            { path: 'users', element: <Navigate to="/users/list" replace /> },
            { path: 'users/list', lazy: lazyProtectedRoute(() => import('./pages/users/UserList'), { permission: 'system:user:list' }) },
            { path: 'users/admins', lazy: lazyProtectedRoute(() => import('./pages/admins/AdminList'), { permission: 'system:admin:list' }) },

            { path: 'providers', element: <Navigate to="/providers/designers" replace /> },
            { path: 'providers/designers', lazy: lazyProtectedRoute(() => import('./pages/providers/ProviderList'), { permission: 'provider:designer:list' }) },
            { path: 'providers/companies', lazy: lazyProtectedRoute(() => import('./pages/providers/ProviderList'), { permission: 'provider:company:list' }) },
            { path: 'providers/foremen', lazy: lazyProtectedRoute(() => import('./pages/providers/ProviderList'), { permission: 'provider:foreman:list' }) },
            { path: 'providers/audit', lazy: lazyProtectedRoute(() => import('./pages/audits/ProviderAudit'), { permission: 'provider:audit:list' }) },
            { path: 'providers/identity-applications', lazy: lazyProtectedRoute(() => import('./pages/audits/IdentityApplicationAudit'), { permission: 'identity:application:audit' }) },
            { path: 'audits/identity-applications', lazy: lazyProtectedRoute(() => import('./pages/audits/IdentityApplicationAudit'), { permission: 'identity:application:audit' }) },

            { path: 'materials', element: <Navigate to="/materials/list" replace /> },
            { path: 'materials/list', lazy: lazyProtectedRoute(() => import('./pages/materials/MaterialShopList'), { permission: 'material:shop:list' }) },
            { path: 'materials/audit', lazy: lazyProtectedRoute(() => import('./pages/audits/MaterialShopAudit'), { permission: 'material:audit:list' }) },

            { path: 'cases', element: <Navigate to="/cases/manage" replace /> },
            { path: 'cases/manage', lazy: lazyProtectedRoute(() => import('./pages/cases/CaseManagement'), { permission: 'system:case:view' }) },

            { path: 'projects', element: <Navigate to="/projects/list" replace /> },
            { path: 'projects/list', lazy: lazyProtectedRoute(() => import('./pages/projects/list'), { permission: 'project:list' }) },
            { path: 'projects/detail/:id', lazy: lazyProtectedRoute(() => import('./pages/projects/ProjectDetail'), { permission: 'project:view' }) },
            { path: 'projects/map', lazy: lazyProtectedRoute(() => import('./pages/projects/ProjectMap'), { permission: 'project:map' }) },

            { path: 'bookings', element: <Navigate to="/bookings/list" replace /> },
            { path: 'bookings/list', lazy: lazyProtectedRoute(() => import('./pages/bookings/BookingList'), { permission: 'booking:list' }) },
            { path: 'bookings/disputed', lazy: lazyProtectedRoute(() => import('./pages/bookings/DisputedBookings'), { permission: 'booking:dispute:detail' }) },

            { path: 'finance', element: <Navigate to="/finance/escrow" replace /> },
            { path: 'finance/escrow', lazy: lazyProtectedRoute(() => import('./pages/finance/EscrowAccountList'), { permission: 'finance:escrow:list' }) },
            { path: 'finance/transactions', lazy: lazyProtectedRoute(() => import('./pages/finance/TransactionList'), { permission: 'finance:transaction:list' }) },

            { path: 'reviews', element: <Navigate to="/reviews/list" replace /> },
            { path: 'reviews/list', lazy: lazyProtectedRoute(() => import('./pages/reviews/ReviewList'), { permission: 'review:list' }) },

            { path: 'risk', element: <Navigate to="/risk/warnings" replace /> },
            { path: 'risk/warnings', lazy: lazyProtectedRoute(() => import('./pages/risk/RiskWarningList'), { permission: 'risk:warning:list' }) },
            { path: 'risk/arbitration', lazy: lazyProtectedRoute(() => import('./pages/risk/ArbitrationCenter'), { permission: 'risk:arbitration:list' }) },

            { path: 'logs', element: <Navigate to="/logs/list" replace /> },
            { path: 'logs/list', lazy: lazyProtectedRoute(() => import('./pages/system/LogList'), { permission: 'system:log:list' }) },
            { path: 'settings', element: <Navigate to="/settings/config" replace /> },
            { path: 'settings/config', lazy: lazyProtectedRoute(() => import('./pages/settings/SystemSettings'), { permission: 'system:setting:list' }) },
            { path: 'settings/regions', lazy: lazyProtectedRoute(() => import('./pages/system/RegionManagement'), { permission: 'system:setting:list' }) },

            { path: 'system', element: <Navigate to="/system/dictionary" replace /> },
            { path: 'system/dictionary', lazy: lazyProtectedRoute(() => import('./pages/system/DictionaryManagement'), { permission: 'system:setting:list' }) },

            { path: 'permission', element: <Navigate to="/permission/roles" replace /> },
            { path: 'permission/roles', lazy: lazyProtectedRoute(() => import('./pages/permissions/RoleList'), { permission: 'system:role:list' }) },
            { path: 'permission/menus', lazy: lazyProtectedRoute(() => import('./pages/permissions/MenuList'), { permission: 'system:menu:list' }) },
        ],
    },
], {
    basename: '/admin',
});

export default router;
