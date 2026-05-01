import {
  Navigate,
  Outlet,
  createSearchParams,
  useLocation,
} from "react-router-dom";
import { useMerchantAuthStore } from "../stores/merchantAuthStore";

export default function MerchantAuthGuard() {
  const isAuthenticated = useMerchantAuthStore(
    (state) => state.isAuthenticated,
  );
  const location = useLocation();

  if (!isAuthenticated) {
    const redirect = `${location.pathname}${location.search}`;
    const search =
      redirect && redirect !== "/"
        ? `?${createSearchParams({ redirect })}`
        : "";
    return (
      <Navigate to={`/login${search}`} replace state={{ from: location }} />
    );
  }

  return <Outlet />;
}
