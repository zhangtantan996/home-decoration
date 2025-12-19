import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    TouchableOpacity,
    Platform,
    Dimensions,
} from 'react-native';
import {
    ArrowLeft,
    CheckCircle2,
    Circle,
    Clock,
    Home,
    Trash2,
    Droplets,
    Layers,
    PaintBucket,
    Wrench,
    ClipboardCheck,
    ChevronDown,
    ChevronUp,
    Calendar,
    User,
} from 'lucide-react-native';

const { width } = Dimensions.get('window');

// 主色调
const PRIMARY_GOLD = '#D4AF37';

// 工程阶段定义
const PROJECT_PHASES = [
    { id: 'preparation', name: '开工准备', icon: Home, description: '现场交接、施工准备、材料进场' },
    { id: 'demolition', name: '拆除工程', icon: Trash2, description: '墙体拆除、垃圾清运' },
    { id: 'electrical', name: '水电工程', icon: Droplets, description: '水电走线、开槽、布管、验收' },
    { id: 'masonry', name: '泥木工程', icon: Layers, description: '瓷砖铺贴、木工制作、吊顶' },
    { id: 'painting', name: '油漆工程', icon: PaintBucket, description: '墙面处理、乳胶漆施工' },
    { id: 'installation', name: '安装工程', icon: Wrench, description: '灯具、洁具、五金安装' },
    { id: 'inspection', name: '竣工验收', icon: ClipboardCheck, description: '全屋验收、交付使用' },
];

// 模拟项目阶段数据
const MOCK_PHASES = [
    {
        id: 'preparation', status: 'completed', startDate: '2024-11-05', endDate: '2024-11-08', responsiblePerson: '张工长', subTasks: [
            { id: 'p1', name: '现场交接确认', isCompleted: true },
            { id: 'p2', name: '施工图纸确认', isCompleted: true },
            { id: 'p3', name: '材料进场验收', isCompleted: true },
        ]
    },
    {
        id: 'demolition', status: 'completed', startDate: '2024-11-09', endDate: '2024-11-15', responsiblePerson: '李师傅', subTasks: [
            { id: 'd1', name: '客厅隔墙拆除', isCompleted: true },
            { id: 'd2', name: '卫生间墙体拆除', isCompleted: true },
            { id: 'd3', name: '垃圾清运完成', isCompleted: true },
        ]
    },
    {
        id: 'electrical', status: 'in_progress', startDate: '2024-11-16', endDate: null, responsiblePerson: '王师傅', subTasks: [
            { id: 'e1', name: '厨房水管布置', isCompleted: true },
            { id: 'e2', name: '卫生间水管布置', isCompleted: true },
            { id: 'e3', name: '全屋电路布线', isCompleted: false },
            { id: 'e4', name: '水电验收', isCompleted: false },
        ]
    },
    { id: 'masonry', status: 'pending', startDate: null, endDate: null, estimatedDays: 15 },
    { id: 'painting', status: 'pending', startDate: null, endDate: null, estimatedDays: 10 },
    { id: 'installation', status: 'pending', startDate: null, endDate: null, estimatedDays: 7 },
    { id: 'inspection', status: 'pending', startDate: null, endDate: null, estimatedDays: 3 },
];

interface ProjectTimelineScreenProps {
    route: any;
    navigation: any;
}

const ProjectTimelineScreen: React.FC<ProjectTimelineScreenProps> = ({ route, navigation }) => {
    const { project } = route.params || { project: { name: '汤臣一品 A栋-1201', startDate: '2024-11-05' } };
    const [expandedPhase, setExpandedPhase] = useState<string | null>('electrical');

    // 计算开工天数
    const getConstructionDays = () => {
        const start = new Date(project.startDate || '2024-11-05');
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - start.getTime());
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };

    // 计算完成进度
    const getProgress = () => {
        const completed = MOCK_PHASES.filter(p => p.status === 'completed').length;
        return { completed, total: MOCK_PHASES.length };
    };

    const progress = getProgress();
    const constructionDays = getConstructionDays();

    // 获取阶段信息
    const getPhaseInfo = (phaseId: string) => {
        return PROJECT_PHASES.find(p => p.id === phaseId);
    };

    // 切换展开状态
    const toggleExpand = (phaseId: string) => {
        setExpandedPhase(prev => prev === phaseId ? null : phaseId);
    };

    // 渲染状态徽章
    const renderStatusBadge = (status: string) => {
        const config = {
            completed: { label: '已完成', bg: '#ECFDF5', color: '#10B981' },
            in_progress: { label: '进行中', bg: '#FFFBEB', color: '#D4AF37' },
            pending: { label: '待开始', bg: '#F4F4F5', color: '#A1A1AA' },
        }[status] || { label: '未知', bg: '#F4F4F5', color: '#A1A1AA' };

        return (
            <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
                <Text style={[styles.statusBadgeText, { color: config.color }]}>{config.label}</Text>
            </View>
        );
    };

    // 渲染阶段卡片
    const renderPhaseCard = (phase: typeof MOCK_PHASES[0], index: number) => {
        const info = getPhaseInfo(phase.id);
        if (!info) return null;

        const IconComponent = info.icon;
        const isCompleted = phase.status === 'completed';
        const isActive = phase.status === 'in_progress';
        const isPending = phase.status === 'pending';
        const isExpanded = expandedPhase === phase.id;
        const isLast = index === MOCK_PHASES.length - 1;

        return (
            <View key={phase.id} style={styles.phaseContainer}>
                {/* 时间轴线 */}
                <View style={styles.timelineColumn}>
                    <View style={[
                        styles.timelineNode,
                        isCompleted && styles.timelineNodeCompleted,
                        isActive && styles.timelineNodeActive,
                    ]}>
                        {isCompleted ? (
                            <CheckCircle2 size={18} color="#FFFFFF" />
                        ) : isActive ? (
                            <Clock size={18} color="#FFFFFF" />
                        ) : (
                            <Circle size={18} color="#A1A1AA" />
                        )}
                    </View>
                    {!isLast && (
                        <View style={[
                            styles.timelineLine,
                            isCompleted && styles.timelineLineCompleted,
                        ]} />
                    )}
                </View>

                {/* 阶段卡片 */}
                <TouchableOpacity
                    style={[
                        styles.phaseCard,
                        isActive && styles.phaseCardActive,
                    ]}
                    onPress={() => toggleExpand(phase.id)}
                    activeOpacity={0.8}
                >
                    <View style={styles.phaseCardHeader}>
                        <View style={[
                            styles.phaseIconContainer,
                            isCompleted && styles.phaseIconCompleted,
                            isActive && styles.phaseIconActive,
                        ]}>
                            <IconComponent size={20} color={isCompleted ? '#10B981' : isActive ? PRIMARY_GOLD : '#A1A1AA'} />
                        </View>
                        <View style={styles.phaseInfo}>
                            <View style={styles.phaseTitleRow}>
                                <Text style={[
                                    styles.phaseName,
                                    isCompleted && styles.phaseNameCompleted,
                                    isActive && styles.phaseNameActive,
                                ]}>
                                    {info.name}
                                </Text>
                                {renderStatusBadge(phase.status)}
                            </View>
                            <Text style={styles.phaseDescription}>{info.description}</Text>
                        </View>
                        {(phase.subTasks || phase.responsiblePerson) && (
                            isExpanded ? (
                                <ChevronUp size={20} color="#A1A1AA" />
                            ) : (
                                <ChevronDown size={20} color="#A1A1AA" />
                            )
                        )}
                    </View>

                    {/* 日期和负责人 */}
                    <View style={styles.phaseMeta}>
                        {phase.startDate && (
                            <View style={styles.metaItem}>
                                <Calendar size={14} color="#71717A" />
                                <Text style={styles.metaText}>
                                    {phase.startDate}{phase.endDate ? ` ~ ${phase.endDate}` : ' 至今'}
                                </Text>
                            </View>
                        )}
                        {!phase.startDate && phase.estimatedDays && (
                            <View style={styles.metaItem}>
                                <Clock size={14} color="#71717A" />
                                <Text style={styles.metaText}>预计 {phase.estimatedDays} 天</Text>
                            </View>
                        )}
                        {phase.responsiblePerson && (
                            <View style={styles.metaItem}>
                                <User size={14} color="#71717A" />
                                <Text style={styles.metaText}>{phase.responsiblePerson}</Text>
                            </View>
                        )}
                    </View>

                    {/* 展开的子任务 */}
                    {isExpanded && phase.subTasks && (
                        <View style={styles.subTasksContainer}>
                            {phase.subTasks.map(task => (
                                <View key={task.id} style={styles.subTaskItem}>
                                    {task.isCompleted ? (
                                        <CheckCircle2 size={16} color="#10B981" />
                                    ) : (
                                        <Circle size={16} color="#D4D4D8" />
                                    )}
                                    <Text style={[
                                        styles.subTaskText,
                                        task.isCompleted && styles.subTaskTextCompleted,
                                    ]}>
                                        {task.name}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    )}
                </TouchableOpacity>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ArrowLeft size={24} color="#09090B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>工程计划</Text>
                <View style={styles.placeholder} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* 进度总览 */}
                <View style={styles.summaryCard}>
                    <Text style={styles.projectName}>{project.name || '汤臣一品 A栋-1201'}</Text>
                    <View style={styles.progressRow}>
                        <View style={styles.progressBarContainer}>
                            <View style={[styles.progressBar, { width: `${(progress.completed / progress.total) * 100}%` }]} />
                        </View>
                        <Text style={styles.progressText}>{progress.completed}/{progress.total}</Text>
                    </View>
                    <View style={styles.summaryMeta}>
                        <View style={styles.summaryItem}>
                            <Text style={styles.summaryLabel}>开工天数</Text>
                            <Text style={styles.summaryValue}>{constructionDays} 天</Text>
                        </View>
                        <View style={styles.summaryDivider} />
                        <View style={styles.summaryItem}>
                            <Text style={styles.summaryLabel}>当前阶段</Text>
                            <Text style={[styles.summaryValue, { color: PRIMARY_GOLD }]}>水电工程</Text>
                        </View>
                    </View>
                </View>

                {/* 时间轴列表 */}
                <View style={styles.timelineContainer}>
                    {MOCK_PHASES.map((phase, index) => renderPhaseCard(phase, index))}
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'ios' ? 12 : 44,
        paddingBottom: 12,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F4F4F5',
    },
    backBtn: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: '#09090B',
    },
    placeholder: {
        width: 32,
    },
    content: {
        flex: 1,
    },
    // 进度总览
    summaryCard: {
        backgroundColor: '#FFFFFF',
        marginHorizontal: 16,
        marginTop: 16,
        borderRadius: 12,
        padding: 16,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 8,
            },
            android: {
                elevation: 2,
            },
        }),
    },
    projectName: {
        fontSize: 18,
        fontWeight: '700',
        color: '#09090B',
        marginBottom: 12,
    },
    progressRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    progressBarContainer: {
        flex: 1,
        height: 8,
        backgroundColor: '#F4F4F5',
        borderRadius: 4,
        overflow: 'hidden',
        marginRight: 12,
    },
    progressBar: {
        height: '100%',
        backgroundColor: PRIMARY_GOLD,
        borderRadius: 4,
    },
    progressText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#71717A',
    },
    summaryMeta: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    summaryItem: {
        flex: 1,
        alignItems: 'center',
    },
    summaryDivider: {
        width: 1,
        height: 32,
        backgroundColor: '#E4E4E7',
    },
    summaryLabel: {
        fontSize: 12,
        color: '#A1A1AA',
        marginBottom: 4,
    },
    summaryValue: {
        fontSize: 16,
        fontWeight: '700',
        color: '#09090B',
    },
    // 时间轴
    timelineContainer: {
        paddingHorizontal: 16,
        paddingTop: 16,
    },
    phaseContainer: {
        flexDirection: 'row',
    },
    timelineColumn: {
        width: 40,
        alignItems: 'center',
    },
    timelineNode: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#F4F4F5',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#E4E4E7',
    },
    timelineNodeCompleted: {
        backgroundColor: '#10B981',
        borderColor: '#10B981',
    },
    timelineNodeActive: {
        backgroundColor: PRIMARY_GOLD,
        borderColor: PRIMARY_GOLD,
    },
    timelineLine: {
        flex: 1,
        width: 2,
        backgroundColor: '#E4E4E7',
        marginVertical: 4,
    },
    timelineLineCompleted: {
        backgroundColor: '#10B981',
    },
    // 阶段卡片
    phaseCard: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 14,
        marginLeft: 12,
        marginBottom: 12,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.03,
                shadowRadius: 4,
            },
            android: {
                elevation: 1,
            },
        }),
    },
    phaseCardActive: {
        borderWidth: 1,
        borderColor: PRIMARY_GOLD,
    },
    phaseCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    phaseIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: '#F4F4F5',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    phaseIconCompleted: {
        backgroundColor: '#ECFDF5',
    },
    phaseIconActive: {
        backgroundColor: '#FFFBEB',
    },
    phaseInfo: {
        flex: 1,
    },
    phaseTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    phaseName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#71717A',
        marginRight: 8,
    },
    phaseNameCompleted: {
        color: '#09090B',
    },
    phaseNameActive: {
        color: '#09090B',
    },
    phaseDescription: {
        fontSize: 12,
        color: '#A1A1AA',
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    statusBadgeText: {
        fontSize: 11,
        fontWeight: '500',
    },
    phaseMeta: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 10,
        gap: 12,
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    metaText: {
        fontSize: 12,
        color: '#71717A',
        marginLeft: 4,
    },
    // 子任务
    subTasksContainer: {
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#F4F4F5',
    },
    subTaskItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
    },
    subTaskText: {
        fontSize: 13,
        color: '#09090B',
        marginLeft: 8,
    },
    subTaskTextCompleted: {
        color: '#A1A1AA',
        textDecorationLine: 'line-through',
    },
});

export default ProjectTimelineScreen;
