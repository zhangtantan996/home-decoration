import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { ConfigProvider, App } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import merchantRouter from './merchant-router'
import './index.css'

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <ConfigProvider locale={zhCN}>
            <App>
                <RouterProvider router={merchantRouter} />
            </App>
        </ConfigProvider>
    </StrictMode>,
)
