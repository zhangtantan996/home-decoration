import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import { App, ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { createOpsRouter } from './router';
import { alignLocationWithRouterBasename } from './utils/env';
import './styles/index.css';

dayjs.locale('zh-cn');
alignLocationWithRouterBasename();
const router = createOpsRouter();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        cssVar: true,
        token: {
          borderRadius: 8,
          fontFamily: '"PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
        },
      }}
    >
      <App>
        <RouterProvider router={router} />
      </App>
    </ConfigProvider>
  </StrictMode>,
);
