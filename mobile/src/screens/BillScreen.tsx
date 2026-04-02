import React, { useCallback, useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    StatusBar,
    Platform,
} from 'react-native';
import {
    ArrowLeft,
    Receipt,
    CreditCard,
    CheckCircle,
    Clock,
    FileText,
    Lock,
    Download,
} from 'lucide-react-native';
import { billApi, MobileApiError } from '../services/api';
import { useAuthStore } from '../store/authStore';
import {
    OrderStatus,
    OrderType,
    BillItem,
    getOrderStatusText,
    getOrderTypeText,
} from '../types/businessFlow';
import InfoModal from '../components/InfoModal';

interface BillScreenProps {
    route: any;
    navigation: any;
}

const BillScreen: React.FC<BillScreenProps> = ({ route, navigation }) => {
    const { projectId } = route.params;
    const activeRole = useAuthStore((state) => state.user?.activeRole);

    const [billItems, setBillItems] = useState<BillItem[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal state
    const [modalVisible, setModalVisible] = useState(false);
    const [modalConfig, setModalConfig] = useState<{
        title: string;
        message: string;
        type: 'success' | 'error' | 'info';
    }>({ title: '', message: '', type: 'info' });

    const showModal = (title: string, message: string, type: 'success' | 'error' | 'info' = 'info') => {
        setModalConfig({ title, message, type });
        setModalVisible(true);
    };

    const loadBill = useCallback(async () => {
        try {
            setLoading(true);
            const res = await billApi.get(projectId);
            setBillItems(res.data || []);
        } catch (error: any) {
            showModal('加载失败', error.message || '请稍后重试', 'error');
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    useEffect(() => {
        void loadBill();
    }, [loadBill]);

    const ownerScopeDisabled = activeRole ? !['owner', 'homeowner'].includes(activeRole) : false;

    const handlePayOrder = (_orderId: number) => {
        showModal('请前往 Web/H5 支付', '支付宝一期仅支持 Web/H5 支付，请前往浏览器打开订单页面完成支付。', 'info');
    };

    const handlePayPlan = (_planId: number) => {
        showModal('请前往 Web/H5 支付', '支付宝一期仅支持 Web/H5 支付，请前往浏览器打开订单页面完成支付。', 'info');
    };

    const handleViewFiles = async () => {
        try {
            await billApi.getFiles(projectId);
            // 成功获取（哪怕为空），跳转到列表页
            navigation.navigate('DesignFiles', { projectId });
        } catch (error: any) {
            if (error instanceof MobileApiError && error.status === 403) {
                showModal('无权限', '请先支付设计费后查看图纸', 'error');
            } else if (error instanceof MobileApiError && error.status === 409) {
                showModal('状态已变化', '请刷新后重试', 'info');
            } else {
                showModal('加载失败', error.message || '请稍后重试', 'error');
            }
        }
    };

    const formatMoney = (amount: number) => {
        return `¥${amount.toLocaleString()}`;
    };

    const getStatusColor = (status: number) => {
        switch (status) {
            case OrderStatus.PENDING:
                return '#F59E0B';
            case OrderStatus.PAID:
                return '#10B981';
            case OrderStatus.CANCELLED:
                return '#71717A';
            case OrderStatus.REFUNDED:
                return '#EF4444';
            default:
                return '#71717A';
        }
    };

    // 检查设计费是否已支付
    const isDesignFeePaid = billItems.some(
        (item) => item.order.orderType === OrderType.DESIGN && item.order.status === OrderStatus.PAID
    );

    if (ownerScopeDisabled) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>当前身份无权查看业主账单页</Text>
                    <Text style={styles.emptySubText}>请切换回业主身份后再查看账单与图纸</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#09090B" />
                    <Text style={styles.loadingText}>加载中...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ArrowLeft size={24} color="#09090B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>项目账单</Text>
                <View style={styles.placeholder} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {billItems.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Receipt size={48} color="#D4D4D8" />
                        <Text style={styles.emptyText}>暂无账单</Text>
                    </View>
                ) : (
                    <>
                        {/* 设计图纸入口 */}
                        <TouchableOpacity style={styles.filesCard} onPress={handleViewFiles}>
                            <View style={styles.filesLeft}>
                                {isDesignFeePaid ? (
                                    <Download size={24} color="#10B981" />
                                ) : (
                                    <Lock size={24} color="#F59E0B" />
                                )}
                                <View style={styles.filesInfo}>
                                    <Text style={styles.filesTitle}>设计图纸</Text>
                                    <Text style={styles.filesSubtitle}>
                                        {isDesignFeePaid ? '点击查看/下载' : '支付设计费后解锁'}
                                    </Text>
                                </View>
                            </View>
                            <FileText size={20} color="#71717A" />
                        </TouchableOpacity>

                        {/* 订单列表 */}
                        {billItems.map((item) => (
                            <View key={item.order.id} style={styles.orderCard}>
                                {/* 订单头部 */}
                                <View style={styles.orderHeader}>
                                    <View style={styles.orderTypeRow}>
                                        <CreditCard size={18} color="#09090B" />
                                        <Text style={styles.orderType}>
                                            {getOrderTypeText(item.order.orderType)}
                                        </Text>
                                    </View>
                                    <View
                                        style={[
                                            styles.statusBadge,
                                            { backgroundColor: getStatusColor(item.order.status) + '20' },
                                        ]}
                                    >
                                        <Text
                                            style={[styles.statusText, { color: getStatusColor(item.order.status) }]}
                                        >
                                            {getOrderStatusText(item.order.status)}
                                        </Text>
                                    </View>
                                </View>

                                {/* 金额信息 */}
                                <View style={styles.amountSection}>
                                    <View style={styles.amountRow}>
                                        <Text style={styles.amountLabel}>订单金额</Text>
                                        <Text style={styles.amountValue}>
                                            {formatMoney(item.order.totalAmount)}
                                        </Text>
                                    </View>
                                    {item.order.discount > 0 && (
                                        <View style={styles.amountRow}>
                                            <Text style={styles.discountLabel}>意向金抵扣</Text>
                                            <Text style={styles.discountValue}>
                                                -{formatMoney(item.order.discount)}
                                            </Text>
                                        </View>
                                    )}
                                    <View style={styles.amountRow}>
                                        <Text style={styles.payableLabel}>应付金额</Text>
                                        <Text style={styles.payableValue}>
                                            {formatMoney(item.order.totalAmount - item.order.discount)}
                                        </Text>
                                    </View>
                                </View>

                                {/* 支付计划（仅施工费有） */}
                                {item.paymentPlans.length > 1 && (
                                    <View style={styles.plansSection}>
                                        <Text style={styles.plansTitle}>分期明细</Text>
                                        {item.paymentPlans.map((plan) => (
                                            <View key={plan.id} style={styles.planItem}>
                                                <View style={styles.planLeft}>
                                                    {plan.status === 1 ? (
                                                        <CheckCircle size={16} color="#10B981" />
                                                    ) : (
                                                        <Clock size={16} color="#F59E0B" />
                                                    )}
                                                    <Text style={styles.planName}>{plan.name}</Text>
                                                    <Text style={styles.planPercent}>({plan.percentage}%)</Text>
                                                </View>
                                                <View style={styles.planRight}>
                                                    <Text style={styles.planAmount}>{formatMoney(plan.amount)}</Text>
                                                    {plan.status === 0 && (
                                                        <TouchableOpacity
                                                            style={styles.payPlanBtn}
                                                            onPress={() => handlePayPlan(plan.id)}
                                                        >
                                                            <Text style={styles.payPlanBtnText}>前往 Web/H5 支付</Text>
                                                        </TouchableOpacity>
                                                    )}
                                                </View>
                                            </View>
                                        ))}
                                    </View>
                                )}

                                {/* 支付按钮（设计费或一次性支付） */}
                                {item.order.status === OrderStatus.PENDING && item.paymentPlans.length <= 1 && (
                                    <TouchableOpacity
                                        style={styles.payBtn}
                                        onPress={() => handlePayOrder(item.order.id)}
                                    >
                                        <Text style={styles.payBtnText}>前往 Web/H5 支付</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        ))}
                    </>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>

            {/* Info Modal */}
            <InfoModal
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                title={modalConfig.title}
                message={modalConfig.message}
                type={modalConfig.type}
            />
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
        paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 40) + 12 : 12,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E4E4E7',
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
    content: {
        flex: 1,
        padding: 16,
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
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 100,
    },
    emptyText: {
        marginTop: 16,
        fontSize: 14,
        color: '#71717A',
    },
    emptySubText: {
        marginTop: 8,
        fontSize: 13,
        color: '#A1A1AA',
    },
    filesCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
    },
    filesLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    filesInfo: {
        marginLeft: 12,
    },
    filesTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#09090B',
    },
    filesSubtitle: {
        fontSize: 12,
        color: '#71717A',
        marginTop: 2,
    },
    orderCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
    },
    orderHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F4F4F5',
    },
    orderTypeRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    orderType: {
        fontSize: 16,
        fontWeight: '600',
        color: '#09090B',
        marginLeft: 8,
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '500',
    },
    amountSection: {
        marginBottom: 12,
    },
    amountRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 6,
    },
    amountLabel: {
        fontSize: 14,
        color: '#71717A',
    },
    amountValue: {
        fontSize: 14,
        color: '#09090B',
    },
    discountLabel: {
        fontSize: 14,
        color: '#10B981',
    },
    discountValue: {
        fontSize: 14,
        color: '#10B981',
    },
    payableLabel: {
        fontSize: 15,
        fontWeight: '600',
        color: '#09090B',
    },
    payableValue: {
        fontSize: 16,
        fontWeight: '700',
        color: '#EF4444',
    },
    plansSection: {
        borderTopWidth: 1,
        borderTopColor: '#F4F4F5',
        paddingTop: 12,
    },
    plansTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#09090B',
        marginBottom: 8,
    },
    planItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 8,
    },
    planLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    planName: {
        fontSize: 14,
        color: '#52525B',
        marginLeft: 8,
    },
    planPercent: {
        fontSize: 12,
        color: '#A1A1AA',
        marginLeft: 4,
    },
    planRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    planAmount: {
        fontSize: 14,
        color: '#09090B',
        marginRight: 12,
    },
    payPlanBtn: {
        backgroundColor: '#09090B',
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 6,
    },
    payPlanBtnText: {
        fontSize: 12,
        color: '#FFFFFF',
        fontWeight: '500',
    },
    payBtn: {
        backgroundColor: '#09090B',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 12,
    },
    payBtnText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#FFFFFF',
    },
});

export default BillScreen;
