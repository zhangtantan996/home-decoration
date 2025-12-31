/**
 * useSessionExpiry - 会话过期处理 Hook
 * 
 * 职责：
 * 1. 监听 session_expired 事件
 * 2. 调用 authStore.logout() 清除状态
 * 3. 显示友好的过期提示
 * 
 * 使用位置：App 根组件（AppNavigator）
 */

import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { authEventEmitter, AuthEventPayload } from '../services/AuthEventEmitter';
import { useAuthStore } from '../store/authStore';

export const useSessionExpiry = () => {
    const logout = useAuthStore(state => state.logout);
    const isAuthenticated = useAuthStore(state => state.isAuthenticated);

    // 使用 ref 防止多次弹窗
    const isHandling = useRef(false);

    useEffect(() => {
        const handleSessionExpired = async (payload?: AuthEventPayload) => {
            // 防止重复处理
            if (isHandling.current || !isAuthenticated) {
                return;
            }

            isHandling.current = true;

            try {
                // 先执行登出操作
                await logout();

                // 然后显示提示（使用 setTimeout 确保状态已更新）
                setTimeout(() => {
                    Alert.alert(
                        '登录已过期',
                        payload?.message || '您的登录状态已过期，请重新登录',
                        [
                            {
                                text: '确定',
                                style: 'default',
                            },
                        ],
                        { cancelable: false }
                    );
                }, 100);
            } catch (error) {
                if (__DEV__) {
                    console.error('[useSessionExpiry] Error handling session expiry:', error);
                }
            } finally {
                // 延迟重置标志，防止短时间内重复触发
                setTimeout(() => {
                    isHandling.current = false;
                }, 1000);
            }
        };

        // 订阅事件
        const unsubscribe = authEventEmitter.on('session_expired', handleSessionExpired);

        // 清理订阅
        return () => {
            unsubscribe();
        };
    }, [logout, isAuthenticated]);
};
