import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    TouchableOpacity,
    ScrollView,
    Platform,
    Image,
    Modal,
} from 'react-native';
import {
    Settings,
    FileText,
    Heart,
    MapPin,
    Ticket,
    Calculator,
    ImageIcon,
    Headphones,
    Shield,
    ChevronRight,
    Info,
    ClipboardList,
    CreditCard,
    MessageSquare,
    RotateCcw,
    Banknote,
    MoreHorizontal,
    Bell,
} from 'lucide-react-native';
import { useAuthStore } from '../store/authStore';
import { useToast } from '../components/Toast';

// 主色调
const PRIMARY_GOLD = '#D4AF37';

// Mock 当前项目数据
const MOCK_PROJECT = {
    name: '上海·汤臣一品 别墅装修',
    stage: '报价阶段',
    progress: 30,
    budget: '280万',
    estimatedDays: 12,
};

const ProfileScreen = ({ navigation }: any) => {
    const { user, logout } = useAuthStore();
    const { showConfirm } = useToast();
    const [dialogVisible, setDialogVisible] = useState(false);
    const [dialogMessage, setDialogMessage] = useState('');

    const handleServicePress = (label: string) => {
        setDialogMessage(`${label}功能正在开发中，敬请期待！`);
        setDialogVisible(true);
    };

    const handleLogout = () => {
        showConfirm({
            title: '确认退出',
            message: '确定要退出登录吗？',
            confirmText: '退出',
            cancelText: '取消',
            onConfirm: logout,
        });
    };

    const [pendingCount, setPendingCount] = useState(0);
    const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

    // 加载待处理数量
    // 加载待处理数量 (方案 + 待付款)
    useEffect(() => {
        const loadPendingCount = async () => {
            try {
                const { proposalApi, orderApi } = await import('../services/api');

                // 并行请求
                const [proposalRes, paymentRes] = await Promise.all([
                    proposalApi.pendingCount().catch(() => ({ data: { count: 0 } })),
                    orderApi.listPendingPayments().catch(() => ({ data: { items: [] } }))
                ]);

                const proposalCount = (proposalRes as any).data?.count || 0;
                const paymentCount = (paymentRes as any).data?.items?.length || 0;

                setPendingCount(proposalCount + paymentCount);
            } catch (error) {
                console.log('Failed to load pending count');
            }
        };
        loadPendingCount();

        // 监听焦点变化，每次返回页面都刷新数量
        const unsubscribe = navigation.addListener('focus', loadPendingCount);
        return unsubscribe;
    }, [navigation]);

    // 加载未读通知数量
    useEffect(() => {
        const loadUnreadNotifications = async () => {
            try {
                const { notificationApi } = await import('../services/api');
                const res = await notificationApi.getUnreadCount();
                setUnreadNotificationCount(res.data?.count || 0);
            } catch (error) {
                console.log('Failed to load unread notification count');
            }
        };
        loadUnreadNotifications();

        // 监听焦点变化，每次返回页面都刷新未读数量
        const unsubscribe = navigation.addListener('focus', loadUnreadNotifications);
        return unsubscribe;
    }, [navigation]);

    // 快捷统计数据
    const quickStats = [
        { label: '我的收藏', value: 12, key: 'favorites' },
        { label: '我的项目', value: 3, key: 'projects' }, // TODO: Fetch real project count
        { label: '卡券包', value: 3, key: 'coupons' },
        { label: '待处理', value: pendingCount, hasRedDot: pendingCount > 0, key: 'pending' },
    ];

    // 订单模块
    const orderItems = [
        { icon: ClipboardList, label: '全部订单' },
        { icon: CreditCard, label: '待付款' },
        { icon: MessageSquare, label: '待评价' },
        { icon: RotateCcw, label: '售后' },
    ];

    // 更多服务
    const moreServices = [
        { icon: Calculator, label: '装修算价' },
        { icon: Banknote, label: '贷款' },
        { icon: Headphones, label: '客服' },
        { icon: MoreHorizontal, label: '其他' },
    ];

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView showsVerticalScrollIndicator={false}>
                {/* 用户信息区 */}
                <View style={styles.userSection}>
                    <View style={styles.userInfo}>
                        <View style={styles.avatar}>
                            {user?.avatar ? (
                                <Image source={{ uri: user.avatar }} style={styles.avatarImage} />
                            ) : (
                                <Text style={styles.avatarText}>
                                    {user?.nickname?.[0] || user?.phone?.[0] || '👤'}
                                </Text>
                            )}
                        </View>
                        <View style={styles.userDetails}>
                            <Text style={styles.userName}>
                                {user?.nickname || `用户${user?.phone?.slice(-4) || ''}`}
                            </Text>
                            <View style={styles.memberBadge}>
                                <Text style={styles.memberBadgeText}>BLACK MEMBER</Text>
                            </View>
                        </View>
                    </View>
                    <View style={styles.headerActions}>
                        <TouchableOpacity
                            style={styles.notificationBtn}
                            onPress={() => navigation.navigate('Notification')}
                        >
                            <Bell size={22} color="#71717A" />
                            {unreadNotificationCount > 0 && (
                                <View style={styles.notificationBadge}>
                                    <Text style={styles.notificationBadgeText}>
                                        {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                                    </Text>
                                </View>
                            )}
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.settingsBtn} onPress={() => navigation.navigate('Settings')}>
                            <Settings size={22} color="#71717A" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* 当前项目卡片 - 暂时移除 Mock 数据，等待真实数据接入 */}
                {/* <ProjectCard /> */}

                {/* 快捷统计 */}
                <View style={styles.quickStatsRow}>
                    {quickStats.map((stat, index) => (
                        <TouchableOpacity
                            key={index}
                            style={styles.quickStatItem}
                            onPress={() => {
                                if (stat.key === 'pending') {
                                    navigation.navigate('Pending');
                                } else if (stat.key === 'projects') {
                                    navigation.navigate('ProjectList');
                                } else {
                                    handleServicePress(stat.label);
                                }
                            }}
                        >
                            <View style={styles.quickStatValueContainer}>
                                <Text style={styles.quickStatValue}>{stat.value}</Text>
                                {stat.hasRedDot && <View style={styles.redDot} />}
                            </View>
                            <Text style={styles.quickStatLabel}>{stat.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* 订单模块 */}
                <View style={styles.menuCard}>
                    <Text style={styles.menuTitle}>我的订单</Text>
                    <View style={styles.menuGrid}>
                        {orderItems.map((item, index) => {
                            // 售后跳转到售后页面
                            if (item.label === '售后') {
                                return (
                                    <TouchableOpacity
                                        key={index}
                                        style={styles.menuItem}
                                        onPress={() => navigation.navigate('AfterSales', { tab: 'all' })}
                                    >
                                        <View style={styles.menuIconContainer}>
                                            <item.icon size={24} color="#09090B" />
                                        </View>
                                        <Text style={styles.menuLabel}>{item.label}</Text>
                                    </TouchableOpacity>
                                );
                            }

                            // 其他跳转到订单页面
                            const tabMapping: { [key: string]: 'all' | 'pending_payment' | 'to_review' } = {
                                '全部订单': 'all',
                                '待付款': 'pending_payment',
                                '待评价': 'to_review',
                            };
                            return (
                                <TouchableOpacity
                                    key={index}
                                    style={styles.menuItem}
                                    onPress={() => navigation.navigate('OrderList', { tab: tabMapping[item.label] || 'all' })}
                                >
                                    <View style={styles.menuIconContainer}>
                                        <item.icon size={24} color="#09090B" />
                                    </View>
                                    <Text style={styles.menuLabel}>{item.label}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                {/* 更多服务 */}
                <View style={styles.menuCard}>
                    <Text style={styles.menuTitle}>更多服务</Text>
                    <View style={styles.menuGrid}>
                        {moreServices.map((service, index) => (
                            <TouchableOpacity key={index} style={styles.menuItem} onPress={() => handleServicePress(service.label)}>
                                <View style={styles.menuIconContainer}>
                                    <service.icon size={24} color="#09090B" />
                                </View>
                                <Text style={styles.menuLabel}>{service.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>

            {/* 自定义弹窗 */}
            <Modal
                visible={dialogVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setDialogVisible(false)}
            >
                <View style={styles.dialogOverlay}>
                    <View style={styles.dialogContainer}>
                        <View style={styles.dialogIconContainer}>
                            <Info size={32} color={PRIMARY_GOLD} />
                        </View>
                        <Text style={styles.dialogTitle}>功能开发中</Text>
                        <Text style={styles.dialogMessage}>{dialogMessage}</Text>
                        <TouchableOpacity
                            style={styles.dialogBtn}
                            onPress={() => setDialogVisible(false)}
                        >
                            <Text style={styles.dialogBtnText}>知道了</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA',
    },
    // 用户信息区
    userSection: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'ios' ? 20 : 50,
        paddingBottom: 20,
        backgroundColor: '#FFFFFF',
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#E5E7EB',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    avatarImage: {
        width: 56,
        height: 56,
        borderRadius: 28,
    },
    avatarText: {
        fontSize: 24,
        color: '#71717A',
    },
    userDetails: {
        marginLeft: 14,
    },
    userName: {
        fontSize: 18,
        fontWeight: '700',
        color: '#09090B',
        marginBottom: 6,
    },
    memberBadge: {
        backgroundColor: '#1C1C1E',
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 4,
    },
    memberBadgeText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '600',
        letterSpacing: 0.5,
    },
    settingsBtn: {
        padding: 8,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    notificationBtn: {
        padding: 8,
        position: 'relative',
    },
    notificationBadge: {
        position: 'absolute',
        top: 4,
        right: 4,
        backgroundColor: '#EF4444',
        borderRadius: 10,
        minWidth: 18,
        height: 18,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
    },
    notificationBadgeText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '600',
    },
    // 项目卡片
    projectCard: {
        marginHorizontal: 16,
        marginTop: 16,
        backgroundColor: '#1C1C1E',
        borderRadius: 16,
        padding: 20,
    },
    projectHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    projectLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    projectLabel: {
        color: PRIMARY_GOLD,
        fontSize: 13,
        fontWeight: '600',
        marginLeft: 6,
    },
    viewDetailBtn: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
    },
    viewDetailText: {
        color: '#09090B',
        fontSize: 12,
        fontWeight: '600',
    },
    projectName: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 16,
    },
    progressSection: {
        marginBottom: 16,
    },
    progressLabelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    stageText: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 13,
    },
    progressBarContainer: {
        height: 6,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 3,
    },
    progressBar: {
        height: 6,
        backgroundColor: PRIMARY_GOLD,
        borderRadius: 3,
    },
    progressText: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 12,
    },
    projectStats: {
        flexDirection: 'row',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
        paddingTop: 16,
    },
    projectStatItem: {
        flex: 1,
    },
    projectStatValue: {
        color: '#FFFFFF',
        fontSize: 22,
        fontWeight: '700',
        marginBottom: 4,
    },
    projectStatLabel: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 12,
    },
    // 快捷统计
    quickStatsRow: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        marginHorizontal: 16,
        marginTop: 16,
        borderRadius: 12,
        paddingVertical: 20,
    },
    quickStatItem: {
        flex: 1,
        alignItems: 'center',
    },
    quickStatValueContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    quickStatValue: {
        fontSize: 22,
        fontWeight: '700',
        color: '#09090B',
    },
    redDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#EF4444',
        marginLeft: 2,
        marginTop: 2,
    },
    quickStatLabel: {
        fontSize: 12,
        color: '#71717A',
        marginTop: 6,
    },

    // 菜单模块 (订单 & 更多服务)
    menuCard: {
        backgroundColor: '#FFFFFF',
        marginHorizontal: 16,
        marginTop: 16,
        borderRadius: 16,
        padding: 20,
    },
    menuTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#09090B',
        marginBottom: 20,
    },
    menuGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    menuItem: {
        flex: 1,
        alignItems: 'center',
    },
    menuIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 16,
        backgroundColor: '#F8F9FA',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    menuLabel: {
        fontSize: 12,
        color: '#18181B',
        fontWeight: '500',
    },
    // 退出登录
    logoutBtn: {
        marginHorizontal: 16,
        marginTop: 32,
        backgroundColor: '#FFFFFF',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    logoutText: {
        color: '#EF4444',
        fontSize: 15,
        fontWeight: '600',
    },
    // 弹窗样式
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
        backgroundColor: '#FFFBEB',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
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
    dialogBtn: {
        width: '100%',
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
        backgroundColor: PRIMARY_GOLD,
    },
    dialogBtnText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#FFFFFF',
    },
});

export default ProfileScreen;
