import { createBrowserRouter, Navigate } from 'react-router-dom';
import BasicLayout from './layouts/BasicLayout';
import Dashboard from './pages/dashboard';
import ProjectList from './pages/projects/list';
import UserList from './pages/users/UserList';
import ProviderList from './pages/providers/ProviderList';
import MaterialShopList from './pages/materials/MaterialShopList';
import BookingList from './pages/bookings/BookingList';
import ReviewList from './pages/reviews/ReviewList';
import LogList from './pages/system/LogList';
import Login from './pages/user/Login';
import AdminList from './pages/admins/AdminList';
import ProviderAudit from './pages/audits/ProviderAudit';
import MaterialShopAudit from './pages/audits/MaterialShopAudit';
import ProjectMap from './pages/projects/ProjectMap';
import EscrowAccountList from './pages/finance/EscrowAccountList';
import TransactionList from './pages/finance/TransactionList';
import RiskWarningList from './pages/risk/RiskWarningList';
import ArbitrationCenter from './pages/risk/ArbitrationCenter';
import SystemSettings from './pages/settings/SystemSettings';


const router = createBrowserRouter([
    { path: '/login', element: <Login /> },
    {
        path: '/',
        element: <BasicLayout />,
        children: [
            { index: true, element: <Navigate to="/dashboard" replace /> },
            { path: 'dashboard', element: <Dashboard /> },

            // Users
            { path: 'users', element: <Navigate to="/users/list" replace /> },
            { path: 'users/list', element: <UserList /> },
            { path: 'users/admins', element: <AdminList /> },

            // Providers
            { path: 'providers', element: <Navigate to="/providers/designers" replace /> },
            { path: 'providers/designers', element: <ProviderList /> },
            { path: 'providers/companies', element: <ProviderList /> },
            { path: 'providers/foremen', element: <ProviderList /> },
            { path: 'providers/audit', element: <ProviderAudit /> },

            // Materials
            { path: 'materials', element: <Navigate to="/materials/list" replace /> },
            { path: 'materials/list', element: <MaterialShopList /> },
            { path: 'materials/audit', element: <MaterialShopAudit /> },

            // Projects
            { path: 'projects', element: <Navigate to="/projects/list" replace /> },
            { path: 'projects/list', element: <ProjectList /> },
            { path: 'projects/map', element: <ProjectMap /> },

            // Bookings
            { path: 'bookings', element: <BookingList /> },

            // Finance
            { path: 'finance', element: <Navigate to="/finance/escrow" replace /> },
            { path: 'finance/escrow', element: <EscrowAccountList /> },
            { path: 'finance/transactions', element: <TransactionList /> },

            // Other
            { path: 'reviews', element: <ReviewList /> },

            // Risk
            { path: 'risk', element: <Navigate to="/risk/warnings" replace /> },
            { path: 'risk/warnings', element: <RiskWarningList /> },
            { path: 'risk/arbitration', element: <ArbitrationCenter /> },

            { path: 'logs', element: <LogList /> },
            { path: 'settings', element: <SystemSettings /> },
        ],
    },
], {
    basename: '/admin'
});

export default router;
