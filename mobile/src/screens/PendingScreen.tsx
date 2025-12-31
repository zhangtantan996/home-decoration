import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Platform,
} from 'react-native';
import {
    ArrowLeft,
    FileText,
    Clock,
    CreditCard,
    ChevronRight,
    AlertCircle,
} from 'lucide-react-native';
import { proposalApi, orderApi } from '../services/api';
import { ProposalStatus, ProposalStatusType, getProposalStatusText } from '../types/businessFlow';

// Tab 配置
const TABS = [
    { key: 'payment' as const, label: '待付款' },
    { key: 'confirm' as const, label: '待确认' },
];

interface Proposal {
    id: number;
    bookingId: number;
    summary: string;
    designFee: number;
    constructionFee: number;
    materialFee: number;
    estimatedDays: number;
    status: number;
    createdAt: string;
}

interface PendingPayment {
    type: 'intent_fee' | 'design_fee';
    id: number;
    orderNo: string;
    amount: number;
    providerName: string;
    address?: string;
    expireAt: string | null;
    createdAt: string;
}

interface PendingScreenProps {
    navigation: any;
}

const PendingScreen: React.FC<PendingScreenProps> = ({ navigation }) => {
    const [activeTab, setActiveTab] = useState<'payment' | 'confirm'>('payment');
    const [proposals, setProposals] = useState<Proposal[]>([]);
    const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const loadData = useCallback(async () => {
        try {
            if (activeTab === 'payment') {
                const res = await orderApi.listPendingPayments();
                setPendingPayments(res.data?.items || []);
            } else {
                const res = await proposalApi.list();
                const pendingProposals = (res.data || []).filter(
                    (p: Proposal) => p.status === ProposalStatus.PENDING
                );
                setProposals(pendingProposals);
            }
        } catch (error) {
            console.error('Failed to load data:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [activeTab]);

    useEffect(() => {
        setLoading(true);
        loadData();
    }, [loadData]);

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    const formatMoney = (amount: number) => {
        return `¥${amount?.toLocaleString() || 0}`;
    };

    // 计算倒计时
    const getCountdown = (expireAt: string | null) => {
        if (!expireAt) return null;
        const expire = new Date(expireAt).getTime();
        const now = Date.now();
        const diff = expire - now;
        if (diff <= 0) return '已过期';

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        return `剩余 ${hours}:${String(minutes).padStart(2, '0')}`;
    };

    const handlePaymentPress = (item: PendingPayment) => {
        if (item.type === 'intent_fee') {
            navigation.navigate('Payment', { bookingId: item.id, amount: item.amount });
        } else if (item.type === 'design_fee') {
            navigation.navigate('DesignFeePayment', { orderId: item.id });
        }
    };

    const renderPaymentItem = ({ item }: { item: PendingPayment }) => {
        const isIntentFee = item.type === 'intent_fee';
        const countdown = getCountdown(item.expireAt);

        return (
            <TouchableOpacity
                style={styles.card}
                onPress={() => handlePaymentPress(item)}
                activeOpacity={0.7}
            >
                <View style={styles.cardHeader}>
                    <View style={[styles.cardIcon, { backgroundColor: isIntentFee ? '#EFF6FF' : '#FEF3C7' }]}>
                        <CreditCard size={20} color={isIntentFee ? '#3B82F6' : '#D97706'} />
                    </View>
                    <View style={styles.cardInfo}>
                        <Text style={styles.cardTitle}>
                            {isIntentFee ? '意向金待支付' : '设计费待支付'}
                        </Text>
                        <Text style={styles.cardSubtitle} numberOfLines={1}>
                            {item.providerName || item.address || '服务商'}
                        </Text>
                    </View>
                    <View style={styles.amountContainer}>
                        <Text style={styles.amountValue}>{formatMoney(item.amount)}</Text>
                        {countdown && (
                            <Text style={[styles.countdown, countdown === '已过期' && styles.expired]}>
                                {countdown}
                            </Text>
                        )}
                    </View>
                </View>

                <View style={styles.cardFooter}>
                    <Text style={styles.orderNo}>订单号：{item.orderNo}</Text>
                    <View style={styles.payButton}>
                        <Text style={styles.payButtonText}>立即支付</Text>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    const renderProposalItem = ({ item }: { item: Proposal }) => {
        const totalEstimate = item.designFee + item.constructionFee + item.materialFee;

        return (
            <TouchableOpacity
                style={styles.card}
                onPress={() => navigation.navigate('ProposalDetail', { proposalId: item.id })}
                activeOpacity={0.7}
            >
                <View style={styles.cardHeader}>
                    <View style={[styles.cardIcon, { backgroundColor: '#ECFDF5' }]}>
                        <FileText size={20} color="#10B981" />
                    </View>
                    <View style={styles.cardInfo}>
                        <Text style={styles.cardTitle} numberOfLines={1}>
                            {item.summary || '设计方案'}
                        </Text>
                        <Text style={styles.cardSubtitle}>
                            {new Date(item.createdAt).toLocaleDateString()}
                        </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: '#F59E0B20' }]}>
                        <Text style={[styles.statusText, { color: '#F59E0B' }]}>
                            {getProposalStatusText(item.status as ProposalStatusType)}
                        </Text>
                    </View>
                </View>

                <View style={styles.cardBody}>
                    <View style={styles.feeRow}>
                        <Text style={styles.feeLabel}>预估总费用</Text>
                        <Text style={styles.feeValue}>{formatMoney(totalEstimate)}</Text>
                    </View>
                    <View style={styles.feeRow}>
                        <Text style={styles.feeLabel}>预计工期</Text>
                        <Text style={styles.durationValue}>{item.estimatedDays}天</Text>
                    </View>
                </View>

                <View style={styles.actionFooter}>
                    <Text style={styles.actionText}>点击查看详情并确认</Text>
                    <ChevronRight size={16} color="#71717A" />
                </View>
            </TouchableOpacity>
        );
    };

    const renderEmpty = () => (
        <View style={styles.emptyContainer}>
            {activeTab === 'payment' ? (
                <>
                    <CreditCard size={48} color="#D4D4D8" />
                    <Text style={styles.emptyTitle}>暂无待付款</Text>
                    <Text style={styles.emptySubtitle}>
                        所有订单均已支付完成
                    </Text>
                </>
            ) : (
                <>
                    <Clock size={48} color="#D4D4D8" />
                    <Text style={styles.emptyTitle}>暂无待确认方案</Text>
                    <Text style={styles.emptySubtitle}>
                        设计师提交方案后，您可以在这里查看并确认
                    </Text>
                </>
            )}
        </View>
    );

    const getData = () => {
        return activeTab === 'payment' ? pendingPayments : proposals;
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ArrowLeft size={24} color="#09090B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>待处理</Text>
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

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#09090B" />
                    <Text style={styles.loadingText}>加载中...</Text>
                </View>
            ) : (
                <FlatList
                    data={getData() as any[]}
                    renderItem={activeTab === 'payment' ? renderPaymentItem as any : renderProposalItem}
                    keyExtractor={(item) => `${activeTab}-${item.id}`}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={renderEmpty}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                    }
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
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        paddingTop: Platform.OS === 'android' ? 40 : 12,
        backgroundColor: '#FFFFFF',
    },
    backBtn: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: '#09090B',
    },
    placeholder: {
        width: 40,
    },
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E4E4E7',
    },
    tabItem: {
        flex: 1,
        paddingVertical: 14,
        alignItems: 'center',
        position: 'relative',
    },
    tabItemActive: {},
    tabText: {
        fontSize: 15,
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
        width: 40,
        height: 2,
        backgroundColor: '#09090B',
        borderRadius: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: '#71717A',
    },
    listContent: {
        padding: 16,
        flexGrow: 1,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        marginBottom: 12,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
    },
    cardIcon: {
        width: 40,
        height: 40,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardInfo: {
        flex: 1,
        marginLeft: 12,
    },
    cardTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#09090B',
        marginBottom: 4,
    },
    cardSubtitle: {
        fontSize: 13,
        color: '#71717A',
    },
    amountContainer: {
        alignItems: 'flex-end',
    },
    amountValue: {
        fontSize: 18,
        fontWeight: '700',
        color: '#EF4444',
    },
    countdown: {
        fontSize: 12,
        color: '#F59E0B',
        marginTop: 2,
    },
    expired: {
        color: '#EF4444',
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '500',
    },
    cardBody: {
        paddingHorizontal: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F4F4F5',
    },
    feeRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    feeLabel: {
        fontSize: 14,
        color: '#71717A',
    },
    feeValue: {
        fontSize: 16,
        fontWeight: '700',
        color: '#EF4444',
    },
    durationValue: {
        fontSize: 14,
        fontWeight: '500',
        color: '#09090B',
    },
    cardFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: '#F4F4F5',
    },
    orderNo: {
        fontSize: 12,
        color: '#A1A1AA',
    },
    payButton: {
        backgroundColor: '#09090B',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 6,
    },
    payButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    actionFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#FAFAFA',
    },
    actionText: {
        fontSize: 13,
        color: '#71717A',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 80,
    },
    emptyTitle: {
        marginTop: 16,
        fontSize: 16,
        fontWeight: '600',
        color: '#71717A',
    },
    emptySubtitle: {
        marginTop: 8,
        fontSize: 14,
        color: '#A1A1AA',
        textAlign: 'center',
        paddingHorizontal: 40,
    },
});

export default PendingScreen;
