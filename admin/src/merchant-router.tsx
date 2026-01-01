import { createBrowserRouter } from 'react-router-dom';

// Merchant pages
import MerchantEntry from './pages/merchant/MerchantEntry';
import MerchantLogin from './pages/merchant/MerchantLogin';
import MerchantRegister from './pages/merchant/MerchantRegister';
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
import MerchantChat from './pages/merchant/MerchantChat';
import IMTest from './pages/merchant/IMTest';
import MerchantLayout from './layouts/MerchantLayout';

// 商家端专用路由
const merchantRouter = createBrowserRouter([
    // 入驻流程（无需登录）
    { path: '/', element: <MerchantEntry /> },
    { path: '/login', element: <MerchantLogin /> },
    { path: '/register', element: <MerchantRegister /> },
    { path: '/apply-status', element: <MerchantApplyStatus /> },

    // 商家中心（需要登录）
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
        ]
    }
], {
    basename: '/merchant'
});

export default merchantRouter;
