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
    Alert,
    Platform,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft, Plus, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react-native';
import { afterSalesApi } from '../services/api';
import { RootStackParamList } from '../navigation/AppNavigator';

type AfterSalesScreenRouteProp = RouteProp<RootStackParamList, 'AfterSales'>;
type AfterSalesScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

// 状态配置
const STATUS_CONFIG = {
    0: { label: '待处理', color: '#F59E0B', bgColor: '#FFFBEB', icon: Clock },
    1: { label: '处理中', color: '#3B82F6', bgColor: '#EFF6FF', icon: AlertCircle },
    2: { label: '已完成', color: '#10B981', bgColor: '#ECFDF5', icon: CheckCircle },
    3: { label: '已拒绝', color: '#EF4444', bgColor: '#FEF2F2', icon: XCircle },
};

// Tab 配置
const TABS = [
    { key: 'all' as const, label: '全部' },
    { key: 'pending' as const, label: '待处理' },
    { key: 'processing' as const, label: '处理中' },
    { key: 'completed' as const, label: '已完成' },
];

// 售后类型
const TYPE_LABELS: { [key: string]: string } = {
    refund: '退款',
    complaint: '投诉',
    repair: '返修',
};

interface AfterSalesItem {
    id: number;
    bookingId: number;
    orderNo: string;
    type: string;
    reason: string;
    description: string;
    amount: number;
    status: number;
    reply: string;
    createdAt: string;
    resolvedAt: string | null;
}

const AfterSalesScreen = () => {
    const navigation = useNavigation<AfterSalesScreenNavigationProp>();
    const route = useRoute<AfterSalesScreenRouteProp>();

    const initialTab = route.params?.tab || 'all';

    const [activeTab, setActiveTab] = useState<typeof TABS[number]['key']>(initialTab);
    const [items, setItems] = useState<AfterSalesItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // 加载数据
    const loadData = useCallback(async (showLoading = true) => {
        if (showLoading) setIsLoading(true);

        try {
            // 根据 tab 确定状态参数
            let params: { status?: number } = {};
            if (activeTab === 'pending') params.status = 0;
            else if (activeTab === 'processing') params.status = 1;
            else if (activeTab === 'completed') params.status = 2;

            const response = await afterSalesApi.list(params);
            const data = response?.data || response || [];

            // 如果是"已完成"，也包括已拒绝的
            if (activeTab === 'completed') {
                setItems(data.filter((item: AfterSalesItem) => item.status === 2 || item.status === 3));
            } else {
                setItems(data);
            }
        } catch (error) {
            console.error('Failed to load after-sales:', error);
            setItems([]);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [activeTab]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleRefresh = () => {
        setIsRefreshing(true);
        loadData(false);
    };

    // 取消售后申请
    const handleCancel = (item: AfterSalesItem) => {
        if (item.status !== 0 && item.status !== 1) return;

        Alert.alert(
            '取消申请',
            '确定要取消此售后申请吗？',
            [
                { text: '再想想', style: 'cancel' },
                {
                    text: '确认取消',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await afterSalesApi.cancel(item.id);
                            Alert.alert('提示', '申请已取消');
                            loadData(false);
                        } catch (error: any) {
                            Alert.alert('错误', error?.response?.data?.message || '操作失败');
                        }
                    },
                },
            ]
        );
    };

    // 渲染列表项
    const renderItem = ({ item }: { item: AfterSalesItem }) => {
        const statusConfig = STATUS_CONFIG[item.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG[0];
        const StatusIcon = statusConfig.icon;
        const createdDate = new Date(item.createdAt).toLocaleDateString('zh-CN');

        return (
            <View style={styles.card}>
                {/* 头部 */}
                <View style={styles.cardHeader}>
                    <View>
                        <Text style={styles.orderNo}>售后单号: {item.orderNo}</Text>
                        <Text style={styles.date}>{createdDate}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
                        <StatusIcon size={12} color={statusConfig.color} />
                        <Text style={[styles.statusText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
                    </View>
                </View>

                {/* 内容 */}
                <View style={styles.cardContent}>
                    <View style={styles.typeRow}>
                        <View style={styles.typeBadge}>
                            <Text style={styles.typeText}>{TYPE_LABELS[item.type] || item.type}</Text>
                        </View>
                        {item.amount > 0 && (
                            <Text style={styles.amount}>¥{item.amount}</Text>
                        )}
                    </View>
                    <Text style={styles.reason} numberOfLines={2}>{item.reason}</Text>
                    {item.reply && (
                        <View style={styles.replyBox}>
                            <Text style={styles.replyLabel}>客服回复：</Text>
                            <Text style={styles.replyText}>{item.reply}</Text>
                        </View>
                    )}
                </View>

                {/* 操作按钮 */}
                {(item.status === 0 || item.status === 1) && (
                    <View style={styles.cardFooter}>
                        <TouchableOpacity
                            style={styles.cancelBtn}
                            onPress={() => handleCancel(item)}
                        >
                            <Text style={styles.cancelBtnText}>取消申请</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        );
    };

    // 空状态
    const renderEmpty = () => (
        <View style={styles.emptyContainer}>
            <View style={styles.emptyIcon}>
                <AlertCircle size={48} color="#D4D4D8" />
            </View>
            <Text style={styles.emptyTitle}>暂无售后记录</Text>
            <Text style={styles.emptySubtitle}>如遇问题，可在订单详情中申请售后</Text>
        </View>
    );

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
                <Text style={styles.headerTitle}>售后服务</Text>
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

            {/* List */}
            {isLoading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#09090B" />
                </View>
            ) : (
                <FlatList
                    data={items}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderItem}
                    contentContainerStyle={items.length === 0 ? styles.emptyList : styles.listContent}
                    ListEmptyComponent={renderEmpty}
                    refreshControl={
                        <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
                    }
                    showsVerticalScrollIndicator={false}
                />
            )}
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
        paddingTop: Platform.OS === 'android' ? 48 : 12,
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

    // Card
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        marginBottom: 12,
        overflow: 'hidden',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F4F4F5',
    },
    orderNo: {
        fontSize: 14,
        fontWeight: '600',
        color: '#09090B',
    },
    date: {
        fontSize: 12,
        color: '#A1A1AA',
        marginTop: 2,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '500',
    },
    cardContent: {
        padding: 16,
    },
    typeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    typeBadge: {
        backgroundColor: '#F4F4F5',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    typeText: {
        fontSize: 12,
        color: '#52525B',
        fontWeight: '500',
    },
    amount: {
        fontSize: 16,
        fontWeight: '700',
        color: '#EF4444',
    },
    reason: {
        fontSize: 14,
        color: '#52525B',
        lineHeight: 20,
    },
    replyBox: {
        marginTop: 12,
        padding: 12,
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
    },
    replyLabel: {
        fontSize: 12,
        color: '#71717A',
        marginBottom: 4,
    },
    replyText: {
        fontSize: 13,
        color: '#374151',
        lineHeight: 18,
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        padding: 12,
        paddingTop: 0,
    },
    cancelBtn: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#E4E4E7',
    },
    cancelBtnText: {
        fontSize: 13,
        color: '#71717A',
        fontWeight: '500',
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

export default AfterSalesScreen;
