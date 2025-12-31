import React, { useState, useMemo, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    Image,
    TouchableOpacity,
    Dimensions,
    Platform,
    TouchableWithoutFeedback,
    Animated,
    Easing,
} from 'react-native';
import { Heart, ChevronDown, ChevronUp, Check } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';

const { width, height } = Dimensions.get('window');
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

// Mock Data
const INSPIRATION_ITEMS = [
    {
        id: 1,
        title: '黑白金配色：重新定义现代奢华',
        subtitle: 'Black, white and gold color scheme',
        image: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
        author: 'ID 杂志',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&q=80',
        likes: 245,
        houseType: '三居',
        priceRange: '20-50万',
        style: '轻奢',
        height: 200,
    },
    {
        id: 2,
        title: '探索自然光影：极简别墅设计案例',
        subtitle: 'Exploring natural light and shadow',
        image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
        author: '建筑视野',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&q=80',
        likes: 189,
        houseType: '别墅',
        priceRange: '50万以上',
        style: '现代简约',
        height: 240,
    },
    {
        id: 3,
        title: '把森林搬回家：植物系家居指南',
        subtitle: 'Bring the forest home',
        image: 'https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
        author: 'Green Life',
        avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&q=80',
        likes: 562,
        houseType: '二居',
        priceRange: '10-20万',
        style: '北欧',
        height: 180,
    },
    {
        id: 4,
        title: '新中式禅意空间：东方美学的现代演绎',
        subtitle: 'New Chinese zen space',
        image: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
        author: '东方设计',
        avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&q=80',
        likes: 423,
        houseType: '四居及以上',
        priceRange: '50万以上',
        style: '新中式',
        height: 220,
    },
    {
        id: 5,
        title: '工业风Loft：都市青年的理想居所',
        subtitle: 'Industrial Loft',
        image: 'https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
        author: 'Urban Studio',
        avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&q=80',
        likes: 312,
        houseType: '一居',
        priceRange: '10万以下',
        style: '工业风',
        height: 190,
    },
    {
        id: 6,
        title: '日式和风：简约中的极致美学',
        subtitle: 'Japanese style',
        image: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
        author: '侘寂生活',
        avatar: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&q=80',
        likes: 287,
        houseType: '二居',
        priceRange: '10-20万',
        style: '日式',
        height: 210,
    },
];

type FilterType = 'houseType' | 'priceRange' | 'style' | null;

const InspirationScreen = () => {
    const navigation = useNavigation<any>();

    // 筛选状态
    const [selectedHouseType, setSelectedHouseType] = useState('全部');
    const [selectedPrice, setSelectedPrice] = useState('全部');
    const [selectedStyle, setSelectedStyle] = useState('全部');

    // 下拉框状态
    const [activeDropdown, setActiveDropdown] = useState<FilterType>(null);

    // 按钮位置引用
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
    const filterBarRef = useRef<View>(null);
    const [filterBarBottom, setFilterBarBottom] = useState(0);

    // 按钮布局信息
    const btnLayouts = useRef<Record<string, { x: number, width: number }>>({}).current;

    // 动画值
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(-10)).current;

    // 根据筛选条件过滤数据
    const filteredItems = useMemo(() => {
        return INSPIRATION_ITEMS.filter(item => {
            const matchHouseType = selectedHouseType === '全部' || item.houseType === selectedHouseType;
            const matchPrice = selectedPrice === '全部' || item.priceRange === selectedPrice;
            const matchStyle = selectedStyle === '全部' || item.style === selectedStyle;
            return matchHouseType && matchPrice && matchStyle;
        });
    }, [selectedHouseType, selectedPrice, selectedStyle]);

    // 分列
    const leftColumn = filteredItems.filter((_, i) => i % 2 === 0);
    const rightColumn = filteredItems.filter((_, i) => i % 2 === 1);

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

    const renderCard = (item: typeof INSPIRATION_ITEMS[0]) => (
        <TouchableOpacity
            key={item.id}
            style={[styles.card, { height: (item.height || 200) + 100 }]} // Increased from 80 to 100
            activeOpacity={0.9}
            onPress={() => navigation.navigate('InspirationDetail', { item })}
        >
            <Image
                source={{ uri: item.image }}
                style={[styles.cardImage, { height: item.height || 200 }]}
                resizeMode="cover"
            />
            <View style={styles.cardContent}>
                <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                <View style={styles.cardFooter}>
                    <View style={styles.authorInfo}>
                        <Image source={{ uri: item.avatar }} style={styles.authorAvatar} />
                        <Text style={styles.authorName} numberOfLines={1}>{item.author}</Text>
                    </View>
                    <View style={styles.likeInfo}>
                        <Heart size={12} color="#9CA3AF" />
                        <Text style={styles.likeCount}>{item.likes}</Text>
                    </View>
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
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>灵感图库</Text>
            </View>

            {/* 筛选条 - 加上 zIndex 确保在遮罩之上 */}
            <View
                style={styles.filterBar}
                ref={filterBarRef}
                onLayout={(e) => {
                    const { y, height } = e.nativeEvent.layout;
                    // Platform check for Android offset if needed, but usually y+height is enough relative to parent
                    setFilterBarBottom(y + height);
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
            >
                {filteredItems.length === 0 ? (
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
    container: {
        flex: 1,
        backgroundColor: '#F3F4F6', // Slightly darker for contrast
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'ios' ? 12 : 44,
        paddingBottom: 4,
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
        backgroundColor: '#F3F4F6', // Matching container bg
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 100, // Avoid bottom tab bar
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
