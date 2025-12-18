import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import BasicLayout from './layouts/BasicLayout';
import Dashboard from './pages/dashboard';
import ProjectList from './pages/projects/list';

// 占位页面组件
const PlaceholderPage: React.FC<{ title: string }> = ({ title }) => (
    <div style={{ padding: 24, background: '#fff', borderRadius: 8 }}>
        <h2>{title}</h2>
        <p>页面开发中...</p>
    </div>
);

import Login from './pages/user/Login';

const router = createBrowserRouter([
    { path: '/login', element: <Login /> },
    {
        path: '/',
        element: <BasicLayout />,
        children: [
            { index: true, element: <Navigate to="/dashboard" replace /> },
            { path: 'dashboard', element: <Dashboard /> },
            { path: 'projects/list', element: <ProjectList /> },
            { path: 'projects/map', element: <PlaceholderPage title="全景地图" /> },
            { path: 'providers/designers', element: <PlaceholderPage title="设计师管理" /> },
            { path: 'providers/companies', element: <PlaceholderPage title="装修公司管理" /> },
            { path: 'providers/foremen', element: <PlaceholderPage title="工长管理" /> },
            { path: 'providers/audit', element: <PlaceholderPage title="资质审核" /> },
            { path: 'finance/escrow', element: <PlaceholderPage title="托管账户" /> },
            { path: 'finance/transactions', element: <PlaceholderPage title="交易记录" /> },
            { path: 'risk/warnings', element: <PlaceholderPage title="风险预警" /> },
            { path: 'risk/arbitration', element: <PlaceholderPage title="仲裁中心" /> },
            { path: 'settings', element: <PlaceholderPage title="系统设置" /> },
        ],
    },
], {
    basename: '/admin'
});

export default router;
