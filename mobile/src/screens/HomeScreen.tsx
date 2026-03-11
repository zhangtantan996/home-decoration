import React, { useState, useRef, useCallback } from 'react';
import {
    View,
    Text,
    Image,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    Dimensions,
    SafeAreaView,
    StatusBar,
    Platform,
    Modal,
    TextInput,
    ActivityIndicator,
    Animated,
    Easing,
    TouchableWithoutFeedback,
    FlatList,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
// Mock data no longer needed for material shops, using store
import { Designer, Worker, MaterialShop } from '../types/provider';
import { NetworkErrorView, EmptyView, PullToRefresh, DesignerSkeletonCard, WorkerSkeletonCard, useToast } from '../components';
import { useProviderStore } from '../store/providerStore';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { ChevronDown, MapPin, Search, Maximize2, ArrowLeft, X, Star, MapPinned, Users, Briefcase, Award, Check, SlidersHorizontal, Package, Bell, PencilRuler, Hammer } from 'lucide-react-native';
import { DesignerCard } from '../components/DesignerCard';
import { WorkerCard } from '../components/WorkerCard';
import { MaterialShopCard } from '../components/MaterialShopCard';
import { colors as tokens, spacing, radii, typography } from '../theme/tokens';
import { colorsRaw } from '../theme/tokens.raw';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// 服务分类数据 - 只保留3个
const SERVICE_CATEGORIES = [
    { id: 'designer', icon: PencilRuler, title: '设计师' },
    { id: 'construction', icon: Hammer, title: '施工' },
    { id: 'material', icon: Package, title: '主材' },
];

// ========== 设计师相关配置 ==========
const DESIGNER_SORT_OPTIONS = [
    { id: 'recommend', label: '综合排序' },
    { id: 'distance', label: '距离最近' },
    { id: 'rating', label: '评分最高' },
    { id: 'experience', label: '经验丰富' },
];

const DESIGNER_ORG_TYPES = [
    { id: 'personal', label: '个人' },
    { id: 'studio', label: '工作室' },
    { id: 'company', label: '公司' },
];

// Mock 设计师数据
// Mock 设计师数据 - Imported from mockData.ts

// ========== 施工相关配置 ==========
const CONSTRUCTION_SORT_OPTIONS = [
    { id: 'recommend', label: '综合排序' },
    { id: 'distance', label: '距离最近' },
    { id: 'rating', label: '评分最高' },
    { id: 'experience', label: '经验丰富' },
];

const CONSTRUCTION_ORG_TYPES = [
    { id: 'personal', label: '个人' },
    { id: 'company', label: '公司' },
];

// Mock 施工人员数据
// Mock 施工人员数据 - Imported from mockData.ts

// ========== 主材相关配置 ==========
const MATERIAL_SORT_OPTIONS = [
    { id: 'recommend', label: '综合排序' },
    { id: 'distance', label: '距离最近' },
];

// 主材门店类型
const MATERIAL_ORG_TYPES = [
    { id: 'all', label: '全部类型' },
    { id: 'showroom', label: '展示店' },
    { id: 'brand', label: '品牌店' },
];

// 主材分类
const MATERIAL_CATEGORIES = [
    { id: 'all', label: '全部分类' },
    { id: 'tile', label: '瓷砖' },
    { id: 'floor', label: '地板' },
    { id: 'sanitary', label: '卫浴' },
    { id: 'kitchen', label: '橱柜' },
    { id: 'door', label: '门窗' },
    { id: 'paint', label: '涂料' },
    { id: 'wallpaper', label: '壁纸壁布' },
    { id: 'lighting', label: '灯具' },
    { id: 'hardware', label: '五金' },
    { id: 'ceiling', label: '吸顶' },
    { id: 'wardrobe', label: '衣柜' },
];

// Mock 主材商品数据
// Mock 主材商品数据 - Imported from mockData.ts

// 全局搜索排序选项
const GLOBAL_SORT_OPTIONS = [
    { id: 'recommend', label: '综合排序' },
    { id: 'rating', label: '评分最高' },
    { id: 'distance', label: '距离最近' },
    { id: 'popularity', label: '人气最高' },
];

// 热门搜索词
const HOT_SEARCH_TERMS = [
    '北欧风格',
    '现代简约',
    '水电安装',
    '全屋定制',
    '日式原木',
    '木工',
    '新中式',
];





const HomeScreen: React.FC = () => {
    const [activeCategory, setActiveCategory] = useState('designer');
    const [renderedCategory, setRenderedCategory] = useState('designer');
    const [currentCity, setCurrentCity] = useState('西安');

    const { showToast } = useToast();

    // 从全局 Store 获取预加载的数据
    const {
        designers,
        workers,
        materialShops,
        isDesignerLoading,
        isWorkerLoading,
        isMaterialLoading,
        designerError,
        workerError,
        materialError,
        hasMoreDesigners,
        hasMoreWorkers,
        hasMoreMaterials,
        designerPage,
        workerPage,
        materialPage,
        fetchDesigners: storeFetchDesigners,
        fetchWorkers: storeFetchWorkers,
        fetchMaterialShops: storeFetchMaterialShops,
    } = useProviderStore();

    // 加载更多状态（保留本地，因为是卷续行为）
    const [loadingMoreDesigners, setLoadingMoreDesigners] = React.useState(false);
    const [loadingMoreWorkers, setLoadingMoreWorkers] = React.useState(false);
    const [loadingMoreMaterials, setLoadingMoreMaterials] = React.useState(false);

    // 设计师状态
    const [designerSortBy, setDesignerSortBy] = useState('recommend');
    const [showDesignerSortMenu, setShowDesignerSortMenu] = useState(false);
    const [designerOrgFilter, setDesignerOrgFilter] = useState<string | null>(null);

    // 施工状态
    const [constructionSortBy, setConstructionSortBy] = useState('recommend');
    const [showConstructionSortMenu, setShowConstructionSortMenu] = useState(false);
    const [constructionOrgFilter, setConstructionOrgFilter] = useState<string | null>(null);
    const [searchText, setSearchText] = useState('');

    // 主材状态
    const [materialSortBy, setMaterialSortBy] = useState('recommend');
    const [showMaterialSortMenu, setShowMaterialSortMenu] = useState(false);
    const [materialFilter, setMaterialFilter] = useState('all');
    const [showMaterialCategoryModal, setShowMaterialCategoryModal] = useState(false);
    const [selectedMaterialCategory, setSelectedMaterialCategory] = useState('all');
    const [showMaterialFilterPanel, setShowMaterialFilterPanel] = useState(false); // 筛选面板显示状态
    const [selectedMaterialType, setSelectedMaterialType] = useState('all'); // 门店类型筛选

    // 全局搜索状态
    const [isSearching, setIsSearching] = useState(false);
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [globalSortBy, setGlobalSortBy] = useState('recommend');
    const [showGlobalSortMenu, setShowGlobalSortMenu] = useState(false);

    const scrollRef = useRef<ScrollView>(null);
    const materialFlatListRef = useRef<FlatList>(null);
    const [categoryHeight, setCategoryHeight] = useState(0);
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

    // Pilot is currently Xi'an only; keep city fixed and show a friendly hint.
    const handleLocationPress = useCallback(() => {
        showToast({ message: '暂时仅开放西安试点，其他地区暂未开放', type: 'info' });
        setCurrentCity('西安');
    }, [showToast]);

    // 筛选按钮位置追踪（用于紧贴按钮显示下拉框）
    const [filterButtonLayout, setFilterButtonLayout] = useState({ x: 0, y: 0, width: 0, height: 0 });

    // 分类Tab滚动隐藏动画
    const categoryTranslateY = useRef(new Animated.Value(0)).current;
    const lastScrollY = useRef(0);
    const isCategoryHidden = useRef(false);

    const handleScroll = useCallback((event: any) => {
        const currentY = event.nativeEvent.contentOffset.y;
        const threshold = 50; // 滚动超过此值后隐藏分类Tab

        if (currentY > threshold && !isCategoryHidden.current) {
            // 向下滚动，隐藏分类Tab
            isCategoryHidden.current = true;
            Animated.timing(categoryTranslateY, {
                toValue: -100,
                duration: 200,
                useNativeDriver: true,
            }).start();
        } else if (currentY <= 10 && isCategoryHidden.current) {
            // 滚动到顶部，显示分类Tab
            isCategoryHidden.current = false;
            Animated.timing(categoryTranslateY, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }).start();
        }

        lastScrollY.current = currentY;
    }, [categoryTranslateY]);

    // 初始加载已在 AppNavigator 中完成 (preloadAll)
    // 如果用户手动刷新或筛选变化时才重新请求

    // 下拉刷新处理
    const handleRefresh = async () => {
        if (activeCategory === 'designer') {
            await storeFetchDesigners(1, true);
        } else if (activeCategory === 'construction') {
            await storeFetchWorkers(1, true);
        } else if (activeCategory === 'material') {
            await storeFetchMaterialShops(1, true, materialSortBy, materialFilter);
        }
    };

    // 加载更多处理
    const handleLoadMore = async () => {
        if (activeCategory === 'designer') {
            if (loadingMoreDesigners || isDesignerLoading || !hasMoreDesigners) return;
            setLoadingMoreDesigners(true);
            await storeFetchDesigners(designerPage + 1, false);
            setLoadingMoreDesigners(false);
        } else if (activeCategory === 'construction') {
            if (loadingMoreWorkers || isWorkerLoading || !hasMoreWorkers) return;
            setLoadingMoreWorkers(true);
            await storeFetchWorkers(workerPage + 1, false);
            setLoadingMoreWorkers(false);
        } else if (activeCategory === 'material') {
            if (loadingMoreMaterials || isMaterialLoading || !hasMoreMaterials) return;
            setLoadingMoreMaterials(true);
            await storeFetchMaterialShops(materialPage + 1, false, materialSortBy, materialFilter);
            setLoadingMoreMaterials(false);
        }
    };

    // 搜索模式下隐藏底部导航栏
    React.useEffect(() => {
        (navigation as any).setOptions({
            tabBarStyle: isSearchFocused
                ? { display: 'none' }
                : {
                    height: Platform.OS === 'ios' ? 88 : 70,
                    paddingBottom: Platform.OS === 'ios' ? 28 : 18,
                    paddingTop: 6,
                    backgroundColor: tokens.white,
                    borderTopWidth: 1,
                    borderTopColor: tokens.borderSoft,
                }
        });
    }, [isSearchFocused, navigation]);

    const scrollToFilter = () => {
        if (scrollRef.current) {
            scrollRef.current.scrollTo({ y: categoryHeight, animated: true });
        }
    };



    // ========== 全局搜索统一结果 ==========
    const getUnifiedSearchResults = () => {
        if (!searchText.trim()) return [];

        const keyword = searchText.toLowerCase();
        let results: any[] = [];

        // 1. 搜索设计师
        designers.forEach((d: Designer) => {
            const name = d.name.toLowerCase();
            const specialty = d.specialty.toLowerCase();
            const orgLabel = d.orgLabel.toLowerCase();
            if (name.includes(keyword) || specialty.includes(keyword) || orgLabel.includes(keyword)) {
                results.push({
                    ...d,
                    _type: 'designer',
                    _popularity: d.reviewCount,
                    _distance: parseFloat(d.distance),
                });
            }
        });

        // 2. 搜索施工人员
        workers.forEach((w: Worker) => {
            const name = w.name.toLowerCase();
            const serviceLabel = w.serviceLabel.toLowerCase();
            const tags = w.tags.join(' ').toLowerCase();
            if (name.includes(keyword) || serviceLabel.includes(keyword) || tags.includes(keyword)) {
                results.push({
                    ...w,
                    _type: 'construction',
                    _popularity: w.completedOrders,
                    _distance: parseFloat(w.distance),
                });
            }
        });

        // 3. 排序
        switch (globalSortBy) {
            case 'rating':
                results.sort((a, b) => b.rating - a.rating);
                break;
            case 'distance':
                results.sort((a, b) => a._distance - b._distance);
                break;
            case 'popularity':
                results.sort((a, b) => b._popularity - a._popularity);
                break;
            default:
                // 综合排序：按类型分组显示
                break;
        }

        return results;
    };

    const unifiedSearchResults = isSearching ? getUnifiedSearchResults() : [];

    // 触发全局搜索
    const handleGlobalSearch = () => {
        if (searchText.trim()) {
            setIsSearching(true);
            setShowGlobalSortMenu(false);
        }
    };

    // 退出搜索
    const exitSearch = () => {
        setIsSearching(false);
        setSearchText('');
        setGlobalSortBy('recommend');
        setShowGlobalSortMenu(false);
    };

    const handleMaterialFilter = (type: string) => {
        setMaterialFilter(type);
    };

    const handleDesignerOrgFilter = useCallback((type: string) => {
        setDesignerOrgFilter(prev => prev === type ? null : type);
    }, []);

    const handleConstructionOrgFilter = useCallback((type: string) => {
        setConstructionOrgFilter(prev => prev === type ? null : type);
    }, []);

    // 切换分类时重置状态
    const handleCategoryChange = (categoryId: string) => {
        const startTime = Date.now();
        console.log(`[PERF] Switch to ${categoryId} START`);

        setActiveCategory(categoryId);
        setRenderedCategory(categoryId);
        // 关闭所有菜单
        setShowDesignerSortMenu(false);
        setShowConstructionSortMenu(false);
        setShowMaterialSortMenu(false);

        console.log(`[PERF] Switch to ${categoryId} RENDERED: ${Date.now() - startTime}ms`);
    };

    const toggleDesignerSort = useCallback(() => {
        setShowDesignerSortMenu(prev => {
            if (!prev) scrollToFilter();
            return !prev;
        });
    }, []);

    const toggleConstructionSort = useCallback(() => {
        setShowConstructionSortMenu(prev => {
            if (!prev) {
                scrollToFilter();
            }
            return !prev;
        });
    }, []);

    // 获取当前排序选项和标签
    let currentSortOptions = DESIGNER_SORT_OPTIONS;
    let currentSortBy = designerSortBy;
    if (renderedCategory === 'construction') {
        currentSortOptions = CONSTRUCTION_SORT_OPTIONS;
        currentSortBy = constructionSortBy;
    } else if (renderedCategory === 'material') {
        currentSortOptions = MATERIAL_SORT_OPTIONS;
        currentSortBy = materialSortBy;
    }
    const currentSortLabel = currentSortOptions.find(o => o.id === currentSortBy)?.label || '综合排序';

    // ==================== 多Tab预渲染架构 ====================
    // 核心思路：所有Tab的列表同时存在于内存，切换时只改变opacity
    // 这样切换时不需要重新挂载FlatList，实现即时响应

    // Tab切换动画
    const designerOpacity = React.useRef(new Animated.Value(activeCategory === 'designer' ? 1 : 0)).current;
    const constructionOpacity = React.useRef(new Animated.Value(activeCategory === 'construction' ? 1 : 0)).current;
    const materialOpacity = React.useRef(new Animated.Value(activeCategory === 'material' ? 1 : 0)).current;

    React.useEffect(() => {
        // 淡入淡出动画 - 设置为 0ms 实现即时切换，配合骨架屏
        Animated.parallel([
            Animated.timing(designerOpacity, {
                toValue: activeCategory === 'designer' ? 1 : 0,
                duration: 0,
                useNativeDriver: true,
            }),
            Animated.timing(constructionOpacity, {
                toValue: activeCategory === 'construction' ? 1 : 0,
                duration: 0,
                useNativeDriver: true,
            }),
            Animated.timing(materialOpacity, {
                toValue: activeCategory === 'material' ? 1 : 0,
                duration: 0,
                useNativeDriver: true,
            }),
        ]).start();
    }, [activeCategory]);

    // 自动加载主材数据
    React.useEffect(() => {
        if (activeCategory === 'material' && materialShops.length === 0 && !isMaterialLoading && !materialError) {
            storeFetchMaterialShops(1, false, materialSortBy, materialFilter);
        }
    }, [activeCategory, materialShops.length, isMaterialLoading, materialError, storeFetchMaterialShops, materialSortBy, materialFilter]);

    // 准备列表数据 - 使用 useMemo 避免每次渲染都创建新数组
    const designerListData = React.useMemo(() => {
        if (isDesignerLoading && designers.length === 0) {
            // Skeleton data: 5 items
            return [{ id: 'FILTER_SECTION' }, { id: 'skeleton-1' }, { id: 'skeleton-2' }, { id: 'skeleton-3' }, { id: 'skeleton-4' }, { id: 'skeleton-5' }];
        }

        let filtered = [...designers];

        // 按组织类型筛选
        if (designerOrgFilter) {
            filtered = filtered.filter((d: Designer) => d.orgType === designerOrgFilter);
        }

        // 排序
        if (designerSortBy === 'rating') {
            filtered.sort((a: Designer, b: Designer) => b.rating - a.rating);
        } else if (designerSortBy === 'distance') {
            filtered.sort((a: Designer, b: Designer) => parseFloat(a.distance) - parseFloat(b.distance));
        } else if (designerSortBy === 'experience') {
            filtered.sort((a: Designer, b: Designer) => b.yearsExperience - a.yearsExperience);
        }

        return [{ id: 'FILTER_SECTION' }, ...filtered];
    }, [designers, isDesignerLoading, designerOrgFilter, designerSortBy]);

    const workerListData = React.useMemo(() => {
        if (isWorkerLoading && workers.length === 0) {
            // Skeleton data: 5 items
            return [{ id: 'FILTER_SECTION' }, { id: 'skeleton-1' }, { id: 'skeleton-2' }, { id: 'skeleton-3' }, { id: 'skeleton-4' }, { id: 'skeleton-5' }];
        }

        let filtered = [...workers];

        // 按组织类型筛选
        if (constructionOrgFilter) {
            filtered = filtered.filter((w: Worker) => w.type === constructionOrgFilter);
        }

        // 排序
        if (constructionSortBy === 'rating') {
            filtered.sort((a: Worker, b: Worker) => b.rating - a.rating);
        } else if (constructionSortBy === 'distance') {
            filtered.sort((a: Worker, b: Worker) => parseFloat(a.distance) - parseFloat(b.distance));
        } else if (constructionSortBy === 'experience') {
            filtered.sort((a: Worker, b: Worker) => {
                const aExp = a.yearsExperience ?? (new Date().getFullYear() - (a.establishedYear ?? 2010));
                const bExp = b.yearsExperience ?? (new Date().getFullYear() - (b.establishedYear ?? 2010));
                return bExp - aExp;
            });
        }

        return [{ id: 'FILTER_SECTION' }, ...filtered];
    }, [workers, isWorkerLoading, constructionOrgFilter, constructionSortBy]);

    const materialListData = React.useMemo(() => {
        if (isMaterialLoading && materialShops.length === 0) {
            return [{ id: 'FILTER_SECTION' }, { id: 'skeleton-1' }, { id: 'skeleton-2' }, { id: 'skeleton-3' }];
        }

        if (materialError && materialShops.length === 0) {
            return [{ id: 'FILTER_SECTION' }, { id: 'material-error', _type: 'error', message: materialError }];
        }

        let sorted = [...materialShops];

        // 按门店类型筛选
        if (selectedMaterialType !== 'all') {
            sorted = sorted.filter((s: MaterialShop) => s.type === selectedMaterialType);
        }

        // 按商品分类筛选
        if (selectedMaterialCategory !== 'all') {
            sorted = sorted.filter((s: MaterialShop) =>
                s.productCategories && s.productCategories.includes(selectedMaterialCategory)
            );
        }

        // 排序
        if (materialSortBy === 'distance') {
            sorted.sort((a: MaterialShop, b: MaterialShop) => parseFloat(a.distance) - parseFloat(b.distance));
        } else if (materialSortBy === 'recommend') {
            sorted.sort((a: MaterialShop, b: MaterialShop) => b.rating - a.rating);
        }

        return [{ id: 'FILTER_SECTION' }, ...sorted];
    }, [materialShops, isMaterialLoading, materialSortBy, selectedMaterialType, selectedMaterialCategory]);

    // 修改渲染函数以处理 Skeleton
    const renderDesignerItem = useCallback(({ item }: { item: any }) => {
        if (item.id === 'FILTER_SECTION') {
            return (
                <View style={styles.filterSectionWrapper}>
                    <View style={styles.filterSection}>
                        <View style={styles.filterLeft}>
                            <TouchableOpacity
                                style={styles.sortBtn}
                                onPress={toggleDesignerSort}
                                onLayout={(event) => {
                                    event.target.measure((_x, _y, width, height, pageX, pageY) => {
                                        setFilterButtonLayout({ x: pageX, y: pageY, width, height });
                                    });
                                }}
                            >
                                <Text style={styles.sortBtnText}>{currentSortLabel}</Text>
                                <ChevronDown size={14} color={tokens.secondary} />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.filterRight}>
                            {DESIGNER_ORG_TYPES.map(org => (
                                <TouchableOpacity
                                    key={org.id}
                                    style={[styles.orgFilterBtn, designerOrgFilter === org.id && styles.orgFilterBtnActive]}
                                    onPress={() => handleDesignerOrgFilter(org.id)}
                                >
                                    <Text style={[styles.orgFilterText, designerOrgFilter === org.id && styles.orgFilterTextActive]}>
                                        {org.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                    {showDesignerSortMenu && isCategoryHidden.current && (
                        <TouchableWithoutFeedback onPress={() => setShowDesignerSortMenu(false)}>
                            <View style={styles.dropdownBackdrop} />
                        </TouchableWithoutFeedback>
                    )}
                    {showDesignerSortMenu && (
                        <View style={[
                            styles.sortDropdown,
                            isCategoryHidden.current && {
                                position: 'absolute',
                                top: filterButtonLayout.y + filterButtonLayout.height + 4,
                                left: filterButtonLayout.x,
                                width: filterButtonLayout.width + 100,
                                zIndex: 1001,
                                borderRadius: radii.sm,
                                ...Platform.select({
                                    ios: {
                                        shadowColor: '#000',
                                        shadowOffset: { width: 0, height: 4 },
                                        shadowOpacity: 0.15,
                                        shadowRadius: 12,
                                    },
                                    android: {
                                        elevation: 8,
                                    },
                                })
                            }
                        ]}>
                            {DESIGNER_SORT_OPTIONS.map(option => (
                                <TouchableOpacity
                                    key={option.id}
                                    style={[styles.sortDropdownItem, designerSortBy === option.id && styles.sortDropdownItemActive]}
                                    onPress={() => { setDesignerSortBy(option.id); setShowDesignerSortMenu(false); }}
                                >
                                    <Text style={[styles.sortDropdownText, designerSortBy === option.id && styles.sortDropdownTextActive]}>{option.label}</Text>
                                    {designerSortBy === option.id && <Check size={16} color={tokens.primary} />}
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </View>
            );
        }

        // Skeleton Item
        if (typeof item.id === 'string' && item.id.startsWith('skeleton')) {
            return <DesignerSkeletonCard />;
        }

        return (
            <DesignerCard
                designer={item}
                onPress={(d) => (navigation as any).navigate('DesignerDetail', { designer: d })}
                onBookPress={(d) => (navigation as any).navigate('Booking', { provider: d, providerType: 'designer' })}
            />
        );
    }, [currentSortLabel, designerOrgFilter, designerSortBy, showDesignerSortMenu, toggleDesignerSort, handleDesignerOrgFilter, navigation]);

    const renderWorkerItem = useCallback(({ item }: { item: any }) => {
        if (item.id === 'FILTER_SECTION') {
            return (
                <View style={styles.filterSectionWrapper}>
                    <View style={styles.filterSection}>
                        <View style={styles.filterLeft}>
                            <TouchableOpacity
                                style={styles.sortBtn}
                                onPress={toggleConstructionSort}
                                onLayout={(event) => {
                                    event.target.measure((_x, _y, width, height, pageX, pageY) => {
                                        setFilterButtonLayout({ x: pageX, y: pageY, width, height });
                                    });
                                }}
                            >
                                <Text style={styles.sortBtnText}>{CONSTRUCTION_SORT_OPTIONS.find(o => o.id === constructionSortBy)?.label}</Text>
                                <ChevronDown size={14} color={tokens.secondary} />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.filterRight}>
                            {CONSTRUCTION_ORG_TYPES.map(org => (
                                <TouchableOpacity
                                    key={org.id}
                                    style={[styles.orgFilterBtn, constructionOrgFilter === org.id && styles.orgFilterBtnActive]}
                                    onPress={() => handleConstructionOrgFilter(org.id)}
                                >
                                    <Text style={[styles.orgFilterText, constructionOrgFilter === org.id && styles.orgFilterTextActive]}>{org.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                    {showConstructionSortMenu && isCategoryHidden.current && (
                        <TouchableWithoutFeedback onPress={() => setShowConstructionSortMenu(false)}>
                            <View style={styles.dropdownBackdrop} />
                        </TouchableWithoutFeedback>
                    )}
                    {showConstructionSortMenu && (
                        <View style={[
                            styles.sortDropdown,
                            isCategoryHidden.current && {
                                position: 'absolute',
                                top: filterButtonLayout.y + filterButtonLayout.height + 4,
                                left: filterButtonLayout.x,
                                width: filterButtonLayout.width + 100,
                                zIndex: 1001,
                                borderRadius: radii.sm,
                                ...Platform.select({
                                    ios: {
                                        shadowColor: '#000',
                                        shadowOffset: { width: 0, height: 4 },
                                        shadowOpacity: 0.15,
                                        shadowRadius: 12,
                                    },
                                    android: {
                                        elevation: 8,
                                    },
                                })
                            }
                        ]}>
                            {CONSTRUCTION_SORT_OPTIONS.map(option => (
                                <TouchableOpacity
                                    key={option.id}
                                    style={[styles.sortDropdownItem, constructionSortBy === option.id && styles.sortDropdownItemActive]}
                                    onPress={() => { setConstructionSortBy(option.id); setShowConstructionSortMenu(false); }}
                                >
                                    <Text style={[styles.sortDropdownText, constructionSortBy === option.id && styles.sortDropdownTextActive]}>{option.label}</Text>
                                    {constructionSortBy === option.id && <Check size={16} color={tokens.primary} />}
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </View>
            );
        }

        // Skeleton Item
        if (typeof item.id === 'string' && item.id.startsWith('skeleton')) {
            return <WorkerSkeletonCard />;
        }

        if (item._type === 'error') {
            return (
                <NetworkErrorView
                    type="network"
                    message={item.message || '主材数据加载失败，请检查当前开发环境网络配置后重试'}
                    onRetry={() => storeFetchMaterialShops(1, true, materialSortBy, materialFilter)}
                />
            );
        }

        return (
            <WorkerCard
                worker={item}
                onPress={(w) => (w.type === 'company'
                    ? (navigation as any).navigate('CompanyDetail', { company: w })
                    : (navigation as any).navigate('WorkerDetail', { worker: w })
                )}
                onBookPress={(w, type) => (navigation as any).navigate('Booking', { provider: w, providerType: type })}
            />
        );
    }, [constructionSortBy, constructionOrgFilter, showConstructionSortMenu, toggleConstructionSort, handleConstructionOrgFilter, navigation]);

    const toggleMaterialSort = useCallback(() => {
        setShowMaterialSortMenu(prev => {
            if (!prev) scrollToFilter();
            return !prev;
        });
        setShowMaterialFilterPanel(false);
    }, []);

    const toggleMaterialFilterPanel = useCallback(() => {
        setShowMaterialFilterPanel(prev => !prev);
        setShowMaterialSortMenu(false);
    }, []);

    const renderMaterialItem = useCallback(({ item }: { item: any }) => {
        if (item.id === 'FILTER_SECTION') {
            const categoryLabel = MATERIAL_CATEGORIES.find(c => c.id === selectedMaterialCategory)?.label || '全部分类';
            // const typeLabel = MATERIAL_ORG_TYPES.find(t => t.id === selectedMaterialType)?.label || '全部类型';
            const hasActiveFilter = selectedMaterialCategory !== 'all'; // || selectedMaterialType !== 'all';

            return (
                <View style={styles.filterSectionWrapper}>
                    <View style={styles.filterSection}>
                        <View style={styles.filterLeft}>
                            <TouchableOpacity
                                style={styles.sortBtn}
                                onPress={toggleMaterialSort}
                                onLayout={(event) => {
                                    event.target.measure((_x, _y, width, height, pageX, pageY) => {
                                        setFilterButtonLayout({ x: pageX, y: pageY, width, height });
                                    });
                                }}
                            >
                                <Text style={styles.sortBtnText}>{MATERIAL_SORT_OPTIONS.find(o => o.id === materialSortBy)?.label}</Text>
                                <ChevronDown size={14} color={tokens.secondary} />
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity
                            style={[styles.filterIconBtn, hasActiveFilter && styles.filterIconBtnActive]}
                            onPress={toggleMaterialFilterPanel}
                        >
                            <SlidersHorizontal size={16} color={hasActiveFilter ? tokens.white : tokens.secondary} />
                            <Text style={[styles.filterIconText, hasActiveFilter && styles.filterIconTextActive]}>
                                {hasActiveFilter ? categoryLabel : '筛选'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                    {/* 排序下拉 */}
                    {showMaterialSortMenu && isCategoryHidden.current && (
                        <TouchableWithoutFeedback onPress={() => setShowMaterialSortMenu(false)}>
                            <View style={styles.dropdownBackdrop} />
                        </TouchableWithoutFeedback>
                    )}
                    {showMaterialSortMenu && (
                        <View style={[
                            styles.sortDropdown,
                            isCategoryHidden.current && {
                                position: 'absolute',
                                top: filterButtonLayout.y + filterButtonLayout.height + 4,
                                left: filterButtonLayout.x,
                                width: filterButtonLayout.width + 100,
                                zIndex: 1001,
                                borderRadius: radii.sm,
                                ...Platform.select({
                                    ios: {
                                        shadowColor: '#000',
                                        shadowOffset: { width: 0, height: 4 },
                                        shadowOpacity: 0.15,
                                        shadowRadius: 12,
                                    },
                                    android: {
                                        elevation: 8,
                                    },
                                })
                            }
                        ]}>
                            {MATERIAL_SORT_OPTIONS.map(option => (
                                <TouchableOpacity
                                    key={option.id}
                                    style={[styles.sortDropdownItem, materialSortBy === option.id && styles.sortDropdownItemActive]}
                                    onPress={() => { setMaterialSortBy(option.id); setShowMaterialSortMenu(false); }}
                                >
                                    <Text style={[styles.sortDropdownText, materialSortBy === option.id && styles.sortDropdownTextActive]}>{option.label}</Text>
                                    {materialSortBy === option.id && <Check size={16} color={tokens.primary} />}
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                    {/* 筛选面板 */}
                    {showMaterialFilterPanel && (
                        <View style={styles.materialFilterPanel}>
                            {/* 分类筛选 */}
                            <View style={styles.filterPanelSection}>
                                <Text style={styles.filterPanelTitle}>商品分类</Text>
                                <View style={styles.filterPanelGrid}>
                                    {MATERIAL_CATEGORIES.map(cat => (
                                        <TouchableOpacity
                                            key={cat.id}
                                            style={[
                                                styles.filterPanelItem,
                                                selectedMaterialCategory === cat.id && styles.filterPanelItemActive
                                            ]}
                                            onPress={() => setSelectedMaterialCategory(cat.id)}
                                        >
                                            <Text style={[
                                                styles.filterPanelItemText,
                                                selectedMaterialCategory === cat.id && styles.filterPanelItemTextActive
                                            ]}>
                                                {cat.label}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                            {/* 门店类型筛选 - 已移除 */}
                            {/* <View style={styles.filterPanelSection}>
                                <Text style={styles.filterPanelTitle}>门店类型</Text>
                                <View style={styles.filterPanelGrid}>
                                    {MATERIAL_ORG_TYPES.map(type => (
                                        <TouchableOpacity
                                            key={type.id}
                                            style={[
                                                styles.filterPanelItem,
                                                selectedMaterialType === type.id && styles.filterPanelItemActive
                                            ]}
                                            onPress={() => setSelectedMaterialType(type.id)}
                                        >
                                            <Text style={[
                                                styles.filterPanelItemText,
                                                selectedMaterialType === type.id && styles.filterPanelItemTextActive
                                            ]}>
                                                {type.label}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View> */}
                            {/* 操作按钮 */}
                            <View style={styles.filterPanelFooter}>
                                <TouchableOpacity
                                    style={styles.filterPanelResetBtn}
                                    onPress={() => {
                                        setSelectedMaterialCategory('all');
                                        setSelectedMaterialType('all');
                                    }}
                                >
                                    <Text style={styles.filterPanelResetText}>重置</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.filterPanelConfirmBtn}
                                    onPress={() => setShowMaterialFilterPanel(false)}
                                >
                                    <Text style={styles.filterPanelConfirmText}>确定</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                </View>
            );
        }

        // Skeleton Item
        if (typeof item.id === 'string' && item.id.startsWith('skeleton')) {
            return <WorkerSkeletonCard />;
        }

        if (item._type === 'error') {
            return (
                <NetworkErrorView
                    type="network"
                    message={item.message || '主材数据加载失败，请检查当前开发环境网络配置后重试'}
                    onRetry={() => storeFetchMaterialShops(1, true, materialSortBy, materialFilter)}
                />
            );
        }

        return (
            <MaterialShopCard
                shop={item}
                onPress={(shop) => (navigation as any).navigate('MaterialShopDetail', { shop })}
            />
        );
    }, [materialFilter, materialSortBy, showMaterialSortMenu, showMaterialFilterPanel, selectedMaterialCategory, selectedMaterialType, storeFetchMaterialShops, toggleMaterialSort, toggleMaterialFilterPanel, filterButtonLayout]);

    // 点击外部关闭所有筛选弹窗
    const handleBackdropPress = useCallback(() => {
        if (showDesignerSortMenu) setShowDesignerSortMenu(false);
        if (showConstructionSortMenu) setShowConstructionSortMenu(false);
        if (showMaterialSortMenu) setShowMaterialSortMenu(false);
        if (showMaterialFilterPanel) setShowMaterialFilterPanel(false);
        if (showGlobalSortMenu) setShowGlobalSortMenu(false);
    }, [showDesignerSortMenu, showConstructionSortMenu, showMaterialSortMenu, showMaterialFilterPanel, showGlobalSortMenu]);

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar
                barStyle="dark-content"
                backgroundColor={tokens.white}
                translucent={Platform.OS === 'android'}
            />
            <TouchableWithoutFeedback onPress={handleBackdropPress}>
                <View style={{ flex: 1 }}>
                    {/* Header */}
                    <View style={styles.header}>
                        {isSearchFocused ? (
                            <>
                                <TouchableOpacity style={styles.backBtn} onPress={() => { setIsSearchFocused(false); setIsSearching(false); setSearchText(''); }}>
                                    <ArrowLeft size={20} color={tokens.primary} />
                                </TouchableOpacity>
                                <View style={[styles.searchBar, { flex: 1, marginRight: 0 }]}>
                                    <Search size={16} color={tokens.placeholder} />
                                    <TextInput
                                        style={styles.searchInput}
                                        placeholder="搜索设计师 / 施工队"
                                        placeholderTextColor={tokens.placeholder}
                                        value={searchText}
                                        onChangeText={(text) => { setSearchText(text); if (!text.trim() && isSearching) setIsSearching(false); }}
                                        returnKeyType="search"
                                        onSubmitEditing={handleGlobalSearch}
                                        autoFocus
                                    />
                                    {searchText.length > 0 && (
                                        <TouchableOpacity onPress={() => { setSearchText(''); setIsSearching(false); }} style={styles.clearSearchBtn}>
                                            <X size={16} color={tokens.secondary} />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </>
                        ) : (
                            <>
                                <TouchableOpacity style={styles.locationBtn} onPress={handleLocationPress}>
                                    <MapPin size={16} color={tokens.secondary} />
                                    <Text style={styles.locationText}>{currentCity}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.searchBar} activeOpacity={0.7} onPress={() => setIsSearchFocused(true)}>
                                    <Search size={16} color={tokens.placeholder} />
                                    <Text style={styles.searchPlaceholder} numberOfLines={1}>{searchText || '搜索设计师 / 施工队'}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('ScanQR' as never)}>
                                    <Maximize2 size={20} color={tokens.primary} />
                                </TouchableOpacity>
                            </>
                        )}
                    </View>

                    {/* 搜索模式 */}
                    {isSearchFocused || isSearching ? (
                        <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                            {isSearchFocused && !isSearching ? (
                                <View style={styles.hotSearchSection}>
                                    <Text style={styles.hotSearchTitle}>热门搜索</Text>
                                    <View style={styles.hotSearchTags}>
                                        {HOT_SEARCH_TERMS.map((term, index) => (
                                            <TouchableOpacity key={index} style={styles.hotSearchTag} onPress={() => { setSearchText(term); setIsSearching(true); }}>
                                                <Text style={styles.hotSearchTagText}>{term}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                            ) : (
                                <View style={styles.listSection}>
                                    {unifiedSearchResults.length === 0 ? (
                                        <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                                            <Text style={{ fontSize: typography.h3, color: tokens.secondary }}>未找到相关结果</Text>
                                            <Text style={{ fontSize: typography.body - 1, color: tokens.placeholder, marginTop: spacing.xs }}>试试其他关键词</Text>
                                        </View>
                                     ) : (
                                         unifiedSearchResults.map((item, index) => (
                                            <TouchableOpacity
                                                key={`${item._type}-${item.id}-${index}`}
                                                style={styles.searchResultCard}
                                                onPress={() => {
                                                    if (item._type === 'designer') {
                                                        navigation.navigate('DesignerDetail', { designer: item });
                                                        return;
                                                    }
                                                    if (item._type === 'construction') {
                                                        if (item.type === 'company') {
                                                            navigation.navigate('CompanyDetail', { company: item });
                                                        } else {
                                                            navigation.navigate('WorkerDetail', { worker: item });
                                                        }
                                                    }
                                                }}
                                            >
                                                {item._type === 'material' ? (
                                                    <Image source={{ uri: item.image }} style={styles.searchResultImage} />
                                                ) : (
                                                    <Image source={{ uri: item.avatar || item.logo }} style={styles.searchResultAvatar} />
                                                )}
                                                <View style={styles.searchResultInfo}>
                                                    <Text style={styles.searchResultName} numberOfLines={1}>{item.name}</Text>
                                                    <View style={styles.searchResultMeta}>
                                                        <View style={[styles.searchResultTypeBadge, { backgroundColor: item._type === 'designer' ? '#F0F9FF' : item._type === 'construction' ? '#FFF7ED' : '#FDF2F8' }]}>
                                                            <Text style={[styles.searchResultTypeBadgeText, { color: item._type === 'designer' ? '#0369A1' : item._type === 'construction' ? '#C2410C' : '#BE185D' }]}>
                                                                {item._type === 'designer' ? '设计师' : item._type === 'construction' ? '施工' : '主材'}
                                                            </Text>
                                                        </View>
                                                        <Star size={12} color={tokens.warning} fill={tokens.warning} />
                                                        <Text style={{ fontSize: typography.caption, color: tokens.primary, marginLeft: 2 }}>{item.rating}</Text>
                                                    </View>
                                                    <Text style={styles.searchResultDesc} numberOfLines={1}>
                                                        {item._type === 'material' ? `${item.brand} · ¥${item.price}/${item.unit}` : item.specialty || item.serviceLabel || '施工服务'}
                                                    </Text>
                                                </View>
                                            </TouchableOpacity>
                                        ))
                                    )}
                                </View>
                            )}
                        </ScrollView>
                    ) : (
                        <View style={{ flex: 1 }}>
                            {/* ==================== 多Tab预渲染层叠 ==================== */}
                            <View style={{ flex: 1 }}>
                                {/* 设计师Tab */}
                                <Animated.View style={[styles.tabPane, { opacity: designerOpacity, zIndex: activeCategory === 'designer' ? 1 : 0 }]} pointerEvents={activeCategory === 'designer' ? 'auto' : 'none'}>
                                    <FlatList
                                        data={designerListData}
                                        renderItem={renderDesignerItem}
                                        keyExtractor={(item) => String(item.id)}
                                        stickyHeaderIndices={[1]}
                                        ListHeaderComponent={
                                            <View style={styles.categorySection}>
                                                {SERVICE_CATEGORIES.map((cat) => (
                                                    <CategoryTab
                                                        key={cat.id}
                                                        item={cat}
                                                        isActive={activeCategory === cat.id}
                                                        onPress={() => handleCategoryChange(cat.id)}
                                                    />
                                                ))}
                                            </View>
                                        }
                                        refreshing={isDesignerLoading}
                                        onRefresh={handleRefresh}
                                        onEndReached={() => { if (activeCategory === 'designer') handleLoadMore(); }}
                                        onEndReachedThreshold={0.2}
                                        ListFooterComponent={loadingMoreDesigners ? <ActivityIndicator style={{ paddingVertical: spacing.md }} size="small" color={tokens.placeholder} /> : <View style={{ height: 100 }} />}
                                        showsVerticalScrollIndicator={false}
                                    />
                                </Animated.View>

                                {/* 施工Tab */}
                                <Animated.View style={[styles.tabPane, { opacity: constructionOpacity, zIndex: activeCategory === 'construction' ? 1 : 0 }]} pointerEvents={activeCategory === 'construction' ? 'auto' : 'none'}>
                                    <FlatList
                                        data={workerListData}
                                        renderItem={renderWorkerItem}
                                        keyExtractor={(item) => String(item.id)}
                                        stickyHeaderIndices={[1]}
                                        ListHeaderComponent={
                                            <View style={styles.categorySection}>
                                                {SERVICE_CATEGORIES.map((cat) => (
                                                    <CategoryTab
                                                        key={cat.id}
                                                        item={cat}
                                                        isActive={activeCategory === cat.id}
                                                        onPress={() => handleCategoryChange(cat.id)}
                                                    />
                                                ))}
                                            </View>
                                        }
                                        refreshing={isWorkerLoading}
                                        onRefresh={handleRefresh}
                                        onEndReached={() => { if (activeCategory === 'construction') handleLoadMore(); }}
                                        onEndReachedThreshold={0.2}
                                        ListFooterComponent={loadingMoreWorkers ? <ActivityIndicator style={{ paddingVertical: spacing.md }} size="small" color={tokens.placeholder} /> : <View style={{ height: 100 }} />}
                                        showsVerticalScrollIndicator={false}
                                    />
                                </Animated.View>

                                {/* 主材Tab */}
                                <Animated.View style={[styles.tabPane, { opacity: materialOpacity, zIndex: activeCategory === 'material' ? 1 : 0 }]} pointerEvents={activeCategory === 'material' ? 'auto' : 'none'}>
                                    <FlatList
                                        ref={materialFlatListRef}
                                        data={materialListData}
                                        renderItem={renderMaterialItem}
                                        keyExtractor={(item) => String(item.id)}
                                        stickyHeaderIndices={[1]}
                                        ListHeaderComponent={
                                            <View style={styles.categorySection}>
                                                {SERVICE_CATEGORIES.map((cat) => (
                                                    <CategoryTab
                                                        key={cat.id}
                                                        item={cat}
                                                        isActive={activeCategory === cat.id}
                                                        onPress={() => handleCategoryChange(cat.id)}
                                                    />
                                                ))}
                                            </View>
                                        }
                                        refreshing={activeCategory === 'material' && isMaterialLoading && materialShops.length > 0}
                                        onRefresh={handleRefresh}
                                        onEndReached={() => { if (activeCategory === 'material') handleLoadMore(); }}
                                        onEndReachedThreshold={0.2}
                                        showsVerticalScrollIndicator={false}
                                        ListFooterComponent={<View style={{ height: 100 }} />}
                                    />
                                </Animated.View>
                            </View>
                        </View>
                    )}

                </View>
            </TouchableWithoutFeedback>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: tokens.white,
    },
    tabPane: {
        ...StyleSheet.absoluteFillObject,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingTop: Platform.OS === 'ios' ? 12 : 44, // 适配沉浸式状态栏
        paddingBottom: 12,
        backgroundColor: tokens.white,
        borderBottomWidth: 1,
        borderBottomColor: tokens.borderSoft,
        zIndex: 100,
    },
    locationBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 12,
    },
    locationText: {
        fontSize: typography.body,
        fontWeight: '500',
        color: tokens.primary,
        marginLeft: 4,
    },
    searchBar: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: tokens.borderSoft,
        borderRadius: 20,
        paddingHorizontal: 12,
        height: 36,
        marginRight: spacing.xs,
        overflow: 'hidden',
    },
    searchInput: {
        flex: 1,
        fontSize: typography.body - 1,
        color: tokens.primary,
        marginLeft: spacing.xs,
        padding: 0, // Android fix
    },
    searchPlaceholder: {
        flex: 1,
        fontSize: typography.body - 1,
        color: tokens.placeholder,
        marginLeft: spacing.xs,
    },
    hotSearchSection: {
        padding: spacing.md,
        backgroundColor: tokens.white,
    },
    hotSearchTitle: {
        fontSize: typography.body,
        fontWeight: '600',
        color: tokens.primary,
        marginBottom: spacing.sm,
    },
    hotSearchTags: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    hotSearchTag: {
        backgroundColor: tokens.borderSoft,
        paddingHorizontal: 14,
        paddingVertical: spacing.xs,
        borderRadius: 16,
        marginRight: spacing.xs,
        marginBottom: 8,
    },
    hotSearchTagText: {
        fontSize: typography.body - 1,
        color: tokens.gray600,
    },
    clearSearchBtn: {
        padding: 4,
    },
    backBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.xs,
    },
    searchResultsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        backgroundColor: tokens.white,
        borderBottomWidth: 1,
        borderBottomColor: tokens.borderSoft,
    },
    searchResultsInfo: {
        fontSize: typography.body - 1,
        color: tokens.secondary,
    },
    searchResultCard: {
        flexDirection: 'row',
        backgroundColor: tokens.white,
        borderRadius: radii.md,
        padding: 12,
        marginHorizontal: 16,
        marginBottom: spacing.sm,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.08,
                shadowRadius: 8,
            },
            android: {
                elevation: 2,
            },
        }),
    },
    searchResultAvatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: tokens.borderSoft,
    },
    searchResultImage: {
        width: 80,
        height: 80,
        borderRadius: radii.sm,
        backgroundColor: tokens.borderSoft,
    },
    searchResultInfo: {
        flex: 1,
        marginLeft: 12,
    },
    searchResultName: {
        fontSize: typography.h3 - 1,
        fontWeight: '600',
        color: tokens.primary,
        marginBottom: 4,
    },
    searchResultMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    searchResultTypeBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: radii.xs,
        marginRight: spacing.xs,
    },
    searchResultTypeBadgeText: {
        fontSize: typography.xs,
        fontWeight: '600',
    },
    searchResultDesc: {
        fontSize: typography.caption,
        color: tokens.secondary,
    },
    searchResultPrice: {
        fontSize: typography.h3,
        fontWeight: '700',
        color: tokens.error,
    },
    iconBtn: {
        width: 36,
        height: 36,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 4,
    },
    scrollContent: {
        flex: 1,
    },
    categorySection: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingVertical: 20,
        paddingHorizontal: spacing.md,
        backgroundColor: tokens.white,
    },
    categoryTab: {
        alignItems: 'center',
        width: (SCREEN_WIDTH - 32) / 3,
        backgroundColor: 'transparent',
    },
    categoryIconBox: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    categoryIconBoxInactive: {
        backgroundColor: tokens.bgPage,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.03)',
    },
    categoryIconBoxActive: {
        backgroundColor: tokens.primary,
    },
    categoryLabel: {
        fontSize: typography.body - 1,
        fontWeight: '500',
        color: tokens.secondary,
    },
    categoryLabelActive: {
        color: tokens.primary,
        fontWeight: '700',
    },
    filterSectionWrapper: {
        backgroundColor: tokens.white,
        zIndex: 90,
    },
    filterSection: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        backgroundColor: tokens.white,
    },
    filterLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    filterRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    sortBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.xs - 2,
        paddingHorizontal: spacing.xs + 2,
        backgroundColor: tokens.borderSoft,
        borderRadius: radii.xs,
    },
    sortBtnText: {
        fontSize: typography.body - 1,
        color: tokens.primary,
        marginRight: 4,
    },
    orgFilterBtn: {
        paddingHorizontal: 12,
        paddingVertical: spacing.xs - 2,
        borderRadius: radii.xs,
        marginLeft: spacing.xs,
        backgroundColor: tokens.borderSoft,
    },
    orgFilterBtnActive: {
        backgroundColor: tokens.primary,
    },
    orgFilterText: {
        fontSize: typography.caption,
        color: tokens.secondary,
    },
    orgFilterTextActive: {
        color: tokens.white,
    },
    filterBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.xs + 2,
        paddingVertical: spacing.xs - 2,
        backgroundColor: tokens.borderSoft,
        borderRadius: radii.xs,
        marginLeft: spacing.xs,
    },
    filterBtnActive: {
        backgroundColor: tokens.border,
    },
    filterBtnText: {
        fontSize: typography.caption,
        color: tokens.secondary,
        marginLeft: 4,
    },
    filterBtnTextActive: {
        color: tokens.primary,
    },
    filterIconBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: spacing.xs - 2,
        backgroundColor: tokens.borderSoft,
        borderRadius: radii.xs,
    },
    filterIconBtnActive: {
        backgroundColor: tokens.primary,
    },
    filterIconText: {
        fontSize: typography.caption,
        color: tokens.secondary,
        marginLeft: 4,
    },
    filterIconTextActive: {
        color: tokens.white,
    },
    listSection: {
        padding: spacing.md,
    },

    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyStateTitle: {
        fontSize: typography.h2,
        fontWeight: '700',
        color: tokens.primary,
        marginTop: 16,
        marginBottom: 8,
    },
    emptyStateSub: {
        fontSize: typography.body,
        color: tokens.secondary,
    },
    comingSoonText: {
        fontSize: typography.body,
        color: tokens.placeholder,
        textAlign: 'center',
        width: '100%',
    },

    // 排序下拉菜单样式
    sortDropdown: {
        backgroundColor: tokens.white,
        borderBottomWidth: 1,
        borderBottomColor: tokens.borderSoft,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
    },
    sortDropdownItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing.sm,
        paddingHorizontal: 12,
        borderRadius: radii.sm,
        marginVertical: 2,
    },
    sortDropdownItemActive: {
        backgroundColor: tokens.borderSoft,
    },
    sortDropdownText: {
        fontSize: typography.body,
        color: tokens.secondary,
    },
    sortDropdownTextActive: {
        color: tokens.primary,
        fontWeight: '600',
    },
    // Modal 样式
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    categoryModalContent: {
        backgroundColor: tokens.white,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingBottom: 40,
    },
    categoryModalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: tokens.borderSoft,
    },
    categoryModalTitle: {
        fontSize: typography.h3,
        fontWeight: '600',
        color: tokens.primary,
    },
    categoryGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        padding: spacing.md,
    },
    categoryGridItem: {
        width: (SCREEN_WIDTH - 32 - 24) / 4,
        paddingVertical: spacing.sm,
        margin: 4,
        backgroundColor: tokens.borderSoft,
        borderRadius: radii.sm,
        alignItems: 'center',
    },
    categoryGridItemActive: {
        backgroundColor: tokens.primary,
    },
    categoryGridText: {
        fontSize: typography.body - 1,
        color: tokens.secondary,
    },
    categoryGridTextActive: {
        color: tokens.white,
        fontWeight: '600',
    },
    // 工种筛选下拉菜单样式
    workTypeDropdownGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        padding: 12,
        justifyContent: 'flex-start',
    },
    // 主材分类下拉菜单样式
    categoryDropdown: {
        backgroundColor: tokens.white,
        borderBottomWidth: 1,
        borderBottomColor: tokens.borderSoft,
    },
    categoryDropdownGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        padding: 12,
    },
    categoryDropdownItem: {
        width: (SCREEN_WIDTH - 32 - 48) / 4,
        paddingVertical: spacing.xs + 2,
        margin: 4,
        backgroundColor: tokens.borderSoft,
        borderRadius: radii.xs,
        alignItems: 'center',
    },
    categoryDropdownItemActive: {
        backgroundColor: tokens.primary,
    },
    categoryDropdownText: {
        fontSize: typography.caption,
        color: tokens.secondary,
    },
    categoryDropdownTextActive: {
        color: tokens.white,
        fontWeight: '600',
    },
    workTypeDropdownItem: {
        width: (SCREEN_WIDTH - 32 - 24 - 24) / 3, // 32(outer padding) + 24(grid padding) + 24(margins)
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.xs + 2,
        margin: 4,
        backgroundColor: tokens.borderSoft,
        borderRadius: radii.sm,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    workTypeDropdownItemActive: {
        backgroundColor: tokens.white,
        borderColor: tokens.primary,
    },
    workTypeDropdownText: {
        fontSize: typography.caption,
        color: tokens.secondary,
        marginRight: 4,
    },
    workTypeDropdownTextActive: {
        color: tokens.primary,
        fontWeight: '600',
    },
    dropdownFooter: {
        flexDirection: 'row',
        padding: 12,
        borderTopWidth: 1,
        borderTopColor: tokens.borderSoft,
    },
    dropdownResetBtn: {
        flex: 1,
        backgroundColor: tokens.white,
        paddingVertical: spacing.sm,
        borderRadius: radii.sm,
        alignItems: 'center',
        marginRight: spacing.xs,
        borderWidth: 1,
        borderColor: tokens.border,
    },
    dropdownResetBtnText: {
        color: tokens.secondary,
        fontSize: typography.body,
        fontWeight: '600',
    },
    dropdownConfirmBtn: {
        flex: 2,
        backgroundColor: tokens.primary,
        paddingVertical: spacing.sm,
        borderRadius: radii.sm,
        alignItems: 'center',
    },
    dropdownConfirmBtnText: {
        color: tokens.white,
        fontSize: typography.body,
        fontWeight: '600',
    },
    // 加载、错误、空状态样式
    loadingContainer: {
        paddingVertical: 60,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: typography.body,
        color: tokens.secondary,
    },
    errorContainer: {
        paddingVertical: 60,
        alignItems: 'center',
        justifyContent: 'center',
    },
    errorText: {
        fontSize: typography.body,
        color: tokens.error,
        marginBottom: 16,
    },
    retryBtn: {
        backgroundColor: tokens.primary,
        paddingHorizontal: 24,
        paddingVertical: spacing.xs + 2,
        borderRadius: radii.sm,
    },
    retryBtnText: {
        color: tokens.white,
        fontSize: typography.body,
        fontWeight: '600',
    },
    emptyContainer: {
        paddingVertical: 60,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: {
        fontSize: typography.body,
        color: tokens.placeholder,
    },
    // 自定义刷新指示器样式
    customRefreshIndicator: {
        overflow: 'hidden',
        backgroundColor: tokens.gray50,
        justifyContent: 'center',
        alignItems: 'center',
    },
    refreshContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    refreshText: {
        fontSize: typography.body - 1,
        color: tokens.secondary,
    },
    // 下拉菜单背景遮罩（用于点击关闭）
    dropdownBackdrop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
    },
    // 主材筛选面板样式
    materialFilterPanel: {
        backgroundColor: tokens.white,
        borderBottomWidth: 1,
        borderBottomColor: tokens.borderSoft,
        paddingBottom: 12,
    },
    filterPanelSection: {
        paddingHorizontal: spacing.md,
        paddingTop: 16,
    },
    filterPanelTitle: {
        fontSize: typography.body,
        fontWeight: '600',
        color: tokens.primary,
        marginBottom: spacing.sm,
    },
    filterPanelGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginHorizontal: -4,
    },
    filterPanelItem: {
        width: (SCREEN_WIDTH - 32 - 24) / 4,
        paddingVertical: spacing.xs + 2,
        margin: 4,
        backgroundColor: tokens.borderSoft,
        borderRadius: radii.xs,
        alignItems: 'center',
    },
    filterPanelItemActive: {
        backgroundColor: tokens.primary,
    },
    filterPanelItemText: {
        fontSize: typography.caption,
        color: tokens.secondary,
    },
    filterPanelItemTextActive: {
        color: tokens.white,
        fontWeight: '600',
    },
    filterPanelFooter: {
        flexDirection: 'row',
        paddingHorizontal: spacing.md,
        paddingTop: 16,
        gap: 12,
    },
    filterPanelResetBtn: {
        flex: 1,
        backgroundColor: tokens.white,
        paddingVertical: spacing.sm,
        borderRadius: radii.sm,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: tokens.border,
    },
    filterPanelResetText: {
        color: tokens.secondary,
        fontSize: typography.body,
        fontWeight: '600',
    },
    filterPanelConfirmBtn: {
        flex: 2,
        backgroundColor: tokens.primary,
        paddingVertical: spacing.sm,
        borderRadius: radii.sm,
        alignItems: 'center',
    },
    filterPanelConfirmText: {
        color: tokens.white,
        fontSize: typography.body,
        fontWeight: '600',
    },
});

// 独立的分类 Tab 组件，处理按压动画 (Function Declaration for hoisting)
function CategoryTab({ item, isActive, onPress }: { item: any, isActive: boolean, onPress: () => void }) {
    const scaleAnim = React.useRef(new Animated.Value(1)).current;
    const selectionAnim = React.useRef(new Animated.Value(isActive ? 1 : 0)).current;

    React.useEffect(() => {
        Animated.timing(selectionAnim, {
            toValue: isActive ? 1 : 0,
            duration: 200,
            useNativeDriver: false, // Color interpolation requires false
            easing: Easing.out(Easing.quad),
        }).start();
    }, [isActive]);

    const handlePressIn = () => {
        Animated.spring(scaleAnim, {
            toValue: 0.9,
            useNativeDriver: true,
            speed: 20,
            bounciness: 0,
        }).start();
    };

    const handlePressOut = () => {
        Animated.spring(scaleAnim, {
            toValue: 1,
            useNativeDriver: true,
            speed: 20,
            bounciness: 8,
        }).start();
    };

    const IconComponent = item.icon;

    // Interpolations
    const containerBg = selectionAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [colorsRaw.bgPage, colorsRaw.primary]
    });

    const containerBorder = selectionAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['rgba(0,0,0,0.03)', 'rgba(0,0,0,0)']
    });

    const labelColor = selectionAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [colorsRaw.secondary, colorsRaw.primary]
    });

    // For icon color, we crossfade opacity of two icons because native icon doesn't support animated color string easily
    const activeIconOpacity = selectionAnim;
    const inactiveIconOpacity = selectionAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 0]
    });

    return (
        <TouchableWithoutFeedback
            onPress={onPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
        >
            <Animated.View style={[styles.categoryTab, { transform: [{ scale: scaleAnim }] }]}>
                {/* Icon Container with interpolated background */}
                <Animated.View style={[
                    styles.categoryIconBox,
                    {
                        backgroundColor: containerBg,
                        borderColor: containerBorder,
                        borderWidth: 1, // continuous border width
                    }
                ]}>
                    {/* Inactive Icon (Gray) */}
                    <Animated.View style={{ position: 'absolute', opacity: inactiveIconOpacity }}>
                        <IconComponent size={24} color={tokens.secondary} strokeWidth={1.5} />
                    </Animated.View>

                    {/* Active Icon (White) */}
                    <Animated.View style={{ opacity: activeIconOpacity }}>
                        <IconComponent size={24} color={tokens.white} strokeWidth={1.5} />
                    </Animated.View>
                </Animated.View>

                {/* Animated Label */}
                <Animated.Text style={[
                    styles.categoryLabel,
                    { color: labelColor, fontWeight: isActive ? '700' : '500' }
                ]}>
                    {item.title}
                </Animated.Text>
            </Animated.View>
        </TouchableWithoutFeedback>
    );
}

export default HomeScreen;
