import { createBrowserRouter, Navigate } from "react-router-dom";
import React, { Suspense } from "react";
import { Spin } from "antd";
import SupervisorLayout from "../layouts/SupervisorLayout";
import SupervisorAuthGuard from "../components/SupervisorAuthGuard";
import SupervisorPortalUnavailable from "../pages/SupervisorPortalUnavailable";
import { getRouterBasename, isSupervisorPortalFrontendEnabled } from "../utils/env";

// 懒加载所有页面组件，减少首屏 bundle 体积
const SupervisorLogin = React.lazy(
  () => import("../pages/login/SupervisorLogin"),
);
const SupervisorApply = React.lazy(
  () => import("../pages/apply/SupervisorApply"),
);
const SupervisorDashboard = React.lazy(
  () => import("../pages/dashboard/SupervisorDashboard"),
);
const SupervisorProjectList = React.lazy(
  () => import("../pages/projects/SupervisorProjectList"),
);
const SupervisorProjectDetail = React.lazy(
  () => import("../pages/projects/SupervisorProjectDetail"),
);
const SupervisorProfile = React.lazy(
  () => import("../pages/profile/SupervisorProfile"),
);
const SupervisorSessions = React.lazy(
  () => import("../pages/sessions/SupervisorSessions"),
);

const PageFallback = (
  <div
    style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      height: "40vh",
    }}
  >
    <Spin size="large" />
  </div>
);

const withSuspense = (element: React.ReactNode) => (
  <Suspense fallback={PageFallback}>{element}</Suspense>
);

const routes = isSupervisorPortalFrontendEnabled()
  ? [
    { path: "/", element: <Navigate to="/dashboard" replace /> },
    {
      element: <SupervisorAuthGuard />,
      children: [
        // 公网页面（无需登录）
        { path: "/login", element: withSuspense(<SupervisorLogin />) },
        { path: "/apply", element: withSuspense(<SupervisorApply />) },

        // 需登录页面
        {
          element: <SupervisorLayout />,
          children: [
            {
              path: "/dashboard",
              element: withSuspense(<SupervisorDashboard />),
            },
            {
              path: "/projects",
              element: withSuspense(<SupervisorProjectList />),
            },
            {
              path: "/projects/:id",
              element: withSuspense(<SupervisorProjectDetail />),
            },
            { path: "/profile", element: withSuspense(<SupervisorProfile />) },
            {
              path: "/sessions",
              element: withSuspense(<SupervisorSessions />),
            },
          ],
        },
      ],
    },
    { path: "*", element: <Navigate to="/dashboard" replace /> },
  ]
  : [{ path: "*", element: <SupervisorPortalUnavailable /> }];

const router = createBrowserRouter(
  routes,
  {
    basename: getRouterBasename(),
  },
);

export default router;
