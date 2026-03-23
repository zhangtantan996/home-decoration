import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    Platform,
    TextInput,
    Image,
    ActivityIndicator,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import {
    Search,
    Bell,
    FileText,
    CheckCheck,
    Wifi,
    WifiOff,
} from 'lucide-react-native';
// import TencentIMService from '../services/TencentIMService';
// import TIM from '@tencentcloud/chat';
import TinodeService from '../services/TinodeService';
import { useAuthStore } from '../store/authStore';
import { parseEmojiText } from '../utils/emojiParser';

// 主色调
const PRIMARY_GOLD = '#D4AF37';

// UI 会话数据类型
interface UIConversation {
    conversationID: string;
    partnerID: string;
    partnerIdentifier?: string;
    partnerPublicId?: string;
    name: string;
    avatar: string;
    role: 'designer' | 'worker' | 'company' | 'manager';
    roleLabel: string;
    lastMessage: string;
    time: string;
    unreadCount: number;
    isOnline: boolean;
    isRead: boolean;
}

// 系统通知数据类型
interface SystemNotification {
    id: string;
    type: 'system' | 'quote' | 'project';
    title: string;
    content: string;
    time: string;
    isRead: boolean;
}

// Mock 系统通知数据 (未来可从API获取)
const MOCK_NOTIFICATIONS: SystemNotification[] = [
    {
        id: '1',
        type: 'system',
        title: '系统维护通知',
        content: '为了提供更好的服务，我们将于本周日凌晨2:00进行系统升级。',
        time: '2小时前',
        isRead: false,
    },
    {
        id: '2',
        type: 'quote',
        title: '报价变更提醒',
        content: '您的项目「汤臣一品」新增了一项增项报价，请及时确认。',
        time: '昨天',
        isRead: false,
    },
    {
        id: '3',
        type: 'project',
        title: '项目进度更新',
        content: '您的项目「西溪诚园」已进入油漆工程阶段。',
        time: '3天前',
        isRead: true,
    },
];

// 角色颜色映射
const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
    designer: { bg: '#FEF3C7', text: '#D97706' },
    worker: { bg: '#DBEAFE', text: '#2563EB' },
    manager: { bg: '#D1FAE5', text: '#059669' },
    company: { bg: '#F3E8FF', text: '#7C3AED' },
};

const IM_RECONNECT_BUSINESS_KEY = 'mobile.message.im_reconnect';

// 格式化时间
const formatTime = (isoString: string): string => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
        return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
        return '昨天';
    } else if (days < 7) {
        const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        return weekDays[date.getDay()];
    } else {
        return `${date.getMonth() + 1}/${date.getDate()}`;
    }
};

const MessageScreen: React.FC = () => {
    const navigation = useNavigation();
    const [activeTab, setActiveTab] = useState<'conversations' | 'notifications'>('conversations');
    const [refreshing, setRefreshing] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [notifications] = useState(MOCK_NOTIFICATIONS);

    // IM 状态
    const [conversations, setConversations] = useState<UIConversation[]>([]);
    const [imStatus, setImStatus] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected');
    const [reconnectPaused, setReconnectPaused] = useState(false);
    const tinodeToken = useAuthStore(state => state.tinodeToken);
    const conversationsRefreshScheduledRef = useRef(false);

    // 加载会话列表
    const loadConversations = useCallback(async (trigger: 'auto' | 'manual' = 'auto') => {
        if (trigger === 'auto' && reconnectPaused) {
            return;
        }

        /* Tencent IM Implementation - Commented out
        const isLoggedIn = TencentIMService.getIsLoggedIn();
        if (!isLoggedIn) {
            setImStatus('connecting');
            const success = await TencentIMService.init();
            if (!success) {
                setImStatus('disconnected');
                return;
            }
        }
        setImStatus('connected');

        const list = await TencentIMService.getConversationList();

        // 转换数据格式
        const uiList: UIConversation[] = list.map((item: any) => {
            const profile = item.userProfile || {};
            const rawLastMessage = item.lastMessage?.messageForShow || '';
            return {
                conversationID: item.conversationID,
                partnerID: profile.userID || item.conversationID.replace('C2C', ''),
                name: profile.nick || profile.userID || '未知用户',
                avatar: profile.avatar || 'https://via.placeholder.com/100',
                role: 'designer', // TODO: 根据自定义字段判断
                roleLabel: '服务商',
                lastMessage: parseEmojiText(rawLastMessage),
                time: formatTime(item.lastMessage?.lastTime),
                unreadCount: item.unreadCount,
                isOnline: false,
                isRead: item.unreadCount === 0,
            };
        });

        setConversations(uiList);
        */

        // Tinode Implementation
        if (!tinodeToken) {
            setImStatus('disconnected');
            return;
        }

        const isConnected = TinodeService.isConnected();
        if (!isConnected) {
            if (trigger === 'auto' && TinodeService.isReconnectPaused()) {
                setReconnectPaused(true);
                setImStatus('disconnected');
                return;
            }

            setImStatus('connecting');
            const success = await TinodeService.init(tinodeToken);
            if (!success) {
                setImStatus('disconnected');
                return;
            }
        }
        setImStatus('connected');

        const list = await TinodeService.getConversationList();

        // React Native does not have Tinode persistent cache enabled by default,
        // so P2P topics may have stale/empty last message until we fetch it explicitly.
        // If a topic shows unread count but preview is still the old message, we also need a prefetch.
        const candidates = list
            .filter((t: any) => typeof t?.name === 'string')
            .filter((t: any) => {
                const latest = typeof t?.latestMessage === 'function' ? t.latestMessage() : undefined;
                const unread = typeof t?.unread === 'number' ? t.unread : 0;
                return unread > 0 || !latest?.content;
            })
            .slice(0, 20);

        if (candidates.length > 0) {
            await Promise.allSettled(
                candidates.map((t: any) => TinodeService.prefetchLastMessage(t.name))
            );
        }

        const selfTinodeUserId = TinodeService.getCurrentUserID();

        const uiList: UIConversation[] = list.map((item: any) => {
            // `item` is a Tinode Topic (likely P2P). The SDK stores last message in `latestMessage()`.
            const latest = typeof item?.latestMessage === 'function' ? item.latestMessage() : undefined;

            const rawLastMessage = (() => {
                const content = latest?.content;
                if (typeof content === 'string') return content;
                if (content && typeof content === 'object') {
                    const obj = content as Record<string, unknown>;
                    if (typeof obj.txt === 'string') return obj.txt;

                    const ent = obj.ent;
                    if (Array.isArray(ent)) {
                        type DraftyEntity = {
                            tp?: string;
                            data?: {
                                mime?: unknown;
                                duration?: unknown;
                            };
                        };
                        const draftyEntities = ent as DraftyEntity[];

                        const audioEntity = draftyEntities.find(
                            (entity) =>
                                entity?.tp === 'EX' &&
                                typeof entity.data?.mime === 'string' &&
                                entity.data.mime.startsWith('audio/')
                        );

                        if (audioEntity) {
                            const durationMs =
                                typeof audioEntity.data?.duration === 'number'
                                    ? audioEntity.data.duration
                                    : 0;
                            const durationSeconds = Math.floor(durationMs / 1000);
                            return `【语音 ${durationSeconds}s】`;
                        }

                        const hasImage = draftyEntities.some((entity) => entity?.tp === 'IM');
                        if (hasImage) {
                            return '【图片】';
                        }
                    }
                }
                return '';
            })();

            const from = latest?.from;
            const isMe = !from || (!!selfTinodeUserId && from === selfTinodeUserId);
            const preview = rawLastMessage ? (isMe ? `我：${rawLastMessage}` : rawLastMessage) : '';

            // For P2P topics, peer description is under `p2pPeerDesc()`.
            const peer = typeof item?.p2pPeerDesc === 'function' ? item.p2pPeerDesc() : undefined;
            const peerPublic = peer?.public || item?.public || {};
            const peerPublicIdCandidate = (peerPublic as Record<string, unknown>)?.publicId
                ?? (peerPublic as Record<string, unknown>)?.userPublicId;
            const peerPublicId =
                typeof peerPublicIdCandidate === 'number'
                    ? String(peerPublicIdCandidate)
                    : typeof peerPublicIdCandidate === 'string'
                        ? peerPublicIdCandidate.trim() || undefined
                        : undefined;

            return {
                // In tinode-sdk P2P, the topic name is the peer's `usr...` id.
                conversationID: item.name,
                partnerID: item.name,
                partnerIdentifier: peerPublicId || item.name,
                partnerPublicId: peerPublicId,
                name: peerPublic?.fn || '未知用户',
                avatar: peerPublic?.photo || 'https://via.placeholder.com/100',
                role: 'designer', // Placeholder
                roleLabel: '服务商',
                lastMessage: preview ? parseEmojiText(preview) : '',
                time: formatTime(item.touched || latest?.ts || ''),
                unreadCount: typeof item.unread === 'number' ? item.unread : 0,
                isOnline: false,
                isRead: (typeof item.unread === 'number' ? item.unread : 0) === 0,
            };
        });
        
        setConversations(uiList);
    }, [reconnectPaused, tinodeToken]);

    const scheduleLoadConversations = useCallback(() => {
        if (conversationsRefreshScheduledRef.current) return;
        conversationsRefreshScheduledRef.current = true;
        // Coalesce bursts of events into a single refresh.
        setTimeout(() => {
            conversationsRefreshScheduledRef.current = false;
            loadConversations('auto').catch((error) => {
                console.error('[Message] Scheduled auto load failed:', error);
            });
        }, 0);
    }, [loadConversations]);

    const handleManualReconnect = useCallback(async () => {
        setReconnectPaused(false);

        console.info('[AutoRetry]', {
            businessKey: IM_RECONNECT_BUSINESS_KEY,
            trigger: 'manual',
            event: 'manual_reconnect',
        });

        await TinodeService.reconnectManually();
        await loadConversations('manual');
    }, [loadConversations]);

    // 页面聚焦时刷新
    useFocusEffect(
        useCallback(() => {
            loadConversations('auto').catch((error) => {
                console.error('[Message] Focus auto load failed:', error);
            });
        }, [loadConversations])
    );

    // 监听 IM SDK 事件（简化版，仅监听新消息以刷新列表）
    useEffect(() => {
        /* Tencent IM Implementation - Commented out
        const chat = TencentIMService.getChat();
        if (!chat) return;

        const onMessageReceived = () => {
            loadConversations();
        };

        chat.on(TIM.EVENT.MESSAGE_RECEIVED, onMessageReceived);

        return () => {
            chat.off(TIM.EVENT.MESSAGE_RECEIVED, onMessageReceived);
        };
        */

        // Tinode Implementation
        const onConnected = () => {
            setImStatus('connected');
            setReconnectPaused(false);
            scheduleLoadConversations();
        };
        const onDisconnected = () => {
            setImStatus('disconnected');
        };
        const onReconnectAttempt = (payload: any) => {
            console.info('[AutoRetry]', {
                businessKey: IM_RECONNECT_BUSINESS_KEY,
                trigger: 'auto',
                event: 'attempt',
                attempt: payload?.attempt,
            });
        };
        const onReconnectPaused = (payload: any) => {
            setReconnectPaused(true);
            setImStatus('disconnected');
            console.warn('[AutoRetry]', {
                businessKey: IM_RECONNECT_BUSINESS_KEY,
                trigger: 'auto',
                event: 'paused',
                attempt: payload?.autoAttempts,
                consecutiveFailures: payload?.consecutiveFailures,
                pausedReason: 'max_auto_attempts_reached',
            });
        };
        const onReconnectResumed = () => {
            setReconnectPaused(false);
            console.info('[AutoRetry]', {
                businessKey: IM_RECONNECT_BUSINESS_KEY,
                trigger: 'manual',
                event: 'resumed',
            });
        };
        const onSubsUpdated = () => {
            scheduleLoadConversations();
        };
        const onPres = (pres: any) => {
            if (pres?.what === 'msg' && typeof pres?.src === 'string') {
                TinodeService.prefetchLastMessage(pres.src).finally(scheduleLoadConversations);
                return;
            }
            if (pres?.what === 'read' || pres?.what === 'recv') {
                scheduleLoadConversations();
            }
        };
        const onContactUpdate = (payload: any) => {
            const what = payload?.what;
            const topicName = payload?.cont?.name;
            if (what === 'msg' && typeof topicName === 'string') {
                TinodeService.prefetchLastMessage(topicName).finally(scheduleLoadConversations);
                return;
            }
            scheduleLoadConversations();
        };

        TinodeService.on('connected', onConnected);
        TinodeService.on('disconnected', onDisconnected);
        TinodeService.on('reconnect-attempt', onReconnectAttempt);
        TinodeService.on('reconnect-paused', onReconnectPaused);
        TinodeService.on('reconnect-resumed', onReconnectResumed);
        TinodeService.on('subs-updated', onSubsUpdated);
        TinodeService.on('contact-update', onContactUpdate);
        TinodeService.on('pres', onPres);

        return () => {
            TinodeService.removeListener('connected', onConnected);
            TinodeService.removeListener('disconnected', onDisconnected);
            TinodeService.removeListener('reconnect-attempt', onReconnectAttempt);
            TinodeService.removeListener('reconnect-paused', onReconnectPaused);
            TinodeService.removeListener('reconnect-resumed', onReconnectResumed);
            TinodeService.removeListener('subs-updated', onSubsUpdated);
            TinodeService.removeListener('contact-update', onContactUpdate);
            TinodeService.removeListener('pres', onPres);
        };
    }, [scheduleLoadConversations]);

    const onRefresh = async () => {
        setRefreshing(true);
        await loadConversations('manual');
        setRefreshing(false);
    };

    const renderEmptyConversations = () => {
        if (imStatus === 'connecting') {
            return (
                <View style={styles.emptyContainer}>
                    <ActivityIndicator size="small" color="#F59E0B" />
                    <Text style={styles.emptyText}>正在连接 IM...</Text>
                    <Text style={styles.emptySubtext}>请稍候，正在获取会话列表</Text>
                </View>
            );
        }

        if (imStatus === 'disconnected') {
            return (
                <TouchableOpacity
                    style={styles.emptyContainer}
                    onPress={() => {
                        if (reconnectPaused) {
                            handleManualReconnect().catch((error) => {
                                console.error('[Message] Manual reconnect failed:', error);
                            });
                            return;
                        }
                        loadConversations('manual').catch((error) => {
                            console.error('[Message] Manual load failed:', error);
                        });
                    }}
                    activeOpacity={0.7}
                >
                    <Text style={styles.emptyIcon}>⚠️</Text>
                    <Text style={styles.emptyText}>{reconnectPaused ? 'IM 自动重连已暂停' : 'IM 未登录'}</Text>
                    <Text style={styles.emptySubtext}>
                        {reconnectPaused ? '点击手动重连' : '点击重试或重新登录后再试'}
                    </Text>
                </TouchableOpacity>
            );
        }

        return (
            <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>💬</Text>
                <Text style={styles.emptyText}>暂无会话</Text>
                <Text style={styles.emptySubtext}>开始咨询服务商吧</Text>
            </View>
        );
    };

    // 页面聚焦时刷新




    // 未读通知数量
    const unreadNotificationCount = notifications.filter(n => !n.isRead).length;

    // 获取通知图标
    const getNotificationIcon = (type: string) => {
        switch (type) {
            case 'system':
                return <Bell size={20} color="#71717A" />;
            case 'quote':
                return <FileText size={20} color="#71717A" />;
            case 'project':
                return <FileText size={20} color="#71717A" />;
            default:
                return <Bell size={20} color="#71717A" />;
        }
    };

    // 渲染会话卡片
    const renderConversationCard = (conversation: UIConversation) => {
        const roleColor = ROLE_COLORS[conversation.role] || ROLE_COLORS.designer;

        return (
            <TouchableOpacity
                key={conversation.conversationID}
                style={styles.conversationCard}
                onPress={() => (navigation as any).navigate('ChatRoom', {
                    conversationID: conversation.conversationID,
                    partnerID: conversation.partnerID,
                    partnerIdentifier: conversation.partnerIdentifier || conversation.partnerPublicId || conversation.partnerID,
                    partnerPublicId: conversation.partnerPublicId,
                    name: conversation.name,
                    avatar: conversation.avatar,
                })}
                activeOpacity={0.7}
            >
                {/* 头像 + 在线状态 */}
                <View style={styles.avatarContainer}>
                    <Image source={{ uri: conversation.avatar }} style={styles.avatar} />
                    {conversation.isOnline && <View style={styles.onlineDot} />}
                </View>

                {/* 内容区 */}
                <View style={styles.conversationContent}>
                    <View style={styles.conversationHeader}>
                        <View style={styles.nameRow}>
                            <Text style={styles.conversationName}>{conversation.name}</Text>
                            <View style={[styles.roleBadge, { backgroundColor: roleColor.bg }]}>
                                <Text style={[styles.roleBadgeText, { color: roleColor.text }]}>
                                    {conversation.roleLabel}
                                </Text>
                            </View>
                        </View>
                        <Text style={styles.conversationTime}>{conversation.time}</Text>
                    </View>
                    <View style={styles.conversationFooter}>
                        <Text style={styles.lastMessage} numberOfLines={1}>
                            {conversation.lastMessage}
                        </Text>
                        {conversation.unreadCount > 0 ? (
                            <View style={styles.unreadBadge}>
                                <Text style={styles.unreadBadgeText}>{conversation.unreadCount}</Text>
                            </View>
                        ) : conversation.isRead ? (
                            <CheckCheck size={16} color="#A1A1AA" />
                        ) : null}
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    // 渲染通知卡片
    const renderNotificationCard = (notification: SystemNotification) => (
        <TouchableOpacity
            key={notification.id}
            style={[styles.notificationCard, !notification.isRead && styles.notificationCardUnread]}
            activeOpacity={0.7}
        >
            <View style={styles.notificationIcon}>
                {getNotificationIcon(notification.type)}
            </View>
            <View style={styles.notificationContent}>
                <View style={styles.notificationHeader}>
                    <Text style={[styles.notificationTitle, !notification.isRead && styles.notificationTitleUnread]}>
                        {notification.title}
                    </Text>
                    <Text style={styles.notificationTime}>{notification.time}</Text>
                </View>
                <Text style={styles.notificationText} numberOfLines={2}>
                    {notification.content}
                </Text>
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>通知中心</Text>
                {/* 连接状态指示器 */}
                <View style={styles.connectionStatus}>
                    {imStatus === 'connected' ? (
                        <Wifi size={16} color="#22C55E" />
                    ) : imStatus === 'connecting' ? (
                        <ActivityIndicator size="small" color="#F59E0B" />
                    ) : (
                        <WifiOff size={16} color="#EF4444" />
                    )}
                </View>
            </View>

            {/* 搜索框 */}
            <View style={styles.searchContainer}>
                <View style={styles.searchBox}>
                    <Search size={18} color="#A1A1AA" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="搜索联系人 / 聊天记录"
                        placeholderTextColor="#A1A1AA"
                        value={searchText}
                        onChangeText={setSearchText}
                    />
                </View>
            </View>

            {/* Tabs */}
            <View style={styles.tabs}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'conversations' && styles.tabActive]}
                    onPress={() => setActiveTab('conversations')}
                >
                    <Text style={[styles.tabText, activeTab === 'conversations' && styles.tabTextActive]}>
                        会话列表
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'notifications' && styles.tabActive]}
                    onPress={() => setActiveTab('notifications')}
                >
                    <Text style={[styles.tabText, activeTab === 'notifications' && styles.tabTextActive]}>
                        系统通知
                    </Text>
                    {unreadNotificationCount > 0 && <View style={styles.tabDot} />}
                </TouchableOpacity>
            </View>

            {/* 内容列表 */}
            <ScrollView
                style={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
            >
                {activeTab === 'conversations' ? (
                    conversations.length === 0 ? (
                        renderEmptyConversations()
                    ) : (
                        conversations.map(renderConversationCard)
                    )
                ) : (
                    notifications.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyIcon}>🔔</Text>
                            <Text style={styles.emptyText}>暂无通知</Text>
                        </View>
                    ) : (
                        notifications.map(renderNotificationCard)
                    )
                )}

                <View style={styles.footerSpacer} />
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'ios' ? 12 : 44,
        paddingBottom: 16,
        backgroundColor: '#FFFFFF',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#09090B',
    },
    connectionStatus: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#F4F4F5',
        alignItems: 'center',
        justifyContent: 'center',
    },
    // 搜索框
    searchContainer: {
        paddingHorizontal: 20,
        paddingBottom: 12,
    },
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F4F4F5',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 4,
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        fontSize: 14,
        color: '#09090B',
    },
    // Tabs
    tabs: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#F4F4F5',
    },
    tab: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        marginRight: 24,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    tabActive: {
        borderBottomColor: '#09090B',
    },
    tabText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#A1A1AA',
    },
    tabTextActive: {
        color: '#09090B',
        fontWeight: '600',
    },
    tabDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#EF4444',
        marginLeft: 4,
    },
    // 内容区
    content: {
        flex: 1,
    },
    footerSpacer: {
        height: 20,
    },
    // 会话卡片
    conversationCard: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#F4F4F5',
    },
    avatarContainer: {
        position: 'relative',
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#E5E7EB',
    },
    onlineDot: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#22C55E',
        borderWidth: 2,
        borderColor: '#FFFFFF',
    },
    conversationContent: {
        flex: 1,
        marginLeft: 12,
    },
    conversationHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    conversationName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#09090B',
        marginRight: 8,
    },
    roleBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    roleBadgeText: {
        fontSize: 10,
        fontWeight: '600',
    },
    conversationTime: {
        fontSize: 12,
        color: '#A1A1AA',
    },
    conversationFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    lastMessage: {
        flex: 1,
        fontSize: 13,
        color: '#71717A',
        marginRight: 8,
    },
    unreadBadge: {
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: PRIMARY_GOLD,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 5,
    },
    unreadBadgeText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    // 通知卡片
    notificationCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F4F4F5',
    },
    notificationCardUnread: {
        backgroundColor: '#FAFAFA',
    },
    notificationIcon: {
        width: 40,
        height: 40,
        borderRadius: 8,
        backgroundColor: '#F4F4F5',
        alignItems: 'center',
        justifyContent: 'center',
    },
    notificationContent: {
        flex: 1,
        marginLeft: 12,
    },
    notificationHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    notificationTitle: {
        fontSize: 14,
        fontWeight: '500',
        color: '#09090B',
    },
    notificationTitleUnread: {
        fontWeight: '600',
    },
    notificationTime: {
        fontSize: 12,
        color: '#A1A1AA',
    },
    notificationText: {
        fontSize: 13,
        color: '#71717A',
        lineHeight: 18,
    },
    // 空状态
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 80,
    },
    emptyIcon: {
        fontSize: 48,
        marginBottom: 16,
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#71717A',
        marginBottom: 4,
    },
    emptySubtext: {
        fontSize: 14,
        color: '#A1A1AA',
    },
});

export default MessageScreen;
