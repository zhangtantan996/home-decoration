import { createBrowserRouter, Navigate } from 'react-router-dom';

// Merchant pages
import MerchantEntry from './pages/merchant/MerchantEntry';
import MerchantLogin from './pages/merchant/MerchantLogin';
import MerchantRegister from './pages/merchant/MerchantRegister';
import MaterialShopRegister from './pages/merchant/MaterialShopRegister';
import MerchantApplyStatus from './pages/merchant/MerchantApplyStatus';
import MerchantDashboard from './pages/merchant/MerchantDashboard';
import MerchantBookings from './pages/merchant/MerchantBookings';
import MerchantProposals from './pages/merchant/MerchantProposals';
import MerchantOrders from './pages/merchant/MerchantOrders';
import MerchantIncome from './pages/merchant/MerchantIncome';
import MerchantWithdraw from './pages/merchant/MerchantWithdraw';
import MerchantBankAccounts from './pages/merchant/MerchantBankAccounts';
import MerchantCases from './pages/merchant/MerchantCases';
import MerchantSettings from './pages/merchant/MerchantSettings';
import MaterialShopSettings from './pages/merchant/MaterialShopSettings';
import MaterialShopProducts from './pages/merchant/MaterialShopProducts';
import MerchantChat from './pages/merchant/MerchantChat';
import IMTest from './pages/merchant/IMTest';
import OnboardingAgreementPage from './pages/merchant/legal/OnboardingAgreementPage';
import PlatformRulesPage from './pages/merchant/legal/PlatformRulesPage';
import PrivacyDataProcessingPage from './pages/merchant/legal/PrivacyDataProcessingPage';
import MerchantLayout from './layouts/MerchantLayout';
import MerchantAuthGuard from './components/MerchantAuthGuard';

// 商家端专用路由
const merchantRouter = createBrowserRouter([
    // 入驻流程（无需登录）
    { path: '/', element: <MerchantEntry /> },
    { path: '/login', element: <MerchantLogin /> },
    { path: '/register', element: <MerchantRegister /> },
    { path: '/material-shop/register', element: <MaterialShopRegister /> },
    { path: '/apply-status', element: <MerchantApplyStatus /> },
    { path: '/legal/onboarding-agreement', element: <OnboardingAgreementPage /> },
    { path: '/legal/platform-rules', element: <PlatformRulesPage /> },
    { path: '/legal/privacy-data-processing', element: <PrivacyDataProcessingPage /> },

    // 商家中心（需要登录）
    {
        element: <MerchantAuthGuard />,
        children: [
            {
                element: <MerchantLayout />,
                children: [
                    { path: '/dashboard', element: <MerchantDashboard /> },
                    { path: '/bookings', element: <MerchantBookings /> },
                    { path: '/proposals', element: <MerchantProposals /> },
                    { path: '/orders', element: <MerchantOrders /> },

                    // 客户消息
                    { path: '/chat', element: <MerchantChat /> },
                    // IM 纯 SDK 测试页面
                    { path: '/im-test', element: <IMTest /> },

                    // 财务模块
                    { path: '/income', element: <MerchantIncome /> },
                    { path: '/withdraw', element: <MerchantWithdraw /> },
                    { path: '/bank-accounts', element: <MerchantBankAccounts /> },

                    // 作品集与设置
                    { path: '/cases', element: <MerchantCases /> },
                    { path: '/settings', element: <MerchantSettings /> },
                    { path: '/material-shop/settings', element: <MaterialShopSettings /> },
                    { path: '/material-shop/products', element: <MaterialShopProducts /> },
                ]
            }
        ]
    },

    // 404 兜底
    { path: '*', element: <Navigate to='/' replace /> }
], {
    basename: '/merchant'
});

export default merchantRouter;
