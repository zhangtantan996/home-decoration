import React, { useEffect, useLayoutEffect, useState, useRef, useCallback } from 'react';
import { Card, Spin, Alert, Layout, List, Avatar, Input, Button, Typography, Empty, Badge, Image, Upload, message, Descriptions } from 'antd';
import { MessageOutlined, SendOutlined, UserOutlined, SyncOutlined, PictureOutlined, PaperClipOutlined, InfoCircleOutlined } from '@ant-design/icons';
import TinodeService from '../../services/TinodeService';
import dayjs from 'dayjs';

const { Sider, Content, Header } = Layout;
const { Text, Title } = Typography;
const { TextArea } = Input;

const formatTime = (ts: string | number) => {
    if (!ts) return '';
    return dayjs(ts).format('HH:mm');
};

const formatDate = (ts: string | number) => {
    if (!ts) return '';
    const date = dayjs(ts);
    const now = dayjs();
    if (date.isSame(now, 'day')) return date.format('HH:mm');
    if (date.isSame(now.subtract(1, 'day'), 'day')) return '昨天';
    return date.format('M月D日');
};

const formatBytes = (bytes?: number): string => {
    if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes <= 0) return '未知大小';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let n = bytes;
    let i = 0;
    while (n >= 1024 && i < units.length - 1) {
        n /= 1024;
        i += 1;
    }
    const fixed = i === 0 ? 0 : n < 10 ? 1 : 0;
    return `${n.toFixed(fixed)} ${units[i]}`;
};

const MerchantChat: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [tinodeToken, setTinodeToken] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [myUserId, setMyUserId] = useState<string | null>(null);
    
    const [conversations, setConversations] = useState<any[]>([]);
    const [activeTopicName, setActiveTopicName] = useState<string | null>(null);
    const [activeTopic, setActiveTopic] = useState<any | null>(null);
    const [messages, setMessages] = useState<any[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const [sending, setSending] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [peerTyping, setPeerTyping] = useState(false);
    const [showInfoPanel, setShowInfoPanel] = useState(false);
    const [notificationsEnabled, setNotificationsEnabled] = useState(false);
    
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<any>(null);
    const prefetchedPreviewTopicsRef = useRef<Set<string>>(new Set());
    const openConversationSeqRef = useRef(0);
    const conversationsRefreshScheduledRef = useRef(false);
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastTypingSentRef = useRef<number>(0);

    // Chat UX: only auto-scroll when user is already near the bottom.
    // When switching conversations, always jump to the latest message.
    const isNearBottomRef = useRef(true);
    const forceScrollToBottomRef = useRef(false);

    const handleMessagesScroll = useCallback(() => {
        const el = messagesContainerRef.current;
        if (!el) return;
        const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
        // Allow a small threshold to account for rounding and padding.
        isNearBottomRef.current = distance <= 120;
    }, []);

    const scrollToBottom = useCallback(() => {
        // Use `auto` (no animation) to avoid a jarring top-to-bottom scroll on conversation switch.
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
    }, []);

    useLayoutEffect(() => {
        // While loading, the message list may not be rendered; don't attempt to scroll.
        if (loadingHistory) return;
        if (!messagesEndRef.current) return;

        const shouldForce = forceScrollToBottomRef.current;
        const shouldAuto = isNearBottomRef.current;
        if (!shouldForce && !shouldAuto) return;

        scrollToBottom();
        forceScrollToBottomRef.current = false;
        isNearBottomRef.current = true;
    }, [messages, loadingHistory, scrollToBottom]);

    const requestNotificationPermission = useCallback(async () => {
        if (!('Notification' in window)) {
            console.warn('Browser does not support notifications');
            return false;
        }

        if (Notification.permission === 'granted') {
            setNotificationsEnabled(true);
            return true;
        }

        if (Notification.permission !== 'denied') {
            const permission = await Notification.requestPermission();
            const granted = permission === 'granted';
            setNotificationsEnabled(granted);
            return granted;
        }

        return false;
    }, []);

    const showNotification = useCallback((title: string, body: string, topicName: string) => {
        if (!notificationsEnabled || document.hasFocus()) {
            return;
        }

        try {
            const notification = new Notification(title, {
                body,
                icon: '/favicon.ico',
                tag: topicName,
                requireInteraction: false,
            });

            notification.onclick = () => {
                window.focus();
                notification.close();
            };

            setTimeout(() => notification.close(), 5000);
        } catch (e) {
            console.error('Failed to show notification:', e);
        }
    }, [notificationsEnabled]);

    useEffect(() => {
        try {
            const token = localStorage.getItem('merchant_tinode_token');
            if (!token) {
                setError('缺少 Tinode 登录凭证，请重新登录商家端。');
                setLoading(false);
                return;
            }
            setTinodeToken(token);
        } catch (e) {
            setError('读取登录凭证失败，请刷新页面重试。');
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        // Cleanup topic handlers on unmount.
        return () => {
            if (activeTopic) {
                activeTopic.onData = undefined;
            }
        };
    }, [activeTopic]);

    useEffect(() => {
        if (!tinodeToken) return;

        const initTinode = async () => {
            try {
                const ok = await TinodeService.init(tinodeToken);
                if (!ok) {
                    if (TinodeService.isConnected()) {
                         setIsLoggedIn(true);
                    } else {
                        throw new Error('Tinode init failed');
                    }
                } else {
                    setIsLoggedIn(true);
                }
                setIsConnected(TinodeService.isConnected());
                setMyUserId(TinodeService.getCurrentUserID());
                // Ensure list is loaded after `me` subscription is ready.
                await loadConversations();
            } catch (err: any) {
                console.error('[MerchantChat] Tinode init failed', err);
                setError(`Tinode 初始化失败: ${err.message || '未知错误'}`);
            } finally {
                setLoading(false);
            }
        };

        initTinode();
        
        requestNotificationPermission();
        
        const onConnected = () => {
            setIsConnected(true);
            setMyUserId(TinodeService.getCurrentUserID());
        };
        const onDisconnected = () => {
            setIsConnected(false);
            setIsLoggedIn(false);
            setMyUserId(null);
        };

        TinodeService.on('connected', onConnected);
        TinodeService.on('disconnected', onDisconnected);
        
        return () => {
            TinodeService.removeListener('connected', onConnected);
            TinodeService.removeListener('disconnected', onDisconnected);
            TinodeService.disconnect();
        };
    }, [tinodeToken]);

    const loadConversations = useCallback(async (opts?: { showSpinner?: boolean }) => {
        const showSpinner = opts?.showSpinner === true;
        if (showSpinner) setRefreshing(true);
        try {
            const list = await TinodeService.getConversationList();
            setConversations([...list]);

            // After a page reload, Tinode has subs but lacks per-topic message cache.
            // Prefetch latest message for a small batch so the preview can show real text.
            const candidates = list
                .filter((t: any) => typeof t?.name === 'string')
                .filter((t: any) => {
                    const name = t.name as string;
                    if (prefetchedPreviewTopicsRef.current.has(name)) return false;
                    const latest = typeof t?.latestMessage === 'function' ? t.latestMessage() : undefined;
                    return !latest?.content;
                })
                .slice(0, 20);

            if (candidates.length > 0) {
                candidates.forEach((t: any) => {
                    if (typeof t?.name === 'string') {
                        prefetchedPreviewTopicsRef.current.add(t.name);
                    }
                });
                await Promise.allSettled(candidates.map((t: any) => TinodeService.prefetchLastMessage(t.name)));
                const updated = await TinodeService.getConversationList();
                setConversations([...updated]);
            }
        } catch (e) {
            console.error('Failed to load conversations', e);
        } finally {
            if (showSpinner) setRefreshing(false);
        }
    }, []);

    const scheduleLoadConversations = useCallback(() => {
        if (conversationsRefreshScheduledRef.current) return;
        conversationsRefreshScheduledRef.current = true;
        // Coalesce bursts of events (pres/contact-update/topic data) into a single refresh.
        setTimeout(() => {
            conversationsRefreshScheduledRef.current = false;
            void loadConversations();
        }, 0);
    }, [loadConversations]);

    useEffect(() => {
        if (isLoggedIn) {
            void loadConversations();
        }
    }, [isLoggedIn, loadConversations]);

    useEffect(() => {
        // Use `me.onPres` (emitted by TinodeService as `pres`) to refresh conversation list.
        const handlePres = (pres: any) => {
            if (pres?.what === 'msg' && typeof pres?.src === 'string') {
                // Prefetch last message for preview.
                TinodeService.prefetchLastMessage(pres.src).finally(scheduleLoadConversations);
                return;
            }
            if (pres?.what === 'read' || pres?.what === 'recv') {
                scheduleLoadConversations();
            }
        };

        // Tinode SDK reliably fires `me.onContactUpdate` when subs (unread/touched/preview) change.
        // This is critical for real-time conversation list updates without manual refresh.
        const handleContactUpdate = (payload: any) => {
            const what = payload?.what;
            const topicName = payload?.cont?.name;
            if (what === 'msg' && typeof topicName === 'string') {
                TinodeService.prefetchLastMessage(topicName).finally(scheduleLoadConversations);
                return;
            }
            scheduleLoadConversations();
        };

        TinodeService.on('pres', handlePres);
        TinodeService.on('contact-update', handleContactUpdate);
        return () => {
            TinodeService.removeListener('pres', handlePres);
            TinodeService.removeListener('contact-update', handleContactUpdate);
        };
    }, [scheduleLoadConversations]);

    useEffect(() => {
        // After a full page reload, `me.subscribe({get:{sub}})` delivers the subscription list
        // asynchronously; refresh the UI when Tinode finishes processing it.
        const handleSubsUpdated = () => {
            // Next tick: ensure SDK caches are updated before reading `me.contacts`.
            scheduleLoadConversations();
        };

        TinodeService.on('subs-updated', handleSubsUpdated);
        return () => {
            TinodeService.removeListener('subs-updated', handleSubsUpdated);
        };
    }, [scheduleLoadConversations]);

    const handleSelectConversation = async (topicName: string) => {
        if (topicName === activeTopicName) return;

        const prevTopic = activeTopic;
        const prevTopicName = activeTopicName;
        const prevMessages = messages;
        const requestId = ++openConversationSeqRef.current;

        // Conversation switch should always land on the latest message.
        forceScrollToBottomRef.current = true;
        isNearBottomRef.current = true;

        setActiveTopicName(topicName);
        setLoadingHistory(true);
        
        try {
            const topic = await TinodeService.openConversation(topicName);

            if (requestId !== openConversationSeqRef.current) {
                topic.leaveDelayed?.(false, 500);
                return;
            }

            if (prevTopic) {
                prevTopic.onData = undefined;
                prevTopic.onInfo = undefined;
                prevTopic.onPres = undefined;
            }

            // Real-time updates: use topic-level onData which is called after Tinode routes data into caches.
            topic.onData = (data: any) => {
                if (typeof data?.seq !== 'number') return;
                
                const isFromPeer = data.from && myUserId && data.from !== myUserId;
                if (isFromPeer) {
                    const peerInfo = getPeerInfo(topic);
                    const contentText = typeof data.content === 'string' 
                        ? data.content 
                        : data.content?.txt || '新消息';
                    showNotification(peerInfo.fn, contentText, topic.name);
                }
                
                setMessages(TinodeService.listMessages(topic));
                // Mark as read while the chat is open.
                topic.noteRead?.();
                scheduleLoadConversations();
            };

            topic.onInfo = (info: any) => {
                console.log('[MerchantChat] Info event:', info);
                if (info?.what === 'kp') {
                    setPeerTyping(true);
                    if (typingTimeoutRef.current) {
                        clearTimeout(typingTimeoutRef.current);
                    }
                    typingTimeoutRef.current = setTimeout(() => {
                        setPeerTyping(false);
                    }, 3000);
                }
            };

            topic.onPres = (pres: any) => {
                console.log('[MerchantChat] Presence event:', pres);
                if (pres?.what === 'on' || pres?.what === 'off') {
                    setActiveTopic({ ...topic });
                }
            };

            setActiveTopic(topic);
            const msgs = TinodeService.listMessages(topic);
            setMessages(msgs);

            // Mark existing history as read right after opening.
            topic.noteRead?.();
        } catch (e) {
            console.error('Failed to open conversation', e);

            if (requestId === openConversationSeqRef.current) {
                forceScrollToBottomRef.current = false;
                setActiveTopicName(prevTopicName);
                setActiveTopic(prevTopic);
                setMessages(prevMessages);
            }
        } finally {
            if (requestId === openConversationSeqRef.current) {
                setLoadingHistory(false);
            }
        }
    };

    const handleTyping = () => {
        if (!activeTopic || !activeTopic.isSubscribed?.()) return;

        const now = Date.now();
        if (now - lastTypingSentRef.current > 3000) {
            activeTopic.noteKeyPress?.();
            lastTypingSentRef.current = now;
        }
    };

    const handleSend = async () => {
        if (!inputValue.trim() || !activeTopicName) return;
        
        setSending(true);
        try {
            await TinodeService.sendText(activeTopicName, inputValue);
            setInputValue('');
            
             if (activeTopic) {
                  const msgs = TinodeService.listMessages(activeTopic);
                  setMessages(msgs);
             }

            scheduleLoadConversations();
            
            setTimeout(() => {
                inputRef.current?.focus();
            }, 0);
        } catch (e) {
            console.error('Failed to send message', e);
        } finally {
            setSending(false);
        }
    };

    const [uploading, setUploading] = useState(false);
    const [uploadingFile, setUploadingFile] = useState(false);

    const handleImageUpload = async (file: File) => {
        if (!file.type.startsWith('image/')) {
            message.error('请选择图片文件');
            return false;
        }
        
        if (file.size > 5 * 1024 * 1024) {
            message.error('图片大小不能超过 5MB');
            return false;
        }
        
        if (!activeTopicName) {
            message.error('请先选择一个会话');
            return false;
        }
        
        setUploading(true);
        try {
            await TinodeService.sendImageMessage(activeTopicName, file);
            message.success('图片已发送');
            
            if (activeTopic) {
                const msgs = TinodeService.listMessages(activeTopic);
                setMessages(msgs);
            }
            
            scheduleLoadConversations();
        } catch (error) {
            console.error('Image send failed:', error);
            message.error('图片发送失败，请重试');
        } finally {
            setUploading(false);
        }
        
        return false;
    };

    const handleFileUpload = async (file: File) => {
        if (file.type && file.type.startsWith('image/')) {
            message.error('图片请使用图片按钮上传');
            return false;
        }

        // Keep consistent with backend merchant upload limit (20MB).
        if (file.size > 20 * 1024 * 1024) {
            message.error('文件大小不能超过 20MB');
            return false;
        }

        if (!activeTopicName) {
            message.error('请先选择一个会话');
            return false;
        }

        setUploadingFile(true);
        try {
            await TinodeService.sendFileMessage(activeTopicName, file);
            message.success('文件已发送');

            if (activeTopic) {
                const msgs = TinodeService.listMessages(activeTopic);
                setMessages(msgs);
            }

            scheduleLoadConversations();
        } catch (error) {
            console.error('File send failed:', error);
            message.error('文件发送失败，请重试');
        } finally {
            setUploadingFile(false);
        }

        return false;
    };

    const getPeerInfo = (topic: any) => {
        // `p2pPeerDesc()` may return undefined (e.g. non-P2P topics or missing sub cache).
        const peerDesc = typeof topic?.p2pPeerDesc === 'function' ? topic.p2pPeerDesc() : undefined;
        const pub = peerDesc?.public || topic?.public || {};
        const fn = pub?.fn || topic?.name || '未知用户';
        const photo = pub?.photo;
        return { fn, photo };
    };

    const renderAvatar = (photo: any, name: string) => {
        if (photo?.data) {
             return <Avatar src={`data:${photo.type || 'image/jpeg'};base64,${photo.data}`} />;
        }
        return <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#D4AF37' }} >{name.charAt(0).toUpperCase()}</Avatar>;
    };

    const renderContent = (content: any) => {
        if (typeof content === 'string') return content;
        if (typeof content === 'object' && content !== null) {
            if (Array.isArray(content.ent)) {
                const apiUrl = typeof import.meta.env.VITE_API_URL === 'string' ? import.meta.env.VITE_API_URL : '';
                const backendOrigin = apiUrl
                    ? apiUrl.replace(/\/api\/v1\/?$/, '').replace(/\/$/, '')
                    : (window.location.hostname === 'localhost' ? 'http://localhost:8080' : '');

                const imEnt = content.ent.find((e: any) => e?.tp === 'IM');
                const data = imEnt?.data;
                const raw =
                    typeof data?.ref === 'string' && data.ref.trim()
                        ? data.ref
                        : (typeof data?.val === 'string' ? data.val : '');

                const rawValue = typeof raw === 'string' ? raw.trim() : '';
                if (rawValue) {
                    const mime = typeof data?.mime === 'string' && data.mime.trim() ? data.mime : 'image/jpeg';

                    const src = (() => {
                        if (rawValue.startsWith('data:')) return rawValue;
                        if (rawValue.startsWith('http://') || rawValue.startsWith('https://')) return rawValue;
                        if (rawValue.startsWith('/')) return backendOrigin ? `${backendOrigin}${rawValue}` : rawValue;
                        return `data:${mime};base64,${rawValue}`;
                    })();

                    const fallback =
                        'data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%22200%22%20height=%22150%22%3E%3Crect%20width=%22100%25%22%20height=%22100%25%22%20fill=%22%23f5f5f5%22/%3E%3Ctext%20x=%2250%25%22%20y=%2250%25%22%20dominant-baseline=%22middle%22%20text-anchor=%22middle%22%20fill=%22%23999%22%20font-family=%22Arial%22%20font-size=%2214%22%3EImage%20failed%3C/text%3E%3C/svg%3E';

                    return (
                        <Image
                            src={src}
                            alt="图片"
                            fallback={fallback}
                            style={{
                                maxWidth: 200,
                                maxHeight: 200,
                                objectFit: 'cover',
                                borderRadius: 4,
                            }}
                        />
                    );
                }

                const exEnt = content.ent.find((e: any) => e?.tp === 'EX' && e?.data);
                if (exEnt) {
                    const fileData = exEnt.data;
                    const rawUrl = typeof fileData?.val === 'string' && fileData.val.trim()
                        ? fileData.val.trim()
                        : (typeof fileData?.ref === 'string' ? fileData.ref.trim() : '');

                    const href = (() => {
                        if (!rawUrl) return '';
                        if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) return rawUrl;
                        if (rawUrl.startsWith('/')) return backendOrigin ? `${backendOrigin}${rawUrl}` : rawUrl;
                        return rawUrl;
                    })();

                    const fileName =
                        (typeof fileData?.name === 'string' && fileData.name.trim())
                            ? fileData.name.trim()
                            : (typeof content?.txt === 'string' && content.txt.trim() ? content.txt.trim() : '文件');

                    const rawSize = fileData?.size;
                    const fileSize = typeof rawSize === 'number' && Number.isFinite(rawSize) && rawSize > 0 ? Math.floor(rawSize) : undefined;
                    const sizeText = formatBytes(fileSize);

                    return (
                        <div
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                                if (href) window.open(href, '_blank', 'noopener,noreferrer');
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && href) window.open(href, '_blank', 'noopener,noreferrer');
                            }}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                padding: '10px 12px',
                                border: '1px solid #e8e8e8',
                                borderRadius: 6,
                                background: '#fff',
                                cursor: href ? 'pointer' : 'default',
                                maxWidth: 320,
                            }}
                        >
                            <div style={{
                                width: 36,
                                height: 36,
                                borderRadius: 8,
                                background: '#f5f5f5',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                            }}>
                                <PaperClipOutlined style={{ color: '#999', fontSize: 18 }} />
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{
                                    fontWeight: 500,
                                    color: '#333',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}>
                                    {fileName}
                                </div>
                                <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>
                                    {sizeText}
                                </div>
                            </div>
                        </div>
                    );
                }
            }

            return content.txt || JSON.stringify(content);
        }
        return '【不支持的消息】';
    };

    const renderPreviewText = (content: any): string => {
        if (typeof content === 'string') return content;
        if (content && typeof content === 'object') {
            if (typeof content.txt === 'string' && content.txt.trim()) {
                return content.txt;
            }
            // Drafty image payload from mobile.
            if (Array.isArray(content.ent) && content.ent.some((e: any) => e?.tp === 'IM')) {
                return '【图片】';
            }
            if (Array.isArray(content.ent) && content.ent.some((e: any) => e?.tp === 'EX')) {
                return '【文件】';
            }
        }
        return '';
    };

    const getConversationPreview = (topic: any): string => {
        const latest = typeof topic?.latestMessage === 'function' ? topic.latestMessage() : undefined;
        const text = latest?.content ? renderPreviewText(latest.content) : '';
        if (!text.trim()) return '暂无消息';

        // Outgoing messages may have `from` unset (SDK routes publish ack locally).
        const from = latest?.from;
        const isMe = !from || (myUserId && from === myUserId);
        return isMe ? `我：${text}` : text;
    };

    if (loading) {
        return (
            <Card>
                <div style={{ textAlign: 'center', padding: 60 }}>
                    <Spin size="large" />
                    <p style={{ marginTop: 16, color: '#666' }}>正在连接聊天服务...</p>
                </div>
            </Card>
        );
    }

    if (error) {
         return (
            <Card title="客户消息">
                <Alert
                    message="聊天服务不可用"
                    description={error}
                    type="error"
                    showIcon
                />
            </Card>
        );
    }

    return (
        <Card
            title={
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <MessageOutlined style={{ marginRight: 8, color: '#D4AF37' }} />
                    <span>客户消息</span>
                    {isConnected ? (
                        <Badge status="success" text="已连接" style={{ marginLeft: 16 }} />
                    ) : (
                        <Badge status="error" text="未连接" style={{ marginLeft: 16 }} />
                    )}
                </div>
            }
            styles={{ body: { padding: 0, height: 'calc(100vh - 200px)', minHeight: '500px' } }}
            bordered={false}
            style={{ overflow: 'hidden' }}
        >
            <Layout style={{ height: '100%', background: '#fff' }}>
                <Sider width={300} style={{ background: '#f5f5f5', borderRight: '1px solid #e8e8e8', overflowY: 'auto' }}>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid #e8e8e8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                         <Text strong>会话列表</Text>
                         <Button
                             type="text"
                             icon={<SyncOutlined spin={refreshing} />}
                             onClick={() => void loadConversations({ showSpinner: true })}
                             size="small"
                         />
                    </div>
                    <List
                        itemLayout="horizontal"
                        dataSource={conversations}
                        locale={{ emptyText: '暂无会话' }}
                        renderItem={(item) => {
                            const { fn, photo } = getPeerInfo(item);
                            const unread = typeof item?.unread === 'number' ? item.unread : 0;
                            const preview = getConversationPreview(item);
                            const isActive = item.name === activeTopicName;
                            
                            return (
                                <List.Item 
                                    onClick={() => handleSelectConversation(item.name)}
                                    style={{ 
                                        padding: '12px 16px', 
                                        cursor: 'pointer',
                                        background: isActive ? '#fff' : 'transparent',
                                        borderLeft: isActive ? '4px solid #D4AF37' : '4px solid transparent',
                                        transition: 'all 0.2s'
                                    }}
                                    className="conversation-item"
                                >
                                    <List.Item.Meta
                                        avatar={
                                            <Badge count={unread} size="small" offset={[-4, 4]}>
                                                {renderAvatar(photo, fn)}
                                            </Badge>
                                        }
                                        title={<div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <Text strong ellipsis style={{ maxWidth: 140 }}>{fn}</Text>
                                            {item.touched && <Text type="secondary" style={{ fontSize: 11 }}>{formatDate(item.touched)}</Text>}
                                        </div>}
                                        description={<Text type="secondary" ellipsis>{preview}</Text>}
                                    />
                                </List.Item>
                            );
                        }}
                    />
                </Sider>
                <Content style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                    {activeTopicName ? (
                        <>
                            <Header style={{ background: '#fff', borderBottom: '1px solid #e8e8e8', padding: '0 20px', height: 60, display: 'flex', alignItems: 'center' }}>
                                {activeTopic && (
                                    <>
                                        {renderAvatar(getPeerInfo(activeTopic).photo, getPeerInfo(activeTopic).fn)}
                                        <div style={{ marginLeft: 12 }}>
                                            <Title level={5} style={{ margin: 0 }}>{getPeerInfo(activeTopic).fn}</Title>
                                            <Text type="secondary" style={{ fontSize: 12 }}>
                                                {peerTyping ? (
                                                    <span style={{ fontStyle: 'italic', color: '#71717A' }}>正在输入...</span>
                                                ) : activeTopic.online ? (
                                                    <Badge status="success" text="在线" />
                                                ) : (
                                                    '离线'
                                                )}
                                            </Text>
                                        </div>
                                        <Button
                                            type="text"
                                            icon={<InfoCircleOutlined />}
                                            onClick={() => setShowInfoPanel(!showInfoPanel)}
                                            style={{ marginLeft: 'auto' }}
                                        />
                                    </>
                                )}
                            </Header>
                            
                            <div
                                ref={messagesContainerRef}
                                onScroll={handleMessagesScroll}
                                style={{ flex: 1, padding: 20, overflowY: 'auto', background: '#fafafa' }}
                            >
                                {loadingHistory ? (
                                    <div style={{ textAlign: 'center', marginTop: 100 }}>
                                        <Spin />
                                    </div>
                                ) : messages.length === 0 ? (
                                    <div style={{ textAlign: 'center', marginTop: 100 }}>
                                        <Text type="secondary">暂无消息，打个招呼吧</Text>
                                    </div>
                                ) : (
                                    <Image.PreviewGroup>
                                        {messages.map((msg, idx) => {
                                            // Outgoing messages may have `from` unset (SDK routes publish ack locally).
                                            const isMe = !msg.from || (myUserId && msg.from === myUserId);
                                            const showAvatar = idx === 0 || messages[idx - 1].from !== msg.from;

                                            return (
                                                <div key={msg.seq || idx} style={{
                                                    display: 'flex',
                                                    flexDirection: isMe ? 'row-reverse' : 'row',
                                                    marginBottom: 16
                                                }}>
                                                    <div style={{ flexShrink: 0, marginLeft: isMe ? 12 : 0, marginRight: isMe ? 0 : 12, width: 32 }}>
                                                        {showAvatar && (isMe ?
                                                            <Avatar style={{ backgroundColor: '#D4AF37' }}>M</Avatar> :
                                                            renderAvatar(getPeerInfo(activeTopic).photo, getPeerInfo(activeTopic).fn)
                                                        )}
                                                    </div>

                                                    <div style={{ maxWidth: '60%' }}>
                                                        <div style={{
                                                            background: isMe ? '#FEF3C7' : '#fff',
                                                            border: isMe ? '1px solid #FCD34D' : '1px solid #e8e8e8',
                                                            borderRadius: isMe ? '8px 0 8px 8px' : '0 8px 8px 8px',
                                                            padding: '10px 14px',
                                                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                                            color: '#333'
                                                        }}>
                                                            {renderContent(msg.content)}
                                                        </div>
                                                        <div style={{
                                                            textAlign: isMe ? 'right' : 'left',
                                                            marginTop: 4,
                                                            fontSize: 10,
                                                            color: '#999'
                                                        }}>
                                                            {formatTime(msg.ts)}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </Image.PreviewGroup>
                                )}
                                <div ref={messagesEndRef} />
                            </div>
                            
                                <div style={{ padding: 20, background: '#fff', borderTop: '1px solid #e8e8e8' }}>
                                {/* Quick Replies */}
                                {activeTopicName && (
                                    <div style={{ marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                        {[
                                            '您好，有什么可以帮您？',
                                            '我们会尽快为您处理',
                                            '感谢您的咨询',
                                            '请稍等，我查询一下',
                                            '好的，明白了'
                                        ].map((reply, index) => (
                                            <Button
                                                key={index}
                                                size="small"
                                                onClick={() => {
                                                    setInputValue(reply);
                                                    inputRef.current?.focus();
                                                }}
                                                disabled={sending}
                                                style={{ fontSize: 12 }}
                                            >
                                                {reply}
                                            </Button>
                                        ))}
                                    </div>
                                )}
                                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                                    <Upload
                                        accept="image/*"
                                        showUploadList={false}
                                        beforeUpload={handleImageUpload}
                                    >
                                        <Button 
                                            icon={<PictureOutlined />} 
                                            loading={uploading}
                                            disabled={sending || !activeTopicName}
                                        >
                                            图片
                                        </Button>
                                    </Upload>
                                    <Upload
                                        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.txt"
                                        showUploadList={false}
                                        beforeUpload={handleFileUpload}
                                    >
                                        <Button
                                            icon={<PaperClipOutlined />}
                                            loading={uploadingFile}
                                            disabled={sending || !activeTopicName}
                                        >
                                            文件
                                        </Button>
                                    </Upload>
                                    <TextArea
                                        ref={inputRef}
                                        value={inputValue}
                                        onChange={(e) => {
                                            setInputValue(e.target.value);
                                            if (e.target.value.length > 0) {
                                                handleTyping();
                                            }
                                        }}
                                        placeholder="输入消息..."
                                        autoSize={{ minRows: 1, maxRows: 4 }}
                                        onPressEnter={(e) => {
                                            if (!e.shiftKey) {
                                                e.preventDefault();
                                                handleSend();
                                            }
                                        }}
                                        disabled={sending}
                                        style={{ flex: 1 }}
                                    />
                                    <Button 
                                        type="primary" 
                                        icon={<SendOutlined />} 
                                        onClick={handleSend}
                                        loading={sending}
                                        style={{ 
                                            background: '#D4AF37', 
                                            borderColor: '#D4AF37',
                                            height: 'auto'
                                        }}
                                    >
                                        发送
                                    </Button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', background: '#f5f5f5' }}>
                            <Empty description="请选择一个会话开始聊天" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                        </div>
                    )}
                </Content>
                {showInfoPanel && activeTopic && (
                    <Sider width={280} style={{ background: '#fff', borderLeft: '1px solid #e8e8e8', overflowY: 'auto' }}>
                        <div style={{ padding: 20 }}>
                            <div style={{ textAlign: 'center', marginBottom: 20 }}>
                                {renderAvatar(getPeerInfo(activeTopic).photo, getPeerInfo(activeTopic).fn)}
                                <Title level={5} style={{ marginTop: 12, marginBottom: 4 }}>{getPeerInfo(activeTopic).fn}</Title>
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                    {activeTopic.online ? <Badge status="success" text="在线" /> : <Badge status="default" text="离线" />}
                                </Text>
                            </div>
                            <Descriptions column={1} size="small" bordered>
                                <Descriptions.Item label="用户ID">
                                    <Text copyable style={{ fontSize: 12 }}>{activeTopic.name || '未知'}</Text>
                                </Descriptions.Item>
                                <Descriptions.Item label="会话类型">
                                    {activeTopic.isP2PType?.() ? '单聊' : '群聊'}
                                </Descriptions.Item>
                                <Descriptions.Item label="未读消息">
                                    {typeof activeTopic.unread === 'number' ? activeTopic.unread : 0}
                                </Descriptions.Item>
                                <Descriptions.Item label="最后活跃">
                                    {activeTopic.touched ? formatDate(activeTopic.touched) : '未知'}
                                </Descriptions.Item>
                            </Descriptions>
                        </div>
                    </Sider>
                )}
            </Layout>
        </Card>
    );
};

export default MerchantChat;
