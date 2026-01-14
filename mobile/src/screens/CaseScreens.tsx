import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    Image,
    TouchableOpacity,
    Dimensions,
    FlatList,
    Modal,
    Platform,
    ActivityIndicator,
    Animated,
    ImageBackground,
    StatusBar,
} from 'react-native';
import { ArrowLeft, X, Share2, ChevronDown, ChevronUp } from 'lucide-react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import Clipboard from '@react-native-clipboard/clipboard';
import { providerApi, caseApi } from '../services/api';
import { getWebUrl } from '../config';
import { useToast } from '../components/Toast';

const { width } = Dimensions.get('window');

// Mock case data
const MOCK_CASES = [
    {
        id: 1,
        title: '现代简约三居室改造',
        coverImage: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
        style: '现代简约',
        area: '120㎡',
        houseLayout: '3室2厅2卫',
        year: '2024',
        price: '18.5万',
        description: '本案例位于城市中心高档社区，业主是一对年轻夫妇。他们希望打造一个简洁大气、功能完善的现代化住宅。设计师通过开放式布局、明亮的色彩搭配和精选的家具，成功实现了业主的愿望。',
        images: [
            'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
            'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
            'https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
            'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
        ],
        height: 180,
    },
    {
        id: 2,
        title: '北欧风格小户型焕新',
        coverImage: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
        style: '北欧风格',
        area: '85㎡',
        houseLayout: '2客1厅1卫',
        year: '2024',
        price: '12.8万',
        description: '这是一套位于老城区的小户型公寓改造项目。通过巧妙的空间规划和北欧风格的设计语言，让原本局促的空间焕发新生。大量使用白色和原木色，营造出清新自然的居住氛围。',
        images: [
            'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
            'https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
        ],
        height: 220,
    },
    {
        id: 3,
        title: '新中式别墅设计',
        coverImage: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
        style: '新中式',
        area: '280㎡',
        houseLayout: '5客3厅3卫',
        year: '2023',
        price: '45.0万',
        description: '这套别墅项目融合了传统中式元素与现代设计理念。通过木质格栅、水墨画元素和东方园林的设计手法，打造出既有文化底蕴又不失现代感的居住空间。',
        images: [
            'https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
            'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
            'https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
        ],
        height: 200,
    },
    {
        id: 4,
        title: '轻奢法式公寓',
        coverImage: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
        style: '法式轻奢',
        area: '150㎡',
        houseLayout: '4宨2厅2卫',
        year: '2024',
        price: '28.0万',
        description: '法式轻奢风格的公寓设计，注重细节与品质。通过精致的石膏线条、优雅的配色和高端软装，打造出浪漫又不失格调的居住环境。',
        images: [
            'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
            'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
        ],
        height: 160,
    },
    {
        id: 5,
        title: '工业风Loft改造',
        coverImage: 'https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
        style: '工业风',
        area: '100㎡',
        houseLayout: '1客1厅1卫',
        year: '2023',
        price: '15.0万',
        description: '将老厂房改造成现代化的Loft住宅。保留了原有的裸露管道和砖墙，结合现代化的家具和灯具设计，营造出独特的工业美学氛围。',
        images: [
            'https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
        ],
        height: 190,
    },
    {
        id: 6,
        title: '日式禅意住宅',
        coverImage: 'https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
        style: '日式',
        area: '95㎡',
        houseLayout: '2客1厅1卫',
        year: '2024',
        price: '13.5万',
        description: '追求极致简约的日式设计，通过留白、自然材质和柔和光线，创造出宁静致远的禅意空间。',
        images: [
            'https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
            'https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
        ],
        height: 210,
    },
];

// ========== Case Gallery Screen ==========
export const CaseGalleryScreen = ({ route, navigation }: any) => {
    const { providerId, providerName, providerType } = route.params || {};
    const [cases, setCases] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadCases();
    }, []);

    const loadCases = async () => {
        try {
            // 根据 providerType 选择 API 类型
            const apiType = providerType === 'designer' ? 'designers' :
                providerType === 'company' ? 'companies' : 'foremen';
            const res = await providerApi.getCases(apiType, providerId);
            if (res.data && res.data.list) {
                // 为每个案例添加随机高度
                const casesWithHeight = res.data.list.map((c: any, idx: number) => ({
                    ...c,
                    height: 160 + (idx % 3) * 30, // 160, 190, 220
                }));
                setCases(casesWithHeight);
            }
        } catch (error) {
            console.log('加载案例失败:', error);
            // 降级使用 MOCK 数据
            setCases(MOCK_CASES);
        } finally {
            setLoading(false);
        }
    };

    const renderCaseCard = (caseItem: any) => (
        <TouchableOpacity
            key={caseItem.id}
            style={[styles.caseCard, { height: (caseItem.height || 180) + 60 }]}
            onPress={() => navigation.navigate('CaseDetail', {
                caseId: caseItem.id,
                initialData: {
                    title: caseItem.title,
                    coverImage: caseItem.coverImage,
                    style: caseItem.style,
                    area: caseItem.area,
                }
            })}
        >
            <Image
                source={{ uri: caseItem.coverImage }}
                style={[styles.caseCover, { height: caseItem.height || 180 }]}
                resizeMode="cover"
            />
            <View style={styles.caseInfo}>
                <Text style={styles.caseTitle} numberOfLines={1}>{caseItem.title}</Text>
                <Text style={styles.caseStyle}>{caseItem.style}</Text>
            </View>
        </TouchableOpacity>
    );

    const leftColumn = cases.filter((_, i) => i % 2 === 0);
    const rightColumn = cases.filter((_, i) => i % 2 === 1);

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ArrowLeft size={24} color="#111" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>作品案例</Text>
                <View style={styles.placeholder} />
            </View>

            {/* Gallery Grid */}
            {loading ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color="#111" />
                </View>
            ) : cases.length === 0 ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ color: '#9CA3AF' }}>暂无案例</Text>
                </View>
            ) : (
                <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                    <View style={styles.galleryGrid}>
                        <View style={styles.column}>
                            {leftColumn.map(renderCaseCard)}
                        </View>
                        <View style={styles.column}>
                            {rightColumn.map(renderCaseCard)}
                        </View>
                    </View>
                    <View style={{ height: 20 }} />
                </ScrollView>
            )}
        </SafeAreaView>
    );
};

// ========== Parallax Scroll Layout for Case Detail ==========
const ParallaxCaseLayout = ({
    scrollY,
    headerHeight = 320,
    coverImage,
    title,
    onBack,
    onShare,
    children,
}: any) => {
    // Animations
    const imageTranslateY = scrollY.interpolate({
        inputRange: [0, headerHeight],
        outputRange: [0, -headerHeight / 2],
        extrapolate: 'clamp',
    });
    const imageScale = scrollY.interpolate({
        inputRange: [-headerHeight, 0],
        outputRange: [2, 1],
        extrapolate: 'clamp',
    });
    const navOpacity = scrollY.interpolate({
        inputRange: [0, 200],
        outputRange: [0, 1],
        extrapolate: 'clamp',
    });

    return (
        <View style={styles.parallaxContainer}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

            {/* 1. Parallax Header */}
            <Animated.View style={[styles.parallaxHeader, { height: headerHeight, transform: [{ translateY: imageTranslateY }, { scale: imageScale }] }]}>
                <ImageBackground
                    source={{ uri: coverImage }}
                    style={{ width: '100%', height: '100%', justifyContent: 'flex-end' }}
                >
                    <Svg height="100%" width="100%" style={StyleSheet.absoluteFillObject}>
                        <Defs>
                            <LinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                                <Stop offset="0.3" stopColor="black" stopOpacity="0" />
                                <Stop offset="1" stopColor="black" stopOpacity="0.8" />
                            </LinearGradient>
                        </Defs>
                        <Rect x="0" y="0" width="100%" height="100%" fill="url(#grad)" />
                    </Svg>

                    <View style={styles.heroContent}>
                        <Text style={styles.caseHeroTitle} numberOfLines={2}>{title}</Text>
                    </View>
                </ImageBackground>
            </Animated.View>

            {/* 2. Sticky Nav */}
            <View style={styles.stickyNavContainer}>
                <Animated.View style={[styles.stickyNavBg, { opacity: navOpacity }]} />
                <SafeAreaView>
                    <View style={styles.stickyNavContent}>
                        <TouchableOpacity onPress={onBack} style={styles.stickyActionBtn}>
                            <View style={{ width: 24, height: 24, justifyContent: 'center', alignItems: 'center' }}>
                                <ArrowLeft size={24} color="#fff" style={{ position: 'absolute' }} />
                                <Animated.View style={{ opacity: navOpacity }}>
                                    <ArrowLeft size={24} color="#111" />
                                </Animated.View>
                            </View>
                        </TouchableOpacity>

                        {/* Title Fades In */}
                        <View style={{ flex: 1, alignItems: 'center', marginHorizontal: 8 }}>
                            <Animated.Text
                                numberOfLines={1}
                                ellipsizeMode="tail"
                                style={{ opacity: navOpacity, fontSize: 16, fontWeight: '600', color: '#111' }}
                            >
                                {title}
                            </Animated.Text>
                        </View>

                        <TouchableOpacity style={[styles.stickyActionBtn, { marginLeft: 8 }]} onPress={onShare}>
                            <View style={{ width: 24, height: 24, justifyContent: 'center', alignItems: 'center' }}>
                                <Share2 size={20} color="#fff" style={{ position: 'absolute' }} />
                                <Animated.View style={{ opacity: navOpacity }}>
                                    <Share2 size={20} color="#333" />
                                </Animated.View>
                            </View>
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </View>

            {/* 3. Content */}
            <Animated.ScrollView
                style={{ flex: 1, backgroundColor: 'transparent' }}
                contentContainerStyle={{ paddingTop: headerHeight - 30, paddingBottom: 100 }}
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                    { useNativeDriver: true }
                )}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.contentCard}>
                    {children}
                </View>
            </Animated.ScrollView>
        </View>
    );
};

// ========== Case Detail Screen ==========
export const CaseDetailScreen = ({ route, navigation }: any) => {
    const params = route.params || {};
    const caseId = params.caseId ?? params.caseItem?.id;
    const initialData =
        params.initialData ??
        (params.caseItem
            ? {
                title: params.caseItem.title,
                coverImage: params.caseItem.coverImage,
                style: params.caseItem.style,
                area: params.caseItem.area,
            }
            : undefined);

    const { showToast } = useToast();
    const scrollY = useRef(new Animated.Value(0)).current;

    // State management
    const [caseData, setCaseData] = useState<any>(initialData || null);
    const [quoteData, setQuoteData] = useState<any>(null);
    const [loading, setLoading] = useState(!initialData);
    const [quoteLoading, setQuoteLoading] = useState(false);
    const [quoteExpanded, setQuoteExpanded] = useState(false);
    const [showImageViewer, setShowImageViewer] = useState(false);
    const [viewerIndex, setViewerIndex] = useState(0);
    const flatListRef = useRef<FlatList>(null);

    // Fetch case detail on mount
    useEffect(() => {
        if (!caseId) {
            showToast({ message: '缺少案例ID', type: 'error' });
            navigation.goBack();
            return;
        }

        loadCaseDetail();
    }, [caseId, navigation, showToast]);

    const loadCaseDetail = async () => {
        try {
            setLoading(true);
            const res = await caseApi.getDetail(caseId);
            if (res.data) {
                // Parse images if string
                const parsedData = {
                    ...res.data,
                    images: typeof res.data.images === 'string'
                        ? JSON.parse(res.data.images)
                        : res.data.images || [res.data.coverImage]
                };
                setCaseData(parsedData);
            }
        } catch (error) {
            console.error('Failed to load case detail:', error);
            showToast({ message: '加载案例详情失败', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    // Fetch quote details when expanded (lazy load)
    const loadQuoteDetail = async () => {
        if (quoteData) return; // Already loaded

        try {
            setQuoteLoading(true);
            const res = await caseApi.getQuote(caseId);
            if (res.data) {
                setQuoteData(res.data);
            }
        } catch (error: any) {
            console.error('Failed to load quote:', error);
            // Handle 401 gracefully (not logged in)
            if (error?.response?.status === 401) {
                showToast({ message: '请先登录查看报价详情', type: 'warning' });
            } else {
                showToast({ message: '加载报价详情失败', type: 'error' });
            }
        } finally {
            setQuoteLoading(false);
        }
    };

    const handleQuoteToggle = () => {
        if (!quoteExpanded && !quoteData) {
            loadQuoteDetail();
        }
        setQuoteExpanded(!quoteExpanded);
    };

    const getOrderedCategoryTotals = () => {
        if (!quoteData?.items || !Array.isArray(quoteData.items) || quoteData.items.length === 0) {
            return [] as Array<[string, number]>;
        }

        const totals: Record<string, number> = {};
        quoteData.items.forEach((item: any) => {
            const rawCategory = item.category || '其他';
            const category = ['设计费', '施工费', '主材费', '软装费'].includes(rawCategory) ? rawCategory : '其他';
            totals[category] = (totals[category] || 0) + (item.amountCent || 0);
        });

        const ordered = ['设计费', '施工费', '主材费', '软装费', '其他'] as const;
        return ordered
            .map((category) => [category, totals[category] || 0] as [string, number])
            .filter(([, amountCent]) => amountCent > 0);
    };

    const categoryTotals = getOrderedCategoryTotals();

    // Format price from cents
    const formatPrice = (cents: number) => {
        return (cents / 100).toFixed(2);
    };

    // Loading state
    if (loading || !caseData) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <ArrowLeft size={24} color="#111" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>案例详情</Text>
                    <View style={styles.placeholder} />
                </View>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color="#111" />
                </View>
            </SafeAreaView>
        );
    }

    // Data validation
    if (!caseData.images || caseData.images.length === 0) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <ArrowLeft size={24} color="#111" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>案例详情</Text>
                    <View style={styles.placeholder} />
                </View>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ color: '#9CA3AF' }}>案例数据加载失败</Text>
                </View>
            </SafeAreaView>
        );
    }

    const handleShare = () => {
        const shareUrl = `${getWebUrl()}/case/${caseData.id}`;
        Clipboard.setString(shareUrl);
        showToast({ message: '链接已复制到剪贴板', type: 'success' });
    };

    const openImageViewer = (index: number) => {
        setViewerIndex(index);
        setShowImageViewer(true);
    };

    // Convert total price from cents or legacy price field
    const totalPrice = caseData.quoteTotalCent
        ? formatPrice(caseData.quoteTotalCent)
        : caseData.price || '18.5万';

    return (
        <View style={styles.container}>
            <ParallaxCaseLayout
                scrollY={scrollY}
                headerHeight={320}
                coverImage={caseData.images[0]}
                title={caseData.title}
                onBack={() => navigation.goBack()}
                onShare={handleShare}
            >
                {/* 信息卡片 - 浮动在Hero下方 */}
                <View style={[styles.caseInfoCard, { marginTop: -40, alignSelf: 'center', width: '90%' }]}>
                    <View style={styles.infoRow}>
                        <View style={styles.infoItem}>
                            <Text style={styles.infoLabel}>户型</Text>
                            <Text style={styles.infoValue}>{caseData.layout || caseData.houseLayout || '暂无'}</Text>
                        </View>
                        <View style={styles.infoDivider} />
                        <View style={styles.infoItem}>
                            <Text style={styles.infoLabel}>面积</Text>
                            <Text style={styles.infoValue}>{caseData.area || '120㎡'}</Text>
                        </View>
                        <View style={styles.infoDivider} />
                        <View style={styles.infoItem}>
                            <Text style={styles.infoLabel}>风格</Text>
                            <Text style={styles.infoValue}>{caseData.style || '现代简约'}</Text>
                        </View>
                        <View style={styles.infoDivider} />
                        <View style={styles.infoItem}>
                            <Text style={styles.infoLabel}>完工</Text>
                            <Text style={styles.infoValue}>{caseData.year || '2024年'}</Text>
                        </View>
                    </View>
                </View>

                {/* 报价展示 */}
                <View style={styles.quoteSection}>
                    <View style={styles.quoteSummary}>
                        <View style={styles.quoteHeader}>
                            <Text style={styles.quoteSectionTitle}>装修报价</Text>
                            <View style={styles.priceDisplay}>
                                <Text style={styles.priceSymbol}>¥</Text>
                                <Text style={styles.priceAmount}>{totalPrice}</Text>
                            </View>
                        </View>
                        <Text style={styles.quoteHint}>含设计费、施工费、主材费</Text>
                    </View>

                    {/* 展开/收起按钮 */}
                    <TouchableOpacity
                        style={styles.quoteToggleBtn}
                        onPress={handleQuoteToggle}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.quoteToggleText}>
                            {quoteExpanded ? '收起详细报价' : '查看详细报价'}
                        </Text>
                        {quoteLoading ? (
                            <ActivityIndicator size="small" color="#111" />
                        ) : quoteExpanded ? (
                            <ChevronUp size={18} color="#111" />
                        ) : (
                            <ChevronDown size={18} color="#111" />
                        )}
                    </TouchableOpacity>

                    {/* 详细报价（可展开） */}
                    {quoteExpanded && categoryTotals.length > 0 && (
                        <View style={styles.quoteDetails}>
                            {categoryTotals.map(([category, amountCent], index) => (
                                <React.Fragment key={category}>
                                    {index > 0 && <View style={styles.quoteDivider} />}
                                    <View style={styles.quoteDetailItem}>
                                        <View style={styles.quoteItemLeft}>
                                            <Text style={styles.quoteItemTitle}>{category}</Text>
                                            <Text style={styles.quoteItemDesc}>
                                                {category === '设计费' && '含平面布局、效果图、施工图'}
                                                {category === '施工费' && '含水电改造、泥木瓦油工程'}
                                                {category === '主材费' && '含地板、瓷砖、洁具、橱柜等'}
                                                {category === '软装费' && '含家具、窗帘、灯具、装饰品'}
                                            </Text>
                                        </View>
                                        <Text style={styles.quoteItemPrice}>
                                            ¥{formatPrice(amountCent)}
                                        </Text>
                                    </View>
                                </React.Fragment>
                            ))}
                        </View>
                    )}

                    {quoteExpanded && !quoteLoading && categoryTotals.length === 0 && (
                        <View style={{ padding: 16, alignItems: 'center' }}>
                            <Text style={{ color: '#9CA3AF', fontSize: 14 }}>
                                暂无详细报价信息
                            </Text>
                        </View>
                    )}
                </View>

                {/* 设计理念 */}
                <View style={styles.magazineSection}>
                    <Text style={styles.magSectionTitle}>设计理念</Text>
                    <Text style={styles.magDescText}>
                        {caseData.description || '本案例位于城市中心高档社区，业主是一对年轻夫妇。采用简洁大气的设计风格，功能完善的现代化住宅。'}
                    </Text>
                </View>

                {/* 案例图赏 */}
                <View style={styles.magazineSection}>
                    <Text style={styles.magSectionTitle}>案例图赏 ({caseData.images.length})</Text>
                    <View style={styles.fullWidthGallery}>
                        {caseData.images.map((img: string, idx: number) => (
                            <View key={idx} style={styles.fullWidthImageItem}>
                                {/* 图片描述文字 */}
                                <Text style={styles.imageDescTitle}>
                                    {idx === 0 ? '客厅空间' :
                                     idx === 1 ? '餐厅区域' :
                                     idx === 2 ? '主卧设计' :
                                     idx === 3 ? '厨房空间' :
                                     `空间展示 ${idx + 1}`}
                                </Text>
                                <Text style={styles.imageDescText}>
                                    {idx === 0 ? '采用开放式布局，大面积落地窗引入自然光线，搭配简约现代的家具，营造宽敞明亮的居住氛围。' :
                                     idx === 1 ? '餐厅与客厅相连，采用吊灯作为视觉焦点，木质餐桌与整体风格完美融合。' :
                                     idx === 2 ? '主卧以舒适为主，柔和的色调搭配精选的床品，打造温馨的休息空间。' :
                                     idx === 3 ? '厨房采用现代化橱柜设计，合理的动线规划，让烹饪变得更加便捷高效。' :
                                     '精心设计的每一处细节，都体现了对生活品质的追求。'}
                                </Text>

                                {/* 全宽图片 */}
                                <TouchableOpacity
                                    style={styles.fullWidthImageWrapper}
                                    onPress={() => openImageViewer(idx)}
                                    activeOpacity={0.9}
                                >
                                    <Image
                                        source={{ uri: img }}
                                        style={styles.fullWidthImage}
                                        resizeMode="cover"
                                    />
                                </TouchableOpacity>
                            </View>
                        ))}
                    </View>
                </View>
            </ParallaxCaseLayout>

            {/* 图片查看器 */}
            <Modal visible={showImageViewer} transparent animationType="fade">
                <View style={styles.imageViewer}>
                    <TouchableOpacity style={styles.closeBtn} onPress={() => setShowImageViewer(false)}>
                        <X size={28} color="#fff" />
                    </TouchableOpacity>
                    <FlatList
                        ref={flatListRef}
                        data={caseData.images}
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        initialScrollIndex={viewerIndex}
                        getItemLayout={(data, index) => ({
                            length: width,
                            offset: width * index,
                            index,
                        })}
                        onMomentumScrollEnd={(event) => {
                            const index = Math.round(event.nativeEvent.contentOffset.x / width);
                            setViewerIndex(index);
                        }}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={styles.viewerImageContainer}
                                activeOpacity={1}
                                onPress={() => setShowImageViewer(false)}
                            >
                                <Image
                                    source={{ uri: item }}
                                    style={styles.viewerImage}
                                    resizeMode="contain"
                                />
                            </TouchableOpacity>
                        )}
                        keyExtractor={(item, index) => index.toString()}
                    />
                    <View style={styles.viewerIndicator}>
                        <Text style={styles.viewerCounter}>{viewerIndex + 1} / {caseData.images.length}</Text>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    // ===========================
    // Parallax Layout Styles
    // ===========================
    parallaxContainer: {
        flex: 1,
        backgroundColor: '#fff',
    },
    parallaxHeader: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        overflow: 'hidden',
    },
    heroContent: {
        paddingHorizontal: 20,
        paddingBottom: 60, // 增加底部间距，避免被信息卡片遮挡
    },
    caseHeroTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#fff',
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },
    stickyNavContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
    },
    stickyNavBg: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#fff',
        borderBottomWidth: 0.5,
        borderBottomColor: '#E5E7EB',
    },
    stickyNavContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingBottom: 10,
        paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 10 : 0,
    },
    stickyActionBtn: {
        padding: 8,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.1)',
    },
    contentCard: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingTop: 24,
        paddingBottom: 100,
        minHeight: 800,
        marginTop: 0,
    },
    // Info Card Styles
    caseInfoCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        paddingVertical: 20,
        paddingHorizontal: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 5,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    infoItem: {
        flex: 1,
        alignItems: 'center',
    },
    infoLabel: {
        fontSize: 12,
        color: '#9CA3AF',
        marginBottom: 4,
    },
    infoValue: {
        fontSize: 14,
        fontWeight: '500',
        color: '#111',
    },
    infoDivider: {
        width: 1,
        height: 24,
        backgroundColor: '#F3F4F6',
    },
    // Quote Section Styles
    quoteSection: {
        marginTop: 24,
        marginHorizontal: 20,
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
    },
    quoteSummary: {
        marginBottom: 16,
    },
    quoteHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    quoteSectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#111',
    },
    priceDisplay: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    priceSymbol: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FF6B35',
        marginRight: 2,
    },
    priceAmount: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#FF6B35',
    },
    quoteHint: {
        fontSize: 13,
        color: '#9CA3AF',
        marginTop: 4,
    },
    quoteToggleBtn: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
        marginTop: 8,
    },
    quoteToggleText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#111',
        marginRight: 6,
    },
    quoteDetails: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
    },
    quoteDetailItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
    },
    quoteItemLeft: {
        flex: 1,
    },
    quoteItemTitle: {
        fontSize: 15,
        fontWeight: '500',
        color: '#111',
        marginBottom: 4,
    },
    quoteItemDesc: {
        fontSize: 12,
        color: '#9CA3AF',
    },
    quoteItemPrice: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111',
    },
    quoteDivider: {
        height: 1,
        backgroundColor: '#F3F4F6',
    },
    // Magazine Section Styles
    magazineSection: {
        marginTop: 24,
        paddingHorizontal: 20,
    },
    magSectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#111',
        marginBottom: 12,
        letterSpacing: 0.5,
    },
    magDescText: {
        fontSize: 15,
        color: '#4B5563',
        lineHeight: 24,
    },
    // Image Gallery Styles
    imageGallery: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 12,
        marginHorizontal: -4,
    },
    galleryImageWrapper: {
        width: '50%',
        paddingHorizontal: 4,
        marginBottom: 8,
    },
    galleryImage: {
        width: '100%',
        height: 160,
        borderRadius: 12,
        backgroundColor: '#E5E7EB',
    },
    // Full Width Gallery Styles (New Layout)
    fullWidthGallery: {
        marginTop: 16,
    },
    fullWidthImageItem: {
        marginBottom: 32,
    },
    imageDescTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111',
        marginBottom: 8,
    },
    imageDescText: {
        fontSize: 14,
        color: '#6B7280',
        lineHeight: 22,
        marginBottom: 12,
    },
    fullWidthImageWrapper: {
        width: '100%',
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#E5E7EB',
    },
    fullWidthImage: {
        width: '100%',
        height: 240,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'ios' ? 12 : 44, // 适配沉浸式状态栏
        paddingBottom: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    backBtn: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: '#111',
    },
    shareBtn: {
        padding: 4,
    },
    placeholder: {
        width: 28,
    },
    content: {
        flex: 1,
    },
    // Gallery styles
    galleryGrid: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingTop: 16,
    },
    column: {
        flex: 1,
        marginHorizontal: 4,
    },
    caseCard: {
        marginBottom: 16,
        borderRadius: 12,
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
        overflow: 'hidden',
    },
    caseCover: {
        width: '100%',
        backgroundColor: '#E5E7EB',
    },
    caseInfo: {
        padding: 12,
    },
    caseTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111',
        marginBottom: 4,
    },
    caseStyle: {
        fontSize: 12,
        color: '#9CA3AF',
    },
    // Detail styles
    mainImage: {
        width: '100%',
        height: 280,
        backgroundColor: '#E5E7EB',
    },
    indicatorsOverlay: {
        position: 'absolute',
        bottom: 16,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'center',
    },
    indicator: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: 'rgba(255, 255, 255, 0.5)',
        marginHorizontal: 4,
    },
    activeIndicator: {
        backgroundColor: '#fff',
        width: 16,
    },
    caseInfoSection: {
        padding: 20,
    },
    caseDetailTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#111',
        marginBottom: 12,
    },

    infoGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    caseMeta: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    caseMetaText: {
        fontSize: 14,
        color: '#6B7280',
    },
    caseMetaDivider: {
        marginHorizontal: 12,
        color: '#D1D5DB',
    },
    section: {
        padding: 20,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#111',
        marginBottom: 12,
    },
    descText: {
        fontSize: 14,
        color: '#4B5563',
        lineHeight: 24,
    },
    moreImagesScroll: {
        marginTop: 4,
    },
    moreImage: {
        width: 120,
        height: 90,
        borderRadius: 8,
        marginRight: 12,
        backgroundColor: '#E5E7EB',
    },
    // New Premium Styles
    // New Premium Styles
    // floatingHeader & circleBtn removed
    verticalContent: {
        backgroundColor: '#F5F5F5', // Gray background
        padding: 12, // Outer padding
        paddingBottom: 40,
    },
    moduleCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
    },
    verticalGallery: {
        marginTop: 12,
    },
    // cardHeader removed/merged into moduleCard
    premiumTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#111',
        marginBottom: 12,
        lineHeight: 30,
    },
    // premiumSubtitle removed
    priceRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    priceLabel: {
        fontSize: 14,
        color: '#FF4D4F',
        marginRight: 4,
        fontWeight: '500',
    },
    priceValue: {
        fontSize: 28,
        fontWeight: '800',
        color: '#FF4D4F',
    },
    divider: {
        height: 1,
        backgroundColor: '#F3F4F6',
        marginTop: 16,
        marginBottom: 16,
    },
    premiumGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    premiumGridItem: {
        width: '50%',
        marginBottom: 24,
    },
    gridLabel: {
        fontSize: 12,
        color: '#999',
        marginBottom: 6,
        letterSpacing: 1,
    },
    gridValue: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    premiumDesc: {
        fontSize: 15,
        color: '#444',
        lineHeight: 28,
        letterSpacing: 0.5,
    },
    premiumMoreImage: {
        width: 140,
        height: 100,
        borderRadius: 12,
        marginRight: 16,
        backgroundColor: '#F3F4F6',
    },

    // Provider Card (Not used in original detail, but kept for gallery?) No, original didn't have provider card in detail.
    // Keeping shared styles safe.
    // Bottom Bar
    bottomBar: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 10,
        paddingBottom: 24,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
        backgroundColor: '#fff',
    },
    consultBtn: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
        paddingVertical: 10,
        borderRadius: 8,
        marginRight: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    consultBtnText: {
        color: '#111',
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 6,
    },
    bookBtn: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#111',
        paddingVertical: 10,
        borderRadius: 8,
    },
    bookBtnText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    // Image Viewer
    imageViewer: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.95)',
    },
    closeBtn: {
        position: 'absolute',
        top: 60,
        right: 20,
        zIndex: 10,
        padding: 8,
    },
    viewerImageContainer: {
        width: width,
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    viewerImage: {
        width: width,
        height: width * 0.75,
    },
    viewerIndicator: {
        position: 'absolute',
        bottom: 60,
        alignSelf: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 16,
    },
    viewerCounter: {
        color: '#fff',
        fontSize: 14,
    },
});

// New styles for refactored CaseDetailScreen
const newStyles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA',
    },
    sectionCard: {
        marginTop: 16,
        marginHorizontal: 16,
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 16,
    },
    accentBar: {
        position: 'absolute',
        left: 0,
        top: 16,
        width: 4,
        height: 24,
        backgroundColor: '#FF6B35',
        borderTopRightRadius: 2,
        borderBottomRightRadius: 2,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1A1A1A',
        marginBottom: 12,
        paddingLeft: 12,
    },
    description: {
        fontSize: 15,
        lineHeight: 24,
        color: '#666666',
        paddingLeft: 12,
    },
});


