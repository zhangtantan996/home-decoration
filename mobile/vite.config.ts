import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
    base: '/mobile/',
    plugins: [react()],
    resolve: {
        alias: {
            'react-native': 'react-native-web',
        },
        extensions: ['.web.tsx', '.web.ts', '.web.js', '.tsx', '.ts', '.js'],
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
