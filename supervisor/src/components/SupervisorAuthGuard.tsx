import { useEffect, useState } from "react";
import {
  Navigate,
  Outlet,
  createSearchParams,
  useLocation,
} from "react-router-dom";
import { useSupervisorAuthStore } from "../stores/supervisorAuthStore";

// 无需登录的公开页面路径
const PUBLIC_PATHS = ["/login", "/apply"];

/** AUTH-4: 解析 JWT payload 中的 exp，判断 token 是否已过期 */
function isTokenExpired(token: string): boolean {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const payload = JSON.parse(
      atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")),
    );
    if (typeof payload.exp !== "number") return false;
    // 提前 30 秒视为过期，让 interceptor 有时间做 refresh
    return Date.now() / 1000 > payload.exp - 30;
  } catch {
    return false; // 解析失败时保守放行，让 interceptor 处理
  }
}

export default function SupervisorAuthGuard() {
  // 使用独立选择器，避免每次返回新对象引起 Zustand 重渲染循环
  const isAuthenticated = useSupervisorAuthStore((s) => s.isAuthenticated);
  const accessToken = useSupervisorAuthStore((s) => s.accessToken);
  const logout = useSupervisorAuthStore((s) => s.logout);
  const location = useLocation();

  // AUTH-4: 记录"是否因 token 过期而需要踢出"
  // 必须用 state 而非在渲染中直接调用 logout()，避免 render side-effect
  const [expiredRedirect, setExpiredRedirect] = useState(false);

  useEffect(() => {
    if (
      !PUBLIC_PATHS.includes(location.pathname) &&
      isAuthenticated &&
      accessToken &&
      isTokenExpired(accessToken)
    ) {
      logout();
      setExpiredRedirect(true);
    }
  }, [location.pathname, isAuthenticated, accessToken, logout]);

  // 公开页面直接放行
  if (PUBLIC_PATHS.includes(location.pathname)) {
    return <Outlet />;
  }

  // token 已过期，正在踢出（useEffect 已调用 logout，isAuthenticated 会变 false）
  if (expiredRedirect || !isAuthenticated) {
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
