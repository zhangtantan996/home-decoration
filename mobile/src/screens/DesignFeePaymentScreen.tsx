import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Platform,
    ScrollView,
} from 'react-native';
import {
    ArrowLeft,
    CreditCard,
    Clock,
    CheckCircle,
    AlertCircle,
} from 'lucide-react-native';
import { orderApi } from '../services/api';
import CancelOrderModal from '../components/CancelOrderModal';
import InfoModal from '../components/InfoModal';

interface Order {
    id: number;
    orderNo: string;
    orderType: string;
    totalAmount: number;
    discount: number;   // 意向金抵扣额
    paidAmount: number;
    status: number;
    expireAt: string;
    proposalId: number;
}

interface DesignFeePaymentScreenProps {
    route: any;
    navigation: any;
}

const DesignFeePaymentScreen: React.FC<DesignFeePaymentScreenProps> = ({ route, navigation }) => {
    // 可能是从订单列表跳转（orderId）或从方案详情跳转（order对象）
    const { orderId, order: initialOrder } = route.params;

    const [order, setOrder] = useState<Order | null>(initialOrder || null);
    const [loading, setLoading] = useState(!initialOrder);
    const [paying, setPaying] = useState(false);
    const [countdown, setCountdown] = useState('');
    const timerRef = useRef<any>(null);

    // Modal States
    const [cancelModalVisible, setCancelModalVisible] = useState(false);
    const [infoModal, setInfoModal] = useState({
        visible: false,
        title: '',
        message: '',
        type: 'info' as 'success' | 'error' | 'info',
        onClose: () => { }
    });

    const showInfo = (title: string, message: string, type: 'success' | 'error' | 'info' = 'info', onClose?: () => void) => {
        setInfoModal({
            visible: true,
            title,
            message,
            type,
            onClose: onClose || (() => setInfoModal(prev => ({ ...prev, visible: false })))
        });
    };

    // 获取订单详情
    const fetchOrder = async () => {
        if (!orderId && !initialOrder?.id) return;
        try {
            const id = orderId || initialOrder?.id;
            const res = await orderApi.detail(id);
            setOrder(res.data);
        } catch (error) {
            console.error('Fetch order failed:', error);
            showInfo('获取订单失败', '无法获取订单详情', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!initialOrder && orderId) {
            fetchOrder();
        }
    }, [orderId]);

    // 倒计时逻辑
    const updateCountdown = () => {
        if (!order || !order.expireAt) return;

        const expireTime = new Date(order.expireAt).getTime();
        const now = Date.now();
        const diff = expireTime - now;

        if (diff <= 0) {
            setCountdown('');
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
            return;
        }

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        setCountdown(`${hours}小时 ${minutes}分 ${seconds}秒`);
    };

    useEffect(() => {
        updateCountdown();
        timerRef.current = setInterval(updateCountdown, 1000);
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [order]);

    // Debug: 监听模态框状态变化
    useEffect(() => {
        console.log('cancelModalVisible changed:', cancelModalVisible);
    }, [cancelModalVisible]);

    const isExpired = () => {
        if (!order?.expireAt) return false;
        return new Date(order.expireAt).getTime() <= Date.now();
    };

    const handlePay = async () => {
        if (!order) return;

        if (isExpired()) {
            showInfo('订单已过期', '请重新确认方案生成新订单', 'error');
            return;
        }

        try {
            setPaying(true);
            // 模拟支付（调用后端支付接口）
            await orderApi.pay(order.id);

            showInfo('支付成功', '设计费已支付，您可以查看完整方案了', 'success', () => {
                setInfoModal(prev => ({ ...prev, visible: false }));
                navigation.replace('ProposalPaidDetail', { proposalId: order.proposalId });
            });
        } catch (error: any) {
            showInfo('支付失败', error.message || '请稍后重试', 'error');
        } finally {
            setPaying(false);
        }
    };

    const formatMoney = (amount: number) => {
        return `¥${(amount || 0).toLocaleString()}`;
    };

    const handleConfirmCancel = async () => {
        console.log('=== handleConfirmCancel START ===');
        console.log('handleConfirmCancel: order=', order);
        if (!order) {
            console.log('handleConfirmCancel: order is null, aborting');
            return;
        }
        console.log('handleConfirmCancel: closing cancel modal');
        setCancelModalVisible(false);
        try {
            console.log('handleConfirmCancel: setLoading(true)');
            setLoading(true);
            console.log('handleConfirmCancel: calling orderApi.cancel with orderId=', order.id);
            console.log('handleConfirmCancel: API URL will be: DELETE /orders/' + order.id);
            const result = await orderApi.cancel(order.id);
            console.log('handleConfirmCancel: cancel API response=', result);
            console.log('handleConfirmCancel: showing success info modal');
            showInfo('提示', '订单已取消', 'success', () => {
                console.log('handleConfirmCancel: success modal closed, navigating back');
                setInfoModal(prev => ({ ...prev, visible: false }));
                navigation.goBack();
            });
        } catch (error: any) {
            console.error('handleConfirmCancel: cancel API failed, error=', error);
            console.error('handleConfirmCancel: error.response=', error.response);
            const msg = error.response?.data?.error || error.message || '取消失败';
            console.log('handleConfirmCancel: showing error info modal with msg=', msg);
            showInfo('错误', msg, 'error');
        } finally {
            console.log('handleConfirmCancel: setLoading(false)');
            setLoading(false);
            console.log('=== handleConfirmCancel END ===');
        }
    };

    const handleCancel = () => {
        console.log('取消订单按钮被点击');
        console.log('Current order:', order);
        setCancelModalVisible(true);
        // 延迟检查模态框状态
        setTimeout(() => {
            console.log('Modal should be visible now');
        }, 100);
    };

    if (loading && !order) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#09090B" />
            </View>
        );
    }

    if (!order) {
        return (
            <View style={styles.errorContainer}>
                <Text style={styles.errorText}>订单信息不存在</Text>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <Text style={styles.backButtonText}>返回</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backBtn}
                >
                    <ArrowLeft size={24} color="#09090B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>支付设计费</Text>
                <View style={styles.placeholder} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* 金额卡片 */}
                <View style={styles.amountCard}>
                    <Text style={styles.amountLabel}>应付金额</Text>
                    <Text style={styles.amountValue}>{formatMoney(order.totalAmount)}</Text>
                    <Text style={styles.orderNo}>订单号: {order.orderNo}</Text>
                </View>

                {/* 费用明细 */}
                <View style={styles.feeBreakdownCard}>
                    <Text style={styles.feeBreakdownTitle}>费用明细</Text>
                    <View style={styles.feeRow}>
                        <Text style={styles.feeLabel}>设计费原价</Text>
                        <Text style={styles.feeValue}>{formatMoney(order.totalAmount + (order.discount || 0))}</Text>
                    </View>
                    {(order.discount || 0) > 0 && (
                        <View style={styles.feeRow}>
                            <Text style={styles.feeLabel}>意向金抵扣</Text>
                            <Text style={styles.discountValue}>-{formatMoney(order.discount)}</Text>
                        </View>
                    )}
                    <View style={[styles.feeRow, styles.totalRow]}>
                        <Text style={styles.totalLabel}>实付金额</Text>
                        <Text style={styles.totalValue}>{formatMoney(order.totalAmount)}</Text>
                    </View>
                </View>

                {/* 倒计时 */}
                <View style={[styles.countdownCard, isExpired() && styles.expiredCard]}>
                    <View style={styles.countdownHeader}>
                        <Clock size={20} color={isExpired() ? '#EF4444' : '#F59E0B'} />
                        <Text style={[styles.countdownLabel, isExpired() && styles.expiredText]}>
                            {isExpired() ? '订单已过期' : '剩余支付时间'}
                        </Text>
                    </View>
                    {!isExpired() && (
                        <Text style={styles.countdownValue}>{countdown}</Text>
                    )}
                    <Text style={styles.countdownHint}>
                        {isExpired()
                            ? '请重新确认方案生成新订单'
                            : '超时未支付订单将自动取消'}
                    </Text>
                </View>

                {/* 支付说明 */}
                <View style={styles.infoCard}>
                    <Text style={styles.infoTitle}>支付说明</Text>
                    <View style={styles.infoItem}>
                        <CheckCircle size={16} color="#10B981" />
                        <Text style={styles.infoText}>支付后可查看和下载完整设计图纸</Text>
                    </View>
                    <View style={styles.infoItem}>
                        <CheckCircle size={16} color="#10B981" />
                        <Text style={styles.infoText}>支持创建装修项目，选择材料和施工队</Text>
                    </View>
                    <View style={styles.infoItem}>
                        <CheckCircle size={16} color="#10B981" />
                        <Text style={styles.infoText}>设计费不可退款，请确认后再支付</Text>
                    </View>
                </View>
                {/* 底部留白防止遮挡 */}
                <View style={{ height: 20 }} />
            </ScrollView>

            {/* 支付按钮 */}
            <View style={styles.footer}>
                {!isExpired() && (
                    <TouchableOpacity
                        style={styles.cancelButton}
                        onPress={handleCancel}
                        activeOpacity={0.7}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Text style={styles.cancelButtonText}>取消订单</Text>
                    </TouchableOpacity>
                )}
                <TouchableOpacity
                    style={[styles.payButton, isExpired() && styles.disabledButton]}
                    onPress={handlePay}
                    disabled={isExpired()}
                >
                    {paying ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                        <Text style={styles.payButtonText}>
                            {isExpired() ? '订单已过期' : `立即支付 ${formatMoney(order.totalAmount)}`}
                        </Text>
                    )}
                </TouchableOpacity>
            </View>

            {/* Modals */}
            <CancelOrderModal
                visible={cancelModalVisible}
                onClose={() => setCancelModalVisible(false)}
                onConfirm={handleConfirmCancel}
            />
            <InfoModal
                visible={infoModal.visible}
                title={infoModal.title}
                message={infoModal.message}
                type={infoModal.type}
                onClose={infoModal.onClose}
            />
        </View>
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
        paddingTop: Platform.OS === 'android' ? 44 : 12,
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
    amountCard: {
        backgroundColor: '#09090B',
        borderRadius: 20,
        padding: 32,
        alignItems: 'center',
        marginBottom: 16,
    },
    amountLabel: {
        fontSize: 14,
        color: '#A1A1AA',
        marginBottom: 8,
    },
    amountValue: {
        fontSize: 40,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 12,
    },
    orderNo: {
        fontSize: 12,
        color: '#71717A',
    },
    feeBreakdownCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
    },
    feeBreakdownTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#09090B',
        marginBottom: 16,
    },
    feeRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    feeLabel: {
        fontSize: 14,
        color: '#71717A',
    },
    feeValue: {
        fontSize: 14,
        color: '#52525B',
    },
    discountValue: {
        fontSize: 14,
        color: '#10B981',
        fontWeight: '500',
    },
    totalRow: {
        marginTop: 8,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#E4E4E7',
        marginBottom: 0,
    },
    totalLabel: {
        fontSize: 15,
        fontWeight: '600',
        color: '#09090B',
    },
    totalValue: {
        fontSize: 18,
        fontWeight: '700',
        color: '#EF4444',
    },
    countdownCard: {
        backgroundColor: '#FFFBEB',
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#FDE68A',
    },
    expiredCard: {
        backgroundColor: '#FEF2F2',
        borderColor: '#FECACA',
    },
    countdownHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    countdownLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: '#F59E0B',
        marginLeft: 8,
    },
    expiredText: {
        color: '#EF4444',
    },
    countdownValue: {
        fontSize: 24,
        fontWeight: '700',
        color: '#09090B',
        marginBottom: 4,
    },
    countdownHint: {
        fontSize: 12,
        color: '#71717A',
    },
    infoCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 20,
    },
    infoTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#09090B',
        marginBottom: 16,
    },
    infoItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    infoText: {
        fontSize: 14,
        color: '#52525B',
        marginLeft: 8,
    },
    footer: {
        padding: 16,
        paddingBottom: Platform.OS === 'ios' ? 32 : 16,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#E4E4E7',
    },
    payButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#09090B',
        paddingVertical: 16,
        borderRadius: 12,
    },
    disabledButton: {
        backgroundColor: '#A1A1AA',
    },
    payButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
        marginLeft: 8,
    },
    cancelButton: {
        backgroundColor: '#FFFFFF',
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E4E4E7',
        marginBottom: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#71717A',
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    errorText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#71717A',
        marginBottom: 24,
    },
    backButton: {
        paddingHorizontal: 24,
        paddingVertical: 12,
        backgroundColor: '#09090B',
        borderRadius: 12,
    },
    backButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default DesignFeePaymentScreen;
