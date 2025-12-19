import React, { useState } from 'react';
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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
    Search,
    Bell,
    FileText,
    CheckCheck,
    Circle,
} from 'lucide-react-native';

// 主色调
const PRIMARY_GOLD = '#D4AF37';

// 会话数据类型
interface Conversation {
    id: string;
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

// Mock 会话数据
const MOCK_CONVERSATIONS: Conversation[] = [
    {
        id: '1',
        name: '张设计师',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100',
        role: 'designer',
        roleLabel: '设计师',
        lastMessage: '新的平面布局方案已经发给您了，请查收',
        time: '10:42',
        unreadCount: 2,
        isOnline: true,
        isRead: false,
    },
    {
        id: '2',
        name: '李工长',
        avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100',
        role: 'manager',
        roleLabel: '工长',
        lastMessage: '水电验收将在明天下午2点开始，请确认时...',
        time: '昨天',
        unreadCount: 0,
        isOnline: false,
        isRead: false,
    },
    {
        id: '3',
        name: '王师傅',
        avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100',
        role: 'worker',
        roleLabel: '工人',
        lastMessage: '您的第一期款项已确认到账。',
        time: '周一',
        unreadCount: 0,
        isOnline: true,
        isRead: true,
    },
    {
        id: '4',
        name: '美家装饰',
        avatar: 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=100',
        role: 'company',
        roleLabel: '公司',
        lastMessage: '感谢您选择我们，期待为您服务！',
        time: '12/15',
        unreadCount: 0,
        isOnline: false,
        isRead: true,
    },
];

// Mock 系统通知数据
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
    {
        id: '4',
        type: 'system',
        title: '账户安全提醒',
        content: '检测到您的账户在新设备登录，如非本人操作请及时修改密码。',
        time: '1周前',
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

const MessageScreen: React.FC = () => {
    const navigation = useNavigation();
    const [activeTab, setActiveTab] = useState<'conversations' | 'notifications'>('conversations');
    const [refreshing, setRefreshing] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [conversations, setConversations] = useState(MOCK_CONVERSATIONS);
    const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);

    const onRefresh = () => {
        setRefreshing(true);
        setTimeout(() => setRefreshing(false), 1000);
    };

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
    const renderConversationCard = (conversation: Conversation) => {
        const roleColor = ROLE_COLORS[conversation.role] || ROLE_COLORS.designer;

        return (
            <TouchableOpacity
                key={conversation.id}
                style={styles.conversationCard}
                onPress={() => (navigation as any).navigate('ChatRoom', { conversation })}
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
                <Text style={styles.headerTitle}>消息中心</Text>
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
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyIcon}>💬</Text>
                            <Text style={styles.emptyText}>暂无会话</Text>
                            <Text style={styles.emptySubtext}>开始咨询服务商吧</Text>
                        </View>
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

                <View style={{ height: 20 }} />
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
