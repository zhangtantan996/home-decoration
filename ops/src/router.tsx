import { Navigate, createBrowserRouter } from 'react-router-dom';
import OpsLayout from './components/OpsLayout';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardPage from './pages/DashboardPage';
import LoginPage from './pages/LoginPage';
import OpsSecuritySetupPage from './pages/OpsSecuritySetupPage';
import SupplyPage from './pages/SupplyPage';
import SupplyProviderEditPage, { MaterialShopEditPage } from './pages/SupplyEditPage';
import MaterialProductsPage from './pages/MaterialProductsPage';
import MaterialProductEditPage from './pages/MaterialProductEditPage';
import InspirationPage from './pages/InspirationPage';
import InspirationEditPage from './pages/InspirationEditPage';
import BookingsPage from './pages/BookingsPage';
import AuditLogsPage from './pages/AuditLogsPage';
import { getRouterBasename } from './utils/env';

export const createOpsRouter = () => createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      { path: '/security/setup', element: <OpsSecuritySetupPage /> },
      {
        element: <OpsLayout />,
        children: [
          { path: '/', element: <Navigate to="/dashboard" replace /> },
          { path: '/dashboard', element: <DashboardPage /> },
          { path: '/supply', element: <SupplyPage /> },
          { path: '/supply/provider/:kind/:id', element: <SupplyProviderEditPage /> },
          { path: '/supply/provider/:kind/:providerId/showcase/:caseId', element: <InspirationEditPage /> },
          { path: '/supply/material-shop/:shopId/products', element: <MaterialProductsPage /> },
          { path: '/supply/material-shop/:shopId/products/:productId', element: <MaterialProductEditPage /> },
          { path: '/supply/material-shop/:id', element: <MaterialShopEditPage /> },
          { path: '/inspirations', element: <InspirationPage /> },
          { path: '/inspirations/:id', element: <InspirationEditPage /> },
          { path: '/bookings', element: <BookingsPage /> },
          { path: '/audit-logs', element: <AuditLogsPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/dashboard" replace /> },
], { basename: getRouterBasename() });
