import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Dimensions,
    Platform,
    Alert,
} from 'react-native';
import {
    ArrowLeft,
    FileText,
    DollarSign,
    Calendar,
    Check,
    X,
    Clock,
    Download,
    CheckCircle,
} from 'lucide-react-native';
import { proposalApi } from '../services/api';
import { useToast } from '../components/Toast';
import { Proposal, ProposalStatus, getProposalStatusText, Order } from '../types/businessFlow';
import RejectionReasonModal from '../components/RejectionReasonModal';

const { width } = Dimensions.get('window');

interface ProposalDetailScreenProps {
    route: any;
    navigation: any;
}

const ProposalDetailScreen: React.FC<ProposalDetailScreenProps> = ({ route, navigation }) => {
    const { showAlert } = useToast();
    const { proposalId } = route.params;

    const [proposal, setProposal] = useState<Proposal | null>(null);
    const [order, setOrder] = useState<any>(null); // TODO: 使用 Order 类型
    const [loading, setLoading] = useState(true);
    const [confirming, setConfirming] = useState(false);
    const [rejecting, setRejecting] = useState(false);
    const [confirmModalVisible, setConfirmModalVisible] = useState(false);
    const [rejectModalVisible, setRejectModalVisible] = useState(false);
    const [successModalVisible, setSuccessModalVisible] = useState(false);
    const [successMessage, setSuccessMessage] = useState({ title: '', subtitle: '' });
    const [resultProjectId, setResultProjectId] = useState<number | null>(null);

    useEffect(() => {
        loadProposal();
    }, [proposalId]);

    const loadProposal = async () => {
        try {
            setLoading(true);
            const res = await proposalApi.detail(proposalId);
            // 兼容后端返回结构变化
            if (res.data.proposal) {
                setProposal(res.data.proposal);
                setOrder(res.data.order);
            } else {
                setProposal(res.data);
            }
        } catch (error: any) {
            showAlert('加载失败', error.message || '请稍后重试');
        } finally {
            setLoading(false);
        }
    };

    const handleConfirm = async () => {
        setConfirmModalVisible(true);
    };

    const doConfirm = async () => {
        try {
            setConfirming(true);
            setConfirmModalVisible(false);
            const res = await proposalApi.confirm(proposalId);
            // 跳转到设计费支付页面
            navigation.replace('DesignFeePayment', {
                order: res.data?.order,
                proposalId: proposalId,
            });
        } catch (error: any) {
            showAlert('操作失败', error.message || '请稍后重试');
        } finally {
            setConfirming(false);
        }
    };

    const handleReject = async () => {
        setRejectModalVisible(true);
    };

    const doReject = async (reason: string) => {
        try {
            setRejecting(true);
            setRejectModalVisible(false);
            await proposalApi.reject(proposalId, { reason });
            setSuccessMessage({
                title: '方案已拒绝',
                subtitle: '设计师可根据您的反馈重新提交方案（最多3次）',
            });
            setResultProjectId(null);
            setSuccessModalVisible(true);
        } catch (error: any) {
            showAlert('操作失败', error.message || '请稍后重试');
        } finally {
            setRejecting(false);
        }
    };

    const handleSuccessClose = () => {
        setSuccessModalVisible(false);
        if (resultProjectId) {
            navigation.replace('ProjectDetail', { projectId: resultProjectId });
        } else {
            navigation.goBack();
        }
    };

    const getStatusColor = (status: number) => {
        switch (status) {
            case ProposalStatus.PENDING:
                return '#F59E0B';
            case ProposalStatus.CONFIRMED:
                return '#10B981';
            case ProposalStatus.REJECTED:
                return '#EF4444';
            default:
                return '#71717A';
        }
    };

    const formatMoney = (amount: number) => {
        return `¥${amount.toLocaleString()}`;
    };

    const totalEstimate = proposal
        ? proposal.designFee + proposal.constructionFee + proposal.materialFee
        : 0;

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

    if (!proposal) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <Text style={styles.errorText}>方案不存在</Text>
                    <TouchableOpacity style={styles.retryBtn} onPress={loadProposal}>
                        <Text style={styles.retryBtnText}>重新加载</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <View style={{ flex: 1 }}>
            <SafeAreaView style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <ArrowLeft size={24} color="#09090B" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>设计方案</Text>
                    <View style={styles.placeholder} />
                </View>

                <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                    {/* 状态标签 */}
                    <View style={styles.statusSection}>
                        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(proposal.status) + '20' }]}>
                            <Text style={[styles.statusText, { color: getStatusColor(proposal.status) }]}>
                                {getProposalStatusText(proposal.status)}
                            </Text>
                        </View>
                        <Text style={styles.createTime}>
                            提交于 {new Date(proposal.createdAt).toLocaleDateString()}
                        </Text>
                    </View>

                    {/* 方案概述 */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <FileText size={18} color="#09090B" />
                            <Text style={styles.sectionTitle}>方案概述</Text>
                        </View>
                        <Text style={styles.summaryText}>
                            {proposal.summary || '设计师暂未填写方案概述'}
                        </Text>
                    </View>

                    {/* 费用明细 */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <DollarSign size={18} color="#09090B" />
                            <Text style={styles.sectionTitle}>费用预估</Text>
                        </View>

                        <View style={styles.feeItem}>
                            <Text style={styles.feeLabel}>设计费</Text>
                            <Text style={styles.feeValue}>{formatMoney(proposal.designFee)}</Text>
                        </View>
                        <View style={styles.feeItem}>
                            <Text style={styles.feeLabel}>施工费（预估）</Text>
                            <Text style={styles.feeValue}>{formatMoney(proposal.constructionFee)}</Text>
                        </View>
                        <View style={styles.feeItem}>
                            <Text style={styles.feeLabel}>主材费（预估）</Text>
                            <Text style={styles.feeValue}>{formatMoney(proposal.materialFee)}</Text>
                        </View>

                        <View style={styles.totalRow}>
                            <Text style={styles.totalLabel}>总预估费用</Text>
                            <Text style={styles.totalValue}>{formatMoney(totalEstimate)}</Text>
                        </View>
                    </View>

                    {/* 工期 */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Calendar size={18} color="#09090B" />
                            <Text style={styles.sectionTitle}>预计工期</Text>
                        </View>
                        <View style={styles.durationRow}>
                            <Clock size={16} color="#71717A" />
                            <Text style={styles.durationText}>{proposal.estimatedDays} 天</Text>
                        </View>
                    </View>

                    {/* 提示信息 */}
                    <View style={styles.infoBox}>
                        <Text style={styles.infoTitle}>💡 温馨提示</Text>
                        <Text style={styles.infoText}>
                            • 确认方案后，您需要先支付设计费
                        </Text>
                        <Text style={styles.infoText}>
                            • 支付设计费后可下载详细施工图纸
                        </Text>
                        <Text style={styles.infoText}>
                            • 施工费和主材费为预估，具体以选材后报价为准
                        </Text>
                    </View>

                    <View style={{ height: 120 }} />
                </ScrollView>

                {/* 底部操作栏 */}
                <View style={styles.bottomBar}>
                    {proposal.status === ProposalStatus.PENDING ? (
                        <>
                            <TouchableOpacity
                                style={styles.rejectBtn}
                                onPress={handleReject}
                                disabled={rejecting}
                            >
                                {rejecting ? (
                                    <ActivityIndicator color="#EF4444" size="small" />
                                ) : (
                                    <>
                                        <X size={18} color="#EF4444" />
                                        <Text style={styles.rejectBtnText}>拒绝</Text>
                                    </>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.confirmBtn}
                                onPress={handleConfirm}
                                disabled={confirming}
                            >
                                {confirming ? (
                                    <ActivityIndicator color="#FFFFFF" size="small" />
                                ) : (
                                    <>
                                        <Check size={18} color="#FFFFFF" />
                                        <Text style={styles.confirmBtnText}>确认方案</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </>
                    ) : proposal.status === ProposalStatus.CONFIRMED && order ? (
                        order.status === 1 ? ( // 已支付
                            <TouchableOpacity
                                style={styles.confirmBtn}
                                onPress={() => navigation.navigate('ProposalPaidDetail', { proposalId: proposal.id })}
                            >
                                <CheckCircle size={18} color="#FFFFFF" />
                                <Text style={styles.confirmBtnText}>下一步：查看项目/图纸</Text>
                            </TouchableOpacity>
                        ) : ( // 待支付
                            <TouchableOpacity
                                style={styles.confirmBtn}
                                onPress={() => navigation.navigate('DesignFeePayment', { order: order, proposalId: proposal.id })}
                            >
                                <DollarSign size={18} color="#FFFFFF" />
                                <Text style={styles.confirmBtnText}>前往支付设计费</Text>
                            </TouchableOpacity>
                        )
                    ) : null}
                </View>

            </SafeAreaView>

            {/* 确认方案弹窗 */}
            {confirmModalVisible && (
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        <View style={[styles.modalIconContainer, { backgroundColor: '#ECFDF5' }]}>
                            <Check size={32} color="#10B981" />
                        </View>
                        <Text style={styles.modalTitle}>确认方案</Text>
                        <Text style={styles.modalMessage}>
                            确认后将进入选材/选施工队阶段，您需要支付设计费后才能下载详细图纸。
                        </Text>
                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={styles.modalCancelBtn}
                                onPress={() => setConfirmModalVisible(false)}
                            >
                                <Text style={styles.modalCancelBtnText}>取消</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.modalConfirmBtn}
                                onPress={doConfirm}
                            >
                                <Text style={styles.modalConfirmBtnText}>确认</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            )}

            {/* 拒绝方案弹窗 - 使用 RejectionReasonModal */}
            <RejectionReasonModal
                visible={rejectModalVisible}
                onClose={() => setRejectModalVisible(false)}
                onSubmit={doReject}
                loading={rejecting}
            />


            {/* 成功提示弹窗 */}
            {successModalVisible && (
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        <View style={[styles.modalIconContainer, { backgroundColor: '#ECFDF5' }]}>
                            <Check size={32} color="#10B981" />
                        </View>
                        <Text style={styles.modalTitle}>{successMessage.title}</Text>
                        <Text style={styles.modalMessage}>{successMessage.subtitle}</Text>
                        <TouchableOpacity
                            style={[styles.modalConfirmBtn, { flex: 0, width: '100%' }]}
                            onPress={handleSuccessClose}
                        >
                            <Text style={styles.modalConfirmBtnText}>
                                {resultProjectId ? '前往项目' : '返回'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}
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
    errorText: {
        fontSize: 16,
        color: '#71717A',
    },
    retryBtn: {
        marginTop: 16,
        paddingHorizontal: 24,
        paddingVertical: 10,
        backgroundColor: '#09090B',
        borderRadius: 8,
    },
    retryBtnText: {
        fontSize: 14,
        color: '#FFFFFF',
        fontWeight: '500',
    },
    statusSection: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    statusText: {
        fontSize: 13,
        fontWeight: '600',
    },
    createTime: {
        fontSize: 12,
        color: '#71717A',
    },
    section: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#09090B',
        marginLeft: 8,
    },
    summaryText: {
        fontSize: 14,
        color: '#52525B',
        lineHeight: 22,
    },
    feeItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F4F4F5',
    },
    feeLabel: {
        fontSize: 14,
        color: '#71717A',
    },
    feeValue: {
        fontSize: 14,
        color: '#09090B',
        fontWeight: '500',
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingTop: 12,
        marginTop: 4,
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
    durationRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    durationText: {
        fontSize: 14,
        color: '#09090B',
        marginLeft: 8,
    },
    infoBox: {
        backgroundColor: '#FEF3C7',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
    },
    infoTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#92400E',
        marginBottom: 8,
    },
    infoText: {
        fontSize: 13,
        color: '#92400E',
        lineHeight: 20,
    },
    bottomBar: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#E4E4E7',
        gap: 12,
    },
    rejectBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#EF4444',
        backgroundColor: '#FEF2F2',
    },
    rejectBtnText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#EF4444',
        marginLeft: 6,
    },
    confirmBtn: {
        flex: 2,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: '#09090B',
    },
    confirmBtnText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#FFFFFF',
        marginLeft: 6,
    },
    // Modal styles
    modalOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
        padding: 24,
    },
    modalContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 24,
        width: '100%',
        maxWidth: 340,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 10,
    },
    modalIconContainer: {
        width: 72,
        height: 72,
        borderRadius: 36,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#09090B',
        marginBottom: 12,
        textAlign: 'center',
    },
    modalMessage: {
        fontSize: 15,
        color: '#71717A',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 28,
    },
    modalButtons: {
        flexDirection: 'row',
        width: '100%',
        gap: 12,
    },
    modalCancelBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        backgroundColor: '#F4F4F5',
        borderWidth: 1,
        borderColor: '#E4E4E7',
    },
    modalCancelBtnText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#71717A',
    },
    modalConfirmBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        backgroundColor: '#09090B',
    },
    modalConfirmBtnText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#FFFFFF',
    },
});

export default ProposalDetailScreen;
