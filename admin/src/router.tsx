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
import AuditCenter from './pages/audits/AuditCenter';
import ProviderAudit from './pages/audits/ProviderAudit';
import MaterialShopAudit from './pages/audits/MaterialShopAudit';
import ProjectDetail from './pages/projects/ProjectDetail';
import ProjectMap from './pages/projects/ProjectMap';
import DemandAssign from './pages/demands/DemandAssign';
import DemandList from './pages/demands/DemandList';
import ComplaintManagement from './pages/complaints/ComplaintManagement';
import QuoteLibraryManagement from './pages/quotes/QuoteLibraryManagement';
import QuoteListManagement from './pages/quotes/QuoteListManagement';
import QuoteComparison from './pages/quotes/QuoteComparison';
import FinanceOverview from './pages/finance/FinanceOverview';
import SettlementList from './pages/finance/SettlementList';
import PayoutList from './pages/finance/PayoutList';
import FinanceReconciliationList from './pages/finance/FinanceReconciliationList';
import EscrowAccountList from './pages/finance/EscrowAccountList';
import TransactionList from './pages/finance/TransactionList';
import BondRuleList from './pages/finance/BondRuleList';
import BondAccountList from './pages/finance/BondAccountList';
import RiskWarningList from './pages/risk/RiskWarningList';
import SystemSettings from './pages/settings/SystemSettings';
import RoleList from './pages/permissions/RoleList';
import MenuList from './pages/permissions/MenuList';
import CaseManagement from './pages/cases/CaseManagement';
import DictionaryManagement from './pages/system/DictionaryManagement';
import RegionManagement from './pages/system/RegionManagement';
import AuditLogList from './pages/system/AuditLogList';
import IdentityApplicationAudit from './pages/audits/IdentityApplicationAudit';
import ProjectAuditList from './pages/projectAudits/ProjectAuditList';
import ProjectAuditDetail from './pages/projectAudits/ProjectAuditDetail';
import ProjectAuditArbitrate from './pages/projectAudits/ProjectAuditArbitrate';
import RefundList from './pages/refunds/RefundList';
import RefundDetail from './pages/refunds/RefundDetail';
import WithdrawList from './pages/withdraws/WithdrawList';
import WithdrawDetail from './pages/withdraws/WithdrawDetail';
import { ProtectedRoute } from './components/ProtectedRoute';
import { getRouterBasename } from './utils/env';


const router = createBrowserRouter([
    { path: '/login', element: <Login /> },

    // ========== Admin 管理后台 ==========
    {
        path: '/',
        element: (
            <ProtectedRoute>
                <BasicLayout />
            </ProtectedRoute>
        ),
        children: [
            { index: true, element: <Navigate to="/dashboard" replace /> },
            { path: 'dashboard', element: <ProtectedRoute permission="dashboard:view"><Dashboard /></ProtectedRoute> },

            // Users
            { path: 'users', element: <Navigate to="/users/list" replace /> },
            { path: 'users/list', element: <ProtectedRoute permission="system:user:list"><UserList /></ProtectedRoute> },
            { path: 'users/admins', element: <ProtectedRoute permission="system:admin:list"><AdminList /></ProtectedRoute> },

            // Providers
            { path: 'providers', element: <Navigate to="/providers/designers" replace /> },
            { path: 'providers/designers', element: <ProtectedRoute permission="provider:designer:list"><ProviderList /></ProtectedRoute> },
            { path: 'providers/companies', element: <ProtectedRoute permission="provider:company:list"><ProviderList /></ProtectedRoute> },
            { path: 'providers/foremen', element: <ProtectedRoute permission="provider:foreman:list"><ProviderList /></ProtectedRoute> },
            { path: 'providers/audit', element: <ProtectedRoute permission="provider:audit:list"><ProviderAudit /></ProtectedRoute> },
            { path: 'providers/identity-applications', element: <ProtectedRoute permission="identity:application:audit"><IdentityApplicationAudit /></ProtectedRoute> },
            { path: 'audits', element: <ProtectedRoute permission={['provider:audit:list', 'material:audit:list', 'identity:application:audit', 'system:case:view']}><AuditCenter /></ProtectedRoute> },
            { path: 'audits/identity-applications', element: <ProtectedRoute permission="identity:application:audit"><IdentityApplicationAudit /></ProtectedRoute> },

            // Materials
            { path: 'materials', element: <Navigate to="/materials/list" replace /> },
            { path: 'materials/list', element: <ProtectedRoute permission="material:shop:list"><MaterialShopList /></ProtectedRoute> },
            { path: 'materials/audit', element: <ProtectedRoute permission="material:audit:list"><MaterialShopAudit /></ProtectedRoute> },

            // Case Management (作品管理，整合审核功能)
            { path: 'cases', element: <Navigate to="/cases/manage" replace /> },
            { path: 'cases/manage', element: <ProtectedRoute permission="system:case:view"><CaseManagement /></ProtectedRoute> },

            // Projects
            { path: 'projects', element: <Navigate to="/projects/list" replace /> },
            { path: 'projects/list', element: <ProtectedRoute permission="project:list"><ProjectList /></ProtectedRoute> },
            { path: 'projects/detail/:id', element: <ProtectedRoute permission="project:view"><ProjectDetail /></ProtectedRoute> },
            { path: 'projects/map', element: <ProtectedRoute permission="project:map"><ProjectMap /></ProtectedRoute> },
            { path: 'projects/quotes/library', element: <ProtectedRoute permission="project:list"><QuoteLibraryManagement /></ProtectedRoute> },
            { path: 'projects/quotes/lists', element: <ProtectedRoute permission="project:edit"><QuoteListManagement /></ProtectedRoute> },
            { path: 'projects/quotes/compare/:id', element: <ProtectedRoute permission="project:view"><QuoteComparison /></ProtectedRoute> },

            // Demands
            { path: 'demands', element: <Navigate to="/demands/list" replace /> },
            { path: 'demands/list', element: <ProtectedRoute permission="demand:list"><DemandList /></ProtectedRoute> },
            { path: 'demands/:id/assign', element: <ProtectedRoute permission="demand:assign"><DemandAssign /></ProtectedRoute> },

            // Complaints
            { path: 'complaints', element: <ProtectedRoute permission="risk:arbitration:list"><ComplaintManagement /></ProtectedRoute> },
            { path: 'project-audits', element: <ProtectedRoute permission="risk:arbitration:list"><ProjectAuditList /></ProtectedRoute> },
            { path: 'project-audits/:id', element: <ProtectedRoute permission="risk:arbitration:list"><ProjectAuditDetail /></ProtectedRoute> },
            { path: 'project-audits/:id/arbitrate', element: <ProtectedRoute permission="risk:arbitration:judge"><ProjectAuditArbitrate /></ProtectedRoute> },

            // Bookings
            { path: 'bookings', element: <Navigate to="/bookings/list" replace /> },
            { path: 'bookings/list', element: <ProtectedRoute permission="booking:list"><BookingList /></ProtectedRoute> },
            { path: 'bookings/disputed', element: <ProtectedRoute permission="booking:dispute:detail"><DisputedBookings /></ProtectedRoute> },

            // Finance
            { path: 'finance', element: <Navigate to="/finance/overview" replace /> },
            { path: 'finance/overview', element: <ProtectedRoute permission="finance:escrow:list"><FinanceOverview /></ProtectedRoute> },
            { path: 'finance/escrow', element: <ProtectedRoute permission="finance:escrow:list"><EscrowAccountList /></ProtectedRoute> },
            { path: 'finance/transactions', element: <ProtectedRoute permission="finance:transaction:list"><TransactionList /></ProtectedRoute> },
            { path: 'finance/settlements', element: <ProtectedRoute permission="finance:transaction:list"><SettlementList /></ProtectedRoute> },
            { path: 'finance/payouts', element: <ProtectedRoute permission="finance:transaction:list"><PayoutList /></ProtectedRoute> },
            { path: 'finance/reconciliations', element: <ProtectedRoute permission="finance:transaction:list"><FinanceReconciliationList /></ProtectedRoute> },
            { path: 'finance/bond-rules', element: <ProtectedRoute permission="finance:transaction:list"><BondRuleList /></ProtectedRoute> },
            { path: 'finance/bond-accounts', element: <ProtectedRoute permission="finance:transaction:list"><BondAccountList /></ProtectedRoute> },
            { path: 'refunds', element: <ProtectedRoute permission="finance:transaction:list"><RefundList /></ProtectedRoute> },
            { path: 'refunds/:id', element: <ProtectedRoute permission="finance:transaction:view"><RefundDetail /></ProtectedRoute> },
            { path: 'withdraws', element: <ProtectedRoute permission="finance:transaction:list"><WithdrawList /></ProtectedRoute> },
            { path: 'withdraws/:id', element: <ProtectedRoute permission="finance:transaction:view"><WithdrawDetail /></ProtectedRoute> },

            // Other
            { path: 'reviews', element: <Navigate to="/reviews/list" replace /> },
            { path: 'reviews/list', element: <ProtectedRoute permission="review:list"><ReviewList /></ProtectedRoute> },

            // Risk
            { path: 'risk', element: <Navigate to="/risk/warnings" replace /> },
            { path: 'risk/warnings', element: <ProtectedRoute permission="risk:warning:list"><RiskWarningList /></ProtectedRoute> },

            { path: 'logs', element: <Navigate to="/logs/list" replace /> },
            { path: 'logs/list', element: <ProtectedRoute permission="system:log:list"><LogList /></ProtectedRoute> },
            { path: 'audit-logs', element: <ProtectedRoute permission="system:log:list"><AuditLogList /></ProtectedRoute> },
            { path: 'settings', element: <Navigate to="/settings/config" replace /> },
            { path: 'settings/config', element: <ProtectedRoute permission="system:setting:list"><SystemSettings /></ProtectedRoute> },
            { path: 'settings/regions', element: <ProtectedRoute permission="system:setting:list"><RegionManagement /></ProtectedRoute> },

            // System
            { path: 'system', element: <Navigate to="/system/dictionary" replace /> },
            { path: 'system/dictionary', element: <ProtectedRoute permission="system:setting:list"><DictionaryManagement /></ProtectedRoute> },

            // Permissions (注意：路径为单数 permission，与数据库菜单配置一致)
            { path: 'permission', element: <Navigate to="/permission/roles" replace /> },
            { path: 'permission/roles', element: <ProtectedRoute permission="system:role:list"><RoleList /></ProtectedRoute> },
            { path: 'permission/menus', element: <ProtectedRoute permission="system:menu:list"><MenuList /></ProtectedRoute> },
        ],
    },
], {
    basename: getRouterBasename()
});

export default router;
