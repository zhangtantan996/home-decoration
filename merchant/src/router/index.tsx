import { createBrowserRouter, Navigate } from 'react-router-dom';
import MerchantEntry from '../pages/merchant/MerchantEntry';
import MerchantLogin from '../pages/merchant/MerchantLogin';
import MerchantRegister from '../pages/merchant/MerchantRegister';
import MaterialShopRegister from '../pages/merchant/MaterialShopRegister';
import MerchantApplyStatus from '../pages/merchant/MerchantApplyStatus';
import MerchantDashboard from '../pages/merchant/MerchantDashboard';
import MerchantNotifications from '../pages/merchant/MerchantNotifications';
import MerchantLeads from '../pages/merchant/MerchantLeads';
import MerchantBookings from '../pages/merchant/MerchantBookings';
import MerchantBookingBudgetConfirm from '../pages/merchant/MerchantBookingBudgetConfirm';
import MerchantBookingSiteSurvey from '../pages/merchant/MerchantBookingSiteSurvey';
import MerchantProposals from '../pages/merchant/MerchantProposals';
import MerchantQuoteLists from '../pages/merchant/MerchantQuoteLists';
import MerchantQuoteDetail from '../pages/merchant/MerchantQuoteDetail';
import MerchantProjectExecution from '../pages/merchant/MerchantProjectExecution';
import MerchantProjectDispute from '../pages/merchant/MerchantProjectDispute';
import MerchantProjects from '../pages/merchant/MerchantProjects';
import MerchantPriceBook from '../pages/merchant/MerchantPriceBook';
import MerchantOrders from '../pages/merchant/MerchantOrders';
import MerchantComplaints from '../pages/merchant/MerchantComplaints';
import MerchantContractCreate from '../pages/merchant/MerchantContractCreate';
import MerchantIncome from '../pages/merchant/MerchantIncome';
import MerchantBond from '../pages/merchant/MerchantBond';
import MerchantPaymentResult from '../pages/merchant/MerchantPaymentResult';
import MerchantWithdraw from '../pages/merchant/MerchantWithdraw';
import MerchantBankAccounts from '../pages/merchant/MerchantBankAccounts';
import MerchantCases from '../pages/merchant/MerchantCases';
import MerchantSettings from '../pages/merchant/MerchantSettings';
import MaterialShopSettings from '../pages/merchant/MaterialShopSettings';
import MaterialShopProducts from '../pages/merchant/MaterialShopProducts';
import MerchantDesignWorkflow from '../pages/merchant/MerchantDesignWorkflow';
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
          { path: '/notifications', element: <MerchantNotifications /> },
          { path: '/leads', element: <MerchantLeads /> },
          { path: '/bookings', element: <MerchantBookings /> },
          { path: '/bookings/:id/site-survey', element: <MerchantBookingSiteSurvey /> },
          { path: '/bookings/:id/budget-confirm', element: <MerchantBookingBudgetConfirm /> },
          { path: '/bookings/:id/design-workflow', element: <MerchantDesignWorkflow /> },
          { path: '/proposals', element: <MerchantProposals /> },
          { path: '/price-book', element: <MerchantPriceBook /> },
          { path: '/quote-lists', element: <MerchantQuoteLists /> },
          { path: '/quote-lists/:id', element: <MerchantQuoteDetail /> },
          { path: '/projects', element: <MerchantProjects /> },
          { path: '/projects/:id', element: <MerchantProjectExecution /> },
          { path: '/projects/:id/dispute', element: <MerchantProjectDispute /> },
          { path: '/orders', element: <MerchantOrders /> },
          { path: '/complaints', element: <MerchantComplaints /> },
          { path: '/contracts/new', element: <MerchantContractCreate /> },
          { path: '/income', element: <MerchantIncome /> },
          { path: '/bond', element: <MerchantBond /> },
          { path: '/payments/result', element: <MerchantPaymentResult /> },
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
