import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
    // base: '/mobile/', // 移除子路径，使用根路径，修复 SPA 路由问题
    plugins: [react()],
    resolve: {
        alias: {
            'react-native': 'react-native-web',
        },
        extensions: ['.web.tsx', '.web.ts', '.web.js', '.tsx', '.ts', '.js'],
    },
    server: {
        host: '0.0.0.0', // 允许局域网访问
        port: 8082,      // 修改为 8082，避开 Metro (8081) 端口冲突
        open: true,      // 启动自动打开浏览器
    },
    optimizeDeps: {
        esbuildOptions: {
            resolveExtensions: ['.web.tsx', '.web.ts', '.web.js', '.tsx', '.ts', '.js'],
            loader: {
                '.js': 'jsx',
            },
            mainFields: ['module', 'main'],
        },
    },
    define: {
        // React Native expects 'global' to exist
        global: 'window',
    },
});
