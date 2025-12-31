import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Image,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
    ArrowLeft,
    MapPin,
    Calendar,
    Phone,
    Home,
    Ruler,
    DollarSign,
    FileText,
    Clock,
    CheckCircle,
    XCircle,
    AlertCircle,
} from 'lucide-react-native';
import { bookingApi } from '../services/api';
import { RootStackParamList } from '../navigation/AppNavigator';

type OrderDetailScreenRouteProp = RouteProp<RootStackParamList, 'OrderDetail'>;
type OrderDetailScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

// 订单状态配置
const STATUS_CONFIG: Record<number, { label: string; color: string; bgColor: string; icon: any }> = {
    1: { label: '待处理', color: '#F59E0B', bgColor: '#FFFBEB', icon: Clock },
    2: { label: '已确认', color: '#3B82F6', bgColor: '#EFF6FF', icon: CheckCircle },
    3: { label: '已完成', color: '#10B981', bgColor: '#ECFDF5', icon: CheckCircle },
    4: { label: '已取消', color: '#6B7280', bgColor: '#F3F4F6', icon: XCircle },
};

// 装修类型映射
const RENOVATION_TYPE_MAP: Record<string, string> = {
    'new': '新房装修',
    'old': '老房翻新',
    'partial': '局部改造',
};

// 预算范围映射
const BUDGET_RANGE_MAP: Record<string, string> = {
    '1': '5万以下',
    '2': '5-10万',
    '3': '10-20万',
    '4': '20-50万',
    '5': '50万以上',
};

// 服务商类型映射
const PROVIDER_TYPE_MAP: Record<string, string> = {
    'designer': '设计师',
    'company': '装修公司',
    'worker': '施工师傅',
};

interface OrderDetail {
    id: number;
    providerId: number;
    providerType: string;
    address: string;
    area: number;
    houseLayout: string;
    renovationType: string;
    budgetRange: string;
    preferredDate: string;
    phone: string;
    notes: string;
    status: number;
    intentFee: number;
    intentFeePaid: boolean;
    createdAt: string;
    updatedAt?: string;
}

interface ProviderInfo {
    id: number;
    name: string;
    avatar: string;
    rating: number;
    completedCnt: number;
    yearsExperience: number;
    specialty: string;
    verified: boolean;
    providerType: number;
}

const OrderDetailScreen = () => {
    const navigation = useNavigation<OrderDetailScreenNavigationProp>();
    const route = useRoute<OrderDetailScreenRouteProp>();
    const { orderId } = route.params || {};

    const [order, setOrder] = useState<OrderDetail | null>(null);
    const [provider, setProvider] = useState<ProviderInfo | null>(null);
    const [linkedProposalId, setLinkedProposalId] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadOrderDetail();
    }, [orderId]);

    const loadOrderDetail = async () => {
        if (!orderId) {
            setError('订单ID无效');
            setIsLoading(false);
            return;
        }

        try {
            setIsLoading(true);
            const response = await bookingApi.getDetail(orderId);
            const data = response?.data || response;

            if (data.booking) {
                setOrder(data.booking);
                setProvider(data.provider || null);
                if (data.proposalId) {
                    setLinkedProposalId(data.proposalId);
                }
            } else {
                setOrder(data);
                // 尝试从order中获取provider信息（如果后端没有分离）
                setProvider(null);
            }
        } catch (err: any) {
            console.error('加载订单详情失败:', err);
            setError(err?.response?.data?.message || '加载失败，请重试');
        } finally {
            setIsLoading(false);
        }
    };

    const getStatusConfig = () => {
        if (!order) return STATUS_CONFIG[1];

        // 待付款状态
        if (!order.intentFeePaid && order.status !== 4) {
            return { label: '待付款', color: '#F59E0B', bgColor: '#FFFBEB', icon: AlertCircle };
        }

        return STATUS_CONFIG[order.status] || STATUS_CONFIG[1];
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <ArrowLeft size={24} color="#09090B" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>订单详情</Text>
                    <View style={styles.placeholder} />
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#09090B" />
                    <Text style={styles.loadingText}>加载中...</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (error || !order) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <ArrowLeft size={24} color="#09090B" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>订单详情</Text>
                    <View style={styles.placeholder} />
                </View>
                <View style={styles.errorContainer}>
                    <XCircle size={48} color="#EF4444" />
                    <Text style={styles.errorText}>{error || '订单不存在'}</Text>
                    <TouchableOpacity style={styles.retryBtn} onPress={loadOrderDetail}>
                        <Text style={styles.retryBtnText}>重试</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    const statusConfig = getStatusConfig();
    const StatusIcon = statusConfig.icon;

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ArrowLeft size={24} color="#09090B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>订单详情</Text>
                <View style={styles.placeholder} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* 状态卡片 */}
                <View style={[styles.statusCard, { backgroundColor: statusConfig.bgColor }]}>
                    <StatusIcon size={32} color={statusConfig.color} />
                    <View style={styles.statusInfo}>
                        <Text style={[styles.statusLabel, { color: statusConfig.color }]}>
                            {statusConfig.label}
                        </Text>
                        <Text style={styles.orderId}>
                            订单号: BK{order.id.toString().padStart(8, '0')}
                        </Text>
                    </View>
                </View>

                {/* 基础信息卡片 */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>预约信息</Text>

                    <View style={styles.infoRow}>
                        <View style={styles.infoIcon}>
                            <MapPin size={18} color="#71717A" />
                        </View>
                        <View style={styles.infoContent}>
                            <Text style={styles.infoLabel}>服务地址</Text>
                            <Text style={styles.infoValue}>{order.address}</Text>
                        </View>
                    </View>

                    <View style={styles.infoRow}>
                        <View style={styles.infoIcon}>
                            <Calendar size={18} color="#71717A" />
                        </View>
                        <View style={styles.infoContent}>
                            <Text style={styles.infoLabel}>预约时间</Text>
                            <Text style={styles.infoValue}>{order.preferredDate}</Text>
                        </View>
                    </View>

                    <View style={styles.infoRow}>
                        <View style={styles.infoIcon}>
                            <Phone size={18} color="#71717A" />
                        </View>
                        <View style={styles.infoContent}>
                            <Text style={styles.infoLabel}>联系电话</Text>
                            <Text style={styles.infoValue}>{order.phone}</Text>
                        </View>
                    </View>
                </View>

                {/* 房屋信息卡片 */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>房屋信息</Text>

                    <View style={styles.gridRow}>
                        <View style={styles.gridItem}>
                            <Ruler size={16} color="#71717A" />
                            <Text style={styles.gridLabel}>面积</Text>
                            <Text style={styles.gridValue}>{order.area}㎡</Text>
                        </View>
                        <View style={styles.gridItem}>
                            <Home size={16} color="#71717A" />
                            <Text style={styles.gridLabel}>户型</Text>
                            <Text style={styles.gridValue}>{order.houseLayout || '-'}</Text>
                        </View>
                    </View>

                    <View style={styles.gridRow}>
                        <View style={styles.gridItem}>
                            <FileText size={16} color="#71717A" />
                            <Text style={styles.gridLabel}>装修类型</Text>
                            <Text style={styles.gridValue}>
                                {RENOVATION_TYPE_MAP[order.renovationType] || order.renovationType}
                            </Text>
                        </View>
                        <View style={styles.gridItem}>
                            <DollarSign size={16} color="#71717A" />
                            <Text style={styles.gridLabel}>预算范围</Text>
                            <Text style={styles.gridValue}>
                                {BUDGET_RANGE_MAP[order.budgetRange] || order.budgetRange}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* 服务商信息 */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>服务商信息</Text>
                    {provider ? (
                        <TouchableOpacity
                            style={styles.providerCardContent}
                            onPress={() => {
                                // 根据类型跳转到详情页
                                if (provider.providerType === 1) {
                                    navigation.navigate('DesignerDetail', { id: provider.id.toString() });
                                } else if (provider.providerType === 2) {
                                    navigation.navigate('CompanyDetail', { id: provider.id.toString() });
                                } else if (provider.providerType === 3) {
                                    navigation.navigate('WorkerDetail', { id: provider.id.toString() });
                                }
                            }}
                        >
                            <Image
                                source={{ uri: provider.avatar || 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158' }}
                                style={styles.providerAvatar}
                            />
                            <View style={styles.providerInfo}>
                                <View style={styles.providerNameRow}>
                                    <Text style={styles.providerName}>{provider.name}</Text>
                                    <View style={styles.providerTypeTag}>
                                        <Text style={styles.providerTypeTagText}>
                                            {PROVIDER_TYPE_MAP[order.providerType] || '服务商'}
                                        </Text>
                                    </View>
                                </View>
                                <View style={styles.providerMetaRow}>
                                    <Text style={styles.providerMetaText}>{provider.rating}分</Text>
                                    <View style={styles.dividerDot} />
                                    <Text style={styles.providerMetaText}>已服务 {provider.completedCnt} 单</Text>
                                </View>
                                <Text style={styles.providerSpecialty} numberOfLines={1}>
                                    擅长: {provider.specialty || '暂无介绍'}
                                </Text>
                            </View>
                            <ArrowLeft size={16} color="#A1A1AA" style={{ transform: [{ rotate: '180deg' }] }} />
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.infoRow}>
                            <View style={styles.infoContent}>
                                <Text style={styles.infoLabel}>服务类型</Text>
                                <Text style={styles.infoValue}>
                                    {PROVIDER_TYPE_MAP[order.providerType] || '服务商'}
                                </Text>
                            </View>
                        </View>
                    )}
                </View>

                {/* 备注信息 */}
                {order.notes && (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>备注信息</Text>
                        <Text style={styles.notesText}>{order.notes}</Text>
                    </View>
                )}

                {/* 费用信息 */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>费用明细</Text>
                    <View style={styles.feeRow}>
                        <Text style={styles.feeLabel}>意向金</Text>
                        <Text style={styles.feeValue}>¥{order.intentFee}</Text>
                    </View>
                    <View style={styles.feeRow}>
                        <Text style={styles.feeLabel}>支付状态</Text>
                        <Text style={[
                            styles.feeStatus,
                            { color: order.intentFeePaid ? '#10B981' : '#F59E0B' }
                        ]}>
                            {order.intentFeePaid ? '已支付' : '待支付'}
                        </Text>
                    </View>
                </View>

                {/* 时间信息 */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>订单时间</Text>
                    <View style={styles.timeRow}>
                        <Text style={styles.timeLabel}>创建时间</Text>
                        <Text style={styles.timeValue}>{formatDate(order.createdAt)}</Text>
                    </View>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>

            {/* 底部操作栏 */}
            {(linkedProposalId || (!order.intentFeePaid && order.status !== 4)) && (
                <View style={styles.footer}>
                    <View style={styles.footerRow}>
                        {linkedProposalId && (
                            <TouchableOpacity
                                style={[styles.actionBtn, styles.outlineBtn]}
                                onPress={() => navigation.navigate('ProposalDetail', { proposalId: linkedProposalId! })}
                            >
                                <FileText size={18} color="#09090B" />
                                <Text style={styles.outlineBtnText}>查看方案</Text>
                            </TouchableOpacity>
                        )}

                        {!order.intentFeePaid && order.status !== 4 && (
                            <TouchableOpacity
                                style={[styles.actionBtn, styles.primaryBtn]}
                                onPress={() => navigation.navigate('Payment', {
                                    bookingId: order.id,
                                    amount: order.intentFee,
                                    providerName: PROVIDER_TYPE_MAP[order.providerType],
                                })}
                            >
                                <Text style={styles.primaryBtnText}>立即支付</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
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
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        color: '#71717A',
        fontSize: 14,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    errorText: {
        marginTop: 16,
        fontSize: 16,
        color: '#71717A',
        textAlign: 'center',
    },
    retryBtn: {
        marginTop: 20,
        paddingHorizontal: 24,
        paddingVertical: 10,
        backgroundColor: '#09090B',
        borderRadius: 8,
    },
    retryBtnText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    content: {
        flex: 1,
        padding: 16,
    },
    statusCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        borderRadius: 12,
        marginBottom: 16,
    },
    statusInfo: {
        marginLeft: 16,
    },
    statusLabel: {
        fontSize: 18,
        fontWeight: '700',
    },
    orderId: {
        fontSize: 13,
        color: '#71717A',
        marginTop: 4,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
    },
    cardTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#09090B',
        marginBottom: 16,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 14,
    },
    infoIcon: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#F4F4F5',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    infoContent: {
        flex: 1,
    },
    infoLabel: {
        fontSize: 12,
        color: '#A1A1AA',
        marginBottom: 4,
    },
    infoValue: {
        fontSize: 15,
        color: '#09090B',
        fontWeight: '500',
    },
    gridRow: {
        flexDirection: 'row',
        marginBottom: 12,
    },
    gridItem: {
        flex: 1,
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        marginHorizontal: 4,
    },
    gridLabel: {
        fontSize: 12,
        color: '#A1A1AA',
        marginTop: 6,
    },
    gridValue: {
        fontSize: 14,
        color: '#09090B',
        fontWeight: '600',
        marginTop: 4,
    },
    notesText: {
        fontSize: 14,
        color: '#52525B',
        lineHeight: 22,
    },
    feeRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#F4F4F5',
    },
    feeLabel: {
        fontSize: 14,
        color: '#71717A',
    },
    feeValue: {
        fontSize: 16,
        fontWeight: '700',
        color: '#09090B',
    },
    feeStatus: {
        fontSize: 14,
        fontWeight: '600',
    },
    timeRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    timeLabel: {
        fontSize: 14,
        color: '#71717A',
    },
    timeValue: {
        fontSize: 14,
        color: '#09090B',
    },
    footer: {
        padding: 16,
        paddingBottom: 32,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#F4F4F5',
    },
    footerRow: {
        flexDirection: 'row',
        gap: 12,
    },
    actionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 10,
    },
    primaryBtn: {
        backgroundColor: '#09090B',
    },
    primaryBtnText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    outlineBtn: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E4E4E7',
    },
    outlineBtnText: {
        color: '#09090B',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
    },
    providerCardContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    providerAvatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        marginRight: 12,
        backgroundColor: '#F4F4F5',
    },
    providerInfo: {
        flex: 1,
        marginRight: 8,
    },
    providerNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    providerName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#09090B',
        marginRight: 8,
    },
    providerTypeTag: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        backgroundColor: '#F4F4F5',
        borderRadius: 4,
    },
    providerTypeTagText: {
        fontSize: 10,
        color: '#71717A',
    },
    providerMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    providerMetaText: {
        fontSize: 12,
        color: '#71717A',
    },
    dividerDot: {
        width: 2,
        height: 2,
        borderRadius: 1,
        backgroundColor: '#D4D4D8',
        marginHorizontal: 6,
    },
    providerSpecialty: {
        fontSize: 12,
        color: '#A1A1AA',
    },
});

export default OrderDetailScreen;
