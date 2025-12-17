import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
} from 'react-native';

interface Message {
    id: number;
    type: 'system' | 'project' | 'chat';
    title: string;
    content: string;
    time: string;
    read: boolean;
    avatar?: string;
}

const MOCK_MESSAGES: Message[] = [
    {
        id: 1,
        type: 'system',
        title: '系统通知',
        content: '恭喜您成功注册装修设计一体化平台！',
        time: '刚刚',
        read: false,
    },
    {
        id: 2,
        type: 'project',
        title: '项目进度更新',
        content: '您的项目「西溪诚园 A栋1201」已进入水电阶段',
        time: '2小时前',
        read: false,
    },
    {
        id: 3,
        type: 'chat',
        title: '张设计师',
        content: '您好，方案已经修改好了，请查收~',
        time: '昨天',
        read: true,
        avatar: '张',
    },
    {
        id: 4,
        type: 'project',
        title: '验收提醒',
        content: '水电隐蔽工程即将完工，请准备验收',
        time: '3天前',
        read: true,
    },
];

const MessageScreen: React.FC = () => {
    const [messages, setMessages] = useState<Message[]>(MOCK_MESSAGES);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');

    const onRefresh = () => {
        setRefreshing(true);
        // 模拟刷新
        setTimeout(() => {
            setRefreshing(false);
        }, 1000);
    };

    const filteredMessages = activeTab === 'unread'
        ? messages.filter(m => !m.read)
        : messages;

    const unreadCount = messages.filter(m => !m.read).length;

    const markAsRead = (id: number) => {
        setMessages(prev =>
            prev.map(m => m.id === id ? { ...m, read: true } : m)
        );
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'system': return '🔔';
            case 'project': return '🏗️';
            case 'chat': return '💬';
            default: return '📬';
        }
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'system': return '#1890FF';
            case 'project': return '#52C41A';
            case 'chat': return '#722ED1';
            default: return '#999';
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* 顶部标签 */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>消息</Text>
                <TouchableOpacity>
                    <Text style={styles.clearBtn}>全部已读</Text>
                </TouchableOpacity>
            </View>

            {/* 筛选标签 */}
            <View style={styles.tabs}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'all' && styles.tabActive]}
                    onPress={() => setActiveTab('all')}
                >
                    <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>
                        全部
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'unread' && styles.tabActive]}
                    onPress={() => setActiveTab('unread')}
                >
                    <Text style={[styles.tabText, activeTab === 'unread' && styles.tabTextActive]}>
                        未读 {unreadCount > 0 && `(${unreadCount})`}
                    </Text>
                </TouchableOpacity>
            </View>

            {/* 消息列表 */}
            <ScrollView
                style={styles.content}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
            >
                {filteredMessages.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyIcon}>📭</Text>
                        <Text style={styles.emptyText}>暂无消息</Text>
                    </View>
                ) : (
                    filteredMessages.map((message) => (
                        <TouchableOpacity
                            key={message.id}
                            style={[
                                styles.messageCard,
                                !message.read && styles.messageCardUnread
                            ]}
                            onPress={() => markAsRead(message.id)}
                        >
                            <View style={[
                                styles.avatar,
                                { backgroundColor: getTypeColor(message.type) + '20' }
                            ]}>
                                {message.avatar ? (
                                    <Text style={[styles.avatarText, { color: getTypeColor(message.type) }]}>
                                        {message.avatar}
                                    </Text>
                                ) : (
                                    <Text style={styles.avatarIcon}>
                                        {getTypeIcon(message.type)}
                                    </Text>
                                )}
                            </View>
                            <View style={styles.messageContent}>
                                <View style={styles.messageHeader}>
                                    <Text style={styles.messageTitle}>{message.title}</Text>
                                    <Text style={styles.messageTime}>{message.time}</Text>
                                </View>
                                <Text
                                    style={styles.messageText}
                                    numberOfLines={2}
                                >
                                    {message.content}
                                </Text>
                            </View>
                            {!message.read && <View style={styles.unreadDot} />}
                        </TouchableOpacity>
                    ))
                )}

                <View style={{ height: 20 }} />
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F5F5',
    },
    header: {
        backgroundColor: '#fff',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
    },
    clearBtn: {
        fontSize: 14,
        color: '#1890FF',
    },
    tabs: {
        backgroundColor: '#fff',
        flexDirection: 'row',
        paddingHorizontal: 16,
    },
    tab: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        marginRight: 8,
    },
    tabActive: {
        borderBottomWidth: 2,
        borderBottomColor: '#1890FF',
    },
    tabText: {
        fontSize: 14,
        color: '#666',
    },
    tabTextActive: {
        color: '#1890FF',
        fontWeight: '600',
    },
    content: {
        flex: 1,
        padding: 16,
    },
    emptyContainer: {
        paddingVertical: 60,
        alignItems: 'center',
    },
    emptyIcon: {
        fontSize: 48,
        marginBottom: 16,
    },
    emptyText: {
        fontSize: 14,
        color: '#999',
    },
    messageCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    messageCardUnread: {
        backgroundColor: '#F0F7FF',
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        fontSize: 18,
        fontWeight: '600',
    },
    avatarIcon: {
        fontSize: 20,
    },
    messageContent: {
        flex: 1,
        marginLeft: 12,
    },
    messageHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    messageTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#333',
    },
    messageTime: {
        fontSize: 12,
        color: '#999',
    },
    messageText: {
        fontSize: 14,
        color: '#666',
        lineHeight: 20,
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#FF4D4F',
        marginLeft: 8,
        marginTop: 4,
    },
});

export default MessageScreen;
