import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiUrl } from '../config';
import WebSocketService, { PushPayload } from '../services/WebSocketService';

export interface Message {
    id: number;
    conversationId: string;
    senderId: number;
    receiverId: number;
    content: string;
    msgType: number;
    isRead: boolean;
    createdAt: string;
    // 本地状态
    status?: 'sending' | 'sent' | 'failed';
    localSeq?: string; // 用于匹配 ACK
}

export interface Conversation {
    id: string;
    user1Id: number;
    user2Id: number;
    lastMessageContent: string;
    lastMessageTime: string;
    partnerId: number;
    partnerName: string;
    partnerAvatar: string;
    unreadCount: number;
}

interface ChatState {
    // 状态
    connectionStatus: 'connected' | 'connecting' | 'disconnected';
    conversations: Conversation[];
    messages: Record<string, Message[]>; // key: conversationId
    isLoadingConversations: boolean;
    isLoadingMessages: boolean;

    // Actions
    connect: () => void;
    disconnect: () => void;
    fetchConversations: () => Promise<void>;
    fetchMessages: (conversationId: string, page?: number) => Promise<void>;
    sendMessage: (receiverId: number, content: string) => void;
    markAsRead: (conversationId: string, lastMsgId: number) => void;
    onMessageReceived: (payload: PushPayload) => void;
    onAckReceived: (seq: string, messageId: number) => void;
    setConnectionStatus: (status: 'connected' | 'connecting' | 'disconnected') => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
    connectionStatus: 'disconnected',
    conversations: [],
    messages: {},
    isLoadingConversations: false,
    isLoadingMessages: false,

    // 连接 WebSocket
    connect: () => {
        // 设置回调
        WebSocketService.setCallbacks(
            get().onMessageReceived,
            get().onAckReceived,
            (status) => {
                get().setConnectionStatus(status);
                // 离线恢复后自动同步会话列表
                if (status === 'connected') {
                    get().fetchConversations();
                }
            }
        );
        WebSocketService.connect();
    },

    // 断开连接
    disconnect: () => {
        WebSocketService.disconnect();
    },

    // 设置连接状态
    setConnectionStatus: (status) => {
        set({ connectionStatus: status });
    },

    // 获取会话列表
    fetchConversations: async () => {
        set({ isLoadingConversations: true });
        try {
            const token = await AsyncStorage.getItem('token');
            const res = await fetch(`${getApiUrl()}/chat/conversations`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json() as { code: number; data?: Conversation[] };
            if (data.code === 0) {
                set({ conversations: data.data || [] });
            }
        } catch (error) {
            console.error('[ChatStore] 获取会话列表失败:', error);
        } finally {
            set({ isLoadingConversations: false });
        }
    },

    // 获取聊天记录
    fetchMessages: async (conversationId, page = 1) => {
        set({ isLoadingMessages: true });
        try {
            const token = await AsyncStorage.getItem('token');
            const res = await fetch(
                `${getApiUrl()}/chat/messages?conversationId=${conversationId}&page=${page}&pageSize=20`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            const data = await res.json() as { code: number; data?: { messages?: Message[] } };
            if (data.code === 0) {
                const newMessages = data.data?.messages || [];
                set((state) => ({
                    messages: {
                        ...state.messages,
                        [conversationId]: page === 1
                            ? newMessages.reverse() // API 返回倒序，这里反转
                            : [...newMessages.reverse(), ...(state.messages[conversationId] || [])],
                    },
                }));
            }
        } catch (error) {
            console.error('[ChatStore] 获取聊天记录失败:', error);
        } finally {
            set({ isLoadingMessages: false });
        }
    },

    // 发送消息 (Optimistic UI)
    sendMessage: (receiverId, content) => {
        const currentUserId = 1; // TODO: 从 authStore 获取
        const conversationId = currentUserId < receiverId
            ? `${currentUserId}_${receiverId}`
            : `${receiverId}_${currentUserId}`;

        // Optimistic: 先添加到本地
        const localSeq = WebSocketService.sendMessage(receiverId, content);
        const optimisticMessage: Message = {
            id: -Date.now(), // 临时 ID
            conversationId,
            senderId: currentUserId,
            receiverId,
            content,
            msgType: 1,
            isRead: false,
            createdAt: new Date().toISOString(),
            status: 'sending',
            localSeq,
        };

        set((state) => ({
            messages: {
                ...state.messages,
                [conversationId]: [...(state.messages[conversationId] || []), optimisticMessage],
            },
        }));
    },

    // 标记已读
    markAsRead: (conversationId, lastMsgId) => {
        WebSocketService.sendReadAck(conversationId, lastMsgId);
        // 更新本地未读数
        set((state) => ({
            conversations: state.conversations.map((c) =>
                c.id === conversationId ? { ...c, unreadCount: 0 } : c
            ),
        }));
    },

    // 收到新消息
    onMessageReceived: (payload) => {
        const message: Message = {
            id: payload.messageId,
            conversationId: payload.conversationId,
            senderId: payload.senderId,
            receiverId: 0, // 自己是接收者
            content: payload.content,
            msgType: payload.msgType,
            isRead: false,
            createdAt: payload.createdAt,
            status: 'sent',
        };

        set((state) => {
            const convMessages = state.messages[payload.conversationId] || [];
            // 去重
            if (convMessages.some((m) => m.id === message.id)) {
                return state;
            }
            return {
                messages: {
                    ...state.messages,
                    [payload.conversationId]: [...convMessages, message],
                },
                // 更新会话列表
                conversations: state.conversations.map((c) =>
                    c.id === payload.conversationId
                        ? {
                            ...c,
                            lastMessageContent: payload.content,
                            lastMessageTime: payload.createdAt,
                            unreadCount: c.unreadCount + 1,
                        }
                        : c
                ),
            };
        });
    },

    // 收到发送确认
    onAckReceived: (seq, messageId) => {
        set((state) => {
            const newMessages = { ...state.messages };
            for (const convId in newMessages) {
                newMessages[convId] = newMessages[convId].map((m) =>
                    m.localSeq === seq ? { ...m, id: messageId, status: 'sent' } : m
                );
            }
            return { messages: newMessages };
        });
    },
}));
