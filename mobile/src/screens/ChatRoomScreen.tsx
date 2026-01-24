import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Linking,
    Platform,
    useWindowDimensions,
    TextInput,
    KeyboardAvoidingView,
    Image,
    Keyboard,
    Modal,
    ActivityIndicator,
    PermissionsAndroid,
    type NativeScrollEvent,
    type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    ArrowLeft,
    Send,
    MoreVertical,
    Phone,
    Plus,
    Camera,
    Image as ImageIcon,
    File,
    ChevronRight,
    AlertCircle,
    CheckCircle,
    Info,
    X,
} from 'lucide-react-native';
import { useAuthStore } from '../store/authStore';
// import TencentIMService from '../services/TencentIMService';
// import TIM from '@tencentcloud/chat';
import TinodeService from '../services/TinodeService';
import { parseEmojiText } from '../utils/emojiParser';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import * as DocumentPicker from '@react-native-documents/picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiBaseUrl } from '../config';

// 主色调
const PRIMARY_GOLD = '#D4AF37';

// 快捷回复
const QUICK_REPLIES = [
    '好的，收到',
    '什么时候方便？',
    '请发详细报价',
    '我再考虑一下',
];

interface ChatRoomScreenProps {
    route: any;
    navigation: any;
}

// UI 消息类型
interface UIMessage {
    id: string;
    senderId: string;
    content: string;
    image?: {
        url: string;
        width?: number;
        height?: number;
        mime?: string;
    };
    file?: {
        url: string;
        name: string;
        size?: number;
        mime?: string;
    };
    createdAt: number;
    isRead: boolean;
    isMe: boolean;
}

const ChatRoomScreen: React.FC<ChatRoomScreenProps> = ({ route, navigation }) => {
    // 从 MessageScreen 传递的参数
    const { conversationID, partnerID, name: partnerName, avatar: partnerAvatar } = route.params || {};
    const defaultAvatar = 'https://via.placeholder.com/80/E5E7EB/71717A?text=U';

    // 从 Store 获取数据
    const tinodeToken = useAuthStore(state => state.tinodeToken);

    const [messages, setMessages] = useState<UIMessage[]>([]);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [inputText, setInputText] = useState('');
    const [showQuickReplies, setShowQuickReplies] = useState(true);
    const [showMoreMenu, setShowMoreMenu] = useState(false);
    const [dialogConfig, setDialogConfig] = useState<{
        visible: boolean;
        type: 'info' | 'confirm' | 'success';
        title: string;
        message: string;
        onConfirm?: () => void;
    }>({ visible: false, type: 'info', title: '', message: '' });
    const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
    const [previewVisible, setPreviewVisible] = useState(false);
    const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
    const scrollViewRef = useRef<ScrollView>(null);
    const [topic, setTopic] = useState<any>(null);
    const [topicName, setTopicName] = useState<string>(conversationID || '');
    const [clearBeforeTs, setClearBeforeTs] = useState<number>(0);
    const clearBeforeTsRef = useRef(0);
    const insets = useSafeAreaInsets();
    const { width: windowWidth, height: windowHeight } = useWindowDimensions();

    useEffect(() => {
        clearBeforeTsRef.current = clearBeforeTs;
    }, [clearBeforeTs]);

    useEffect(() => {
        const targetTopic = conversationID || topicName;
        if (!targetTopic) {
            setClearBeforeTs(0);
            return;
        }

        let cancelled = false;
        (async () => {
            try {
                const raw = await AsyncStorage.getItem(`chat_clear_${targetTopic}`);
                if (cancelled) return;
                const ts = raw ? Number(raw) : 0;
                setClearBeforeTs(Number.isFinite(ts) && ts > 0 ? ts : 0);
            } catch (e) {
                console.warn('[ChatRoom] Failed to read clearBeforeTs:', e);
                if (!cancelled) setClearBeforeTs(0);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [conversationID, topicName]);

    useEffect(() => {
        if (!clearBeforeTs) return;
        // Ensure UI immediately reflects a persisted clear marker (e.g. after app restart).
        setMessages(prev => prev.filter(m => m.createdAt > clearBeforeTs));
    }, [clearBeforeTs]);

    const openImagePreview = (url: string) => {
        setPreviewImageUrl(url);
        setPreviewVisible(true);
    };

    const closeImagePreview = () => {
        setPreviewVisible(false);
        setPreviewImageUrl(null);
    };

    // Chat UX: open conversation at latest message, but don't force-scroll when user is reading history.
    const isNearBottomRef = useRef(true);
    const pendingScrollToBottomRef = useRef(false);

    const handleMessageListScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
        const distanceToBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
        // Keep the threshold tight: if the user scrolls up even a bit, don't auto-jump.
        const isNearBottom = distanceToBottom <= 24;
        isNearBottomRef.current = isNearBottom;

        // If user scrolls away from the bottom, cancel any pending auto-scroll.
        // This prevents being pulled to the bottom while reading history.
        if (!isNearBottom) {
            pendingScrollToBottomRef.current = false;
        }
    }, []);

    useEffect(() => {
        // Detach handlers to avoid leaks when leaving the screen.
        return () => {
            if (topic) {
                topic.onData = undefined;
            }
        };
    }, [topic]);

    // 解析 TIM 消息为 UI 消息 - Commented out
    /*
    const parseTIMMessages = (timMessages: any[]): UIMessage[] => {
        return timMessages.map(msg => ({
            id: msg.ID,
            senderId: msg.from,
            content: msg.type === TIM.TYPES.MSG_TEXT ? parseEmojiText(msg.payload.text) : '[非文本消息]',
            createdAt: msg.time * 1000,
            isRead: msg.isRead,
            isMe: msg.from === currentUserId
        }));
    };
    */

    // 解析 Tinode 消息
    const parseTinodeMessages = (tinodeMessages: any[]): UIMessage[] => {
        const selfTinodeUserId = TinodeService.getCurrentUserID();
        console.log('[ChatRoom] parseTinodeMessages: input count =', tinodeMessages.length);

        const filtered = tinodeMessages
            .filter(msg => typeof msg?.seq === 'number' && msg.seq > 0)
            .filter(msg => {
                const marker = clearBeforeTsRef.current;
                if (!marker) return true;
                if (!msg?.ts) return true;
                const ts = new Date(msg.ts).getTime();
                if (!Number.isFinite(ts) || ts <= 0) return true;
                return ts > marker;
            });
        console.log('[ChatRoom] parseTinodeMessages: after filter count =', filtered.length);
        
        if (tinodeMessages.length > 0 && filtered.length === 0) {
            console.warn('[ChatRoom] All messages filtered out! Sample message:', JSON.stringify(tinodeMessages[0], null, 2));
        }

        const normalizeMediaUrl = (raw: unknown): string | undefined => {
            if (typeof raw !== 'string') return undefined;
            const val = raw.trim();
            if (!val) return undefined;

            // Relative upload paths.
            if (val.startsWith('/')) {
                const base = getApiBaseUrl().replace(/\/$/, '');
                return `${base}${val}`;
            }

            // In dev, backend may respond with PublicURL=localhost which is unreachable from Android devices.
            try {
                const u = new URL(val);
                if (__DEV__ && (u.hostname === 'localhost' || u.hostname === '127.0.0.1')) {
                    const base = new URL(getApiBaseUrl());
                    return `${base.origin}${u.pathname}${u.search}`;
                }
            } catch {
                // ignore
            }

            return val;
        };

        return filtered.map((msg) => {
            const contentAny = msg.content;
            const contentObj = contentAny && typeof contentAny === 'object' ? (contentAny as any) : null;

            const imageEnt =
                contentObj && Array.isArray(contentObj.ent)
                    ? contentObj.ent.find((e: any) => e && typeof e === 'object' && e.tp === 'IM' && e.data)
                    : undefined;

            const fileEnt =
                contentObj && Array.isArray(contentObj.ent)
                    ? contentObj.ent.find((e: any) => e && typeof e === 'object' && e.tp === 'EX' && e.data)
                    : undefined;

            const imageUrl = normalizeMediaUrl(imageEnt?.data?.val);

            const fileUrl = normalizeMediaUrl(fileEnt?.data?.val ?? fileEnt?.data?.ref);
            const fileNameFromEnt = typeof fileEnt?.data?.name === 'string' ? fileEnt.data.name : undefined;
            const fileNameFromTxt = typeof contentObj?.txt === 'string' ? contentObj.txt : undefined;
            const fileName = fileNameFromEnt || fileNameFromTxt;
            const rawFileSize = fileEnt?.data?.size;
            const fileSize =
                typeof rawFileSize === 'number' && Number.isFinite(rawFileSize) && rawFileSize > 0
                    ? Math.floor(rawFileSize)
                    : undefined;
            const fileMime = typeof fileEnt?.data?.mime === 'string' ? fileEnt.data.mime : undefined;

            const rawText =
                typeof contentAny === 'string'
                    ? contentAny
                    : typeof contentObj?.txt === 'string'
                      ? contentObj.txt
                      : fileNameFromEnt
                        ? fileNameFromEnt
                        : undefined;
            const text = rawText ? parseEmojiText(rawText) : '[非文本消息]';

            return {
                id: String(msg.seq),
                // Outgoing local-echo messages may have `from` unset.
                senderId: msg.from || selfTinodeUserId || '',
                content: text,
                image: imageUrl
                    ? {
                          url: imageUrl,
                          width: imageEnt?.data?.width,
                          height: imageEnt?.data?.height,
                          mime: imageEnt?.data?.mime,
                      }
                    : undefined,
                file: fileUrl
                    ? {
                          url: fileUrl,
                          name: fileName || '[文件]',
                          size: fileSize,
                          mime: fileMime,
                      }
                    : undefined,
                createdAt: msg.ts ? new Date(msg.ts).getTime() : Date.now(),
                isRead: true, // simplified
                // Tinode SDK may route a locally published message with `from` unset.
                isMe: !msg.from || (!!selfTinodeUserId && msg.from === selfTinodeUserId),
            };
        });
    };

    // 加载历史消息
    const getCachedTopicMessages = (t: any): any[] => {
        if (!t || typeof t.messages !== 'function') {
            console.log('[ChatRoom] getCachedTopicMessages: topic invalid or no messages function');
            return [];
        }
        const history: any[] = [];
        t.messages((m: any) => {
            history.push(m);
        });
        console.log('[ChatRoom] getCachedTopicMessages: found', history.length, 'messages');
        if (history.length > 0) {
            console.log('[ChatRoom] First message sample:', JSON.stringify(history[0], null, 2));
        }
        return history;
    };

    const loadMessages = async () => {
        /* Tencent IM Implementation
        const chat = TencentIMService.getChat();
        if (!chat || !conversationID) return;

        try {
            const imResponse = await chat.getMessageList({ conversationID: conversationID });
            const history = imResponse.data.messageList;
            setMessages(parseTIMMessages(history));

            // 标记已读
            chat.setMessageRead({ conversationID });
        } catch (error) {
            console.error('Failed to load messages:', error);
        }
        */

        // Tinode Implementation
        // Message list may have initialized Tinode, but provider details entry might not.
        if (!TinodeService.isConnected()) {
            if (!tinodeToken) {
                setDialogConfig({
                    visible: true,
                    type: 'info',
                    title: 'IM 未登录',
                    message: '聊天服务未就绪，请重新登录后再试',
                });
                setLoadingMessages(false);
                return;
            }
            const ok = await TinodeService.init(tinodeToken);
            if (!ok) {
                setDialogConfig({
                    visible: true,
                    type: 'info',
                    title: '连接失败',
                    message: '无法连接聊天服务，请稍后重试',
                });
                setLoadingMessages(false);
                return;
            }
        }

        const asTinodeTopic = (val: unknown): string | null => {
            if (typeof val !== 'string') return null;
            const topic = val.trim();
            if (!topic) return null;
            if (topic.startsWith('usr') || topic.startsWith('p2p') || topic.startsWith('grp')) {
                return topic;
            }
            return null;
        };

        let targetTopic = asTinodeTopic(conversationID) || asTinodeTopic(partnerID) || '';

        if (!targetTopic && partnerID) {
            try {
                // partnerID is app user id (numeric). Resolve to Tinode `usr...`.
                const resolved = await TinodeService.resolveTinodeUserId(partnerID);
                targetTopic = resolved;
                setTopicName(resolved);
            } catch (e) {
                console.error('Failed to resolve Tinode peer user id:', e);
                setDialogConfig({
                    visible: true,
                    type: 'info',
                    title: '加载失败',
                    message: '无法解析对方的聊天身份，请稍后重试',
                });
                setLoadingMessages(false);
                return;
            }
        }
        if (!targetTopic) {
            setDialogConfig({
                visible: true,
                type: 'info',
                title: '加载失败',
                message: '缺少会话信息，无法打开聊天',
            });
            setLoadingMessages(false);
            return;
        }

        setTopicName(targetTopic);

        // Conversation switch should always land on the latest message.
        pendingScrollToBottomRef.current = true;
        isNearBottomRef.current = true;

        // If we already have cached messages for this topic (e.g. returning to the chat),
        // render them immediately and avoid showing the loading state.
        const cachedTopic = TinodeService.getTinode()?.getTopic?.(targetTopic);
        const cachedHistory = getCachedTopicMessages(cachedTopic);
        const cachedUi = parseTinodeMessages(cachedHistory);
        if (cachedUi.length > 0) {
            setMessages(cachedUi);
            setLoadingMessages(false);
        } else {
            setLoadingMessages(true);
        }

        try {
              // Subscribe to topic (which fetches messages)
              console.log('[ChatRoom] Subscribing to topic:', targetTopic);
              const t = await TinodeService.subscribeToConversation(targetTopic);
              setTopic(t);
              console.log('[ChatRoom] Subscription complete, topic:', t);

              const history = getCachedTopicMessages(t);
              console.log('[ChatRoom] History after subscription:', history.length, 'messages');

              setMessages(parseTinodeMessages(history));
              
               // Mark read (seq=0 means "mark up to max").
               const lastSeq = history.length > 0 ? history[history.length - 1].seq : 0;
               console.log('[ChatRoom] Marking as read up to seq:', lastSeq);
               TinodeService.markAsRead(targetTopic, lastSeq);

              // Setup listener for new messages
               t.onData = (data: any) => {
                    console.log('[ChatRoom] New message:', data);
                    if (typeof data?.seq !== 'number') return;
                    setMessages(prev => {
                        const incoming = parseTinodeMessages([data]);
                        if (incoming.length === 0) return prev;
                        const existing = new Set(prev.map(m => m.id));
                        const unique = incoming.filter(m => !existing.has(m.id));
                        return unique.length > 0 ? [...prev, ...unique] : prev;
                    });
                    TinodeService.markAsRead(targetTopic, data.seq);
                    if (isNearBottomRef.current) {
                        pendingScrollToBottomRef.current = true;
                    }
               };

              setLoadingMessages(false);

        } catch (error: any) {
             console.error('Failed to subscribe/load messages:', error);
             
             const errorMessage = error?.message || String(error);
             const is401 = errorMessage.includes('401') || errorMessage.includes('authentication required');
             
             if (is401 && tinodeToken) {
                 try {
                     console.log('[ChatRoom] 401 error, reinitializing Tinode...');
                     TinodeService.disconnect();
                     const ok = await TinodeService.init(tinodeToken);
                     if (ok) {
                         console.log('[ChatRoom] Reinitialized, retrying load...');
                         await loadMessages();
                         return;
                     }
                 } catch (reinitError) {
                     console.error('[ChatRoom] Reinit failed:', reinitError);
                 }
             }
             
             setDialogConfig({
                 visible: true,
                 type: 'info',
                 title: '加载失败',
                 message: '拉取聊天记录失败，请稍后重试',
             });
              setLoadingMessages(false);
        }
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        loadMessages();
    }, [conversationID, partnerID, tinodeToken]);

    // 监听新消息 - Handled in loadMessages via topic.onData for Tinode
    /*
    useEffect(() => {
        const chat = TencentIMService.getChat();
        if (!chat) return;

        const onMessageReceived = (event: any) => {
            // 筛选当前会话的消息
            const newMsgs = event.data.filter((msg: any) => msg.conversationID === conversationID);
            if (newMsgs.length > 0) {
                setMessages(prev => [...prev, ...parseTIMMessages(newMsgs)]);
                chat.setMessageRead({ conversationID });
                scrollToBottom();
            }
        };

        chat.on(TIM.EVENT.MESSAGE_RECEIVED, onMessageReceived);

        return () => {
            chat.off(TIM.EVENT.MESSAGE_RECEIVED, onMessageReceived);
        };
    }, [conversationID]);
    */

    // 滚动到底部
    const scrollToBottom = (animated = false) => {
        // Ensure layout has updated before attempting to scroll.
        setTimeout(() => {
            requestAnimationFrame(() => {
                scrollViewRef.current?.scrollToEnd({ animated });
            });
        }, 0);
    };

    const handleMessageListContentSizeChange = useCallback(() => {
        if (!pendingScrollToBottomRef.current) return;
        // Do not animate on open/switch; it should feel instant.
        scrollToBottom(false);
        pendingScrollToBottomRef.current = false;
        isNearBottomRef.current = true;
    }, []);

    useEffect(() => {
        // Some RN layouts may not fire onContentSizeChange reliably (e.g. same height).
        // Keep this as a fallback to ensure conversation opens at the latest message.
        if (loadingMessages) return;
        if (!pendingScrollToBottomRef.current) return;
        scrollToBottom(false);
        pendingScrollToBottomRef.current = false;
        isNearBottomRef.current = true;
    }, [messages.length, loadingMessages]);

    // 发送消息
    const handleSendMessage = async (text: string) => {
        if (!text.trim()) return;

        /* Tencent IM Implementation
        const chat = TencentIMService.getChat();
        console.log('[ChatRoom] handleSendMessage - chat:', !!chat, 'partnerID:', partnerID, 'isLoggedIn:', TencentIMService.getIsLoggedIn());

        if (!chat || !partnerID) {
            console.warn('[ChatRoom] Cannot send: chat or partnerID is missing');
            // IM 未初始化时尝试重新初始化
            if (!TencentIMService.getIsLoggedIn()) {
                console.log('[ChatRoom] Attempting to reinitialize IM...');
                const success = await TencentIMService.init();
                if (!success) {
                    setDialogConfig({
                        visible: true,
                        type: 'info',
                        title: 'IM 未就绪',
                        message: '即时通信服务未就绪，请稍后再试',
                    });
                    return;
                }
            }
            return;
        }
        try {
            // 1. 创建消息
            console.log('[ChatRoom] Creating text message to:', partnerID);
            const message = chat.createTextMessage({
                to: partnerID,
                conversationType: TIM.TYPES.CONV_C2C,
                payload: {
                    text: text.trim()
                }
            });
            console.log('[ChatRoom] Message created:', message.ID);

            // 先上屏 (临时消息)
            const uiMsg: UIMessage = {
                id: message.ID, // 使用 TIM 生成的 ID 作为临时 ID
                senderId: currentUserId,
                content: text.trim(),
                createdAt: Date.now(),
                isRead: false,
                isMe: true
            };
            setMessages(prev => [...prev, uiMsg]);
            scrollToBottom();

            setInputText('');
            setShowQuickReplies(false);
            Keyboard.dismiss();

            // 2. 发送消息
            console.log('[ChatRoom] Sending message...');
            const promise = chat.sendMessage(message);
            const res = await promise;

            console.log('✅ [ChatRoom] Send success:', res);

        } catch (error: any) {
            console.error('❌ [ChatRoom] Send failed:', error);
            // 打印完整的错误对象
            if (error.data) console.error('   Error Data:', error.data);

            setDialogConfig({
                visible: true,
                type: 'info',
                title: '发送失败',
                message: '消息发送失败，请重试',
            });
        }
        */

         // Tinode Implementation
         try {
             // With Tinode SDK, `topic.publish()` will route the sent message through `topic.onData`.
             // Avoid adding local placeholders here to prevent duplicates.
             setInputText('');
             setShowQuickReplies(false);
             Keyboard.dismiss();

             const targetTopic = conversationID || topicName;
             if (!targetTopic) throw new Error('Missing Tinode topic');
             await TinodeService.sendTextMessage(targetTopic, text.trim());
         } catch (error) {
             console.error('Tinode send failed:', error);
             setDialogConfig({
                 visible: true,
                 type: 'info',
                 title: '发送失败',
                 message: '消息发送失败，请重试',
             });
         }
    };

    // 电话按钮点击
    const handlePhonePress = () => {
        setDialogConfig({
            visible: true,
            type: 'info',
            title: '功能开发中',
            message: '语音通话功能正在开发中，敬请期待！',
        });
    };

    // 关闭弹窗
    const closeDialog = () => {
        setDialogConfig(prev => ({ ...prev, visible: false }));
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

    const openAttachmentUrl = async (url: string) => {
        try {
            await Linking.openURL(url);
        } catch (e) {
            console.error('Failed to open attachment url:', url, e);
            setDialogConfig({
                visible: true,
                type: 'info',
                title: '打开失败',
                message: '无法打开该文件，请稍后重试',
            });
        }
    };

    // 更多菜单选项
    const handleMenuOption = (option: string) => {
        setShowMoreMenu(false);
        switch (option) {
            case 'profile':
                if (!partnerID) {
                    setDialogConfig({
                        visible: true,
                        type: 'info',
                        title: '提示',
                        message: '无法打开用户资料',
                    });
                    break;
                }
                try {
                    navigation.navigate('DesignerDetail', { id: partnerID });
                } catch (e) {
                    console.warn('[ChatRoom] Failed to navigate to DesignerDetail:', e);
                    setDialogConfig({
                        visible: true,
                        type: 'info',
                        title: '提示',
                        message: '无法打开用户资料',
                    });
                }
                break;
            case 'clear':
                setDialogConfig({
                    visible: true,
                    type: 'confirm',
                    title: '清空聊天记录',
                    message: '确定要清空与该用户的聊天记录吗？此操作不可恢复。',
                    onConfirm: async () => {
                        const targetTopic = conversationID || topicName;
                        if (!targetTopic) {
                            setTimeout(() => {
                                setDialogConfig({
                                    visible: true,
                                    type: 'info',
                                    title: '提示',
                                    message: '清空失败，请稍后重试',
                                });
                            }, 0);
                            return;
                        }

                        const now = Date.now();
                        try {
                            await AsyncStorage.setItem(`chat_clear_${targetTopic}`, String(now));
                        } catch (e) {
                            console.warn('[ChatRoom] Failed to persist clear marker:', e);
                        }

                        setClearBeforeTs(now);
                        setMessages([]);

                        // `confirm` dialog auto-closes after onConfirm; delay to show success.
                        setTimeout(() => {
                            setDialogConfig({
                                visible: true,
                                type: 'success',
                                title: '已清空',
                                message: '聊天记录已清空',
                            });
                        }, 0);
                    },
                });
                break;
            case 'report':
                setDialogConfig({
                    visible: true,
                    type: 'success',
                    title: '举报成功',
                    message: '感谢您的反馈，我们将尽快处理。',
                });
                break;
        }
    };

    // 通用文件上传并发送 helper
    const uploadAndSendFile = async (file: { uri: string; type: string; name: string; size?: number }) => {
        /* Tencent IM Implementation
        const chat = TencentIMService.getChat();
        if (!chat || !partnerID) return;

        try {
            // 1. 上传文件到应用后端
            console.log('[ChatRoom] Uploading file...', file.name);
            const uploadRes = await fileApi.upload(file);
            console.log('[ChatRoom] Upload success:', uploadRes.data);

            const fileUrl = uploadRes.data.url;
            // 注意：腾讯云IM SDK 发送图片/文件通常需要先上传到腾讯云对象存储(COS)，
            // 或者使用 external 方式。
            // 简单做法：我们发送自定义消息或者文本消息带链接？
            // 不，TUIKit 标准做法是 CreateImageMessage，但需要传入 file object (web) 或 path (native)。
            // React Native SDK createMessage 本地路径即可，SDK 会自动上传到腾讯云。

            // 纠正：Chat SDK for RN 通常会自动上传。我们不需要自己上传到后端，除非为了备份。
            // 但是为了与管理后台互通（管理后台可能只认后端 URL？），或者为了统一管理。
            // 如果 SDK 自动上传到腾讯云，那最好。
            // 让我们尝试直接使用 SDK 的 createMessage 方法。

            let message;
            if (msgType === TIM.TYPES.MSG_IMAGE) {
                // Image Message
                message = chat.createImageMessage({
                    to: partnerID,
                    conversationType: TIM.TYPES.CONV_C2C,
                    payload: {
                        file: {
                            uri: file.uri, // 本地路径
                            type: file.type,
                            name: file.name,
                        }
                    }
                });
            } else if (msgType === TIM.TYPES.MSG_FILE) {
                message = chat.createFileMessage({
                    to: partnerID,
                    conversationType: TIM.TYPES.CONV_C2C,
                    payload: {
                        file: {
                            uri: file.uri,
                            type: file.type,
                            name: file.name,
                        }
                    }
                });
            } else {
                return;
            }

            // 先上屏
            const uiMsg: UIMessage = {
                id: String(Date.now()), // 临时 ID
                senderId: currentUserId,
                content: msgType === TIM.TYPES.MSG_IMAGE ? '[图片]' : '[文件]',
                createdAt: Date.now(),
                isRead: false,
                isMe: true
            };
            setMessages(prev => [...prev, uiMsg]);
            scrollToBottom();

            // 发送
            const res = await chat.sendMessage(message);
            if (res.code === 0) {
                // 成功，更新 ID 等信息，或者等待 event
                console.log('✅ [ChatRoom] Attachment sent:', res);
            }
        } catch (error: any) {
            console.error('❌ [ChatRoom] Send attachment failed:', error);
            setDialogConfig({
                visible: true,
                type: 'info',
                title: '发送失败',
                message: '附件发送失败，请重试',
            });
        }
        */
       
        // Tinode Implementation
        try {
            // `publishMessage()` will also route the sent message through `topic.onData`.
            const targetTopic = conversationID || topicName;
            if (!targetTopic) throw new Error('Missing Tinode topic');

            const mime = (file.type || '').trim() || 'application/octet-stream';
            const name = (file.name || '').trim() || '[文件]';
            const ext = name.split('.').pop()?.toLowerCase();
            const isImageByMime = mime.toLowerCase().startsWith('image/');
            const isImageByExt =
                !!ext &&
                ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'bmp', 'tif', 'tiff', 'svg'].includes(ext);
            const isImage = isImageByMime || isImageByExt;

            if (isImage) {
                await TinodeService.sendImageMessage(targetTopic, file.uri);
            } else {
                const size =
                    typeof file.size === 'number' && Number.isFinite(file.size) && file.size > 0
                        ? Math.floor(file.size)
                        : undefined;
                await TinodeService.sendFileMessage(targetTopic, file.uri, name, mime, size);
            }
        } catch (error) {
            console.error('Tinode attachment send failed:', error);
            setDialogConfig({
                visible: true,
                type: 'info',
                title: '发送失败',
                message: '附件发送失败，请重试',
            });
        }
    };

    // 拍照
    const handleCamera = async () => {
        setShowAttachmentMenu(false);
        try {
            // react-native-image-picker may require runtime permission if CAMERA is declared
            // (e.g. via manifest merge from other deps). Requesting is safe on Android.
            const ensureCameraPermission = async (): Promise<boolean> => {
                if (Platform.OS !== 'android') return true;
                try {
                    const res = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
                    return res === PermissionsAndroid.RESULTS.GRANTED;
                } catch (e) {
                    console.error('Camera permission request failed:', e);
                    return false;
                }
            };

            const result = await launchCamera({
                mediaType: 'photo',
                quality: 0.8,
            });

            if (result.didCancel) return;
            if (result.errorCode) {
                console.error('Camera Error:', result.errorMessage);

                const msg = String(result.errorMessage || '');
                const needsPermission =
                    result.errorCode === 'permission' ||
                    msg.includes('Manifest.permission.CAMERA') ||
                    msg.includes('CAMERA');

                if (needsPermission) {
                    const ok = await ensureCameraPermission();
                    if (!ok) {
                        setDialogConfig({
                            visible: true,
                            type: 'info',
                            title: '相机权限未授予',
                            message: '请在系统设置中允许相机权限后重试',
                        });
                        return;
                    }

                    const retry = await launchCamera({
                        mediaType: 'photo',
                        quality: 0.8,
                    });
                    if (retry.didCancel) return;
                    if (retry.errorCode) {
                        console.error('Camera Error (retry):', retry.errorMessage);
                        return;
                    }

                    const assetRetry = retry.assets?.[0];
                    if (assetRetry && assetRetry.uri) {
                        await uploadAndSendFile({
                            uri: assetRetry.uri,
                            type: assetRetry.type || 'image/jpeg',
                            name: assetRetry.fileName || 'photo.jpg',
                            size: typeof assetRetry.fileSize === 'number' ? assetRetry.fileSize : undefined,
                        });
                    }
                    return;
                }
                return;
            }

            const asset = result.assets?.[0];
            if (asset && asset.uri) {
                await uploadAndSendFile({
                    uri: asset.uri,
                    type: asset.type || 'image/jpeg',
                    name: asset.fileName || 'photo.jpg',
                    size: typeof asset.fileSize === 'number' ? asset.fileSize : undefined,
                });
            }
        } catch (error) {
            console.error('Handle Camera Error:', error);
        }
    };

    // 相册
    const handleGallery = async () => {
        setShowAttachmentMenu(false);
        try {
            const ensureReadImagesPermission = async (): Promise<boolean> => {
                if (Platform.OS !== 'android') return true;
                const perm =
                    typeof Platform.Version === 'number' && Platform.Version >= 33
                        ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES
                        : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;
                try {
                    const res = await PermissionsAndroid.request(perm);
                    return res === PermissionsAndroid.RESULTS.GRANTED;
                } catch (e) {
                    console.error('Gallery permission request failed:', e);
                    return false;
                }
            };

            const result = await launchImageLibrary({
                mediaType: 'photo',
                quality: 0.8,
                selectionLimit: 1,
            });
            if (result.didCancel) return;
            if (result.errorCode) {
                console.error('Gallery Error:', result.errorMessage);

                const msg = String(result.errorMessage || '');
                const needsPermission =
                    result.errorCode === 'permission' ||
                    msg.includes('permission') ||
                    msg.includes('READ_MEDIA') ||
                    msg.includes('READ_EXTERNAL');

                if (needsPermission) {
                    const ok = await ensureReadImagesPermission();
                    if (!ok) {
                        setDialogConfig({
                            visible: true,
                            type: 'info',
                            title: '相册权限未授予',
                            message: '请在系统设置中允许相册/图片访问权限后重试',
                        });
                        return;
                    }

                    const retry = await launchImageLibrary({
                        mediaType: 'photo',
                        quality: 0.8,
                        selectionLimit: 1,
                    });
                    if (retry.didCancel) return;
                    if (retry.errorCode) {
                        console.error('Gallery Error (retry):', retry.errorMessage);
                        return;
                    }

                    const assetRetry = retry.assets?.[0];
                    if (assetRetry && assetRetry.uri) {
                        await uploadAndSendFile({
                            uri: assetRetry.uri,
                            type: assetRetry.type || 'image/jpeg',
                            name: assetRetry.fileName || 'image.jpg',
                            size: typeof assetRetry.fileSize === 'number' ? assetRetry.fileSize : undefined,
                        });
                    }
                    return;
                }
                return;
            }

            const asset = result.assets?.[0];
            if (asset && asset.uri) {
                await uploadAndSendFile({
                    uri: asset.uri,
                    type: asset.type || 'image/jpeg',
                    name: asset.fileName || 'image.jpg',
                    size: typeof asset.fileSize === 'number' ? asset.fileSize : undefined,
                });
            }
        } catch (error) {
            console.error('Handle Gallery Error:', error);
        }
    };

    // 文件文档
    const handleFile = async () => {
        setShowAttachmentMenu(false);
        try {
            const res = await DocumentPicker.pick({
                type: [DocumentPicker.types.allFiles],
            });
            const file = res[0];
            if (file && file.uri) {
                await uploadAndSendFile({
                    uri: file.uri,
                    type: file.type || 'application/octet-stream',
                    name: file.name || 'document',
                    size: typeof file.size === 'number' ? file.size : undefined,
                });
            }
        } catch (err: unknown) {
            if (
                DocumentPicker.isErrorWithCode(err) &&
                err.code === DocumentPicker.errorCodes.OPERATION_CANCELED
            ) {
                // cancelled
                return;
            }
            console.error('DocumentPicker Error:', err);
        }
    };

    // 渲染消息气泡
    const renderMessage = (message: UIMessage, index: number) => {
        const isMe = message.isMe;
        const msgTime = new Date(message.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        const prevMsgTime = index > 0 ? new Date(messages[index - 1]?.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '';
        const showTime = index === 0 || prevMsgTime !== msgTime;

        const image = message.image;
        const file = message.file;
        // Limit image bubble width to half of the message area (no more than half the screen).
        // Message list has horizontal padding=16, so the usable width is (windowWidth - 32).
        const maxW = Math.max(140, Math.floor((windowWidth - 32) * 0.5));
        const maxH = Math.min(320, Math.round(maxW * 1.4));
        const rawW = typeof image?.width === 'number' && image.width > 0 ? image.width : undefined;
        const rawH = typeof image?.height === 'number' && image.height > 0 ? image.height : undefined;
        const imageSize = (() => {
            if (!rawW || !rawH) return { width: maxW, height: maxW };
            const scale = Math.min(maxW / rawW, maxH / rawH, 1);
            return { width: Math.round(rawW * scale), height: Math.round(rawH * scale) };
        })();

        return (
            <View key={message.id}>
                {showTime && (
                    <Text style={styles.timeLabel}>{msgTime}</Text>
                )}
                <View style={[
                    styles.messageRow,
                    isMe && styles.messageRowMe,
                ]}>
                    {!isMe && (
                        <Image
                            source={{ uri: partnerAvatar || defaultAvatar }}
                            style={styles.messageAvatar}
                        />
                    )}
                    <View
                        style={[
                            styles.messageBubble,
                            image ? styles.messageBubbleImage : isMe ? styles.messageBubbleMe : styles.messageBubbleOther,
                        ]}
                    >
                        {image?.url ? (
                            <TouchableOpacity
                                activeOpacity={0.9}
                                onPress={() => openImagePreview(image.url)}
                            >
                                <Image
                                    source={{ uri: image.url }}
                                    style={[styles.messageImage, { width: imageSize.width, height: imageSize.height }]}
                                    resizeMode="cover"
                                />
                            </TouchableOpacity>
                        ) : file?.url ? (
                            <TouchableOpacity
                                activeOpacity={0.7}
                                style={styles.fileCard}
                                onPress={() => openAttachmentUrl(file.url)}
                            >
                                <View style={styles.fileCardLeft}>
                                    <View style={[styles.fileIcon, isMe && styles.fileIconMe]}>
                                        <File size={18} color={isMe ? '#FFFFFF' : '#71717A'} />
                                    </View>
                                    <View style={styles.fileMeta}>
                                        <Text
                                            numberOfLines={1}
                                            style={[styles.fileName, isMe && styles.fileNameMe]}
                                        >
                                            {file.name}
                                        </Text>
                                        <Text style={[styles.fileSize, isMe && styles.fileSizeMe]}>{formatBytes(file.size)}</Text>
                                    </View>
                                </View>
                                <ChevronRight size={18} color={isMe ? '#FFFFFF' : '#A1A1AA'} />
                            </TouchableOpacity>
                        ) : (
                            <Text style={[styles.messageText, isMe && styles.messageTextMe]}>{message.content}</Text>
                        )}
                    </View>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ArrowLeft size={24} color="#09090B" />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>{partnerName}</Text>
                    {/* 在线状态暂未接入 */}
                </View>
                <View style={styles.headerRight}>
                    <TouchableOpacity style={styles.headerBtn} onPress={handlePhonePress}>
                        <Phone size={20} color="#09090B" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.headerBtn} onPress={() => setShowMoreMenu(true)}>
                        <MoreVertical size={20} color="#09090B" />
                    </TouchableOpacity>
                </View>
            </View>

            <KeyboardAvoidingView
                // Android already uses `windowSoftInputMode=adjustResize` (AndroidManifest.xml).
                // Using KeyboardAvoidingView behavior on Android can cause layout drift after keyboard hides.
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={styles.keyboardView}
                keyboardVerticalOffset={Platform.OS === 'android' ? 0 : 0}
            >
                {/* 消息列表 */}
                <ScrollView
                    ref={scrollViewRef}
                    style={styles.messageList}
                    contentContainerStyle={styles.messageListContent}
                    showsVerticalScrollIndicator={false}
                    onScroll={handleMessageListScroll}
                    scrollEventThrottle={16}
                    onContentSizeChange={handleMessageListContentSizeChange}
                >
                    {loadingMessages ? (
                        <View style={styles.emptyState}>
                            <ActivityIndicator size="small" color={PRIMARY_GOLD} />
                            <Text style={styles.emptyText}>正在加载聊天记录...</Text>
                        </View>
                    ) : messages.length === 0 ? (
                        <TouchableOpacity style={styles.emptyState} activeOpacity={0.8} onPress={loadMessages}>
                            <Text style={styles.emptyText}>暂无聊天记录</Text>
                            <Text style={styles.emptySubtext}>点击刷新</Text>
                        </TouchableOpacity>
                    ) : (
                        messages.map((message, index) => renderMessage(message, index))
                    )}
                </ScrollView>

                {/* 快捷回复 */}
                {showQuickReplies && (
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.quickRepliesContainer}
                        contentContainerStyle={styles.quickRepliesContent}
                    >
                        {QUICK_REPLIES.map((reply, index) => (
                            <TouchableOpacity
                                key={index}
                                style={styles.quickReplyBtn}
                                onPress={() => handleSendMessage(reply)}
                            >
                                <Text style={styles.quickReplyText}>{reply}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                )}

                {/* 输入区域 */}
                <View style={styles.inputBar}>
                    <View style={styles.inputContainer}>
                        <TouchableOpacity
                            style={styles.attachBtn}
                            onPress={() => setShowAttachmentMenu(true)}
                        >
                            <Plus size={22} color="#71717A" />
                        </TouchableOpacity>
                        <View style={styles.inputWrapper}>
                            <TextInput
                                style={styles.textInput}
                                placeholder="输入消息..."
                                placeholderTextColor="#A1A1AA"
                                value={inputText}
                                onChangeText={setInputText}
                                multiline
                                maxLength={500}
                            />
                        </View>
                        <TouchableOpacity
                            style={[
                                styles.sendBtn,
                                inputText.trim() && styles.sendBtnActive,
                            ]}
                            onPress={() => handleSendMessage(inputText)}
                            disabled={!inputText.trim()}
                        >
                            <Send size={20} color={inputText.trim() ? '#FFFFFF' : '#A1A1AA'} />
                        </TouchableOpacity>
                    </View>
                    {/* Fill the iOS home-indicator safe area without inflating the input row padding. */}
                    {insets.bottom > 0 ? (
                        <View style={[styles.safeAreaFill, { height: insets.bottom }]} />
                    ) : null}
                </View>
            </KeyboardAvoidingView>

            {/* 图片预览 Modal */}
            <Modal
                visible={previewVisible}
                transparent
                animationType="fade"
                statusBarTranslucent
                onRequestClose={closeImagePreview}
            >
                <TouchableOpacity
                    style={styles.previewOverlay}
                    activeOpacity={1}
                    onPress={closeImagePreview}
                >
                    <TouchableOpacity
                        activeOpacity={1}
                        onPress={() => {}}
                        style={{
                            width: Math.max(1, windowWidth - 32),
                            height: Math.max(1, Math.floor(windowHeight * 0.8)),
                        }}
                    >
                        {previewImageUrl ? (
                            <Image
                                source={{ uri: previewImageUrl }}
                                style={styles.previewImage}
                                resizeMode="contain"
                            />
                        ) : null}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.previewCloseBtn, { top: insets.top + 12 }]}
                        onPress={closeImagePreview}
                    >
                        <X size={28} color="#FFFFFF" />
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>

            {/* 更多菜单弹窗 */}
            <Modal
                visible={showMoreMenu}
                transparent
                animationType="fade"
                onRequestClose={() => setShowMoreMenu(false)}
            >
                <TouchableOpacity
                    style={styles.menuOverlay}
                    activeOpacity={1}
                    onPress={() => setShowMoreMenu(false)}
                >
                    <View style={styles.menuContainer}>
                        <TouchableOpacity
                            style={styles.menuItem}
                            onPress={() => handleMenuOption('profile')}
                        >
                            <Text style={styles.menuItemText}>查看个人主页</Text>
                        </TouchableOpacity>
                        <View style={styles.menuDivider} />
                        <TouchableOpacity
                            style={styles.menuItem}
                            onPress={() => handleMenuOption('clear')}
                        >
                            <Text style={styles.menuItemText}>清空聊天记录</Text>
                        </TouchableOpacity>
                        <View style={styles.menuDivider} />
                        <TouchableOpacity
                            style={styles.menuItem}
                            onPress={() => handleMenuOption('report')}
                        >
                            <Text style={[styles.menuItemText, styles.menuItemDanger]}>举报</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* 自定义弹窗 */}
            <Modal
                visible={dialogConfig.visible}
                transparent
                animationType="fade"
                onRequestClose={closeDialog}
            >
                <View style={styles.dialogOverlay}>
                    <View style={styles.dialogContainer}>
                        {/* 图标 */}
                        <View style={[
                            styles.dialogIconContainer,
                            dialogConfig.type === 'success' && styles.dialogIconSuccess,
                            dialogConfig.type === 'confirm' && styles.dialogIconWarning,
                            dialogConfig.type === 'info' && styles.dialogIconInfo,
                        ]}>
                            {dialogConfig.type === 'success' && <CheckCircle size={32} color="#10B981" />}
                            {dialogConfig.type === 'confirm' && <AlertCircle size={32} color="#F59E0B" />}
                            {dialogConfig.type === 'info' && <Info size={32} color={PRIMARY_GOLD} />}
                        </View>

                        {/* 标题和内容 */}
                        <Text style={styles.dialogTitle}>{dialogConfig.title}</Text>
                        <Text style={styles.dialogMessage}>{dialogConfig.message}</Text>

                        {/* 按钮 */}
                        <View style={styles.dialogButtons}>
                            {dialogConfig.type === 'confirm' ? (
                                <>
                                    <TouchableOpacity
                                        style={[styles.dialogBtn, styles.dialogBtnSecondary]}
                                        onPress={closeDialog}
                                    >
                                        <Text style={styles.dialogBtnSecondaryText}>取消</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.dialogBtn, styles.dialogBtnDanger]}
                                        onPress={() => {
                                            dialogConfig.onConfirm?.();
                                            closeDialog();
                                        }}
                                    >
                                        <Text style={styles.dialogBtnDangerText}>确定</Text>
                                    </TouchableOpacity>
                                </>
                            ) : (
                                <TouchableOpacity
                                    style={[styles.dialogBtn, styles.dialogBtnPrimary]}
                                    onPress={closeDialog}
                                >
                                    <Text style={styles.dialogBtnPrimaryText}>知道了</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </View>
            </Modal>

            {/* 附件菜单弹窗 */}
            <Modal
                visible={showAttachmentMenu}
                transparent
                animationType="slide"
                onRequestClose={() => setShowAttachmentMenu(false)}
            >
                <TouchableOpacity
                    style={styles.attachmentOverlay}
                    activeOpacity={1}
                    onPress={() => setShowAttachmentMenu(false)}
                >
                    <View style={styles.attachmentContainer}>
                        <View style={styles.attachmentHandle} />
                        <Text style={styles.attachmentTitle}>发送</Text>
                        <View style={styles.attachmentGrid}>
                            <TouchableOpacity
                                style={styles.attachmentItem}
                                onPress={handleCamera}
                            >
                                <View style={[styles.attachmentIcon, { backgroundColor: '#FEF3C7' }]}>
                                    <Camera size={24} color="#F59E0B" />
                                </View>
                                <Text style={styles.attachmentLabel}>拍照</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.attachmentItem}
                                onPress={handleGallery}
                            >
                                <View style={[styles.attachmentIcon, { backgroundColor: '#DBEAFE' }]}>
                                    <ImageIcon size={24} color="#3B82F6" />
                                </View>
                                <Text style={styles.attachmentLabel}>相册</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.attachmentItem}
                                onPress={handleFile}
                            >
                                <View style={[styles.attachmentIcon, { backgroundColor: '#F3E8FF' }]}>
                                    <File size={24} color="#8B5CF6" />
                                </View>
                                <Text style={styles.attachmentLabel}>文件</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </TouchableOpacity>
            </Modal>
        </SafeAreaView>
    );
};

// ... keep styles same
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'ios' ? 12 : 44,
        paddingBottom: 12,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F4F4F5',
    },
    backBtn: {
        padding: 4,
    },
    headerCenter: {
        flex: 1,
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#09090B',
    },
    headerSubtitle: {
        fontSize: 12,
        color: '#22C55E',
        marginTop: 2,
    },
    headerRight: {
        flexDirection: 'row',
    },
    headerBtn: {
        padding: 8,
    },
    keyboardView: {
        flex: 1,
    },
    // 消息列表
    messageList: {
        flex: 1,
    },
    messageListContent: {
        padding: 16,
        paddingBottom: 8,
    },
    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 80,
        paddingHorizontal: 24,
        gap: 10,
    },
    emptyText: {
        marginTop: 8,
        fontSize: 14,
        fontWeight: '600',
        color: '#71717A',
        textAlign: 'center',
    },
    emptySubtext: {
        fontSize: 13,
        color: '#A1A1AA',
        textAlign: 'center',
    },
    timeLabel: {
        textAlign: 'center',
        fontSize: 12,
        color: '#A1A1AA',
        marginVertical: 12,
    },
    messageRow: {
        flexDirection: 'row',
        marginBottom: 12,
        alignItems: 'flex-end',
    },
    messageRowMe: {
        flexDirection: 'row-reverse',
    },
    messageAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        marginRight: 8,
        backgroundColor: '#E5E7EB',
    },
    messageBubble: {
        maxWidth: '75%',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 16,
    },
    messageBubbleImage: {
        paddingHorizontal: 0,
        paddingVertical: 0,
        backgroundColor: '#E4E4E7',
        borderRadius: 16,
        overflow: 'hidden',
    },
    messageBubbleOther: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 4,
    },
    messageBubbleMe: {
        backgroundColor: PRIMARY_GOLD,
        borderTopRightRadius: 4,
    },
    messageImage: {
        backgroundColor: '#E4E4E7',
        borderRadius: 16,
    },
    messageText: {
        fontSize: 14,
        color: '#09090B',
        lineHeight: 20,
    },
    messageTextMe: {
        color: '#FFFFFF',
    },
    fileCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        minWidth: 0,
        maxWidth: '100%',
    },
    fileCardLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 10,
    },
    fileIcon: {
        width: 34,
        height: 34,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F4F4F5',
        marginRight: 10,
    },
    fileIconMe: {
        backgroundColor: 'rgba(255, 255, 255, 0.18)',
    },
    fileMeta: {
        flex: 1,
    },
    fileName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#09090B',
    },
    fileNameMe: {
        color: '#FFFFFF',
    },
    fileSize: {
        marginTop: 2,
        fontSize: 12,
        color: '#71717A',
    },
    fileSizeMe: {
        color: 'rgba(255, 255, 255, 0.85)',
    },
    // 快捷回复
    quickRepliesContainer: {
        maxHeight: 44,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#F4F4F5',
    },
    quickRepliesContent: {
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    quickReplyBtn: {
        paddingHorizontal: 14,
        paddingVertical: 6,
        backgroundColor: '#F4F4F5',
        borderRadius: 16,
        marginHorizontal: 4,
    },
    quickReplyText: {
        fontSize: 13,
        color: '#71717A',
    },
    // 输入区域
    inputBar: {
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#F4F4F5',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        // Keep a small consistent bottom padding; SafeAreaView already accounts for iOS insets.
        paddingBottom: 8,
        backgroundColor: '#FFFFFF',
    },
    safeAreaFill: {
        backgroundColor: '#FFFFFF',
    },
    attachBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    inputWrapper: {
        flex: 1,
        backgroundColor: '#F4F4F5',
        borderRadius: 22,
        paddingHorizontal: 14,
        paddingVertical: 0,
        marginHorizontal: 8,
        minHeight: 44,
        maxHeight: 100,
        justifyContent: 'center',
    },
    textInput: {
        fontSize: 14,
        color: '#09090B',
        maxHeight: 80,
        paddingVertical: 0,
    },
    sendBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#E4E4E7',
        alignItems: 'center',
        justifyContent: 'center',
    },
    sendBtnActive: {
        backgroundColor: PRIMARY_GOLD,
    },
    // 更多菜单
    menuOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        justifyContent: 'flex-start',
        alignItems: 'flex-end',
        paddingTop: Platform.OS === 'ios' ? 100 : 90,
        paddingRight: 16,
    },
    menuContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        minWidth: 160,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 12,
            },
            android: {
                elevation: 8,
            },
        }),
    },
    menuItem: {
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    menuItemText: {
        fontSize: 15,
        color: '#09090B',
    },
    menuItemDanger: {
        color: '#EF4444',
    },
    menuDivider: {
        height: 1,
        backgroundColor: '#F4F4F5',
    },
    // 自定义弹窗
    dialogOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    dialogContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
        width: '100%',
        maxWidth: 320,
    },
    dialogIconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    dialogIconSuccess: {
        backgroundColor: '#ECFDF5',
    },
    dialogIconWarning: {
        backgroundColor: '#FEF3C7',
    },
    dialogIconInfo: {
        backgroundColor: '#FFFBEB',
    },
    dialogTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#09090B',
        marginBottom: 8,
        textAlign: 'center',
    },
    dialogMessage: {
        fontSize: 14,
        color: '#71717A',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 24,
    },
    dialogButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    dialogBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
    },
    dialogBtnPrimary: {
        backgroundColor: PRIMARY_GOLD,
    },
    dialogBtnPrimaryText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    dialogBtnSecondary: {
        backgroundColor: '#F4F4F5',
    },
    dialogBtnSecondaryText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#71717A',
    },
    dialogBtnDanger: {
        backgroundColor: '#FEE2E2',
    },
    dialogBtnDangerText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#EF4444',
    },
    // 附件菜单样式
    attachmentOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        justifyContent: 'flex-end',
    },
    attachmentContainer: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingHorizontal: 16,
        paddingBottom: Platform.OS === 'ios' ? 34 : 24,
    },
    attachmentHandle: {
        width: 40,
        height: 4,
        backgroundColor: '#E4E4E7',
        borderRadius: 2,
        alignSelf: 'center',
        marginTop: 12,
        marginBottom: 16,
    },
    attachmentTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#09090B',
        textAlign: 'center',
        marginBottom: 20,
    },
    attachmentGrid: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingHorizontal: 20,
    },
    attachmentItem: {
        alignItems: 'center',
    },
    attachmentIcon: {
        width: 56,
        height: 56,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    attachmentLabel: {
        fontSize: 13,
        color: '#71717A',
    },
    // 图片预览
    previewOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.95)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    previewImage: {
        width: '100%',
        height: '100%',
    },
    previewCloseBtn: {
        position: 'absolute',
        right: 16,
        zIndex: 10,
        padding: 8,
    },
});

export default ChatRoomScreen;
