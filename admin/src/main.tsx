import { StrictMode, Component, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { Button, ConfigProvider, App } from "antd";
import zhCN from "antd/locale/zh_CN";
import router from "./router";
import { getLoginPath } from "./utils/env";
import "./index.css";
import "./styles/layout-overrides.css";
import { adminTheme } from "./styles/theme";

class AdminErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[admin-app] render failed", error, errorInfo);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="admin-error-fallback">
          <div className="admin-error-fallback__card">
            <h2 className="admin-error-fallback__title">管理后台加载失败</h2>
            <p className="admin-error-fallback__desc">
              页面没有正常显示。请先刷新页面；如果仍然失败，请重新登录后再进入后台。
            </p>
            <div className="admin-error-fallback__actions">
              <Button type="primary" onClick={() => window.location.reload()}>
                刷新页面
              </Button>
              <Button onClick={() => window.location.replace(getLoginPath())}>
                重新登录
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConfigProvider locale={zhCN} theme={adminTheme}>
      <App>
        <AdminErrorBoundary>
          <RouterProvider router={router} />
        </AdminErrorBoundary>
      </App>
    </ConfigProvider>
  </StrictMode>,
);
