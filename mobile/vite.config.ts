import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
    // base: '/mobile/', // 移除子路径，使用根路径，修复 SPA 路由问题
    plugins: [react()],
    resolve: {
        alias: [
            { find: 'react-native', replacement: resolve(__dirname, 'src/mocks/react-native-web-all.js') },
            { find: /^react-native-camera-kit(\/.*)?$/, replacement: resolve(__dirname, 'src/mocks/native-mocks.js') },
            { find: /^react-native-image-crop-picker(\/.*)?$/, replacement: resolve(__dirname, 'src/mocks/native-mocks.js') },
            { find: /^react-native-image-picker(\/.*)?$/, replacement: resolve(__dirname, 'src/mocks/native-mocks.js') },
            { find: /^react-native-keychain(\/.*)?$/, replacement: resolve(__dirname, 'src/mocks/native-mocks.js') },
            { find: /^react-native-safe-area-context(\/.*)?$/, replacement: resolve(__dirname, 'src/mocks/react-native-web-all.js') }, // Redirect this too if it causes issues
            { find: /^react-native\/Libraries\/Utilities\/codegenNativeComponent$/, replacement: resolve(__dirname, 'src/mocks/native-mocks.js') },
            { find: /^react-native\/Libraries\/Renderer\/shims\/ReactNative$/, replacement: resolve(__dirname, 'node_modules/react-native-web') },
        ],
        extensions: ['.web.tsx', '.web.ts', '.web.js', '.tsx', '.ts', '.js'],
    },
    server: {
        host: '0.0.0.0', // 允许局域网访问
        port: 8082,      // 修改为 8082，避开 Metro (8081) 端口冲突
        open: true,      // 启动自动打开浏览器
        watch: {
            usePolling: true,
        },
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
