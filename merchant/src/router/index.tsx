import { createBrowserRouter, Navigate } from 'react-router-dom';
import MerchantEntry from '../pages/merchant/MerchantEntry';
import MerchantLogin from '../pages/merchant/MerchantLogin';
import MerchantRegister from '../pages/merchant/MerchantRegister';
import MaterialShopRegister from '../pages/merchant/MaterialShopRegister';
import MerchantApplyStatus from '../pages/merchant/MerchantApplyStatus';
import MerchantDashboard from '../pages/merchant/MerchantDashboard';
import MerchantBookings from '../pages/merchant/MerchantBookings';
import MerchantProposals from '../pages/merchant/MerchantProposals';
import MerchantQuoteLists from '../pages/merchant/MerchantQuoteLists';
import MerchantQuoteDetail from '../pages/merchant/MerchantQuoteDetail';
import MerchantOrders from '../pages/merchant/MerchantOrders';
import MerchantIncome from '../pages/merchant/MerchantIncome';
import MerchantWithdraw from '../pages/merchant/MerchantWithdraw';
import MerchantBankAccounts from '../pages/merchant/MerchantBankAccounts';
import MerchantCases from '../pages/merchant/MerchantCases';
import MerchantSettings from '../pages/merchant/MerchantSettings';
import MaterialShopSettings from '../pages/merchant/MaterialShopSettings';
import MaterialShopProducts from '../pages/merchant/MaterialShopProducts';
import MerchantChat from '../pages/merchant/MerchantChat';
import IMTest from '../pages/merchant/IMTest';
import OnboardingAgreementPage from '../pages/merchant/legal/OnboardingAgreementPage';
import PlatformRulesPage from '../pages/merchant/legal/PlatformRulesPage';
import PrivacyDataProcessingPage from '../pages/merchant/legal/PrivacyDataProcessingPage';
import MerchantLayout from '../layouts/MerchantLayout';
import MerchantAuthGuard from '../components/MerchantAuthGuard';
import { getRouterBasename } from '../utils/env';

const router = createBrowserRouter([
  { path: '/', element: <MerchantEntry /> },
  { path: '/login', element: <MerchantLogin /> },
  { path: '/register', element: <MerchantRegister /> },
  { path: '/material-shop/register', element: <MaterialShopRegister /> },
  { path: '/apply-status', element: <MerchantApplyStatus /> },
  { path: '/legal/onboarding-agreement', element: <OnboardingAgreementPage /> },
  { path: '/legal/platform-rules', element: <PlatformRulesPage /> },
  { path: '/legal/privacy-data-processing', element: <PrivacyDataProcessingPage /> },
  {
    element: <MerchantAuthGuard />,
    children: [
      {
        element: <MerchantLayout />,
        children: [
          { path: '/dashboard', element: <MerchantDashboard /> },
          { path: '/bookings', element: <MerchantBookings /> },
          { path: '/proposals', element: <MerchantProposals /> },
          { path: '/quote-lists', element: <MerchantQuoteLists /> },
          { path: '/quote-lists/:id', element: <MerchantQuoteDetail /> },
          { path: '/orders', element: <MerchantOrders /> },
          { path: '/chat', element: <MerchantChat /> },
          { path: '/im-test', element: <IMTest /> },
          { path: '/income', element: <MerchantIncome /> },
          { path: '/withdraw', element: <MerchantWithdraw /> },
          { path: '/bank-accounts', element: <MerchantBankAccounts /> },
          { path: '/cases', element: <MerchantCases /> },
          { path: '/settings', element: <MerchantSettings /> },
          { path: '/material-shop/settings', element: <MaterialShopSettings /> },
          { path: '/material-shop/products', element: <MaterialShopProducts /> }
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
], {
  basename: getRouterBasename(),
});

export default router;
