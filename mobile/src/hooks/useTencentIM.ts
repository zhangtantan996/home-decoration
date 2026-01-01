/**
 * 腾讯云 IM Hook
 * 管理 TUIKit 初始化、登录和状态
 */

import { useState, useEffect, useCallback } from 'react';
import TencentIMService, { IMCredentials } from '../services/TencentIMService';

interface UseTencentIMResult {
    isReady: boolean;
    isLoading: boolean;
    error: string | null;
    credentials: IMCredentials | null;
    refresh: () => Promise<void>;
    logout: () => void;
}

/**
 * 使用腾讯云 IM 的 Hook
 * 
 * @example
 * ```tsx
 * const { isReady, credentials, error } = useTencentIM();
 * 
 * if (!isReady) {
 *     return <LoadingView />;
 * }
 * ```
 */
export function useTencentIM(): UseTencentIMResult {
    const [isReady, setIsReady] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [credentials, setCredentials] = useState<IMCredentials | null>(null);

    // 初始化 IM
    const initIM = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            // 获取凭证
            const creds = await TencentIMService.fetchCredentials();

            if (creds) {
                setCredentials(creds);
                setIsReady(true);
            } else {
                setError('IM 服务未配置或未启用');
                setIsReady(false);
            }
        } catch (err: any) {
            console.error('[useTencentIM] 初始化失败:', err);
            setError(err.message || '初始化失败');
            setIsReady(false);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // 刷新凭证
    const refresh = useCallback(async () => {
        await initIM();
    }, [initIM]);

    // 登出
    const logout = useCallback(() => {
        TencentIMService.logout();
        setCredentials(null);
        setIsReady(false);
    }, []);

    // 组件挂载时初始化
    useEffect(() => {
        initIM();

        // 清理
        return () => {
            // 可选：组件卸载时登出
            // TencentIMService.logout();
        };
    }, [initIM]);

    return {
        isReady,
        isLoading,
        error,
        credentials,
        refresh,
        logout,
    };
}

export default useTencentIM;
