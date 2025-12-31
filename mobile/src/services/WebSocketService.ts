/**
 * WebSocket 服务 - 单例模式
 * 负责建立连接、心跳保活、自动重连
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiBaseUrl } from '../config';

// 协议类型
export enum PacketType {
    // 客户端 -> 服务端
    PING = 0,
    MESSAGE_SEND = 1,
    ACK_READ = 2,
    // 服务端 -> 客户端
    PONG = 10,
    MESSAGE_PUSH = 11,
    ACK_SEND = 12,
    ERROR = 13,
}

export interface Packet {
    type: PacketType;
    seq: string;
    payload: any;
}

export interface MessagePayload {
    conversationId: string;
    receiverId: number;
    content: string;
    msgType: number;
}

export interface PushPayload {
    messageId: number;
    conversationId: string;
    senderId: number;
    senderName: string;
    senderAvatar: string;
    content: string;
    msgType: number;
    createdAt: string;
}

type MessageCallback = (payload: PushPayload) => void;
type AckCallback = (seq: string, messageId: number) => void;
type ConnectionCallback = (status: 'connected' | 'disconnected' | 'connecting') => void;

class WebSocketService {
    private static instance: WebSocketService;
    private ws: any | null = null;
    private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
    private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private isConnecting = false;

    // 回调
    private onMessageReceived: MessageCallback | null = null;
    private onAckReceived: AckCallback | null = null;
    private onConnectionChange: ConnectionCallback | null = null;

    // Pending messages (等待 ACK)
    private pendingMessages: Map<string, { resolve: () => void; timer: ReturnType<typeof setTimeout> }> = new Map();

    private constructor() { }

    public static getInstance(): WebSocketService {
        if (!WebSocketService.instance) {
            WebSocketService.instance = new WebSocketService();
        }
        return WebSocketService.instance;
    }

    // 设置回调
    public setCallbacks(
        onMessage: MessageCallback,
        onAck: AckCallback,
        onConnection: ConnectionCallback
    ) {
        this.onMessageReceived = onMessage;
        this.onAckReceived = onAck;
        this.onConnectionChange = onConnection;
    }

    // 连接
    public async connect() {
        if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
            return;
        }

        this.isConnecting = true;
        this.onConnectionChange?.('connecting');

        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) {
                console.log('[WS] 未登录，跳过连接');
                this.isConnecting = false;
                return;
            }

            const baseUrl = getApiBaseUrl();
            // 将 http:// 替换为 ws://
            const wsUrl = baseUrl.replace('http://', 'ws://') + `/api/v1/ws?token=${token}`;
            console.log('[WS] 正在连接:', wsUrl.substring(0, 50) + '...');

            const ws = new WebSocket(wsUrl);
            this.ws = ws;

            ws.onopen = () => {
                console.log('[WS] 连接成功');
                this.isConnecting = false;
                this.reconnectAttempts = 0;
                this.onConnectionChange?.('connected');
                this.startHeartbeat();
            };

            ws.onmessage = (event) => {
                this.handleMessage(event.data);
            };

            ws.onclose = (event) => {
                console.log('[WS] 连接关闭:', event.code, event.reason);
                this.isConnecting = false;
                this.onConnectionChange?.('disconnected');
                this.stopHeartbeat();
                this.scheduleReconnect();
            };

            ws.onerror = (error) => {
                console.log('[WS] 连接错误:', error);
                this.isConnecting = false;
            };
        } catch (error) {
            console.error('[WS] 连接失败:', error);
            this.isConnecting = false;
            this.scheduleReconnect();
        }
    }

    // 断开连接
    public disconnect() {
        this.stopHeartbeat();
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.reconnectAttempts = 0;
    }

    // 发送消息
    public sendMessage(receiverId: number, content: string, msgType = 1): string {
        const seq = this.generateSeq();
        const packet: Packet = {
            type: PacketType.MESSAGE_SEND,
            seq,
            payload: {
                receiverId,
                content,
                msgType,
            },
        };

        this.send(packet);

        // 设置超时重试 (5秒)
        const timer = setTimeout(() => {
            console.log('[WS] 消息发送超时:', seq);
            this.pendingMessages.delete(seq);
            // 可以在这里触发 UI 显示发送失败
        }, 5000);

        this.pendingMessages.set(seq, { resolve: () => { }, timer });

        return seq;
    }

    // 发送已读回执
    public sendReadAck(conversationId: string, lastReadMsgId: number) {
        const packet: Packet = {
            type: PacketType.ACK_READ,
            seq: this.generateSeq(),
            payload: {
                conversationId,
                lastReadMsgId,
            },
        };
        this.send(packet);
    }

    // 私有方法
    private send(packet: Packet) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(packet));
        } else {
            console.log('[WS] 发送失败，连接未建立');
        }
    }

    private handleMessage(data: string) {
        try {
            const packet: Packet = JSON.parse(data);

            switch (packet.type) {
                case PacketType.PONG:
                    // 心跳响应，忽略
                    break;

                case PacketType.MESSAGE_PUSH:
                    // 收到新消息
                    this.onMessageReceived?.(packet.payload as PushPayload);
                    break;

                case PacketType.ACK_SEND:
                    // 发送确认
                    const ack = packet.payload as { seq: string; messageId: number };
                    const pending = this.pendingMessages.get(ack.seq);
                    if (pending) {
                        clearTimeout(pending.timer);
                        this.pendingMessages.delete(ack.seq);
                    }
                    this.onAckReceived?.(ack.seq, ack.messageId);
                    break;

                case PacketType.ERROR:
                    console.log('[WS] 服务端错误:', packet.payload);
                    break;

                default:
                    console.log('[WS] 未知消息类型:', packet.type);
            }
        } catch (error) {
            console.error('[WS] 解析消息失败:', error);
        }
    }

    private startHeartbeat() {
        this.stopHeartbeat();
        this.heartbeatInterval = setInterval(() => {
            const packet: Packet = {
                type: PacketType.PING,
                seq: this.generateSeq(),
                payload: {},
            };
            this.send(packet);
        }, 30000); // 30秒
    }

    private stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    private scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log('[WS] 达到最大重连次数，放弃重连');
            return;
        }

        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000); // 指数退避，最大 30s
        console.log(`[WS] ${delay / 1000}s 后重连 (第 ${this.reconnectAttempts + 1} 次)`);

        this.reconnectTimeout = setTimeout(() => {
            this.reconnectAttempts++;
            this.connect();
        }, delay);
    }

    private generateSeq(): string {
        return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    }

    // 获取连接状态
    public isConnected(): boolean {
        return this.ws?.readyState === WebSocket.OPEN;
    }
}

export default WebSocketService.getInstance();
