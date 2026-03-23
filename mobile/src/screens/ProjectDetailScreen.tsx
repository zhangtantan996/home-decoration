import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Platform,
} from 'react-native';
import {
    ArrowLeft,
    Home,
    MapPin,
    Calendar,
    DollarSign,
    Clock,
    FileText,
    User,
    ChevronRight,
    CheckCircle,
    AlertCircle,
    Camera,
} from 'lucide-react-native';
import { projectApi, billApi } from '../services/api';
import { useToast } from '../components/Toast';
import { formatServerDate } from '../utils/serverTime';

interface Project {
    id: number;
    ownerId: number;
    providerId: number;
    proposalId?: number; // 关联的设计方案ID
    name: string;
    address: string;
    area: number;
    budget: number;
    status: number;
    currentPhase: string;
    startDate: string | null;
    expectedEnd: string | null;
    createdAt: string;
}

interface ProjectDetailScreenProps {
    route: any;
    navigation: any;
}

const PROJECT_STATUS_MAP: Record<number, { label: string; color: string }> = {
    0: { label: '准备阶段', color: '#F59E0B' },
    1: { label: '施工中', color: '#3B82F6' },
    2: { label: '已完工', color: '#10B981' },
    3: { label: '已取消', color: '#EF4444' },
};

const ProjectDetailScreen: React.FC<ProjectDetailScreenProps> = ({ route, navigation }) => {
    const { showAlert } = useToast();
    const { projectId } = route.params;

    const [project, setProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadProject();
    }, [projectId]);

    const loadProject = async () => {
        try {
            setLoading(true);
            const res = await projectApi.detail(String(projectId));
            setProject(res.data);
        } catch (error: any) {
            showAlert('加载失败', error.message || '请稍后重试');
        } finally {
            setLoading(false);
        }
    };

    const formatMoney = (amount: number) => {
        return `¥${(amount || 0).toLocaleString()}`;
    };

    const formatDate = (dateStr: string | null) => {
        return formatServerDate(dateStr);
    };

    const getStatusInfo = (status: number) => {
        return PROJECT_STATUS_MAP[status] || { label: '未知', color: '#71717A' };
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

    if (!project) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.errorContainer}>
                    <AlertCircle size={48} color="#EF4444" />
                    <Text style={styles.errorTitle}>项目不存在</Text>
                    <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                        <Text style={styles.backButtonText}>返回</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    const statusInfo = getStatusInfo(project.status);

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ArrowLeft size={24} color="#09090B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>项目详情</Text>
                <View style={styles.placeholder} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* 项目状态卡片 */}
                <View style={styles.statusCard}>
                    <View style={styles.statusHeader}>
                        <View style={[styles.statusBadge, { backgroundColor: statusInfo.color + '20' }]}>
                            <View style={[styles.statusDot, { backgroundColor: statusInfo.color }]} />
                            <Text style={[styles.statusText, { color: statusInfo.color }]}>
                                {statusInfo.label}
                            </Text>
                        </View>
                        <Text style={styles.projectDate}>
                            创建于 {formatDate(project.createdAt)}
                        </Text>
                    </View>
                    <Text style={styles.projectName}>{project.name}</Text>
                </View>

                {/* 基本信息 */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Home size={18} color="#09090B" />
                        <Text style={styles.sectionTitle}>基本信息</Text>
                    </View>

                    <View style={styles.infoGrid}>
                        <View style={styles.infoItem}>
                            <View style={styles.infoIconContainer}>
                                <MapPin size={16} color="#71717A" />
                            </View>
                            <View style={styles.infoContent}>
                                <Text style={styles.infoLabel}>地址</Text>
                                <Text style={styles.infoValue} numberOfLines={2}>
                                    {project.address || '-'}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.infoItem}>
                            <View style={styles.infoIconContainer}>
                                <Home size={16} color="#71717A" />
                            </View>
                            <View style={styles.infoContent}>
                                <Text style={styles.infoLabel}>面积</Text>
                                <Text style={styles.infoValue}>{project.area || '-'} ㎡</Text>
                            </View>
                        </View>

                        <View style={styles.infoItem}>
                            <View style={styles.infoIconContainer}>
                                <DollarSign size={16} color="#71717A" />
                            </View>
                            <View style={styles.infoContent}>
                                <Text style={styles.infoLabel}>预算</Text>
                                <Text style={[styles.infoValue, { color: '#EF4444' }]}>
                                    {formatMoney(project.budget)}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.infoItem}>
                            <View style={styles.infoIconContainer}>
                                <Clock size={16} color="#71717A" />
                            </View>
                            <View style={styles.infoContent}>
                                <Text style={styles.infoLabel}>当前阶段</Text>
                                <Text style={styles.infoValue}>{project.currentPhase || '待开始'}</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* 时间节点 */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Calendar size={18} color="#09090B" />
                        <Text style={styles.sectionTitle}>时间节点</Text>
                    </View>

                    <View style={styles.timelineContainer}>
                        <View style={styles.timelineItem}>
                            <View style={[styles.timelineDot, { backgroundColor: '#10B981' }]} />
                            <View style={styles.timelineContent}>
                                <Text style={styles.timelineLabel}>开始日期</Text>
                                <Text style={styles.timelineValue}>{formatDate(project.startDate)}</Text>
                            </View>
                        </View>
                        <View style={styles.timelineLine} />
                        <View style={styles.timelineItem}>
                            <View style={[styles.timelineDot, { backgroundColor: '#3B82F6' }]} />
                            <View style={styles.timelineContent}>
                                <Text style={styles.timelineLabel}>预计完工</Text>
                                <Text style={styles.timelineValue}>{formatDate(project.expectedEnd)}</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* 快捷操作 */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <FileText size={18} color="#09090B" />
                        <Text style={styles.sectionTitle}>项目管理</Text>
                    </View>

                    <View style={styles.actionGrid}>
                        {/* 设计方案入口 - 添加渐变背景效果 */}
                        {project.proposalId && (
                            <TouchableOpacity
                                style={[styles.actionCard, styles.proposalCard]}
                                onPress={() => navigation.navigate('ProposalPaidDetail', { proposalId: project.proposalId, fromProject: true })}
                                activeOpacity={0.7}
                            >
                                <View style={[styles.actionIcon, styles.proposalIcon]}>
                                    <FileText size={24} color="#059669" />
                                </View>
                                <View style={styles.actionTextContainer}>
                                    <Text style={styles.actionLabel}>设计方案</Text>
                                    <Text style={styles.actionSubLabel}>查看图纸与方案详情</Text>
                                </View>
                                <ChevronRight size={16} color="#059669" />
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity
                            style={styles.actionCard}
                            onPress={() => navigation.navigate('Bill', { projectId: project.id })}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.actionIcon, { backgroundColor: '#FEF3C7' }]}>
                                <DollarSign size={24} color="#F59E0B" />
                            </View>
                            <View style={styles.actionTextContainer}>
                                <Text style={styles.actionLabel}>账单费用</Text>
                                <Text style={styles.actionSubLabel}>查看支付明细与账单</Text>
                            </View>
                            <ChevronRight size={16} color="#A1A1AA" />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.actionCard}
                            onPress={() => navigation.navigate('ProjectTimeline', { project: project })}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.actionIcon, { backgroundColor: '#DBEAFE' }]}>
                                <Clock size={24} color="#3B82F6" />
                            </View>
                            <View style={styles.actionTextContainer}>
                                <Text style={styles.actionLabel}>进度跟踪</Text>
                                <Text style={styles.actionSubLabel}>施工阶段与日志</Text>
                            </View>
                            <ChevronRight size={16} color="#A1A1AA" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* 底部间距 */}
                <View style={{ height: 40 }} />
            </ScrollView>
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
    errorTitle: {
        marginTop: 16,
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
    statusCard: {
        backgroundColor: '#FFFFFF',
        margin: 16,
        marginBottom: 8,
        padding: 20,
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    statusHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 6,
    },
    statusText: {
        fontSize: 13,
        fontWeight: '600',
    },
    projectDate: {
        fontSize: 12,
        color: '#A1A1AA',
    },
    projectName: {
        fontSize: 20,
        fontWeight: '700',
        color: '#09090B',
    },
    section: {
        backgroundColor: '#FFFFFF',
        marginHorizontal: 16,
        marginBottom: 8,
        padding: 16,
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
    infoGrid: {
        gap: 12,
    },
    infoItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    infoIconContainer: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#F4F4F5',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    infoContent: {
        flex: 1,
    },
    infoLabel: {
        fontSize: 12,
        color: '#A1A1AA',
        marginBottom: 2,
    },
    infoValue: {
        fontSize: 14,
        fontWeight: '500',
        color: '#09090B',
    },
    timelineContainer: {
        paddingLeft: 4,
    },
    timelineItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    timelineDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: 12,
    },
    timelineLine: {
        width: 2,
        height: 24,
        backgroundColor: '#E4E4E7',
        marginLeft: 5,
    },
    timelineContent: {
        flex: 1,
        paddingVertical: 8,
    },
    timelineLabel: {
        fontSize: 12,
        color: '#A1A1AA',
    },
    timelineValue: {
        fontSize: 14,
        fontWeight: '500',
        color: '#09090B',
        marginTop: 2,
    },
    actionGrid: {
        gap: 12,
    },
    actionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FAFAFA',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#F4F4F5',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 1,
    },
    proposalCard: {
        backgroundColor: '#ECFDF5',
        borderColor: '#A7F3D0',
        borderWidth: 1.5,
    },
    proposalIcon: {
        backgroundColor: '#D1FAE5',
    },
    actionIcon: {
        width: 48,
        height: 48,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
    },
    actionTextContainer: {
        flex: 1,
    },
    actionLabel: {
        fontSize: 15,
        fontWeight: '600',
        color: '#09090B',
    },
    actionSubLabel: {
        fontSize: 12,
        color: '#71717A',
        marginTop: 2,
    },
});

export default ProjectDetailScreen;
