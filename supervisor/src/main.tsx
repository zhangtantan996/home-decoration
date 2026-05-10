import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { App, ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import router from "./router";
import "./index.css";
import { supervisorTheme } from "./styles/theme";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConfigProvider locale={zhCN} theme={supervisorTheme}>
      <App>
        <RouterProvider router={router} />
      </App>
    </ConfigProvider>
  </StrictMode>,
);
