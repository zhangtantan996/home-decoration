import React, { useEffect, useRef, useState } from 'react';
import { Card, Spin, Alert } from 'antd';
import { MessageOutlined } from '@ant-design/icons';
import merchantApi from '../../services/merchantApi';
import { TUILogin } from '@tencentcloud/tui-core-lite';
import TUIChatEngine, { TUIConversationService, TUIStore, StoreName } from '@tencentcloud/chat-uikit-engine-lite';
import { UIKitProvider, ConversationList, Chat, ChatHeader, MessageList, MessageInput } from '@tencentcloud/chat-uikit-react';
import '../../styles/tuikit-theme.css';
import TIM from '@tencentcloud/chat';

interface IMCredentials {
    sdkAppId: number;
    userId: string;
    userSig: string;
}

// 单例，避免重复创建
let globalChatInstance: any = null;
let globalLoginPromise: Promise<any> | null = null;

const MerchantChat: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [credentials, setCredentials] = useState<IMCredentials | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    const chatRef = useRef<any>(null);
    const initCalledRef = useRef(false);

    // 获取 IM 凭证
    useEffect(() => {
        const fetchCredentials = async () => {
            try {
                setLoading(true);
                const res = await merchantApi.getIMUserSig() as any;
                if (res.code === 0 && res.data) {
                    setCredentials(res.data);
                } else {
                    setError(res.message || 'IM 服务未配置');
                }
            } catch (err: any) {
                setError('获取 IM 凭证失败: ' + (err.message || '网络错误'));
            } finally {
                setLoading(false);
            }
        };
        fetchCredentials();
    }, []);

    // 初始化 TUIKit
    useEffect(() => {
        if (!credentials || initCalledRef.current) return;
        initCalledRef.current = true;

        const initChat = async () => {
            try {
                if (globalChatInstance) {
                    chatRef.current = globalChatInstance;
                    if (globalLoginPromise) {
                        await globalLoginPromise;
                    }
                    setIsLoggedIn(true);
                    return;
                }

                globalLoginPromise = TUILogin.login({
                    SDKAppID: Number(credentials.sdkAppId),
                    userID: String(credentials.userId),
                    userSig: credentials.userSig,
                });
                await globalLoginPromise;

                const chat = TUILogin.getContext().chat;
                if (!chat) {
                    throw new Error('TUILogin 未返回 chat 实例');
                }

                await TUIChatEngine.login({
                    chat,
                    SDKAppID: Number(credentials.sdkAppId),
                    userID: String(credentials.userId),
                    userSig: credentials.userSig,
                });

                globalChatInstance = chat;
                chatRef.current = chat;

                // 拉取会话并切换首个会话，确保列表/聊天窗有上下文
                try {
                    const res = await chat.getConversationList();
                    const list = res?.data?.conversationList || [];
                    if (list.length > 0 && list[0].conversationID) {
                        TUIStore.update(StoreName.CONV, 'conversationList', list);
                        TUIConversationService.switchConversation(list[0].conversationID);
                    }
                } catch (convErr) {
                    console.warn('[MerchantChat] 拉取会话失败', convErr);
                }

                // 监听消息事件 (使用 TIM SDK 的事件)
                try {
                    chat.on(TIM.EVENT.MESSAGE_RECEIVED, (event: any) => {
                        console.log('[MerchantChat] MESSAGE_RECEIVED', event);
                    });
                    chat.on(TIM.EVENT.SDK_READY, () => {
                        console.log('[MerchantChat] SDK_READY');
                    });
                } catch (eventErr) {
                    console.warn('[MerchantChat] 事件监听失败', eventErr);
                }

                setIsLoggedIn(true);
            } catch (err: any) {
                if (err?.message?.toLowerCase?.().includes('duplicate') || err?.message?.includes?.('already logged')) {
                    setIsLoggedIn(true);
                    return;
                }
                console.error('[MerchantChat] init failed', err);
                setError(`IM 初始化失败: ${err.message || '未知错误'}`);
            }
        };

        initChat();
    }, [credentials]);

    if (loading) {
        return (
            <Card>
                <div style={{ textAlign: 'center', padding: 60 }}>
                    <Spin size="large" />
                    <p style={{ marginTop: 16, color: '#666' }}>正在加载聊天服务...</p>
                </div>
            </Card>
        );
    }

    if (error || !credentials) {
        return (
            <Card title="客户消息">
                <Alert
                    message="聊天服务未就绪"
                    description={
                        <div>
                            <p>{error || 'IM 服务未配置'}</p>
                            <p style={{ marginTop: 8, color: '#666' }}>
                                请确认后台已配置 SDKAppID / SecretKey，并已开通 IM 服务。
                            </p>
                        </div>
                    }
                    type="warning"
                    showIcon
                />
            </Card>
        );
    }

    if (!isLoggedIn || !chatRef.current) {
        return (
            <Card>
                <div style={{ textAlign: 'center', padding: 60 }}>
                    <Spin size="large" />
                    <p style={{ marginTop: 16, color: '#666' }}>正在连接聊天服务...</p>
                </div>
            </Card>
        );
    }

    return (
        <Card
            title={
                <span>
                    <MessageOutlined style={{ marginRight: 8, color: '#D4AF37' }} />
                    客户消息
                </span>
            }
            styles={{ body: { padding: 0 } }}
        >
            <UIKitProvider
                key={`uikit-${credentials.userId}`}
                chat={chatRef.current}
                language="zh-CN"
                theme="light"
            >
                <div
                    style={{
                        display: 'flex',
                        height: 'calc(100vh - 140px)',
                        borderRadius: '0 0 8px 8px',
                        overflow: 'hidden',
                    }}
                >
                    <div
                        style={{
                            width: 300,
                            borderRight: '1px solid #e8e8e8',
                            overflow: 'auto',
                        }}
                    >
                        <ConversationList
                            key={isLoggedIn ? 'logged-in' : 'not-logged-in'}
                            onSelectConversation={(conversation: any) => {
                                console.log('[ConversationList] 会话被点击:', conversation);
                                if (conversation?.conversationID) {
                                    TUIConversationService.switchConversation(conversation.conversationID);
                                }
                            }}
                        />
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
                        {/* Chat 组件需要显式传递子组件 */}
                        <Chat
                            PlaceholderEmpty={
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    height: '100%',
                                    color: '#999',
                                    fontSize: 14
                                }}>
                                    请选择一个会话开始聊天
                                </div>
                            }
                        >
                            <ChatHeader />
                            <MessageList />
                            <MessageInput />
                        </Chat>
                    </div>
                </div>
            </UIKitProvider>
        </Card>
    );
};

export default MerchantChat;
