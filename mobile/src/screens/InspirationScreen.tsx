import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    Image,
    TouchableOpacity,
    Dimensions,
    TouchableWithoutFeedback,
    Animated,
    Easing,
    StatusBar,
    ActivityIndicator,
    RefreshControl,
    Platform,
} from 'react-native';
import { Heart, ChevronDown, ChevronUp, Check } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { inspirationApi } from '../services/api';
import { useToast } from '../components/Toast';
import { getInspirationAvatarUrl, getInspirationCoverImage } from '../utils/inspirationImages';

const { height } = Dimensions.get('window');
const HALF_SCREEN_HEIGHT = height / 2;

// 新的主题色彩系统
const FilterTheme = {
    primary: {
        50: '#EFF6FF',
        100: '#DBEAFE',
        500: '#3B82F6',
        600: '#2563EB',
        700: '#1D4ED8'
    },
    accent: {
        50: '#FEF3C7',
        100: '#FDE68A',
        500: '#F59E0B',
        600: '#D97706',
        700: '#B45309'
    },
    neutral: {
        50: '#F8FAFC',
        100: '#F1F5F9',
        200: '#E2E8F0',
        400: '#94A3B8',
        500: '#64748B',
        600: '#475569'
    }
};

// 新的尺寸和间距规范
const FilterDimensions = {
    button: {
        height: 36,
        paddingHorizontal: 14,
        borderRadius: 18,
        marginRight: 8,
        iconSize: 14
    },
    dropdown: {
        borderRadius: 16,
        padding: 16,
    },
    option: {
        height: 48,
        borderRadius: 12,
        marginRight: 10,
        marginBottom: 10
    }
};

// 筛选选项
const HOUSE_TYPE_OPTIONS = ['全部', '一居', '二居', '三居', '四居及以上', '别墅'];
const PRICE_OPTIONS = ['全部', '10万以下', '10-20万', '20-50万', '50万以上'];
const STYLE_OPTIONS = ['全部', '现代简约', '北欧', '新中式', '轻奢', '日式', '工业风'];

type FilterType = 'houseType' | 'priceRange' | 'style' | null;

const InspirationScreen = () => {
    const navigation = useNavigation<any>();
    const { showToast } = useToast();

    // 数据状态
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // 筛选状态
    const [selectedHouseType, setSelectedHouseType] = useState('全部');
    const [selectedPrice, setSelectedPrice] = useState('全部');
    const [selectedStyle, setSelectedStyle] = useState('全部');

    // 下拉框状态
    const [activeDropdown, setActiveDropdown] = useState<FilterType>(null);
    const filterBarRef = useRef<View>(null);
    const [filterBarBottom, setFilterBarBottom] = useState(0);

    // 按钮布局信息
    const btnLayouts = useRef<Record<string, { x: number, width: number }>>({}).current;

    // 动画值
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(-10)).current;

    // 瀑布流布局常量
    const { width: screenWidth } = Dimensions.get('window');
    // Calculate card width based on screen width - padding (32) - column gaps (20) / 2
    const CARD_WIDTH = (screenWidth - 52) / 2;
    const MIN_RATIO = 0.75;
    const MAX_RATIO = 1.55;
    const DEFAULT_RATIO = 1.33;

    // 缓存图片比例
    const aspectRatioCache = useRef(new Map<string, number>());

    const fetchItems = useCallback(async () => {
        try {
            const params: any = {};
            if (selectedStyle !== '全部') params.style = selectedStyle;
            // Map houseType to layout
            if (selectedHouseType !== '全部') params.layout = selectedHouseType;
            // Map priceRange
            if (selectedPrice !== '全部') {
                if (selectedPrice === '10万以下') params.priceMax = 10;
                else if (selectedPrice === '10-20万') { params.priceMin = 10; params.priceMax = 20; }
                else if (selectedPrice === '20-50万') { params.priceMin = 20; params.priceMax = 50; }
                else if (selectedPrice === '50万以上') { params.priceMin = 50; }
            }

            const res = await inspirationApi.list(params);
            // API returns { code, data: { list: [], ... } }
            const list = res?.data?.list || [];

            // 预计算图片高度，避免布局抖动
            const decoratedList = await Promise.all(list.map(async (item: any) => {
                const uri = getInspirationCoverImage(item);
                let ratio = DEFAULT_RATIO;

                if (uri) {
                    if (aspectRatioCache.current.has(uri)) {
                        ratio = aspectRatioCache.current.get(uri)!;
                    } else {
                        try {
                            const { width: imgWidth, height: imgHeight } = await new Promise<{ width: number, height: number }>((resolve, reject) => {
                                Image.getSize(uri, (w, h) => resolve({ width: w, height: h }), reject);
                            });
                            if (imgWidth && imgHeight) {
                                const rawRatio = imgHeight / imgWidth;
                                ratio = Math.min(Math.max(rawRatio, MIN_RATIO), MAX_RATIO);
                                aspectRatioCache.current.set(uri, ratio);
                            }
                        } catch {
                            // 失败使用默认比例
                        }
                    }
				}

                return {
                    ...item,
                    _coverImage: uri,
                    _authorAvatar: getInspirationAvatarUrl(item.author?.avatar),
                    _displayHeight: CARD_WIDTH * ratio
                };
            }));

            setItems(decoratedList);
        } catch (error) {
            console.error('Fetch inspiration failed:', error);
            // 错误处理可以加上Toast
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [selectedStyle, selectedHouseType, selectedPrice, CARD_WIDTH]);

    useEffect(() => {
        setLoading(true);
        fetchItems();
    }, [fetchItems]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchItems();
    };

    // 计算分列 (Height Balancing)
    const { leftColumn, rightColumn } = useMemo(() => {
        const left: any[] = [];
        const right: any[] = [];
        let leftH = 0;
        let rightH = 0;

        items.forEach((item) => {
            const cardHeight = item._displayHeight || CARD_WIDTH * DEFAULT_RATIO;

            // 估算卡片总高度 (Image + Content)
            // Title (max 2 lines ~40px + margin 10) + Padding (24) + Footer (20) = ~100px
            const totalItemHeight = cardHeight + 100;

            if (leftH <= rightH) {
                left.push(item);
                leftH += totalItemHeight;
            } else {
                right.push(item);
                rightH += totalItemHeight;
            }
        });

        return { leftColumn: left, rightColumn: right };
    }, [items, CARD_WIDTH]);

    const toggleDropdown = (type: FilterType) => {
        if (activeDropdown === type) {
            closeDropdown();
        } else {
            setActiveDropdown(type);
            // 启动动画
            fadeAnim.setValue(0);
            slideAnim.setValue(-10);
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 250,
                    useNativeDriver: true,
                    easing: Easing.out(Easing.ease),
                }),
                Animated.timing(slideAnim, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: true,
                    easing: Easing.out(Easing.back(1.2)),
                }),
            ]).start();
        }
    };

    const closeDropdown = () => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: -10,
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start(() => {
            setActiveDropdown(null);
        });
    };

    const getFilterOptions = (type: FilterType) => {
        switch (type) {
            case 'houseType': return HOUSE_TYPE_OPTIONS;
            case 'priceRange': return PRICE_OPTIONS;
            case 'style': return STYLE_OPTIONS;
            default: return [];
        }
    };

    const getSelectedValue = (type: FilterType) => {
        switch (type) {
            case 'houseType': return selectedHouseType;
            case 'priceRange': return selectedPrice;
            case 'style': return selectedStyle;
            default: return '';
        }
    };

    const setSelectedValue = (type: FilterType, value: string) => {
        switch (type) {
            case 'houseType': setSelectedHouseType(value); break;
            case 'priceRange': setSelectedPrice(value); break;
            case 'style': setSelectedStyle(value); break;
        }
        closeDropdown();
    };

    const handleLike = async (item: any) => {
        const isLiked = item.isLiked;
        const newIsLiked = !isLiked;
        const newCount = (item.likeCount || 0) + (newIsLiked ? 1 : -1);

        // Optimistic update
        setItems(prevItems => prevItems.map(i =>
            i.id === item.id
                ? { ...i, isLiked: newIsLiked, likeCount: newCount }
                : i
        ));

        try {
            if (newIsLiked) {
                await inspirationApi.like(item.id);
            } else {
                await inspirationApi.unlike(item.id);
            }
        } catch {
            // Revert
            setItems(prevItems => prevItems.map(i =>
                i.id === item.id
                    ? { ...i, isLiked: isLiked, likeCount: item.likeCount }
                    : i
            ));
            showToast({ message: '操作失败', type: 'error' });
        }
    };

    const renderCard = (item: any) => (
        <TouchableOpacity
            key={item.id}
            style={styles.card}
            activeOpacity={0.9}
            onPress={() => navigation.navigate('InspirationDetail', { item })}
        >
            <Image
                source={{ uri: item._coverImage || getInspirationCoverImage(item) }}
                style={[styles.cardImage, { height: item._displayHeight || 200 }]}
                resizeMode="cover"
            />
            <View style={styles.cardContent}>
                <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                <View style={styles.cardFooter}>
                    <View style={styles.authorInfo}>
                        <Image
                            source={{ uri: item._authorAvatar || getInspirationAvatarUrl(item.author?.avatar) }}
                            style={styles.authorAvatar}
                        />
                        <Text style={styles.authorName} numberOfLines={1}>{item.author?.name || '未知作者'}</Text>
                    </View>
                    <TouchableOpacity
                        style={styles.likeInfo}
                        onPress={() => handleLike(item)}
                        activeOpacity={0.7}
                    >
                        <Heart size={12} color={item.isLiked ? "#EF4444" : "#9CA3AF"} fill={item.isLiked ? "#EF4444" : "transparent"} />
                        <Text style={styles.likeCount}>{item.likeCount || 0}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </TouchableOpacity>
    );

    const renderFilterBtn = (type: FilterType, label: string, selectedValue: string) => {
        const isActive = selectedValue !== '全部';
        const isOpen = activeDropdown === type;
        const Icon = isOpen ? ChevronUp : ChevronDown;

        // 动态样式
        const bgStyle = isActive ? styles.filterBtnActive : (isOpen ? styles.filterBtnOpen : styles.filterBtn);
        const textStyle = isActive ? styles.filterBtnTextActive : (isOpen ? styles.filterBtnTextOpen : styles.filterBtnText);
        const iconColor = isActive ? '#FFFFFF' : (isOpen ? FilterTheme.primary[600] : FilterTheme.neutral[400]);

        return (
            <TouchableOpacity
                style={[styles.baseFilterBtn, bgStyle]}
                onPress={() => toggleDropdown(type)}
                onLayout={(e) => {
                    btnLayouts[type as string] = e.nativeEvent.layout;
                }}
                activeOpacity={0.8}
            >
                <Text style={textStyle}>
                    {selectedValue === '全部' ? label : selectedValue}
                </Text>
                <Icon size={FilterDimensions.button.iconSize} color={iconColor} />
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle="dark-content" backgroundColor="#fff" />

            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>灵感图库</Text>
            </View>

            {/* 筛选条 */}
            <View
                style={styles.filterBar}
                ref={filterBarRef}
                onLayout={(e) => {
                    const { y, height: barHeight } = e.nativeEvent.layout;
                    setFilterBarBottom(y + barHeight);
                }}
            >
                {renderFilterBtn('houseType', '户型', selectedHouseType)}
                {renderFilterBtn('priceRange', '价格', selectedPrice)}
                {renderFilterBtn('style', '风格', selectedStyle)}
            </View>

            {/* 瀑布流列表 */}
            <ScrollView
                style={styles.content}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                scrollEnabled={activeDropdown === null}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#3B82F6']} />
                }
            >
                {loading && !refreshing ? (
                    <View style={styles.loadingState}>
                        <ActivityIndicator size="large" color="#3B82F6" />
                    </View>
                ) : items.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyText}>暂无匹配的灵感内容</Text>
                        <TouchableOpacity
                            style={styles.resetBtn}
                            onPress={() => {
                                setSelectedHouseType('全部');
                                setSelectedPrice('全部');
                                setSelectedStyle('全部');
                            }}
                        >
                            <Text style={styles.resetBtnText}>重置筛选</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.waterfallGrid}>
                        <View style={styles.column}>
                            {leftColumn.map(renderCard)}
                        </View>
                        <View style={styles.column}>
                            {rightColumn.map(renderCard)}
                        </View>
                    </View>
                )}
            </ScrollView>

            {/* 局部遮罩层 */}
            {activeDropdown !== null && (
                <TouchableWithoutFeedback onPress={closeDropdown}>
                    <Animated.View style={[
                        styles.maskOverlay,
                        { opacity: fadeAnim }
                    ]} />
                </TouchableWithoutFeedback>
            )}

            {/* 下拉框 */}
            {activeDropdown !== null && (
                <Animated.View style={[
                    styles.dropdownWrapper,
                    {
                        top: filterBarBottom + 8,
                        opacity: fadeAnim,
                        transform: [
                            { translateY: slideAnim },
                            {
                                scale: fadeAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [0.98, 1]
                                })
                            }
                        ]
                    }
                ]}>
                    <View style={styles.dropdownContainer}>
                        <ScrollView
                            style={styles.dropdownScroll}
                            showsVerticalScrollIndicator={false}
                            bounces={false}
                        >
                            <View style={styles.optionsGrid}>
                                {getFilterOptions(activeDropdown).map(option => {
                                    const isSelected = getSelectedValue(activeDropdown) === option;
                                    return (
                                        <TouchableOpacity
                                            key={option}
                                            style={[
                                                styles.optionItem,
                                                isSelected && styles.optionItemActive
                                            ]}
                                            onPress={() => setSelectedValue(activeDropdown, option)}
                                            activeOpacity={0.7}
                                        >
                                            <Text style={[
                                                styles.optionText,
                                                isSelected && styles.optionTextActive
                                            ]}>
                                                {option}
                                            </Text>
                                            {isSelected && (
                                                <View style={styles.checkmarkBadge}>
                                                    <Check size={10} color="#fff" strokeWidth={4} />
                                                </View>
                                            )}
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </ScrollView>
                    </View>
                </Animated.View>
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#fff', // 顶部安全区域背景色设为白色，解决断层问题
        paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 12,
        backgroundColor: '#fff',
        zIndex: 20,
    },
    headerTitle: {
        fontSize: 26,
        fontWeight: '800',
        color: '#111827',
        letterSpacing: -0.5,
    },
    filterBar: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingVertical: 12,
        backgroundColor: '#fff',
        zIndex: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    baseFilterBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        height: 36,
        borderRadius: 18,
        marginRight: 12,
    },
    filterBtn: {
        backgroundColor: '#F3F4F6',
    },
    filterBtnActive: {
        backgroundColor: '#111827',
        shadowColor: '#111827',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    filterBtnOpen: {
        backgroundColor: '#EFF6FF',
        borderWidth: 1,
        borderColor: '#BFDBFE',
    },
    filterBtnText: {
        fontSize: 13,
        color: '#4B5563',
        marginRight: 4,
        fontWeight: '600',
    },
    filterBtnTextActive: {
        color: '#FFFFFF',
        fontWeight: '600',
        marginRight: 4,
    },
    filterBtnTextOpen: {
        color: '#2563EB',
        fontWeight: '600',
        marginRight: 4,
    },
    content: {
        flex: 1,
        zIndex: 1,
        backgroundColor: '#F3F4F6', // 内容区域保持灰色
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 100,
    },
    loadingState: {
        paddingTop: 50,
        alignItems: 'center',
    },
    waterfallGrid: {
        flexDirection: 'row',
    },
    column: {
        flex: 1,
        marginHorizontal: 5,
    },
    card: {
        marginBottom: 16,
        borderRadius: 12,
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 3,
        overflow: 'hidden',
    },
    cardImage: {
        width: '100%',
        backgroundColor: '#E5E7EB',
    },
    cardContent: {
        padding: 12,
    },
    cardTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1F2937',
        lineHeight: 20,
        marginBottom: 10,
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    authorInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    authorAvatar: {
        width: 20,
        height: 20,
        borderRadius: 10,
        marginRight: 8,
        backgroundColor: '#E5E7EB',
    },
    authorName: {
        fontSize: 11,
        color: '#6B7280',
        flex: 1,
    },
    likeInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
    },
    likeCount: {
        fontSize: 10,
        color: '#6B7280',
        marginLeft: 4,
        fontWeight: '500',
    },
    emptyState: {
        alignItems: 'center',
        paddingTop: 80,
    },
    emptyText: {
        fontSize: 14,
        color: '#9CA3AF',
        marginBottom: 16,
    },
    resetBtn: {
        paddingHorizontal: 24,
        paddingVertical: 12,
        backgroundColor: '#1F2937',
        borderRadius: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    resetBtnText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    maskOverlay: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.2)',
        zIndex: 10,
    },
    dropdownWrapper: {
        position: 'absolute',
        left: 0,
        right: 0,
        zIndex: 30,
        alignItems: 'center',
        paddingHorizontal: 16,
    },
    dropdownContainer: {
        width: '100%',
        backgroundColor: '#fff',
        maxHeight: HALF_SCREEN_HEIGHT,
        borderRadius: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.12,
        shadowRadius: 24,
        elevation: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#F3F4F6',
    },
    dropdownScroll: {
        maxHeight: HALF_SCREEN_HEIGHT - 20,
    },
    optionsGrid: {
        padding: 20,
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    optionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 14,
        marginRight: 10,
        marginBottom: 10,
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: 'transparent',
    },
    optionItemActive: {
        backgroundColor: '#EFF6FF',
        borderColor: '#3B82F6',
    },
    optionText: {
        fontSize: 14,
        color: '#4B5563',
        fontWeight: '500',
    },
    optionTextActive: {
        color: '#2563EB',
        fontWeight: '600',
    },
    checkmarkBadge: {
        marginLeft: 8,
        backgroundColor: '#3B82F6',
        borderRadius: 8,
        width: 16,
        height: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default InspirationScreen;
