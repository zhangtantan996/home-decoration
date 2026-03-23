import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
} from 'react-native';
import {
    Bell,
    BellOff,
    CheckCheck,
    Trash2,
    ChevronRight,
} from 'lucide-react-native';
import { notificationApi } from '../services/api';
import { notificationRealtimeService } from '../services/notificationRealtimeService';
import { useToast } from '../components/Toast';
import { formatServerRelativeTime } from '../utils/serverTime';

const PRIMARY_GOLD = '#D4AF37';

interface Notification {
    id: number;
    title: string;
    content: string;
    type: string;
    relatedId: number;
    relatedType: string;
    isRead: boolean;
    actionUrl: string;
    createdAt: string;
}

const NotificationScreen = ({ navigation }: any) => {
    const { showToast, showConfirm } = useToast();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [total, setTotal] = useState(0);

    // 加载通知列表
    const loadNotifications = useCallback(async (pageNum: number = 1, isRefresh: boolean = false) => {
        try {
            if (isRefresh) {
                setRefreshing(true);
            } else if (pageNum === 1) {
                setLoading(true);
            }

            const res = await notificationApi.list({ page: pageNum, pageSize: 20 });
            const { list, total: totalCount } = res.data;

            if (isRefresh || pageNum === 1) {
                setNotifications(list);
            } else {
                setNotifications(prev => [...prev, ...list]);
            }

            setTotal(totalCount);
            setHasMore(list.length >= 20);
            setPage(pageNum);
        } catch (error: any) {
            showToast({
                type: 'error',
                message: error.response?.data?.message || '加载通知失败',
            });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [showToast]);

    useEffect(() => {
        void loadNotifications(1);
    }, [loadNotifications]);

    useEffect(() => {
        return notificationRealtimeService.subscribe((event) => {
            if (
                event.type === 'notification.new'
                || event.type === 'notification.read'
                || event.type === 'notification.delete'
                || event.type === 'notification.all_read'
                || event.type === 'notification.init'
                || event.type === 'notification.unread_count'
            ) {
                void loadNotifications(1, true);
            }
        });
    }, [loadNotifications]);

    // 下拉刷新
    const handleRefresh = () => {
        loadNotifications(1, true);
    };

    // 加载更多
    const handleLoadMore = () => {
        if (!loading && hasMore) {
            loadNotifications(page + 1);
        }
    };

    // 标记单个通知为已读
    const handleMarkAsRead = async (id: number) => {
        try {
            await notificationApi.markAsRead(id);
            setNotifications(prev =>
                prev.map(item =>
                    item.id === id ? { ...item, isRead: true } : item
                )
            );
        } catch (error: any) {
            showToast({
                type: 'error',
                message: error.response?.data?.message || '操作失败',
            });
        }
    };

    // 标记全部已读
    const handleMarkAllAsRead = () => {
        showConfirm({
            title: '确认操作',
            message: '确定要标记全部通知为已读吗？',
            confirmText: '确定',
            cancelText: '取消',
            onConfirm: async () => {
                try {
                    await notificationApi.markAllAsRead();
                    setNotifications(prev =>
                        prev.map(item => ({ ...item, isRead: true }))
                    );
                    showToast({
                        type: 'success',
                        message: '全部已标记为已读',
                    });
                } catch (error: any) {
                    showToast({
                        type: 'error',
                        message: error.response?.data?.message || '操作失败',
                    });
                }
            },
        });
    };

    // 删除通知
    const handleDelete = (id: number) => {
        showConfirm({
            title: '确认删除',
            message: '确定要删除这条通知吗？',
            confirmText: '删除',
            cancelText: '取消',
            onConfirm: async () => {
                try {
                    await notificationApi.delete(id);
                    setNotifications(prev => prev.filter(item => item.id !== id));
                    setTotal(prev => prev - 1);
                    showToast({
                        type: 'success',
                        message: '删除成功',
                    });
                } catch (error: any) {
                    showToast({
                        type: 'error',
                        message: error.response?.data?.message || '删除失败',
                    });
                }
            },
        });
    };

    // 点击通知跳转
    const handleNotificationPress = async (item: Notification) => {
        // 标记为已读
        if (!item.isRead) {
            await handleMarkAsRead(item.id);
        }

        // 根据通知类型跳转
        if (item.relatedType === 'booking' && item.relatedId) {
            navigation.navigate('BookingDetail', { id: item.relatedId });
        } else if (item.relatedType === 'proposal' && item.relatedId) {
            navigation.navigate('ProposalDetail', { id: item.relatedId });
        } else if (item.relatedType === 'order' && item.relatedId) {
            navigation.navigate('OrderDetail', { id: item.relatedId });
        }
    };

    // 格式化时间
    const formatTime = (dateString: string) => {
        return formatServerRelativeTime(dateString, '刚刚');
    };

    // 渲染通知项
    const renderItem = ({ item }: { item: Notification }) => (
        <TouchableOpacity
            style={[styles.notificationItem, !item.isRead && styles.unreadItem]}
            onPress={() => handleNotificationPress(item)}
            activeOpacity={0.7}
        >
            <View style={styles.iconContainer}>
                {item.isRead ? (
                    <BellOff size={24} color="#A1A1AA" />
                ) : (
                    <Bell size={24} color={PRIMARY_GOLD} />
                )}
            </View>
            <View style={styles.contentContainer}>
                <View style={styles.headerRow}>
                    <Text style={[styles.title, !item.isRead && styles.unreadTitle]}>
                        {item.title}
                    </Text>
                    {!item.isRead && <View style={styles.redDot} />}
                </View>
                <Text style={styles.content} numberOfLines={2}>
                    {item.content}
                </Text>
                <Text style={styles.time}>{formatTime(item.createdAt)}</Text>
            </View>
            <TouchableOpacity
                style={styles.deleteBtn}
                onPress={(e) => {
                    e.stopPropagation();
                    handleDelete(item.id);
                }}
            >
                <Trash2 size={18} color="#A1A1AA" />
            </TouchableOpacity>
        </TouchableOpacity>
    );

    // 渲染空状态
    const renderEmpty = () => (
        <View style={styles.emptyContainer}>
            <Bell size={64} color="#D4D4D8" />
            <Text style={styles.emptyText}>暂无通知</Text>
        </View>
    );

    // 渲染底部加载
    const renderFooter = () => {
        if (!hasMore) {
            return (
                <View style={styles.footerContainer}>
                    <Text style={styles.footerText}>没有更多了</Text>
                </View>
            );
        }
        if (loading && page > 1) {
            return (
                <View style={styles.footerContainer}>
                    <ActivityIndicator size="small" color={PRIMARY_GOLD} />
                </View>
            );
        }
        return null;
    };

    const unreadCount = notifications.filter(n => !n.isRead).length;

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>通知</Text>
                {unreadCount > 0 && (
                    <TouchableOpacity
                        style={styles.markAllBtn}
                        onPress={handleMarkAllAsRead}
                    >
                        <CheckCheck size={18} color={PRIMARY_GOLD} />
                        <Text style={styles.markAllText}>全部已读</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Notification List */}
            {loading && page === 1 ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={PRIMARY_GOLD} />
                </View>
            ) : (
                <FlatList
                    data={notifications}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id.toString()}
                    ListEmptyComponent={renderEmpty}
                    ListFooterComponent={renderFooter}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={handleRefresh}
                            tintColor={PRIMARY_GOLD}
                        />
                    }
                    onEndReached={handleLoadMore}
                    onEndReachedThreshold={0.3}
                    showsVerticalScrollIndicator={false}
                />
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F4F4F5',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E4E4E7',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#18181B',
    },
    markAllBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    markAllText: {
        fontSize: 14,
        color: PRIMARY_GOLD,
        fontWeight: '500',
    },
    notificationItem: {
        flexDirection: 'row',
        backgroundColor: '#FFF',
        padding: 16,
        marginHorizontal: 12,
        marginTop: 12,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    unreadItem: {
        backgroundColor: '#FFFBF0',
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F4F4F5',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    contentContainer: {
        flex: 1,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    title: {
        fontSize: 16,
        fontWeight: '500',
        color: '#52525B',
        flex: 1,
    },
    unreadTitle: {
        color: '#18181B',
        fontWeight: '600',
    },
    content: {
        fontSize: 14,
        color: '#71717A',
        lineHeight: 20,
        marginBottom: 8,
    },
    time: {
        fontSize: 12,
        color: '#A1A1AA',
    },
    redDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#EF4444',
        marginLeft: 8,
    },
    deleteBtn: {
        padding: 8,
        justifyContent: 'center',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 100,
    },
    emptyText: {
        fontSize: 16,
        color: '#A1A1AA',
        marginTop: 16,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    footerContainer: {
        paddingVertical: 16,
        alignItems: 'center',
    },
    footerText: {
        fontSize: 14,
        color: '#A1A1AA',
    },
});

export default NotificationScreen;
