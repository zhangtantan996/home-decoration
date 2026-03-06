export type AppEnv = 'local' | 'test' | 'staging' | 'production';

const normalizeAppEnv = (raw?: string): AppEnv => {
  const value = (raw || '').trim().toLowerCase();
  switch (value) {
    case '':
    case 'local':
    case 'dev':
    case 'development':
    case 'docker':
      return 'local';
    case 'test':
    case 'testing':
      return 'test';
    case 'stage':
    case 'staging':
    case 'pre':
    case 'preprod':
    case 'pre-production':
      return 'staging';
    case 'prod':
    case 'production':
    case 'release':
      return 'production';
    default:
      return 'local';
  }
};

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

const getDefaultApiBaseUrl = (appEnv: AppEnv) => {
  switch (appEnv) {
    case 'local':
    case 'test':
      return 'http://127.0.0.1:8080/api/v1';
    default:
      return 'https://api.yourdomain.com/api/v1';
  }
};

const APP_ENV = normalizeAppEnv(process.env.TARO_APP_ENV);
const API_BASE_URL = trimTrailingSlash(process.env.TARO_APP_API_BASE || getDefaultApiBaseUrl(APP_ENV));
const H5_URL = (process.env.TARO_APP_H5_URL || '').trim();
const TINODE_URL = (process.env.TARO_APP_TINODE_URL || '').trim();
const TINODE_API_KEY = (process.env.TARO_APP_TINODE_API_KEY || '').trim();

export const MINI_ENV = {
  APP_ENV,
  API_BASE_URL,
  H5_URL,
  TINODE_URL,
  TINODE_API_KEY,
};
