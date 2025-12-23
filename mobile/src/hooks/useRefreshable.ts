import { useState, useCallback } from 'react';

interface UseRefreshableOptions {
    onRefresh: () => Promise<void>;
}

interface UseRefreshableResult {
    refreshing: boolean;
    error: string | null;
    isLoading: boolean;
    handleRefresh: () => Promise<void>;
    setError: (error: string | null) => void;
    setIsLoading: (loading: boolean) => void;
}

export function useRefreshable({ onRefresh }: UseRefreshableOptions): UseRefreshableResult {
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        setError(null);
        try {
            await onRefresh();
        } catch (err: any) {
            // 判断错误类型
            if (err.message?.includes('Network') || err.code === 'ERR_NETWORK') {
                setError('网络连接失败，请检查网络设置');
            } else if (err.response?.status >= 500) {
                setError('服务器错误，请稍后重试');
            } else if (err.code === 'ECONNABORTED') {
                setError('请求超时，请重试');
            } else {
                setError(err.message || '加载失败，请重试');
            }
        } finally {
            setRefreshing(false);
            setIsLoading(false);
        }
    }, [onRefresh]);

    return {
        refreshing,
        error,
        isLoading,
        handleRefresh,
        setError,
        setIsLoading,
    };
}

export default useRefreshable;
