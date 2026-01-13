import { defineConfig } from '@tarojs/cli';
import path from 'path';

import devConfig from './dev';
import prodConfig from './prod';

export default defineConfig(async (merge) => {
  const baseConfig = {
    projectName: 'home-decoration-mini',
    date: '2026-01-08',
    designWidth: 750,
    deviceRatio: {
      640: 2.34 / 2,
      750: 1,
      828: 1.81 / 2
    },
    sourceRoot: 'src',
    outputRoot: 'dist',
    plugins: ['@tarojs/plugin-framework-react', '@tarojs/plugin-platform-weapp'],
    alias: {
      '@': path.resolve(__dirname, '..', 'src')
    },
    defineConstants: {},
    framework: 'react',
    compiler: 'webpack5',
    cache: {
      enable: true
    },
    mini: {
      postcss: {
        pxtransform: {
          enable: true,
          config: {}
        },
        cssModules: {
          enable: false
        }
      }
    },
    h5: {
      publicPath: '/',
      staticDirectory: 'static',
      postcss: {
        autoprefixer: {
          enable: true,
          config: {}
        },
        cssModules: {
          enable: false
        }
      }
    }
  };

  if (process.env.NODE_ENV === 'development') {
    return merge({}, baseConfig, devConfig);
  }
  return merge({}, baseConfig, prodConfig);
});
