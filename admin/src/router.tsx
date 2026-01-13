import { createBrowserRouter, Navigate } from 'react-router-dom';
import BasicLayout from './layouts/BasicLayout';
import Dashboard from './pages/dashboard';
import ProjectList from './pages/projects/list';
import UserList from './pages/users/UserList';
import ProviderList from './pages/providers/ProviderList';
import MaterialShopList from './pages/materials/MaterialShopList';
import BookingList from './pages/bookings/BookingList';
import DisputedBookings from './pages/bookings/DisputedBookings';
import ReviewList from './pages/reviews/ReviewList';
import LogList from './pages/system/LogList';
import Login from './pages/user/Login';
import AdminList from './pages/admins/AdminList';
import ProviderAudit from './pages/audits/ProviderAudit';
import MaterialShopAudit from './pages/audits/MaterialShopAudit';
import ProjectDetail from './pages/projects/ProjectDetail';
import ProjectMap from './pages/projects/ProjectMap';
import EscrowAccountList from './pages/finance/EscrowAccountList';
import TransactionList from './pages/finance/TransactionList';
import RiskWarningList from './pages/risk/RiskWarningList';
import ArbitrationCenter from './pages/risk/ArbitrationCenter';
import SystemSettings from './pages/settings/SystemSettings';
import RoleList from './pages/permissions/RoleList';
import MenuList from './pages/permissions/MenuList';
import CaseManagement from './pages/cases/CaseManagement';
import DictionaryManagement from './pages/system/DictionaryManagement';
import RegionManagement from './pages/system/RegionManagement';


const router = createBrowserRouter([
    { path: '/login', element: <Login /> },

    // ========== Admin 管理后台 ==========
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

            // Case Management (作品管理，整合审核功能)
            { path: 'cases', element: <Navigate to="/cases/manage" replace /> },
            { path: 'cases/manage', element: <CaseManagement /> },

            // Projects
            { path: 'projects', element: <Navigate to="/projects/list" replace /> },
            { path: 'projects/list', element: <ProjectList /> },
            { path: 'projects/detail/:id', element: <ProjectDetail /> },
            { path: 'projects/map', element: <ProjectMap /> },

            // Bookings
            { path: 'bookings', element: <Navigate to="/bookings/list" replace /> },
            { path: 'bookings/list', element: <BookingList /> },
            { path: 'bookings/disputed', element: <DisputedBookings /> },

            // Finance
            { path: 'finance', element: <Navigate to="/finance/escrow" replace /> },
            { path: 'finance/escrow', element: <EscrowAccountList /> },
            { path: 'finance/transactions', element: <TransactionList /> },

            // Other
            { path: 'reviews', element: <Navigate to="/reviews/list" replace /> },
            { path: 'reviews/list', element: <ReviewList /> },

            // Risk
            { path: 'risk', element: <Navigate to="/risk/warnings" replace /> },
            { path: 'risk/warnings', element: <RiskWarningList /> },
            { path: 'risk/arbitration', element: <ArbitrationCenter /> },

            { path: 'logs', element: <Navigate to="/logs/list" replace /> },
            { path: 'logs/list', element: <LogList /> },
            { path: 'settings', element: <Navigate to="/settings/config" replace /> },
            { path: 'settings/config', element: <SystemSettings /> },
            { path: 'settings/regions', element: <RegionManagement /> },

            // System
            { path: 'system', element: <Navigate to="/system/dictionary" replace /> },
            { path: 'system/dictionary', element: <DictionaryManagement /> },

            // Permissions (注意：路径为单数 permission，与数据库菜单配置一致)
            { path: 'permission', element: <Navigate to="/permission/roles" replace /> },
            { path: 'permission/roles', element: <RoleList /> },
            { path: 'permission/menus', element: <MenuList /> },
        ],
    },
], {
    basename: '/admin'
});

export default router;
