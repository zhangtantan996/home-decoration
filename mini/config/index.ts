import { defineConfig } from '@tarojs/cli';
import path from 'path';

import devConfig from './dev';
import prodConfig from './prod';

export default defineConfig(async (merge) => {
  const taroEnv = process.env.TARO_ENV;
  const isH5 = taroEnv === 'h5';
  const isProduction = process.env.NODE_ENV === 'production';
  const h5PublicPath = process.env.TARO_APP_H5_PUBLIC_PATH || (isH5 && isProduction ? '/app/' : '/');
  const plugins = ['@tarojs/plugin-framework-react'];

  if (!isH5) {
    plugins.push('@tarojs/plugin-platform-weapp');
  }

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
    outputRoot: isH5 ? 'dist/h5' : 'dist/weapp',
    plugins,
    alias: {
      '@': path.resolve(__dirname, '..', 'src'),
    },
    defineConstants: {},
    webpackChain(chain) {
      if (isH5 && isProduction) {
        chain.optimization.minimize(false);
      }
    },
    framework: 'react',
    compiler: {
      type: 'webpack5',
      prebundle: {
        enable: false,
      },
    },
    cache: {
      enable: true
    },
    mini: {
      miniCssExtractPluginOption: {
        ignoreOrder: true
      },
      postcss: {
        pxtransform: {
          enable: true,
          config: {}
        },
        cssModules: {
          enable: false
        }
      },
      sassLoaderOption: {
        sassOptions: {
          includePaths: [path.resolve(__dirname, '..', 'src')]
        }
      }
    },
    h5: {
      publicPath: h5PublicPath,
      staticDirectory: 'static',
      output: {
        environment: {
          asyncFunction: true,
          arrowFunction: true,
          bigIntLiteral: true,
          const: true,
          destructuring: true,
          dynamicImport: true,
          forOf: true,
          module: true,
          optionalChaining: true,
          templateLiteral: true,
        },
      },
      router: {
        mode: 'hash',
      },
      webpackChain(chain, webpack) {
        chain.resolve.alias.set('@tarojs/components$', path.resolve(__dirname, '..', 'src/shims/taro-components.cjs'));
        chain.plugin('replaceTaroRouterTabbar').use(webpack.NormalModuleReplacementPlugin, [
          /[/\\]@tarojs[/\\]router[/\\]dist[/\\]tabbar\.js$/,
          path.resolve(__dirname, '..', 'src/shims/taro-tabbar.js'),
        ]);
      },
      devServer: {
        port: 5176,
        hot: false,
      },
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

  if (isProduction) {
    return merge({}, baseConfig, prodConfig);
  }
  return merge({}, baseConfig, devConfig);
});
