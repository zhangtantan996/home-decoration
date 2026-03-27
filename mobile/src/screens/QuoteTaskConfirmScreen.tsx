import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { AlertCircle, ArrowLeft, CheckCircle2, Clock3, Hammer, XCircle } from 'lucide-react-native';

import RejectionReasonModal from '../components/RejectionReasonModal';
import { useToast } from '../components/Toast';
import { isMobileConflictError, quoteTaskApi } from '../services/api';
import { getBusinessStageText } from '../types/businessFlow';

interface QuoteTaskConfirmScreenProps {
    route: any;
    navigation: any;
}

interface QuoteTaskDetail {
    id: number;
    title: string;
    statusText: string;
    businessStage?: string;
    flowSummary?: string;
    estimatedDays: number;
    totalAmount: number;
    submissionId: number;
    items: Array<{
        id: number;
        quoteListItemId: number;
        unitPrice: number;
        amount: number;
        remark?: string;
    }>;
    taskSummary: {
        area?: number;
        layout?: string;
    };
}

const QuoteTaskConfirmScreen: React.FC<QuoteTaskConfirmScreenProps> = ({ route, navigation }) => {
    const { showAlert } = useToast();
    const { quoteTaskId } = route.params;
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [rejecting, setRejecting] = useState(false);
    const [rejectVisible, setRejectVisible] = useState(false);
    const [detail, setDetail] = useState<QuoteTaskDetail | null>(null);

    const loadDetail = useCallback(async () => {
        try {
            setLoading(true);
            const res = await quoteTaskApi.detailUser(quoteTaskId);
            const nextDetail: QuoteTaskDetail = {
                id: res.data.quoteList.id,
                title: res.data.quoteList.title || `施工报价任务 #${quoteTaskId}`,
                statusText: res.data.quoteList.status || '处理中',
                businessStage: res.data.businessStage || undefined,
                flowSummary: res.data.flowSummary || undefined,
                estimatedDays: Number(res.data.submission?.estimatedDays || 0),
                totalAmount: Math.round(Number(res.data.submission?.totalCent || 0) / 100),
                submissionId: res.data.submission.id,
                items: (res.data.items || []).map((item: any) => ({
                    id: item.id,
                    quoteListItemId: item.quoteListItemId,
                    unitPrice: Math.round(Number(item.unitPriceCent || 0) / 100),
                    amount: Math.round(Number(item.amountCent || 0) / 100),
                    remark: item.remark || undefined,
                })),
                taskSummary: {
                    area: Number(res.data.taskSummary?.area || 0) || undefined,
                    layout: res.data.taskSummary?.layout || undefined,
                },
            };
            setDetail(nextDetail);
        } catch (error: any) {
            showAlert('加载失败', error.message || '请稍后重试');
        } finally {
            setLoading(false);
        }
    }, [quoteTaskId, showAlert]);

    useEffect(() => {
        loadDetail();
    }, [loadDetail]);

    const handleConfirm = async () => {
        if (!detail || submitting) return;
        try {
            setSubmitting(true);
            await quoteTaskApi.confirmSubmission(detail.submissionId);
            navigation.reset({
                index: 1,
                routes: [{ name: 'Main' }, { name: 'ProjectList' }],
            });
        } catch (error: any) {
            if (isMobileConflictError(error)) {
                await loadDetail();
                showAlert('状态已变化', '请刷新后重试');
                return;
            }
            showAlert('确认失败', error.message || '请稍后重试');
        } finally {
            setSubmitting(false);
        }
    };

    const handleReject = async (reason: string) => {
        if (!detail || rejecting) return;
        try {
            setRejecting(true);
            setRejectVisible(false);
            await quoteTaskApi.rejectSubmission(detail.submissionId, { reason });
            await loadDetail();
            showAlert('已退回重报', '施工报价已退回服务商重新报价');
        } catch (error: any) {
            if (isMobileConflictError(error)) {
                await loadDetail();
                showAlert('状态已变化', '请刷新后重试');
                return;
            }
            showAlert('驳回失败', error.message || '请稍后重试');
        } finally {
            setRejecting(false);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#09090B" />
                    <Text style={styles.loadingText}>加载施工报价中...</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (!detail) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <Text style={styles.errorText}>未找到施工报价任务</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ArrowLeft size={24} color="#09090B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>施工报价确认</Text>
                <View style={styles.placeholder} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.banner}>
                    <View style={styles.bannerIcon}>
                        <Hammer size={20} color="#D97706" />
                    </View>
                    <View style={styles.bannerBody}>
                        <Text style={styles.bannerTitle}>{detail.title}</Text>
                        <Text style={styles.bannerSubtitle}>确认施工报价后才会创建项目，不再走旧建项目入口。</Text>
                    </View>
                </View>

                {detail.flowSummary ? (
                    <View style={styles.noticeCard}>
                        <AlertCircle size={16} color="#D97706" />
                        <Text style={styles.noticeText}>{detail.flowSummary}</Text>
                    </View>
                ) : null}
                {detail.businessStage ? (
                    <View style={styles.noticeCard}>
                        <AlertCircle size={16} color="#2563EB" />
                        <Text style={styles.noticeText}>当前闭环阶段：{getBusinessStageText(detail.businessStage)}</Text>
                    </View>
                ) : null}

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>报价摘要</Text>
                    <View style={styles.metricRow}>
                        <Text style={styles.metricLabel}>施工总价</Text>
                        <Text style={styles.metricValue}>¥{detail.totalAmount.toLocaleString()}</Text>
                    </View>
                    <View style={styles.metricRow}>
                        <Text style={styles.metricLabel}>预计工期</Text>
                        <Text style={styles.metricValue}>{detail.estimatedDays > 0 ? `${detail.estimatedDays} 天` : '待补充'}</Text>
                    </View>
                    <View style={styles.metricRow}>
                        <Text style={styles.metricLabel}>面积 / 户型</Text>
                        <Text style={styles.metricValue}>
                            {detail.taskSummary.area ? `${detail.taskSummary.area}㎡` : '待补充'}
                            {detail.taskSummary.layout ? ` · ${detail.taskSummary.layout}` : ''}
                        </Text>
                    </View>
                    <View style={styles.metricRow}>
                        <Text style={styles.metricLabel}>当前状态</Text>
                        <Text style={styles.metricValue}>{detail.statusText}</Text>
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>施工清单</Text>
                    {detail.items.length === 0 ? (
                        <Text style={styles.emptyText}>暂无施工清单</Text>
                    ) : (
                        detail.items.map((item) => (
                            <View key={item.id} style={styles.itemCard}>
                                <View style={styles.itemHeader}>
                                    <Text style={styles.itemTitle}>清单项 #{item.quoteListItemId}</Text>
                                    <Text style={styles.itemAmount}>¥{item.amount.toLocaleString()}</Text>
                                </View>
                                <View style={styles.itemMeta}>
                                    <Clock3 size={14} color="#71717A" />
                                    <Text style={styles.itemMetaText}>单价 ¥{item.unitPrice.toLocaleString()}</Text>
                                </View>
                                {item.remark ? <Text style={styles.itemRemark}>{item.remark}</Text> : null}
                            </View>
                        ))
                    )}
                </View>
                <View style={styles.bottomSpacer} />
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity
                    style={[styles.secondaryButton, rejecting && styles.buttonDisabled]}
                    onPress={() => setRejectVisible(true)}
                    disabled={rejecting || submitting}
                >
                    <XCircle size={18} color="#52525B" />
                    <Text style={styles.secondaryButtonText}>驳回重报</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.primaryButton, submitting && styles.buttonDisabled]}
                    onPress={handleConfirm}
                    disabled={submitting || rejecting}
                >
                    <CheckCircle2 size={18} color="#FFFFFF" />
                    <Text style={styles.primaryButtonText}>{submitting ? '确认中...' : '确认施工报价'}</Text>
                </TouchableOpacity>
            </View>

            <RejectionReasonModal
                visible={rejectVisible}
                onClose={() => setRejectVisible(false)}
                onSubmit={handleReject}
                loading={rejecting}
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
        paddingTop: 44,
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
    banner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
    },
    bannerIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#FEF3C7',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    bannerBody: {
        flex: 1,
    },
    bannerTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#09090B',
        marginBottom: 4,
    },
    bannerSubtitle: {
        fontSize: 13,
        color: '#71717A',
        lineHeight: 20,
    },
    noticeCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: '#FFF7ED',
        borderRadius: 14,
        padding: 14,
        marginBottom: 12,
    },
    noticeText: {
        flex: 1,
        fontSize: 13,
        color: '#9A3412',
        lineHeight: 20,
        marginLeft: 8,
    },
    section: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#09090B',
        marginBottom: 12,
    },
    metricRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F4F4F5',
    },
    metricLabel: {
        fontSize: 14,
        color: '#71717A',
    },
    metricValue: {
        fontSize: 14,
        fontWeight: '600',
        color: '#09090B',
        marginLeft: 16,
        flexShrink: 1,
        textAlign: 'right',
    },
    itemCard: {
        borderWidth: 1,
        borderColor: '#F4F4F5',
        borderRadius: 14,
        padding: 14,
        marginBottom: 10,
    },
    itemHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    itemTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#09090B',
    },
    itemAmount: {
        fontSize: 15,
        fontWeight: '700',
        color: '#D97706',
    },
    itemMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    itemMetaText: {
        fontSize: 12,
        color: '#71717A',
        marginLeft: 6,
    },
    itemRemark: {
        fontSize: 13,
        color: '#52525B',
        lineHeight: 18,
    },
    emptyText: {
        fontSize: 13,
        color: '#A1A1AA',
    },
    bottomSpacer: {
        height: 120,
    },
    footer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 24,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#E4E4E7',
    },
    secondaryButton: {
        flex: 1,
        height: 48,
        borderRadius: 12,
        backgroundColor: '#F4F4F5',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        marginRight: 6,
    },
    secondaryButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#52525B',
        marginLeft: 8,
    },
    primaryButton: {
        flex: 1,
        height: 48,
        borderRadius: 12,
        backgroundColor: '#09090B',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        marginLeft: 6,
    },
    primaryButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#FFFFFF',
        marginLeft: 8,
    },
    buttonDisabled: {
        opacity: 0.6,
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
        fontSize: 15,
        color: '#71717A',
    },
});

export default QuoteTaskConfirmScreen;
