/**
 * AuthEventEmitter - 认证事件总线
 * 
 * 职责：解耦 API 层和状态管理层，实现安全的会话过期处理
 * 
 * 架构说明：
 * 1. api.ts 在 refresh token 失败时发出 'session_expired' 事件
 * 2. App 根组件监听此事件，调用 authStore.logout() 并显示提示
 * 3. 这样 api.ts 不需要直接依赖 zustand store，符合单一职责原则
 */

type AuthEventType =
    | 'session_expired'      // Token 过期且无法刷新
    | 'unauthorized'         // 未授权访问
    | 'force_logout';        // 强制登出（如账号被禁用、在其他设备登录等）

interface AuthEventPayload {
    reason?: string;
    message?: string;
}

type AuthEventListener = (payload?: AuthEventPayload) => void;

class AuthEventEmitter {
    private listeners: Map<AuthEventType, Set<AuthEventListener>> = new Map();
    private static instance: AuthEventEmitter;

    private constructor() {
        // 私有构造函数，确保单例
    }

    /**
     * 获取单例实例
     */
    static getInstance(): AuthEventEmitter {
        if (!AuthEventEmitter.instance) {
            AuthEventEmitter.instance = new AuthEventEmitter();
        }
        return AuthEventEmitter.instance;
    }

    /**
     * 订阅事件
     * @returns 取消订阅的函数
     */
    on(event: AuthEventType, listener: AuthEventListener): () => void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)!.add(listener);

        // 返回取消订阅函数
        return () => {
            this.listeners.get(event)?.delete(listener);
        };
    }

    /**
     * 发送事件
     */
    emit(event: AuthEventType, payload?: AuthEventPayload): void {
        const eventListeners = this.listeners.get(event);
        if (eventListeners) {
            eventListeners.forEach(listener => {
                try {
                    listener(payload);
                } catch (error) {
                    if (__DEV__) {
                        console.error(`[AuthEventEmitter] Error in listener for ${event}:`, error);
                    }
                }
            });
        }
    }

    /**
     * 移除指定事件的所有监听器
     */
    removeAllListeners(event?: AuthEventType): void {
        if (event) {
            this.listeners.delete(event);
        } else {
            this.listeners.clear();
        }
    }
}

// 导出单例实例
export const authEventEmitter = AuthEventEmitter.getInstance();

// 导出类型供外部使用
export type { AuthEventType, AuthEventPayload };
