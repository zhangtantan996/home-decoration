import React, { useEffect, useState, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
    Image,
    Dimensions,
    Platform,
    StatusBar,
    Modal,
} from 'react-native';
import {
    Home,
    CheckCircle2,
    Circle,
    ChevronRight,
    Hammer,
    Droplets,
    Layers,
    PaintBucket,
    Wrench,
    ClipboardCheck,
    Trash2,
    MessageCircle,
    Clock,
    MapPin,
    X,
    ChevronLeft,
} from 'lucide-react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// 主色调
const PRIMARY_GOLD = '#D4AF37';

// 工程阶段定义
const PROJECT_PHASES = [
    { id: 'preparation', name: '开工准备', icon: Home },
    { id: 'demolition', name: '拆除工程', icon: Trash2 },
    { id: 'electrical', name: '水电工程', icon: Droplets },
    { id: 'masonry', name: '泥木工程', icon: Layers },
    { id: 'painting', name: '油漆工程', icon: PaintBucket },
    { id: 'installation', name: '安装工程', icon: Wrench },
    { id: 'inspection', name: '竣工验收', icon: ClipboardCheck },
];

// 模拟施工日志数据
const MOCK_LOGS = [
    {
        id: 1,
        dateLabel: '今天',
        time: '10:30 上午',
        title: '水电验收阶段',
        highlight: '厨房水管打压测试',
        description: '今日进行厨房及卫生间水管打压测试，压力值稳定0.8MPa，30分钟无掉压，验收合格。现场已拍照留档。',
        images: [
            'https://images.unsplash.com/photo-1581858726788-75bc0f6a952d?w=400',
            'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=400',
            'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400',
        ],
    },
    {
        id: 2,
        dateLabel: '昨天',
        time: '2:15 下午',
        title: '水电材料进场验收',
        highlight: '',
        description: '电线、水管等材料验收完成，品牌型号与合同一致。',
        images: [
            'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=400',
        ],
    },
    {
        id: 3,
        dateLabel: '12月17日',
        time: '9:00 上午',
        title: '拆除工程完工',
        highlight: '墙体拆除',
        description: '客厅与餐厅隔墙拆除完成，垃圾清运完毕。',
        images: [],
    },
];

// 模拟项目数据
const MOCK_PROJECT = {
    id: 1,
    name: '汤臣一品 A栋-1201',
    address: '上海市浦东新区花园石桥路28弄',
    startDate: '2024-11-05',
    currentPhase: 'electrical',
    coverImage: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80',
    phases: [
        { id: 'preparation', status: 'completed', date: '11/05' },
        { id: 'demolition', status: 'completed', date: '11/15' },
        { id: 'electrical', status: 'in_progress', date: '进行中' },
        { id: 'masonry', status: 'pending', date: '待定' },
        { id: 'painting', status: 'pending', date: '待定' },
        { id: 'installation', status: 'pending', date: '待定' },
        { id: 'inspection', status: 'pending', date: '待定' },
    ],
};

const MySiteScreen: React.FC = () => {
    const navigation = useNavigation();
    const isFocused = useIsFocused();
    const [hasProject, setHasProject] = useState(true);
    const [project, setProject] = useState<any>(MOCK_PROJECT);
    const [loading, setLoading] = useState(false);
    const [isHeaderScrolled, setIsHeaderScrolled] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    // 图片查看器状态
    const [viewerVisible, setViewerVisible] = useState(false);
    const [viewerImages, setViewerImages] = useState<string[]>([]);
    const [viewerIndex, setViewerIndex] = useState(0);

    const onRefresh = () => {
        setRefreshing(true);
        setTimeout(() => setRefreshing(false), 1000);
    };

    const openViewer = (images: string[], index: number) => {
        setViewerImages(images);
        setViewerIndex(index);
        setViewerVisible(true);
    };

    // 计算开工天数
    const getConstructionDays = () => {
        if (!project?.startDate) return 0;
        const start = new Date(project.startDate);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - start.getTime());
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };

    const constructionDays = getConstructionDays();

    // 空状态组件
    const EmptyState = () => (
        <View style={styles.emptyContainer}>
            <View style={styles.emptyIllustration}>
                <Home size={80} color="#E4E4E7" strokeWidth={1} />
            </View>
            <Text style={styles.emptyTitle}>开始您的装修之旅</Text>
            <Text style={styles.emptySubtitle}>
                预约设计师或施工团队{'\n'}在这里追踪您的装修进度
            </Text>
            <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => (navigation as any).navigate('Home')}
            >
                <Text style={styles.emptyBtnText}>寻找服务</Text>
            </TouchableOpacity>
        </View>
    );

    // 头部 Hero 区域
    const ProjectHero = () => (
        <View style={styles.heroContainer}>
            <Image source={{ uri: project.coverImage }} style={styles.heroImage} />
            <View style={styles.heroOverlay} />
            <View style={styles.heroContent}>
                <View style={styles.heroTop}>
                    <View style={styles.constructionBadge}>
                        <Text style={styles.constructionBadgeText}>开工第 {constructionDays} 天</Text>
                    </View>
                </View>
                <TouchableOpacity
                    style={styles.projectTitleContainer}
                    onPress={() => setHasProject(!hasProject)} // 调试点击
                >
                    <Text style={styles.heroProjectName}>{project.name}</Text>
                    <View style={styles.heroLocation}>
                        <MapPin size={12} color="#FFFFFF" />
                        <Text style={styles.heroLocationText}>{project.address}</Text>
                    </View>
                </TouchableOpacity>
            </View>
        </View>
    );

    // 工程节点组件
    const MilestoneTimeline = () => (
        <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitleText}>工程节点</Text>
                <TouchableOpacity
                    style={styles.sectionLink}
                    onPress={() => (navigation as any).navigate('ProjectTimeline', { project })}
                >
                    <Text style={styles.sectionLinkText}>完整计划</Text>
                    <ChevronRight size={16} color="#A1A1AA" />
                </TouchableOpacity>
            </View>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.timelineScroll}
                snapToInterval={SCREEN_WIDTH * 0.25}
                decelerationRate="fast"
            >
                {PROJECT_PHASES.map((phase, index) => {
                    const phaseData = project.phases.find((p: any) => p.id === phase.id);
                    const status = phaseData?.status || 'pending';
                    const date = phaseData?.date || '';
                    const isActive = status === 'in_progress';
                    const isCompleted = status === 'completed';
                    const IconComponent = phase.icon;

                    return (
                        <View key={phase.id} style={styles.timelineItem}>
                            <View style={[
                                styles.nodeContainer,
                                isActive && styles.nodeContainerActive,
                                isCompleted && styles.nodeContainerCompleted,
                            ]}>
                                {isCompleted ? (
                                    <CheckCircle2 size={20} color="#FFFFFF" />
                                ) : isActive ? (
                                    <Clock size={20} color="#FFFFFF" />
                                ) : (
                                    <IconComponent size={20} color="#A1A1AA" />
                                )}
                            </View>
                            <Text style={[
                                styles.nodeLabel,
                                isActive && styles.nodeLabelActive,
                                isCompleted && styles.nodeLabelCompleted,
                            ]}>
                                {phase.name}
                            </Text>
                            <Text style={[
                                styles.nodeDate,
                                isActive && styles.nodeDateActive,
                            ]}>
                                {date}
                            </Text>
                        </View>
                    );
                })}
            </ScrollView>
        </View>
    );

    // 施工日志组件
    const ConstructionLogs = () => (
        <View style={styles.logsContainer}>
            <View style={styles.sectionHeaderLogs}>
                <Text style={styles.sectionTitleText}>施工日志</Text>
            </View>

            <View style={styles.logsList}>
                {MOCK_LOGS.map((log, index) => (
                    <View key={log.id} style={styles.logWrapper}>
                        {/* 时间轴线 */}
                        <View style={styles.logTimeline}>
                            <View style={[
                                styles.logTimelineDot,
                                index === 0 && styles.logTimelineDotActive
                            ]} />
                            {index !== MOCK_LOGS.length - 1 && <View style={styles.logTimelineLine} />}
                        </View>

                        <View style={styles.logContent}>
                            <View style={styles.logMeta}>
                                <Text style={styles.logDateLabel}>{log.dateLabel}, {log.time}</Text>
                            </View>
                            <View style={styles.logBody}>
                                <Text style={styles.logEntryTitle}>
                                    {log.title}
                                    {log.highlight ? ` - ${log.highlight}` : null}
                                </Text>
                                <Text style={styles.logEntryDesc}>{log.description}</Text>
                                {log.images.length > 0 && (
                                    <ScrollView
                                        horizontal
                                        showsHorizontalScrollIndicator={false}
                                        style={styles.logGallery}
                                    >
                                        {log.images.map((img, idx) => (
                                            <TouchableOpacity
                                                key={idx}
                                                onPress={() => openViewer(log.images, idx)}
                                                activeOpacity={0.8}
                                            >
                                                <Image source={{ uri: img }} style={styles.logGalleryImage} />
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                )}
                            </View>
                        </View>
                    </View>
                ))}
            </View>
        </View>
    );



    return (
        <View style={styles.container}>
            {isFocused && <StatusBar
                barStyle={isHeaderScrolled ? "dark-content" : "light-content"}
                backgroundColor="transparent"
                translucent
            />}

            {loading ? (
                <View style={[styles.container, styles.center]}>
                    <ActivityIndicator color={PRIMARY_GOLD} />
                </View>
            ) : hasProject ? (
                <ScrollView
                    style={styles.activeContainer}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                    }
                    stickyHeaderIndices={[1]}
                    onScroll={(e) => {
                        const offsetY = e.nativeEvent.contentOffset.y;
                        setIsHeaderScrolled(offsetY > 200); // Threshold at 200 (near hero height)
                    }}
                    scrollEventThrottle={16}
                >
                    <ProjectHero />
                    <MilestoneTimeline />
                    <View style={styles.mainContent}>
                        <ConstructionLogs />
                    </View>
                    <View style={{ height: 40 }} />
                </ScrollView>
            ) : (
                <SafeAreaView style={styles.container}>
                    <View style={styles.simpleHeader}>
                        <Text style={styles.simpleHeaderTitle} onPress={() => setHasProject(!hasProject)}>装修进度</Text>
                    </View>
                    <EmptyState />
                </SafeAreaView>
            )}

            {/* 图片查看器 */}
            <Modal
                visible={viewerVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setViewerVisible(false)}
            >
                <View style={styles.viewerBackground}>
                    <TouchableOpacity
                        style={styles.viewerCloseBtn}
                        onPress={() => setViewerVisible(false)}
                    >
                        <X size={28} color="#FFFFFF" />
                    </TouchableOpacity>

                    <View style={styles.viewerCenter}>
                        <Image
                            source={{ uri: viewerImages[viewerIndex] }}
                            style={styles.viewerMainImage}
                            resizeMode="contain"
                        />
                    </View>

                    {viewerImages.length > 1 && (
                        <View style={styles.viewerNav}>
                            <TouchableOpacity
                                style={[styles.viewerNavBtn, viewerIndex === 0 && styles.viewerNavDisabled]}
                                onPress={() => setViewerIndex(prev => Math.max(0, prev - 1))}
                            >
                                <ChevronLeft size={32} color={viewerIndex === 0 ? '#666' : '#FFFFFF'} />
                            </TouchableOpacity>

                            <Text style={styles.viewerCounter}>
                                {viewerIndex + 1} / {viewerImages.length}
                            </Text>

                            <TouchableOpacity
                                style={[styles.viewerNavBtn, viewerIndex === viewerImages.length - 1 && styles.viewerNavDisabled]}
                                onPress={() => setViewerIndex(prev => Math.min(viewerImages.length - 1, prev + 1))}
                            >
                                <ChevronRight size={32} color={viewerIndex === viewerImages.length - 1 ? '#666' : '#FFFFFF'} />
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    center: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    activeContainer: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    simpleHeader: {
        paddingTop: Platform.OS === 'ios' ? 54 : 44, // 针对沉浸式状态栏留出空间
        paddingBottom: 14,
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
        backgroundColor: '#FFFFFF',
    },
    simpleHeaderTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111',
    },
    // Hero Section
    heroContainer: {
        height: 240,
        width: '100%',
        position: 'relative',
    },
    heroImage: {
        width: '100%',
        height: '100%',
        backgroundColor: '#E5E7EB',
    },
    heroOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    heroContent: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 24,
        paddingTop: Platform.OS === 'ios' ? 60 : 50, // 为沉浸式状态栏留出透明空间，保护文字 UI
    },
    heroTop: {
        marginBottom: 8,
    },
    constructionBadge: {
        backgroundColor: PRIMARY_GOLD,
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 20,
        alignSelf: 'flex-start',
    },
    constructionBadgeText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '700',
    },
    projectTitleContainer: {
        marginTop: 4,
    },
    heroProjectName: {
        color: '#FFFFFF',
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    heroLocation: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    heroLocationText: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 12,
        marginLeft: 4,
    },
    // Main Content
    mainContent: {
        marginTop: 0,
    },
    sectionCard: {
        backgroundColor: '#FFFFFF',
        paddingTop: Platform.OS === 'ios' ? 48 : 44, // 增加顶部像素，保护吸顶时的安全区域
        paddingBottom: 24,
        borderBottomWidth: 8,
        borderBottomColor: '#F3F4F6',
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        marginBottom: 20,
    },
    sectionTitleText: {
        fontSize: 17,
        fontWeight: 'bold',
        color: '#111',
    },
    sectionLink: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    sectionLinkText: {
        fontSize: 13,
        color: '#A1A1AA',
        marginRight: 2,
    },
    timelineScroll: {
        paddingLeft: 16,
    },
    timelineItem: {
        width: 80,
        alignItems: 'center',
        marginRight: 12,
    },
    nodeContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
        borderWidth: 2,
        borderColor: '#F9FAFB',
    },
    nodeContainerActive: {
        backgroundColor: PRIMARY_GOLD,
        borderColor: 'rgba(212, 175, 55, 0.2)',
    },
    nodeContainerCompleted: {
        backgroundColor: '#111827',
    },
    nodeLabel: {
        fontSize: 12,
        color: '#6B7280',
        marginBottom: 2,
    },
    nodeLabelActive: {
        color: PRIMARY_GOLD,
        fontWeight: '700',
    },
    nodeLabelCompleted: {
        color: '#111',
        fontWeight: '500',
    },
    nodeDate: {
        fontSize: 10,
        color: '#A1A1AA',
    },
    nodeDateActive: {
        color: PRIMARY_GOLD,
    },
    // Logs
    logsContainer: {
        backgroundColor: '#FFFFFF',
        paddingVertical: 20,
    },
    sectionHeaderLogs: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        marginBottom: 16,
    },
    logsList: {
        paddingHorizontal: 16,
    },
    logWrapper: {
        flexDirection: 'row',
        minHeight: 120,
    },
    logTimeline: {
        width: 20,
        alignItems: 'center',
    },
    logTimelineDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#E5E7EB',
        zIndex: 2,
        marginTop: 4,
    },
    logTimelineDotActive: {
        backgroundColor: PRIMARY_GOLD,
        width: 12,
        height: 12,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: 'rgba(212, 175, 55, 0.2)',
    },
    logTimelineLine: {
        position: 'absolute',
        top: 14,
        bottom: -4,
        width: 1,
        backgroundColor: '#F3F4F6',
    },
    logContent: {
        flex: 1,
        marginLeft: 12,
        paddingBottom: 24,
    },
    logMeta: {
        marginBottom: 6,
    },
    logDateLabel: {
        fontSize: 11,
        fontWeight: 'bold',
        color: PRIMARY_GOLD,
        textTransform: 'uppercase',
    },
    logBody: {
    },
    logEntryTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#111',
        marginBottom: 8,
    },
    textGold: {
        color: PRIMARY_GOLD,
    },
    logEntryDesc: {
        fontSize: 15,
        color: '#6B7280',
        lineHeight: 22,
    },
    logGallery: {
        marginTop: 12,
    },
    logGalleryImage: {
        width: 100,
        height: 100,
        borderRadius: 12,
        marginRight: 8,
        backgroundColor: '#F3F4F6',
    },

    // Empty State
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
        backgroundColor: '#FFFFFF',
    },
    emptyIllustration: {
        width: 160,
        height: 160,
        borderRadius: 80,
        backgroundColor: '#F9FAFB',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 32,
    },
    emptyTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#111',
        marginBottom: 12,
    },
    emptySubtitle: {
        fontSize: 15,
        color: '#6B7280',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 32,
    },
    emptyBtn: {
        backgroundColor: '#111',
        paddingHorizontal: 40,
        paddingVertical: 14,
        borderRadius: 12,
    },
    emptyBtnText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    // Image Viewer Styles
    viewerBackground: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.95)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    viewerCloseBtn: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 60 : 40,
        right: 20,
        zIndex: 10,
        padding: 8,
    },
    viewerCenter: {
        width: SCREEN_WIDTH,
        height: SCREEN_WIDTH * 1.5,
        justifyContent: 'center',
        alignItems: 'center',
    },
    viewerMainImage: {
        width: '100%',
        height: '100%',
    },
    viewerNav: {
        position: 'absolute',
        bottom: 50,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
    },
    viewerNavBtn: {
        padding: 10,
    },
    viewerNavDisabled: {
        opacity: 0.3,
    },
    viewerCounter: {
        color: '#FFFFFF',
        fontSize: 15,
        marginHorizontal: 30,
        fontWeight: 'bold',
    },
});

export default MySiteScreen;
