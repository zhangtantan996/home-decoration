import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    TouchableOpacity,
    FlatList,
    ActivityIndicator,
    RefreshControl,
    Image,
    Alert,
    Modal,
    Animated,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft, Clock, CheckCircle, MapPin, Calendar, CreditCard, AlertTriangle, X } from 'lucide-react-native';
import { bookingApi, orderApi } from '../services/api';
import { RootStackParamList } from '../navigation/AppNavigator';
import CancelOrderModal from '../components/CancelOrderModal';
import InfoModal from '../components/InfoModal';
import { formatServerDate, getServerTimeMs } from '../utils/serverTime';

type OrderListScreenRouteProp = RouteProp<RootStackParamList, 'OrderList'>;
type OrderListScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

// 订单状态映射
const ORDER_STATUS = {
    pending_payment: { label: '待付款', color: '#F59E0B', bgColor: '#FFFBEB' },
    pending: { label: '待确认', color: '#3B82F6', bgColor: '#EFF6FF' },
    confirmed: { label: '已确认', color: '#10B981', bgColor: '#ECFDF5' },
    in_progress: { label: '进行中', color: '#8B5CF6', bgColor: '#F5F3FF' },
    completed: { label: '已完成', color: '#6B7280', bgColor: '#F3F4F6' },
    cancelled: { label: '已取消', color: '#EF4444', bgColor: '#FEF2F2' },
};

// Tab 配置
const TABS = [
    { key: 'all' as const, label: '全部' },
    { key: 'pending_payment' as const, label: '待付款' },
    { key: 'pending' as const, label: '待确认' },
    { key: 'in_progress' as const, label: '已完成' },
    { key: 'to_review' as const, label: '待评价' },
    { key: 'cancelled' as const, label: '已取消' },
];

interface Booking {
    id: number;
    providerId: number;
    providerType: string;
    address: string;
    area: number;
    renovationType: string;
    budgetRange: string;
    preferredDate: string;
    houseLayout: string;
    status: number;
    intentFee: number;
    intentFeePaid: boolean;
    createdAt: string;
}

// 统一待付款项
interface PendingPaymentItem {
    type: 'intent_fee' | 'design_fee';
    id: number;
    orderNo: string;
    amount: number;
    providerName: string;
    address?: string;
    expireAt: string | null;
    createdAt: string;
}

const OrderListScreen = () => {
    const navigation = useNavigation<OrderListScreenNavigationProp>();
    const route = useRoute<OrderListScreenRouteProp>();

    // 从路由参数获取初始 tab
    const initialTab = route.params?.tab || 'all';

    const [activeTab, setActiveTab] = useState<typeof TABS[number]['key']>(initialTab);
    const [orders, setOrders] = useState<Booking[]>([]);
    const [pendingPayments, setPendingPayments] = useState<PendingPaymentItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Cancel Modal State
    const [cancelModalVisible, setCancelModalVisible] = useState(false);
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<Booking | null>(null);

    // Info Modal State
    const [infoModal, setInfoModal] = useState({
        visible: false,
        title: '',
        message: '',
        type: 'info' as 'success' | 'error' | 'info',
    });

    const showInfo = (title: string, message: string, type: 'success' | 'error' | 'info' = 'info') => {
        setInfoModal({ visible: true, title, message, type });
    };

    // Confirm cancel
    const handleConfirmCancel = async () => {
        if (!selectedOrder) return;

        console.log('[CancelOrder] Starting cancel for order:', selectedOrder.id);
        setCancelModalVisible(false);
        try {
            const result = await bookingApi.cancel(selectedOrder.id);
            console.log('[CancelOrder] Cancel API result:', result);
            // 刷新列表
            loadOrders(false);
            showInfo('提示', '订单已取消', 'success');
        } catch (error: any) {
            console.error('[CancelOrder] Cancel failed:', error);
            const msg = error?.response?.data?.message || '取消失败，请重试';
            showInfo('错误', msg, 'error');
        } finally {
            setSelectedOrder(null);
        }
    };

    // Confirm delete
    const handleConfirmDelete = async () => {
        if (!selectedOrder) return;

        console.log('[DeleteOrder] Starting delete for order:', selectedOrder.id);
        setDeleteModalVisible(false);
        try {
            const result = await bookingApi.delete(selectedOrder.id);
            console.log('[DeleteOrder] Delete API result:', result);
            // 刷新列表
            loadOrders(false);
            showInfo('提示', '订单已删除', 'success');
        } catch (error: any) {
            console.error('[DeleteOrder] Delete failed:', error);
            const msg = error?.response?.data?.message || '删除失败，请重试';
            showInfo('错误', msg, 'error');
        } finally {
            setSelectedOrder(null);
        }
    };

    // 获取订单状态显示
    const getOrderStatus = (order: Booking) => {
        // 优先检查是否已取消（status = 4）
        if (order.status === 4) {
            return ORDER_STATUS.cancelled;
        }

        // 待付款状态
        if (!order.intentFeePaid) {
            return ORDER_STATUS.pending_payment;
        }

        // 其他状态
        switch (order.status) {
            case 1: return ORDER_STATUS.pending;
            case 2: return ORDER_STATUS.confirmed;
            case 3: return ORDER_STATUS.completed;
            default: return ORDER_STATUS.pending;
        }
    };

    // 获取服务商类型标签
    const getProviderTypeLabel = (type: string) => {
        switch (type) {
            case 'designer': return '设计师';
            case 'company': return '装修公司';
            case 'worker': return '施工师傅';
            default: return '服务商';
        }
    };

    // 获取装修类型标签
    const getRenovationTypeLabel = (type: string) => {
        switch (type) {
            case 'new': return '新房装修';
            case 'old': return '老房翻新';
            case 'partial': return '局部改造';
            default: return type;
        }
    };

    // 加载订单数据
    const loadOrders = useCallback(async (showLoading = true) => {
        if (showLoading) setIsLoading(true);

        try {
            // 待付款 Tab 调用统一接口
            if (activeTab === 'pending_payment') {
                const res = await orderApi.listPendingPayments();
                setPendingPayments(res.data?.items || []);
                setOrders([]);
            } else {
                // 其他 Tab 继续使用原有逻辑
                let params: { paid?: boolean } = {};
                if (activeTab === 'cancelled') {
                    // 已取消：不限制付款状态
                } else if (activeTab !== 'all') {
                    params.paid = true;
                }

                const response = await bookingApi.list(params);
                let data = response?.data || response || [];

                if (activeTab === 'pending') {
                    data = data.filter((o: Booking) => o.intentFeePaid && o.status === 1);
                } else if (activeTab === 'in_progress') {
                    data = data.filter((o: Booking) => o.status === 3);
                } else if (activeTab === 'to_review') {
                    data = data.filter((o: Booking) => o.status === 3);
                } else if (activeTab === 'cancelled') {
                    data = data.filter((o: Booking) => o.status === 4);
                }

                setOrders(data);
                setPendingPayments([]);
            }
        } catch (error) {
            console.error('Failed to load orders:', error);
            setOrders([]);
            setPendingPayments([]);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [activeTab]);

    // Tab 切换时重新加载
    useEffect(() => {
        loadOrders();
    }, [loadOrders]);

    // 下拉刷新
    const handleRefresh = () => {
        setIsRefreshing(true);
        loadOrders(false);
    };

    // 点击订单卡片
    const handleOrderPress = (order: Booking) => {
        // 跳转到订单详情页
        navigation.navigate('OrderDetail', { orderId: order.id });
    };

    // 取消订单
    const handleCancelOrder = (order: Booking) => {
        setSelectedOrder(order);
        setCancelModalVisible(true);
    };

    // 删除订单
    const handleDeleteOrder = (order: Booking) => {
        setSelectedOrder(order);
        setDeleteModalVisible(true);
    };

    // 渲染订单卡片
    const renderOrderItem = ({ item }: { item: Booking }) => {
        const status = getOrderStatus(item);
        const createdDate = formatServerDate(item.createdAt);

        return (
            <TouchableOpacity
                style={styles.orderCard}
                onPress={() => handleOrderPress(item)}
                activeOpacity={0.7}
            >
                {/* 头部 */}
                <View style={styles.cardHeader}>
                    <View style={styles.orderInfo}>
                        <Text style={styles.orderId}>订单号: BK{item.id.toString().padStart(8, '0')}</Text>
                        <Text style={styles.orderDate}>{createdDate}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: status.bgColor }]}>
                        <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                    </View>
                </View>

                {/* 内容 */}
                <View style={styles.cardContent}>
                    <View style={styles.infoRow}>
                        <MapPin size={14} color="#71717A" />
                        <Text style={styles.infoText} numberOfLines={1}>{item.address}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Calendar size={14} color="#71717A" />
                        <Text style={styles.infoText}>{item.preferredDate}</Text>
                    </View>
                    <View style={styles.detailRow}>
                        <Text style={styles.detailText}>
                            {getProviderTypeLabel(item.providerType)} · {getRenovationTypeLabel(item.renovationType)} · {item.houseLayout || '未设置户型'}
                        </Text>
                    </View>
                </View>

                {/* 底部 */}
                <View style={styles.cardFooter}>
                    <View style={styles.priceRow}>
                        <Text style={styles.priceLabel}>意向金</Text>
                        <Text style={styles.priceValue}>¥{item.intentFee}</Text>
                    </View>
                    {!item.intentFeePaid && item.status !== 4 && (
                        <View style={styles.buttonRow}>
                            <TouchableOpacity
                                style={styles.cancelButton}
                                onPress={() => handleCancelOrder(item)}
                            >
                                <Text style={styles.cancelButtonText}>取消订单</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.payButton}
                                onPress={() => handleOrderPress(item)}
                            >
                                <Text style={styles.payButtonText}>立即付款</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                    {item.status === 4 && (
                        <TouchableOpacity
                            style={styles.deleteButton}
                            onPress={() => handleDeleteOrder(item)}
                        >
                            <Text style={styles.deleteButtonText}>删除订单</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    // 渲染待付款项
    const renderPendingPaymentItem = ({ item }: { item: PendingPaymentItem }) => {
        const isIntentFee = item.type === 'intent_fee';
        const countdown = getCountdown(item.expireAt);

        return (
            <TouchableOpacity
                style={styles.orderCard}
                onPress={() => handlePendingPaymentPress(item)}
                activeOpacity={0.7}
            >
                <View style={styles.cardHeader}>
                    <View style={styles.orderInfo}>
                        <Text style={styles.orderId}>订单号: {item.orderNo}</Text>
                        <Text style={styles.orderDate}>
                            {formatServerDate(item.createdAt)}
                        </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: '#FFFBEB' }]}>
                        <Text style={[styles.statusText, { color: '#F59E0B' }]}>
                            {isIntentFee ? '意向金' : '设计费'}
                        </Text>
                    </View>
                </View>

                <View style={styles.cardContent}>
                    <View style={styles.infoRow}>
                        <CreditCard size={14} color="#71717A" />
                        <Text style={styles.infoText}>
                            {isIntentFee ? '意向金待支付' : '设计费待支付'}
                        </Text>
                    </View>
                    <View style={styles.infoRow}>
                        <MapPin size={14} color="#71717A" />
                        <Text style={styles.infoText} numberOfLines={1}>
                            {item.providerName || item.address || '服务商'}
                        </Text>
                    </View>
                    {countdown && (
                        <View style={styles.detailRow}>
                            <Text style={[styles.detailText, countdown === '已过期' && { color: '#EF4444' }]}>
                                {countdown}
                            </Text>
                        </View>
                    )}
                </View>

                <View style={styles.cardFooter}>
                    <View style={styles.priceRow}>
                        <Text style={styles.priceLabel}>待付金额</Text>
                        <Text style={styles.priceValue}>¥{item.amount}</Text>
                    </View>
                    <TouchableOpacity
                        style={styles.payButton}
                        onPress={() => handlePendingPaymentPress(item)}
                    >
                        <Text style={styles.payButtonText}>立即支付</Text>
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        );
    };

    // 计算倒计时
    const getCountdown = (expireAt: string | null) => {
        if (!expireAt) return null;
        const expire = getServerTimeMs(expireAt);
        const now = Date.now();
        const diff = expire - now;
        if (diff <= 0) return '已过期';

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        return `剩余 ${hours}:${String(minutes).padStart(2, '0')}`;
    };

    // 点击待付款项
    const handlePendingPaymentPress = (item: PendingPaymentItem) => {
        if (item.type === 'intent_fee') {
            navigation.navigate('Payment', { bookingId: item.id, amount: item.amount });
        } else if (item.type === 'design_fee') {
            navigation.navigate('DesignFeePayment', { orderId: item.id });
        }
    };

    // 空状态
    const renderEmpty = () => (
        <View style={styles.emptyContainer}>
            <View style={styles.emptyIcon}>
                <CreditCard size={48} color="#D4D4D8" />
            </View>
            <Text style={styles.emptyTitle}>暂无订单</Text>
            <Text style={styles.emptySubtitle}>
                {activeTab === 'pending_payment' ? '没有待付款的订单' : '浏览服务商并预约服务吧'}
            </Text>
        </View>
    );

    // 获取当前数据和渲染方法
    const getCurrentData = () => {
        if (activeTab === 'pending_payment') {
            return pendingPayments;
        }
        return orders;
    };

    const getCurrentRenderItem = () => {
        if (activeTab === 'pending_payment') {
            return renderPendingPaymentItem as any;
        }
        return renderOrderItem;
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backBtn}
                    hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                >
                    <ArrowLeft size={24} color="#09090B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>我的订单</Text>
                <View style={styles.placeholder} />
            </View>

            {/* Tabs */}
            <View style={styles.tabContainer}>
                {TABS.map(tab => (
                    <TouchableOpacity
                        key={tab.key}
                        style={[styles.tabItem, activeTab === tab.key && styles.tabItemActive]}
                        onPress={() => setActiveTab(tab.key)}
                    >
                        <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                            {tab.label}
                        </Text>
                        {activeTab === tab.key && <View style={styles.tabIndicator} />}
                    </TouchableOpacity>
                ))}
            </View>

            {/* Order List */}
            {isLoading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#09090B" />
                </View>
            ) : (
                <FlatList
                    data={getCurrentData() as any[]}
                    keyExtractor={(item) => `${activeTab}-${item.id}`}
                    renderItem={getCurrentRenderItem()}
                    contentContainerStyle={getCurrentData().length === 0 ? styles.emptyList : styles.listContent}
                    ListEmptyComponent={renderEmpty}
                    refreshControl={
                        <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
                    }
                    showsVerticalScrollIndicator={false}
                />
            )}

            <CancelOrderModal
                visible={cancelModalVisible}
                onClose={() => setCancelModalVisible(false)}
                onConfirm={handleConfirmCancel}
            />

            <CancelOrderModal
                visible={deleteModalVisible}
                onClose={() => setDeleteModalVisible(false)}
                onConfirm={handleConfirmDelete}
                title="删除订单"
                message="确定要删除此订单吗？删除后将无法恢复。"
                confirmText="确认删除"
            />

            <InfoModal
                visible={infoModal.visible}
                title={infoModal.title}
                message={infoModal.message}
                type={infoModal.type}
                onClose={() => setInfoModal(prev => ({ ...prev, visible: false }))}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F5F5',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        paddingTop: 48,
        backgroundColor: '#FFFFFF',
    },
    backBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'flex-start',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#09090B',
    },
    placeholder: {
        width: 40,
    },

    // Tabs
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#F4F4F5',
    },
    tabItem: {
        flex: 1,
        paddingVertical: 14,
        alignItems: 'center',
        position: 'relative',
    },
    tabItemActive: {},
    tabText: {
        fontSize: 14,
        color: '#71717A',
        fontWeight: '500',
    },
    tabTextActive: {
        color: '#09090B',
        fontWeight: '600',
    },
    tabIndicator: {
        position: 'absolute',
        bottom: 0,
        width: 24,
        height: 2,
        backgroundColor: '#09090B',
        borderRadius: 1,
    },

    // Loading
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },

    // List
    listContent: {
        padding: 16,
    },
    emptyList: {
        flexGrow: 1,
    },

    // Order Card
    orderCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        marginBottom: 12,
        overflow: 'hidden',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F4F4F5',
    },
    orderInfo: {
        flex: 1,
    },
    orderId: {
        fontSize: 14,
        fontWeight: '600',
        color: '#09090B',
    },
    orderDate: {
        fontSize: 12,
        color: '#A1A1AA',
        marginTop: 2,
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
    },
    cardContent: {
        padding: 16,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    infoText: {
        fontSize: 14,
        color: '#52525B',
        marginLeft: 8,
        flex: 1,
    },
    detailRow: {
        marginTop: 4,
    },
    detailText: {
        fontSize: 13,
        color: '#A1A1AA',
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        paddingTop: 0,
    },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    priceLabel: {
        fontSize: 12,
        color: '#71717A',
        marginRight: 4,
    },
    priceValue: {
        fontSize: 18,
        fontWeight: '700',
        color: '#09090B',
    },
    payButton: {
        backgroundColor: '#09090B',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 6,
    },
    payButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 6,
    },
    cancelButton: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#E4E4E7',
    },
    cancelButtonText: {
        fontSize: 13,
        fontWeight: '500',
        color: '#71717A',
    },
    deleteButton: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#EF4444',
    },
    deleteButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#EF4444',
    },

    // Empty
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    emptyIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#F4F4F5',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#09090B',
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 14,
        color: '#A1A1AA',
        textAlign: 'center',
    },
});

export default OrderListScreen;
