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

// 工种筛选
const WORK_TYPES = [
    { id: 'all', label: '全部工种' },
    { id: 'mason', label: '瓦工' },
    { id: 'electrician', label: '电工' },
    { id: 'carpenter', label: '木工' },
    { id: 'painter', label: '油漆工' },
    { id: 'plumber', label: '水暖工' },
    { id: 'hvac', label: '空调安装' },
    { id: 'general', label: '综合施工' },
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
    const [showWorkTypeModal, setShowWorkTypeModal] = useState(false);
    const [selectedWorkTypes, setSelectedWorkTypes] = useState<string[]>(['all']);
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
                    backgroundColor: '#FFFFFF',
                    borderTopWidth: 1,
                    borderTopColor: '#F4F4F5',
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
            const workTypeLabels = w.workTypeLabels.toLowerCase();
            const tags = w.tags.join(' ').toLowerCase();
            if (name.includes(keyword) || workTypeLabels.includes(keyword) || tags.includes(keyword)) {
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

    const handleWorkTypeToggle = (workType: string) => {
        if (workType === 'all') {
            setSelectedWorkTypes(['all']);
        } else {
            setSelectedWorkTypes(prev => {
                const newTypes = prev.filter(t => t !== 'all');
                if (newTypes.includes(workType)) {
                    const result = newTypes.filter(t => t !== workType);
                    return result.length === 0 ? ['all'] : result;
                } else {
                    return [...newTypes, workType];
                }
            });
        }
    };

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
        setShowWorkTypeModal(false);

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
                setShowWorkTypeModal(false);
                scrollToFilter();
            }
            return !prev;
        });
    }, []);

    const toggleWorkTypeMenu = useCallback(() => {
        setShowWorkTypeModal(prev => {
            if (!prev) {
                setShowConstructionSortMenu(false);
                scrollToFilter();
            }
            return !prev;
        });
    }, []);

    const resetWorkTypes = () => {
        setSelectedWorkTypes(['all']);
    };

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

        // 按工种筛选
        if (!selectedWorkTypes.includes('all') && selectedWorkTypes.length > 0) {
            filtered = filtered.filter((w: Worker) =>
                selectedWorkTypes.some(wt => w.workTypes.includes(wt))
            );
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
    }, [workers, isWorkerLoading, constructionOrgFilter, constructionSortBy, selectedWorkTypes]);

    const materialListData = React.useMemo(() => {
        if (isMaterialLoading && materialShops.length === 0) {
            return [{ id: 'FILTER_SECTION' }, { id: 'skeleton-1' }, { id: 'skeleton-2' }, { id: 'skeleton-3' }];
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
                                <ChevronDown size={14} color="#71717A" />
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
                                borderRadius: 8,
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
                                    {designerSortBy === option.id && <Check size={16} color="#09090B" />}
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
                                <ChevronDown size={14} color="#71717A" />
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
                                borderRadius: 8,
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
                                    {constructionSortBy === option.id && <Check size={16} color="#09090B" />}
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
    }, [constructionSortBy, constructionOrgFilter, showConstructionSortMenu, showWorkTypeModal, selectedWorkTypes, toggleConstructionSort, handleConstructionOrgFilter, navigation]);

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
                                <ChevronDown size={14} color="#71717A" />
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity
                            style={[styles.filterIconBtn, hasActiveFilter && styles.filterIconBtnActive]}
                            onPress={toggleMaterialFilterPanel}
                        >
                            <SlidersHorizontal size={16} color={hasActiveFilter ? '#FFFFFF' : '#71717A'} />
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
                                borderRadius: 8,
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
                                    {materialSortBy === option.id && <Check size={16} color="#09090B" />}
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

        return (
            <MaterialShopCard
                shop={item}
                onPress={(shop) => (navigation as any).navigate('MaterialShopDetail', { shop })}
            />
        );
    }, [materialSortBy, showMaterialSortMenu, showMaterialFilterPanel, selectedMaterialCategory, selectedMaterialType, toggleMaterialSort, toggleMaterialFilterPanel, filterButtonLayout]);

    // 点击外部关闭所有筛选弹窗
    const handleBackdropPress = useCallback(() => {
        if (showDesignerSortMenu) setShowDesignerSortMenu(false);
        if (showConstructionSortMenu) setShowConstructionSortMenu(false);
        if (showMaterialSortMenu) setShowMaterialSortMenu(false);
        if (showWorkTypeModal) setShowWorkTypeModal(false);
        if (showMaterialFilterPanel) setShowMaterialFilterPanel(false);
        if (showGlobalSortMenu) setShowGlobalSortMenu(false);
    }, [showDesignerSortMenu, showConstructionSortMenu, showMaterialSortMenu, showWorkTypeModal, showMaterialFilterPanel, showGlobalSortMenu]);

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar
                barStyle="dark-content"
                backgroundColor="#FFFFFF"
                translucent={Platform.OS === 'android'}
            />
            <TouchableWithoutFeedback onPress={handleBackdropPress}>
                <View style={{ flex: 1 }}>
                    {/* Header */}
                    <View style={styles.header}>
                        {isSearchFocused ? (
                            <>
                                <TouchableOpacity style={styles.backBtn} onPress={() => { setIsSearchFocused(false); setIsSearching(false); setSearchText(''); }}>
                                    <ArrowLeft size={20} color="#09090B" />
                                </TouchableOpacity>
                                <View style={[styles.searchBar, { flex: 1, marginRight: 0 }]}>
                                    <Search size={16} color="#A1A1AA" />
                                    <TextInput
                                        style={styles.searchInput}
                                        placeholder="搜索设计师 / 施工队"
                                        placeholderTextColor="#A1A1AA"
                                        value={searchText}
                                        onChangeText={(text) => { setSearchText(text); if (!text.trim() && isSearching) setIsSearching(false); }}
                                        returnKeyType="search"
                                        onSubmitEditing={handleGlobalSearch}
                                        autoFocus
                                    />
                                    {searchText.length > 0 && (
                                        <TouchableOpacity onPress={() => { setSearchText(''); setIsSearching(false); }} style={styles.clearSearchBtn}>
                                            <X size={16} color="#71717A" />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </>
                        ) : (
                            <>
                                <TouchableOpacity style={styles.locationBtn} onPress={handleLocationPress}>
                                    <MapPin size={16} color="#71717A" />
                                    <Text style={styles.locationText}>{currentCity}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.searchBar} activeOpacity={0.7} onPress={() => setIsSearchFocused(true)}>
                                    <Search size={16} color="#A1A1AA" />
                                    <Text style={styles.searchPlaceholder} numberOfLines={1}>{searchText || '搜索设计师 / 施工队'}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('ScanQR' as never)}>
                                    <Maximize2 size={20} color="#09090B" />
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
                                            <Text style={{ fontSize: 16, color: '#71717A' }}>未找到相关结果</Text>
                                            <Text style={{ fontSize: 13, color: '#A1A1AA', marginTop: 8 }}>试试其他关键词</Text>
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
                                                        <Star size={12} color="#F59E0B" fill="#F59E0B" />
                                                        <Text style={{ fontSize: 12, color: '#09090B', marginLeft: 2 }}>{item.rating}</Text>
                                                    </View>
                                                    <Text style={styles.searchResultDesc} numberOfLines={1}>
                                                        {item._type === 'material' ? `${item.brand} · ¥${item.price}/${item.unit}` : item.specialty || item.workTypeLabels}
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
                                        ListFooterComponent={loadingMoreDesigners ? <ActivityIndicator style={{ paddingVertical: 16 }} size="small" color="#A1A1AA" /> : <View style={{ height: 100 }} />}
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
                                        ListFooterComponent={loadingMoreWorkers ? <ActivityIndicator style={{ paddingVertical: 16 }} size="small" color="#A1A1AA" /> : <View style={{ height: 100 }} />}
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
                                        refreshing={isMaterialLoading}
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
        backgroundColor: '#FFFFFF',
    },
    tabPane: {
        ...StyleSheet.absoluteFillObject,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'ios' ? 12 : 44, // 适配沉浸式状态栏
        paddingBottom: 12,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F4F4F5',
        zIndex: 100,
    },
    locationBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 12,
    },
    locationText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#09090B',
        marginLeft: 4,
    },
    searchBar: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F4F4F5',
        borderRadius: 20,
        paddingHorizontal: 12,
        height: 36,
        marginRight: 8,
        overflow: 'hidden',
    },
    searchInput: {
        flex: 1,
        fontSize: 13,
        color: '#09090B',
        marginLeft: 8,
        padding: 0, // Android fix
    },
    searchPlaceholder: {
        flex: 1,
        fontSize: 13,
        color: '#A1A1AA',
        marginLeft: 8,
    },
    hotSearchSection: {
        padding: 16,
        backgroundColor: '#FFFFFF',
    },
    hotSearchTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#09090B',
        marginBottom: 12,
    },
    hotSearchTags: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    hotSearchTag: {
        backgroundColor: '#F4F4F5',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 16,
        marginRight: 8,
        marginBottom: 8,
    },
    hotSearchTagText: {
        fontSize: 13,
        color: '#52525B',
    },
    clearSearchBtn: {
        padding: 4,
    },
    backBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
    },
    searchResultsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F4F4F5',
    },
    searchResultsInfo: {
        fontSize: 13,
        color: '#71717A',
    },
    searchResultCard: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 12,
        marginHorizontal: 16,
        marginBottom: 12,
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
        backgroundColor: '#F4F4F5',
    },
    searchResultImage: {
        width: 80,
        height: 80,
        borderRadius: 8,
        backgroundColor: '#F4F4F5',
    },
    searchResultInfo: {
        flex: 1,
        marginLeft: 12,
    },
    searchResultName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#09090B',
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
        borderRadius: 4,
        marginRight: 8,
    },
    searchResultTypeBadgeText: {
        fontSize: 10,
        fontWeight: '600',
    },
    searchResultDesc: {
        fontSize: 12,
        color: '#71717A',
    },
    searchResultPrice: {
        fontSize: 16,
        fontWeight: '700',
        color: '#EF4444',
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
        paddingHorizontal: 16,
        backgroundColor: '#FFFFFF',
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
        backgroundColor: '#F8F9FA',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.03)',
    },
    categoryIconBoxActive: {
        backgroundColor: '#09090B',
    },
    categoryLabel: {
        fontSize: 13,
        fontWeight: '500',
        color: '#71717A',
    },
    categoryLabelActive: {
        color: '#09090B',
        fontWeight: '700',
    },
    filterSectionWrapper: {
        backgroundColor: '#FFFFFF',
        zIndex: 90,
    },
    filterSection: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#FFFFFF',
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
        paddingVertical: 6,
        paddingHorizontal: 10,
        backgroundColor: '#F4F4F5',
        borderRadius: 6,
    },
    sortBtnText: {
        fontSize: 13,
        color: '#09090B',
        marginRight: 4,
    },
    orgFilterBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
        marginLeft: 8,
        backgroundColor: '#F4F4F5',
    },
    orgFilterBtnActive: {
        backgroundColor: '#09090B',
    },
    orgFilterText: {
        fontSize: 12,
        color: '#71717A',
    },
    orgFilterTextActive: {
        color: '#FFFFFF',
    },
    filterBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        backgroundColor: '#F4F4F5',
        borderRadius: 6,
        marginLeft: 8,
    },
    filterBtnActive: {
        backgroundColor: '#E4E4E7',
    },
    filterBtnText: {
        fontSize: 12,
        color: '#71717A',
        marginLeft: 4,
    },
    filterBtnTextActive: {
        color: '#09090B',
    },
    filterIconBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: '#F4F4F5',
        borderRadius: 6,
    },
    filterIconBtnActive: {
        backgroundColor: '#09090B',
    },
    filterIconText: {
        fontSize: 12,
        color: '#71717A',
        marginLeft: 4,
    },
    filterIconTextActive: {
        color: '#FFFFFF',
    },
    listSection: {
        padding: 16,
    },

    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyStateTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#09090B',
        marginTop: 16,
        marginBottom: 8,
    },
    emptyStateSub: {
        fontSize: 14,
        color: '#71717A',
    },
    comingSoonText: {
        fontSize: 14,
        color: '#A1A1AA',
        textAlign: 'center',
        width: '100%',
    },

    // 排序下拉菜单样式
    sortDropdown: {
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F4F4F5',
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    sortDropdownItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 8,
        marginVertical: 2,
    },
    sortDropdownItemActive: {
        backgroundColor: '#F4F4F5',
    },
    sortDropdownText: {
        fontSize: 14,
        color: '#71717A',
    },
    sortDropdownTextActive: {
        color: '#09090B',
        fontWeight: '600',
    },
    // Modal 样式
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    categoryModalContent: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingBottom: 40,
    },
    categoryModalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F4F4F5',
    },
    categoryModalTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#09090B',
    },
    categoryGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        padding: 16,
    },
    categoryGridItem: {
        width: (SCREEN_WIDTH - 32 - 24) / 4,
        paddingVertical: 12,
        margin: 4,
        backgroundColor: '#F4F4F5',
        borderRadius: 8,
        alignItems: 'center',
    },
    categoryGridItemActive: {
        backgroundColor: '#09090B',
    },
    categoryGridText: {
        fontSize: 13,
        color: '#71717A',
    },
    categoryGridTextActive: {
        color: '#FFFFFF',
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
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F4F4F5',
    },
    categoryDropdownGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        padding: 12,
    },
    categoryDropdownItem: {
        width: (SCREEN_WIDTH - 32 - 48) / 4,
        paddingVertical: 10,
        margin: 4,
        backgroundColor: '#F4F4F5',
        borderRadius: 6,
        alignItems: 'center',
    },
    categoryDropdownItemActive: {
        backgroundColor: '#09090B',
    },
    categoryDropdownText: {
        fontSize: 12,
        color: '#71717A',
    },
    categoryDropdownTextActive: {
        color: '#FFFFFF',
        fontWeight: '600',
    },
    workTypeDropdownItem: {
        width: (SCREEN_WIDTH - 32 - 24 - 24) / 3, // 32(outer padding) + 24(grid padding) + 24(margins)
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        margin: 4,
        backgroundColor: '#F4F4F5',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    workTypeDropdownItemActive: {
        backgroundColor: '#FFFFFF',
        borderColor: '#09090B',
    },
    workTypeDropdownText: {
        fontSize: 12,
        color: '#71717A',
        marginRight: 4,
    },
    workTypeDropdownTextActive: {
        color: '#09090B',
        fontWeight: '600',
    },
    dropdownFooter: {
        flexDirection: 'row',
        padding: 12,
        borderTopWidth: 1,
        borderTopColor: '#F4F4F5',
    },
    dropdownResetBtn: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
        marginRight: 8,
        borderWidth: 1,
        borderColor: '#E4E4E7',
    },
    dropdownResetBtnText: {
        color: '#71717A',
        fontSize: 14,
        fontWeight: '600',
    },
    dropdownConfirmBtn: {
        flex: 2,
        backgroundColor: '#09090B',
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    dropdownConfirmBtnText: {
        color: '#FFFFFF',
        fontSize: 14,
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
        fontSize: 14,
        color: '#71717A',
    },
    errorContainer: {
        paddingVertical: 60,
        alignItems: 'center',
        justifyContent: 'center',
    },
    errorText: {
        fontSize: 14,
        color: '#EF4444',
        marginBottom: 16,
    },
    retryBtn: {
        backgroundColor: '#09090B',
        paddingHorizontal: 24,
        paddingVertical: 10,
        borderRadius: 8,
    },
    retryBtnText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    emptyContainer: {
        paddingVertical: 60,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: {
        fontSize: 14,
        color: '#A1A1AA',
    },
    // 自定义刷新指示器样式
    customRefreshIndicator: {
        overflow: 'hidden',
        backgroundColor: '#F8F8F8',
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
        fontSize: 13,
        color: '#71717A',
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
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F4F4F5',
        paddingBottom: 12,
    },
    filterPanelSection: {
        paddingHorizontal: 16,
        paddingTop: 16,
    },
    filterPanelTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#09090B',
        marginBottom: 12,
    },
    filterPanelGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginHorizontal: -4,
    },
    filterPanelItem: {
        width: (SCREEN_WIDTH - 32 - 24) / 4,
        paddingVertical: 10,
        margin: 4,
        backgroundColor: '#F4F4F5',
        borderRadius: 6,
        alignItems: 'center',
    },
    filterPanelItemActive: {
        backgroundColor: '#09090B',
    },
    filterPanelItemText: {
        fontSize: 12,
        color: '#71717A',
    },
    filterPanelItemTextActive: {
        color: '#FFFFFF',
        fontWeight: '600',
    },
    filterPanelFooter: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingTop: 16,
        gap: 12,
    },
    filterPanelResetBtn: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E4E4E7',
    },
    filterPanelResetText: {
        color: '#71717A',
        fontSize: 14,
        fontWeight: '600',
    },
    filterPanelConfirmBtn: {
        flex: 2,
        backgroundColor: '#09090B',
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    filterPanelConfirmText: {
        color: '#FFFFFF',
        fontSize: 14,
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
        outputRange: ['#F8F9FA', '#09090B']
    });

    const containerBorder = selectionAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['rgba(0,0,0,0.03)', 'rgba(0,0,0,0)']
    });

    const labelColor = selectionAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['#71717A', '#09090B']
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
                        <IconComponent size={24} color="#71717A" strokeWidth={1.5} />
                    </Animated.View>

                    {/* Active Icon (White) */}
                    <Animated.View style={{ opacity: activeIconOpacity }}>
                        <IconComponent size={24} color="#FFFFFF" strokeWidth={1.5} />
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
