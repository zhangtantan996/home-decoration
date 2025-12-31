import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Platform,
    Linking,
} from 'react-native';
import {
    ArrowLeft,
    FileText,
    Download,
    Calendar,
    DollarSign,
    CheckCircle,
} from 'lucide-react-native';
import { proposalApi } from '../services/api';
import { Proposal } from '../types/businessFlow';

interface ProposalPaidDetailScreenProps {
    route: any;
    navigation: any;
}

const ProposalPaidDetailScreen: React.FC<ProposalPaidDetailScreenProps> = ({ route, navigation }) => {
    const { proposalId } = route.params;

    const [proposal, setProposal] = useState<Proposal | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadProposal();
    }, [proposalId]);

    const loadProposal = async () => {
        try {
            setLoading(true);
            const res = await proposalApi.detail(proposalId);
            if (res.data.proposal) {
                setProposal(res.data.proposal);
            } else {
                setProposal(res.data);
            }
        } catch (error: any) {
            Alert.alert('加载失败', error.message || '请稍后重试');
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = (url: string) => {
        Linking.openURL(url).catch((err) =>
            Alert.alert('无法打开链接', '请检查您的设备是否支持打开此文件')
        );
    };

    const handleCreateProject = () => {
        // 跳转到创建项目页面
        navigation.navigate('CreateProject', { proposalId });
    };

    const formatMoney = (amount: number) => {
        return `¥${(amount || 0).toLocaleString()}`;
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('zh-CN');
    };

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
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>方案不存在</Text>
                    <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                        <Text style={styles.backButtonText}>返回</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    let attachments: string[] = [];
    try {
        attachments = proposal.attachments ? JSON.parse(proposal.attachments) : [];
    } catch (e) {
        attachments = [];
    }

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ArrowLeft size={24} color="#09090B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>方案详情</Text>
                <View style={styles.placeholder} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* 状态横幅 */}
                <View style={styles.statusBanner}>
                    <CheckCircle size={20} color="#10B981" />
                    <Text style={styles.statusText}>设计费已支付，您可以随时下载完整图纸</Text>
                </View>

                {/* 方案概述 */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <FileText size={18} color="#09090B" />
                        <Text style={styles.sectionTitle}>方案概述</Text>
                    </View>
                    <Text style={styles.summaryText}>{proposal.summary}</Text>
                </View>

                {/* 费用明细 */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <DollarSign size={18} color="#09090B" />
                        <Text style={styles.sectionTitle}>费用明细</Text>
                    </View>
                    <View style={styles.metaRow}>
                        <Text style={styles.metaLabel}>设计费</Text>
                        <Text style={styles.metaValue}>{formatMoney(proposal.designFee)}</Text>
                    </View>
                    <View style={styles.metaRow}>
                        <Text style={styles.metaLabel}>施工费(预估)</Text>
                        <Text style={styles.metaValue}>{formatMoney(proposal.constructionFee)}</Text>
                    </View>
                    <View style={styles.metaRow}>
                        <Text style={styles.metaLabel}>主材费(预估)</Text>
                        <Text style={styles.metaValue}>{formatMoney(proposal.materialFee)}</Text>
                    </View>
                    <View style={[styles.metaRow, styles.totalRow]}>
                        <Text style={styles.totalLabel}>总预估费用</Text>
                        <Text style={styles.totalValue}>
                            {formatMoney(
                                proposal.designFee +
                                proposal.constructionFee +
                                proposal.materialFee
                            )}
                        </Text>
                    </View>
                </View>

                {/* 图纸下载 */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Download size={18} color="#09090B" />
                        <Text style={styles.sectionTitle}>设计图纸下载</Text>
                    </View>

                    {attachments.length > 0 ? (
                        <View style={styles.fileList}>
                            {attachments.map((url, index) => (
                                <TouchableOpacity
                                    key={index}
                                    style={styles.fileItem}
                                    onPress={() => handleDownload(url)}
                                >
                                    <View style={styles.fileIcon}>
                                        <FileText size={20} color="#3B82F6" />
                                    </View>
                                    <View style={styles.fileInfo}>
                                        <Text style={styles.fileName}>设计图纸 {index + 1}</Text>
                                        <Text style={styles.fileType}>PDF/JPG</Text>
                                    </View>
                                    <Download size={20} color="#A1A1AA" />
                                </TouchableOpacity>
                            ))}
                        </View>
                    ) : (
                        <Text style={styles.emptyText}>暂无图纸文件</Text>
                    )}
                </View>

                {/* 底部间距 */}
                <View style={{ height: 40 }} />
            </ScrollView>

            {/* 底部按钮 */}
            <View style={styles.footer}>
                <TouchableOpacity style={styles.createBtn} onPress={handleCreateProject}>
                    <Text style={styles.createBtnText}>下一步：创建项目</Text>
                </TouchableOpacity>
            </View>
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
    },
    backButton: {
        marginTop: 24,
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
    content: {
        flex: 1,
    },
    statusBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    statusText: {
        marginLeft: 8,
        fontSize: 13,
        color: '#059669',
        fontWeight: '500',
    },
    section: {
        backgroundColor: '#FFFFFF',
        marginHorizontal: 16,
        marginTop: 16,
        padding: 20,
        borderRadius: 16,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#09090B',
        marginLeft: 8,
    },
    summaryText: {
        fontSize: 15,
        lineHeight: 24,
        color: '#52525B',
    },
    metaRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F4F4F5',
    },
    metaLabel: {
        fontSize: 14,
        color: '#71717A',
    },
    metaValue: {
        fontSize: 15,
        fontWeight: '500',
        color: '#09090B',
    },
    totalRow: {
        borderBottomWidth: 0,
        marginTop: 4,
        paddingBottom: 0,
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
    fileList: {
        marginTop: 8,
    },
    fileItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        padding: 12,
        borderRadius: 12,
        marginBottom: 8,
    },
    fileIcon: {
        width: 40,
        height: 40,
        borderRadius: 8,
        backgroundColor: '#EBF5FF',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    fileInfo: {
        flex: 1,
    },
    fileName: {
        fontSize: 14,
        fontWeight: '500',
        color: '#09090B',
        marginBottom: 2,
    },
    fileType: {
        fontSize: 12,
        color: '#64748B',
    },
    emptyText: {
        textAlign: 'center',
        color: '#94A3B8',
        padding: 20,
    },
    footer: {
        padding: 16,
        paddingBottom: Platform.OS === 'ios' ? 32 : 16,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#E4E4E7',
    },
    createBtn: {
        backgroundColor: '#09090B',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    createBtnText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
});

export default ProposalPaidDetailScreen;
