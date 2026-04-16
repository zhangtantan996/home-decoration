import { Navigate, createBrowserRouter } from 'react-router-dom';

import { AuthenticatedAppLayout } from '../app/AuthenticatedAppLayout';
import { ProfileWorkspaceLayout } from '../app/ProfileWorkspaceLayout';
import { PublicAppLayout } from '../app/PublicAppLayout';
import { PublicAuthLayout } from '../app/PublicAuthLayout';
import { BookingDetailPage } from '../pages/BookingDetailPage';
import { BookingBudgetConfirmPage } from '../pages/BookingBudgetConfirmPage';
import { BookingRefundPage } from '../pages/BookingRefundPage';
import { BookingSiteSurveyPage } from '../pages/BookingSiteSurveyPage';
import { DesignFeeQuotePage } from '../pages/DesignFeeQuotePage';
import { DesignDeliverableReviewPage } from '../pages/DesignDeliverableReviewPage';
import { AfterSalesCreatePage } from '../pages/AfterSalesCreatePage';
import { AfterSalesDetailPage } from '../pages/AfterSalesDetailPage';
import { AfterSalesPage } from '../pages/AfterSalesPage';
import { ComplaintCreatePage } from '../pages/ComplaintCreatePage';
import { ContractConfirmPage } from '../pages/ContractConfirmPage';
import { DemandComparePage } from '../pages/DemandComparePage';
import { DemandCreatePage } from '../pages/DemandCreatePage';
import { DemandDetailPage } from '../pages/DemandDetailPage';
import { HomePage } from '../pages/HomePage';
import { InspirationDetailPage } from '../pages/InspirationDetailPage';
import { InspirationPage } from '../pages/InspirationPage';
import { LoginPage } from '../pages/LoginPage';
import { MaterialShopDetailPage } from '../pages/MaterialShopDetailPage';
import { OrderDetailPage } from '../pages/OrderDetailPage';
import { PaymentDetailPage } from '../pages/PaymentDetailPage';
import { ProfileHomePage } from '../pages/ProfileHomePage';
import { ProgressPage } from '../pages/ProgressPage';
import { PaymentResultPage } from '../pages/PaymentResultPage';
import { ProjectAcceptancePage } from '../pages/ProjectAcceptancePage';
import { ProjectBillingPage } from '../pages/ProjectBillingPage';
import { ProjectCompletionPage } from '../pages/ProjectCompletionPage';
import { ProjectDisputePage } from '../pages/ProjectDisputePage';
import { ProjectChangeRequestPage } from '../pages/ProjectChangeRequestPage';
import { ProjectPausePage } from '../pages/ProjectPausePage';
import { ProposalDetailPage } from '../pages/ProposalDetailPage';
import { ProviderSceneDetailPage, ProviderShowcaseDetailPage } from '../pages/ProviderAssetDetailPages';
import { ProviderBookingCreatePage } from '../pages/ProviderBookingCreatePage';
import { QuoteTaskDetailPage } from '../pages/QuoteTaskDetailPage';
import { ProviderDetailPage } from '../pages/ProviderDetailPage';
import { ProvidersPage } from '../pages/ProvidersPage';
import { QuoteGeneratorLandingPage } from '../pages/QuoteGeneratorLandingPage';
import { PrivacyPolicyPage } from '../pages/legal/PrivacyPolicyPage';
import { UserAgreementPage } from '../pages/legal/UserAgreementPage';
import { BookingsPage } from '../pages/profile/BookingsPage';
import { ComplaintsPage } from '../pages/profile/ComplaintsPage';
import { DemandsPage } from '../pages/profile/DemandsPage';
import { MessagesPage } from '../pages/profile/MessagesPage';
import { OrdersPage } from '../pages/profile/OrdersPage';
import { ProjectsPage } from '../pages/profile/ProjectsPage';
import { ProposalsPage } from '../pages/profile/ProposalsPage';
import { SettingsPage } from '../pages/profile/SettingsPage';
import { ProtectedRoute } from './ProtectedRoute';
import { PublicOnlyRoute } from './PublicOnlyRoute';
import { ProviderRoleRedirectPage, RouteErrorPage, RouteNotFoundPage } from './RouteStatePages';

const basename = (() => {
  const raw = (import.meta.env.VITE_ROUTER_BASENAME || '/').trim();
  if (!raw || raw === '/') {
    return '/';
  }
  return `/${raw.replace(/^\/+|\/+$/g, '')}`;
})();

const errorElement = <RouteErrorPage />;

const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <PublicAuthLayout />,
      errorElement,
      children: [
        {
          path: 'login',
          element: (
            <PublicOnlyRoute>
              <LoginPage />
            </PublicOnlyRoute>
          ),
        },
        { path: 'legal/user-agreement', element: <UserAgreementPage /> },
        { path: 'legal/privacy-policy', element: <PrivacyPolicyPage /> },
      ],
    },
  {
    path: '/',
    element: <PublicAppLayout />,
    errorElement,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'quote-generator', element: <QuoteGeneratorLandingPage /> },
      { path: 'inspiration', element: <InspirationPage /> },
        { path: 'inspiration/:id', element: <InspirationDetailPage /> },
        { path: 'providers', element: <ProvidersPage /> },
        { path: 'providers/:role', element: <ProviderRoleRedirectPage /> },
        { path: 'provider-cases/:id', element: <ProviderShowcaseDetailPage /> },
        { path: 'provider-scenes/:id', element: <ProviderSceneDetailPage /> },
        { path: 'providers/:role/:id/booking', element: <ProviderBookingCreatePage /> },
        { path: 'providers/:role/:id', element: <ProviderDetailPage /> },
        { path: 'material-shops/:id', element: <MaterialShopDetailPage /> },
        { path: '*', element: <RouteNotFoundPage /> },
      ],
    },
    {
      path: '/',
      element: (
        <ProtectedRoute>
          <AuthenticatedAppLayout />
        </ProtectedRoute>
      ),
      errorElement,
      children: [
        { path: 'progress', element: <ProjectsPage /> },
        { path: 'messages', element: <Navigate to="/me/notifications" replace /> },
        { path: 'notifications', element: <Navigate to="/me/notifications" replace /> },
        { path: 'orders/:id', element: <OrderDetailPage /> },
        { path: 'payments/:id', element: <PaymentDetailPage /> },
        { path: 'payments/result', element: <PaymentResultPage /> },
        { path: 'me', element: <ProfileWorkspaceLayout />, children: [
          { index: true, element: <ProfileHomePage /> },
          { path: 'bookings', element: <BookingsPage /> },
          { path: 'demands', element: <DemandsPage /> },
          { path: 'proposals', element: <ProposalsPage /> },
          { path: 'projects', element: <ProjectsPage /> },
          { path: 'orders', element: <OrdersPage /> },
          { path: 'messages', element: <MessagesPage /> },
          { path: 'notifications', element: <MessagesPage /> },
          { path: 'complaints', element: <ComplaintsPage /> },
          { path: 'after-sales', element: <AfterSalesPage /> },
          { path: 'settings', element: <SettingsPage /> },
          { path: 'edit', element: <Navigate replace to="/me/settings?tab=profile" /> },
        ] },
        { path: 'after-sales', element: <Navigate replace to="/me/after-sales" /> },
        { path: 'after-sales/new', element: <AfterSalesCreatePage /> },
        { path: 'after-sales/:id', element: <AfterSalesDetailPage /> },
        { path: 'complaints/new', element: <ComplaintCreatePage /> },
        { path: 'demands/new', element: <DemandCreatePage /> },
        { path: 'demands/:id', element: <DemandDetailPage /> },
        { path: 'demands/:id/compare', element: <DemandComparePage /> },
        { path: 'bookings/:id', element: <BookingDetailPage /> },
        { path: 'bookings/:id/refund', element: <BookingRefundPage /> },
        { path: 'bookings/:id/site-survey', element: <BookingSiteSurveyPage /> },
        { path: 'bookings/:id/budget-confirm', element: <BookingBudgetConfirmPage /> },
        { path: 'bookings/:id/design-quote', element: <DesignFeeQuotePage /> },
        { path: 'bookings/:bookingId/design-deliverable', element: <DesignDeliverableReviewPage /> },
        { path: 'proposals/:id', element: <ProposalDetailPage /> },
        { path: 'quote-tasks/:id', element: <QuoteTaskDetailPage /> },
        { path: 'projects/:id', element: <ProgressPage /> },
        { path: 'projects/:id/billing', element: <ProjectBillingPage /> },
        { path: 'projects/:id/pause', element: <ProjectPausePage /> },
        { path: 'projects/:id/dispute', element: <ProjectDisputePage /> },
        { path: 'projects/:id/contract', element: <ContractConfirmPage /> },
        { path: 'projects/:id/acceptance', element: <ProjectAcceptancePage /> },
        { path: 'projects/:id/completion', element: <ProjectCompletionPage /> },
        { path: 'projects/:projectId/design-deliverable', element: <DesignDeliverableReviewPage /> },
        { path: 'projects/:id/change-request', element: <ProjectChangeRequestPage /> },
      ],
    },
  ],
  { basename },
);

export default router;
