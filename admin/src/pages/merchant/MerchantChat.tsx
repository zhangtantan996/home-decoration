import React, { useEffect, useRef, useState } from 'react';
import { Card, Spin, Alert, message as antdMessage } from 'antd';
import { MessageOutlined, CameraOutlined, PictureOutlined, FileOutlined, PlusOutlined } from '@ant-design/icons';
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
    const [lastDebugMsg, setLastDebugMsg] = useState<string>('');
    const [currentConversationID, setCurrentConversationID] = useState<string>('');
    const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);

    const chatRef = useRef<any>(null);
    const initCalledRef = useRef(false);
    const unsubscribeRef = useRef<any>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const galleryInputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 点击外部关闭附件菜单
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (showAttachmentMenu) {
                // 检查点击是否在附件菜单外部
                const target = event.target as HTMLElement;
                if (!target.closest('[data-attachment-menu]')) {
                    setShowAttachmentMenu(false);
                }
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showAttachmentMenu]);

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
                        setCurrentConversationID(list[0].conversationID);
                    }
                } catch (convErr) {
                    console.warn('[MerchantChat] 拉取会话失败', convErr);
                }

                // 订阅 TUIStore 会话切换事件
                const unsubscribe = TUIStore.watch(StoreName.CONV, {
                    currentConversationID: (id: string) => {
                        console.log('[MerchantChat] 会话切换:', id);
                        setCurrentConversationID(id);
                    }
                });
                unsubscribeRef.current = unsubscribe;

                // 监听消息事件 (使用 TIM SDK 的事件)
                try {
                    chat.on(TIM.EVENT.MESSAGE_RECEIVED, (event: any) => {
                        const msgBody = event.data?.[0];
                        const text = msgBody?.payload?.text || '[非文本]';
                        setLastDebugMsg(`${new Date().toLocaleTimeString()} From: ${msgBody?.from} - ${text}`);
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

        // 清理函数
        return () => {
            if (unsubscribeRef.current) {
                console.log('[MerchantChat] 取消订阅 TUIStore');
                unsubscribeRef.current();
                unsubscribeRef.current = null;
            }
        };
    }, [credentials]);

    // 手动处理会话切换
    const handleConversationChange = (conversationID: string) => {
        console.log('[MerchantChat] 手动切换会话:', conversationID);
        try {
            TUIConversationService.switchConversation(conversationID);
            setCurrentConversationID(conversationID);
        } catch (err) {
            console.error('[MerchantChat] 切换会话失败:', err);
        }
    };

    // 通用文件上传并发送
    const uploadAndSendFile = async (file: File, msgType: string) => {
        const chat = chatRef.current;
        if (!chat || !currentConversationID) {
            antdMessage.error('请先选择一个会话');
            return;
        }

        try {
            console.log('[MerchantChat] Uploading file...', file.name);

            // 从 conversationID 提取对方 userID
            // conversationID 格式: C2C{userID}
            const targetUserID = currentConversationID.replace('C2C', '');

            let message;
            if (msgType === TIM.TYPES.MSG_IMAGE) {
                // 图片消息
                message = chat.createImageMessage({
                    to: targetUserID,
                    conversationType: TIM.TYPES.CONV_C2C,
                    payload: {
                        file: file
                    },
                    onProgress: (percent: number) => {
                        console.log('Upload progress:', percent);
                    }
                });
            } else if (msgType === TIM.TYPES.MSG_FILE) {
                // 文件消息
                message = chat.createFileMessage({
                    to: targetUserID,
                    conversationType: TIM.TYPES.CONV_C2C,
                    payload: {
                        file: file
                    },
                    onProgress: (percent: number) => {
                        console.log('Upload progress:', percent);
                    }
                });
            } else {
                return;
            }

            // 发送消息
            const res = await chat.sendMessage(message);
            if (res.code === 0) {
                console.log('✅ [MerchantChat] File sent successfully:', res);
                antdMessage.success('发送成功');
            } else {
                throw new Error(res.message || '发送失败');
            }
        } catch (error: any) {
            console.error('❌ [MerchantChat] Send file failed:', error);
            antdMessage.error('文件发送失败: ' + (error.message || '未知错误'));
        }
    };

    // 处理拍照 (Web 环境下使用摄像头)
    const handleCamera = () => {
        setShowAttachmentMenu(false);
        if (cameraInputRef.current) {
            cameraInputRef.current.click();
        }
    };

    // 处理相册选择
    const handleGallery = () => {
        setShowAttachmentMenu(false);
        if (galleryInputRef.current) {
            galleryInputRef.current.click();
        }
    };

    // 处理文件选择
    const handleFile = () => {
        setShowAttachmentMenu(false);
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    // 处理文件输入改变
    const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>, type: 'camera' | 'gallery' | 'file') => {
        const file = event.target.files?.[0];
        if (!file) return;

        // 根据类型判断是图片还是文件
        if (type === 'camera' || type === 'gallery') {
            uploadAndSendFile(file, TIM.TYPES.MSG_IMAGE);
        } else {
            // 判断是否为图片文件
            if (file.type.startsWith('image/')) {
                uploadAndSendFile(file, TIM.TYPES.MSG_IMAGE);
            } else {
                uploadAndSendFile(file, TIM.TYPES.MSG_FILE);
            }
        }

        // 清空 input，允许重复选择同一文件
        event.target.value = '';
    };

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
                    {currentConversationID && (
                        <span style={{ marginLeft: 20, fontSize: 12, color: '#1890ff', fontWeight: 'normal' }}>
                            当前会话: {currentConversationID}
                        </span>
                    )}
                    {lastDebugMsg && (
                        <span style={{ marginLeft: 20, fontSize: 12, color: '#52c41a', fontWeight: 'normal' }}>
                            最新 {lastDebugMsg}
                        </span>
                    )}
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
                        <div style={{ padding: '8px', borderBottom: '1px solid #eee', display: 'flex', gap: 8 }}>
                            <button
                                onClick={async () => {
                                    if (!chatRef.current) return;
                                    try {
                                        const res = await chatRef.current.getConversationList();
                                        console.log('Conversation list:', res.data.conversationList);
                                        alert(
                                            `Found ${res.data.conversationList.length} conversations\n${res.data.conversationList
                                                .map((c: any) => c.conversationID)
                                                .join('\n')}`,
                                        );
                                    } catch (e: any) {
                                        alert('Failed to fetch: ' + e.message);
                                    }
                                }}
                                style={{ padding: '4px 8px', fontSize: 12, cursor: 'pointer' }}
                            >
                                Check conversations
                            </button>
                            <button
                                onClick={() => {
                                    window.location.reload();
                                }}
                                style={{ padding: '4px 8px', fontSize: 12, cursor: 'pointer' }}
                            >
                                Refresh page
                            </button>
                        </div>
                        <ConversationList
                            key={isLoggedIn ? 'logged-in' : 'not-logged-in'}
                            onSelectConversation={(conversation: any) => {
                                console.log('[ConversationList] 会话被点击:', conversation);
                                if (conversation?.conversationID) {
                                    handleConversationChange(conversation.conversationID);
                                }
                            }}
                        />
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
                        {/* 调试信息覆盖层 */}
                        <div style={{
                            position: 'absolute',
                            top: 0,
                            right: 0,
                            padding: '8px 12px',
                            background: 'rgba(0,0,0,0.7)',
                            color: 'white',
                            fontSize: 12,
                            zIndex: 1000,
                            borderRadius: '0 0 0 4px'
                        }}>
                            {currentConversationID ? `会话: ${currentConversationID}` : '未选择会话'}
                        </div>

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
                            <div style={{ position: 'relative' }}>
                                {/* 附件按钮 */}
                                <div style={{
                                    position: 'absolute',
                                    bottom: '16px',
                                    left: '16px',
                                    zIndex: 10,
                                }} data-attachment-menu>
                                    <button
                                        onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                                        style={{
                                            width: '32px',
                                            height: '32px',
                                            borderRadius: '50%',
                                            border: '1px solid #d9d9d9',
                                            background: '#fff',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            transition: 'all 0.3s',
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.borderColor = '#D4AF37';
                                            e.currentTarget.style.color = '#D4AF37';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.borderColor = '#d9d9d9';
                                            e.currentTarget.style.color = 'inherit';
                                        }}
                                    >
                                        <PlusOutlined style={{ fontSize: '16px' }} />
                                    </button>

                                    {/* 附件菜单 */}
                                    {showAttachmentMenu && (
                                        <div style={{
                                            position: 'absolute',
                                            bottom: '40px',
                                            left: '0',
                                            background: '#fff',
                                            borderRadius: '8px',
                                            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                                            padding: '8px',
                                            display: 'flex',
                                            gap: '12px',
                                            minWidth: '200px',
                                        }}>
                                            <div
                                                onClick={handleCamera}
                                                style={{
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    cursor: 'pointer',
                                                    padding: '8px',
                                                    borderRadius: '4px',
                                                    transition: 'background 0.2s',
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.background = '#f5f5f5';
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.background = 'transparent';
                                                }}
                                            >
                                                <div style={{
                                                    width: '48px',
                                                    height: '48px',
                                                    borderRadius: '12px',
                                                    background: '#FEF3C7',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    marginBottom: '4px',
                                                }}>
                                                    <CameraOutlined style={{ fontSize: '24px', color: '#F59E0B' }} />
                                                </div>
                                                <span style={{ fontSize: '12px', color: '#666' }}>拍照</span>
                                            </div>

                                            <div
                                                onClick={handleGallery}
                                                style={{
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    cursor: 'pointer',
                                                    padding: '8px',
                                                    borderRadius: '4px',
                                                    transition: 'background 0.2s',
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.background = '#f5f5f5';
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.background = 'transparent';
                                                }}
                                            >
                                                <div style={{
                                                    width: '48px',
                                                    height: '48px',
                                                    borderRadius: '12px',
                                                    background: '#DBEAFE',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    marginBottom: '4px',
                                                }}>
                                                    <PictureOutlined style={{ fontSize: '24px', color: '#3B82F6' }} />
                                                </div>
                                                <span style={{ fontSize: '12px', color: '#666' }}>相册</span>
                                            </div>

                                            <div
                                                onClick={handleFile}
                                                style={{
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    cursor: 'pointer',
                                                    padding: '8px',
                                                    borderRadius: '4px',
                                                    transition: 'background 0.2s',
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.background = '#f5f5f5';
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.background = 'transparent';
                                                }}
                                            >
                                                <div style={{
                                                    width: '48px',
                                                    height: '48px',
                                                    borderRadius: '12px',
                                                    background: '#F3E8FF',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    marginBottom: '4px',
                                                }}>
                                                    <FileOutlined style={{ fontSize: '24px', color: '#8B5CF6' }} />
                                                </div>
                                                <span style={{ fontSize: '12px', color: '#666' }}>文件</span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <MessageInput />
                            </div>
                        </Chat>

                        {/* 隐藏的文件输入 */}
                        <input
                            ref={cameraInputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            style={{ display: 'none' }}
                            onChange={(e) => handleFileInputChange(e, 'camera')}
                        />
                        <input
                            ref={galleryInputRef}
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={(e) => handleFileInputChange(e, 'gallery')}
                        />
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="*/*"
                            style={{ display: 'none' }}
                            onChange={(e) => handleFileInputChange(e, 'file')}
                        />
                    </div>
                </div>
            </UIKitProvider>
        </Card>
    );
};

export default MerchantChat;
