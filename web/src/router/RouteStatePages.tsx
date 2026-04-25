import { Link, Navigate, isRouteErrorResponse, useLocation, useParams, useRouteError } from 'react-router-dom';

import { EmptyBlock, ErrorBlock } from '../components/AsyncState';
import type { ProviderRole } from '../types/viewModels';
import { readSafeErrorMessage } from '../utils/userFacingText';

const pageActions = (
  <div className="inline-actions state-actions">
    <Link className="button-secondary" to="/">回首页</Link>
    <Link className="button-outline" to="/providers">去找服务商</Link>
  </div>
);

function isProviderRole(value: string | undefined): value is ProviderRole {
  return value === 'designer' || value === 'company' || value === 'foreman';
}

export function RouteNotFoundPage() {
  return (
    <div className="container page-stack">
      <EmptyBlock
        action={pageActions}
        description="链接可能已失效，或地址不正确。"
        title="页面不存在"
      />
    </div>
  );
}

export function RouteErrorPage() {
  const error = useRouteError();

  if (isRouteErrorResponse(error) && error.status === 404) {
    return <RouteNotFoundPage />;
  }

  const description = readSafeErrorMessage(error, '页面加载失败，请稍后重试。');

  return (
    <main className="container page-stack">
      <ErrorBlock description={description} />
      {pageActions}
    </main>
  );
}

export function ProviderRoleRedirectPage() {
  const { role } = useParams();
  const location = useLocation();

  if (!isProviderRole(role)) {
    return <RouteNotFoundPage />;
  }

  const searchParams = new URLSearchParams(location.search);
  searchParams.set('category', role);
  const search = searchParams.toString();

  return <Navigate replace to={search ? `/providers?${search}` : '/providers'} />;
}
