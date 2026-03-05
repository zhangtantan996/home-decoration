/**
 * 配置文件入口
 * 导出环境配置和 API URL 获取函数
 */

import { ENV } from './env';

/**
 * 获取 API 基础 URL
 * @returns API 基础 URL（例如：http://localhost:8080）
 */
export function getApiUrl(): string {
  return ENV.API_BASE_URL;
}

/**
 * 导出完整的环境配置
 */
export { ENV };

/**
 * 导出其他配置常量
 */
export const API_TIMEOUT = ENV.API_TIMEOUT;
export const IS_DEV = ENV.IS_DEV;
export const PLATFORM = ENV.PLATFORM;
