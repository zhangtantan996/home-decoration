import React, { useState, useRef, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MATERIALS } from '../services/mockData';
import { providerApi } from '../services/api';
import { Designer, Worker, ProviderDTO, toDesigner, toWorker } from '../types/provider';
import { NetworkErrorView, LoadingView, EmptyView, PullToRefresh } from '../components';
import {
    MapPin,
    Search,
    Bell,
    Maximize2,
    PencilRuler,
    Hammer,
    Package,
    Star,
    ChevronDown,
    MapPinned,
    SlidersHorizontal,
    X,
    Check,
    Briefcase,
    Award,
    Users,
    ArrowLeft
} from 'lucide-react-native';

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
    { id: 'rating', label: '评分最高' },
    { id: 'price_low', label: '价格最低' },
    { id: 'price_high', label: '价格最高' },
    { id: 'orders', label: '接单量最多' },
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
    { id: 'sales', label: '销量最高' },
    { id: 'price_low', label: '价格最低' },
    { id: 'price_high', label: '价格最高' },
    { id: 'rating', label: '好评优先' },
];

// 主材分类
const MATERIAL_CATEGORIES = [
    { id: 'all', label: '全部' },
    { id: 'tile', label: '瓷砖' },
    { id: 'floor', label: '地板' },
    { id: 'bathroom', label: '卫浴' },
    { id: 'cabinet', label: '橱柜' },
    { id: 'door', label: '门窗' },
    { id: 'paint', label: '涂料' },
    { id: 'lighting', label: '灯具' },
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

    // API 数据状态
    const [designers, setDesigners] = useState<Designer[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // 分页状态
    const [designerPage, setDesignerPage] = useState(1);
    const [workerPage, setWorkerPage] = useState(1);
    const [hasMoreDesigners, setHasMoreDesigners] = useState(true);
    const [hasMoreWorkers, setHasMoreWorkers] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

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

    // 全局搜索状态
    const [isSearching, setIsSearching] = useState(false);
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [globalSortBy, setGlobalSortBy] = useState('recommend');
    const [showGlobalSortMenu, setShowGlobalSortMenu] = useState(false);

    const scrollRef = useRef<ScrollView>(null);
    const [categoryHeight, setCategoryHeight] = useState(0);
    const navigation = useNavigation();
    // refreshing 状态由 PullToRefresh 内部控制，但由于我们需要手动触发刷新，保留该状态也没问题，
    // 不过 PullToRefresh 组件是受控的吗？看代码是内部管理的state。我们只传 onRefresh promise。
    // 这里保留 refreshing 也没事。

    // 获取设计师数据
    const fetchDesigners = async (page: number, shouldRefresh: boolean = false) => {
        try {
            if (shouldRefresh) setIsLoading(true);
            else setLoadingMore(true);

            const res = await providerApi.designers({
                page,
                pageSize: 10,
                sortBy: designerSortBy,
                keyword: searchText,
                subType: designerOrgFilter === 'all' ? '' : designerOrgFilter, // Pass subType
                type: 1
            });
            const list = (res?.data?.list || []).map((dto: ProviderDTO) => toDesigner(dto));
            const total = res?.data?.total || 0;

            if (shouldRefresh) {
                setDesigners(list);
                setDesignerPage(1);
            } else {
                setDesigners(prev => [...prev, ...list]);
                setDesignerPage(page);
            }
            setHasMoreDesigners(list.length >= 10);
        } catch (err: any) {
            console.error('Fetch designers failed:', err);
        } finally {
            setIsLoading(false);
            setLoadingMore(false);
        }
    };

    // 获取施工数据
    const fetchWorkers = async (page: number, shouldRefresh: boolean = false) => {
        try {
            if (shouldRefresh) setIsLoading(true);
            else setLoadingMore(true);

            // 处理工种筛选: 只要选了非all，就传第一个作为 WorkType (后端目前支持单选LIKE)
            let workTypeParam = '';
            if (!selectedWorkTypes.includes('all') && selectedWorkTypes.length > 0) {
                workTypeParam = selectedWorkTypes[0];
            }

            const res = await providerApi.foremen({
                page,
                pageSize: 10,
                sortBy: constructionSortBy,
                keyword: searchText,
                workType: workTypeParam,
                subType: constructionOrgFilter === 'all' ? '' : constructionOrgFilter, // Pass subType
                type: 3
            });
            const list = (res?.data?.list || []).map((dto: ProviderDTO) => toWorker(dto));

            if (shouldRefresh) {
                setWorkers(list);
                setWorkerPage(1);
            } else {
                setWorkers(prev => [...prev, ...list]);
                setWorkerPage(page);
            }
            setHasMoreWorkers(list.length >= 10);
        } catch (err: any) {
            console.error('Fetch workers failed:', err);
        } finally {
            setIsLoading(false);
            setLoadingMore(false);
        }
    };

    // 初始加载
    useEffect(() => {
        fetchDesigners(1, true);
        fetchWorkers(1, true);
    }, []);

    // 监听筛选变化 - 设计师
    useEffect(() => {
        fetchDesigners(1, true);
    }, [designerSortBy, searchText, designerOrgFilter]); // Add designerOrgFilter

    // 监听筛选变化 - 施工
    useEffect(() => {
        fetchWorkers(1, true);
    }, [constructionSortBy, selectedWorkTypes, constructionOrgFilter]); // Add constructionOrgFilter

    // 下拉刷新处理
    const handleRefresh = async () => {
        if (activeCategory === 'designer') {
            await fetchDesigners(1, true);
        } else if (activeCategory === 'construction') {
            await fetchWorkers(1, true);
        }
        // Material tab not implemented yet
    };

    // 加载更多处理
    const handleLoadMore = () => {
        if (loadingMore || isLoading) return;

        if (activeCategory === 'designer' && hasMoreDesigners) {
            fetchDesigners(designerPage + 1, false);
        } else if (activeCategory === 'construction' && hasMoreWorkers) {
            fetchWorkers(workerPage + 1, false);
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

    const handleDesignerOrgFilter = (type: string) => {
        setDesignerOrgFilter(prev => prev === type ? null : type);
    };

    const handleConstructionOrgFilter = (type: string) => {
        setConstructionOrgFilter(prev => prev === type ? null : type);
    };

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
        setActiveCategory(categoryId);
        // 关闭所有菜单
        setShowDesignerSortMenu(false);
        setShowConstructionSortMenu(false);
        setShowWorkTypeModal(false);
    };

    const toggleDesignerSort = () => {
        const newValue = !showDesignerSortMenu;
        setShowDesignerSortMenu(newValue);
        if (newValue) scrollToFilter();
    };

    const toggleConstructionSort = () => {
        const newValue = !showConstructionSortMenu;
        setShowConstructionSortMenu(newValue);
        if (newValue) {
            setShowWorkTypeModal(false); // 关闭筛选
            scrollToFilter();
        }
    };

    const toggleWorkTypeMenu = () => {
        const newValue = !showWorkTypeModal;
        setShowWorkTypeModal(newValue);
        if (newValue) {
            setShowConstructionSortMenu(false); // 关闭排序
            scrollToFilter();
        }
    };

    const resetWorkTypes = () => {
        setSelectedWorkTypes(['all']);
    };

    // 获取当前排序选项和标签
    const currentSortOptions = activeCategory === 'designer' ? DESIGNER_SORT_OPTIONS : CONSTRUCTION_SORT_OPTIONS;
    const currentSortBy = activeCategory === 'designer' ? designerSortBy : constructionSortBy;
    const currentSortLabel = currentSortOptions.find(o => o.id === currentSortBy)?.label || '综合排序';

    return (
        <SafeAreaView style={styles.container}>
            {/* 固定Header - 始终在顶部 */}
            <View style={styles.header}>
                {isSearchFocused ? (
                    <>
                        {/* 聚焦状态：返回按钮 + 全宽搜索框 */}
                        <TouchableOpacity
                            style={styles.backBtn}
                            onPress={() => {
                                setIsSearchFocused(false);
                                setIsSearching(false);
                                setSearchText('');
                            }}
                        >
                            <ArrowLeft size={20} color="#09090B" />
                        </TouchableOpacity>
                        <View style={[styles.searchBar, { flex: 1, marginRight: 0 }]}>
                            <Search size={16} color="#A1A1AA" />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="搜索设计师 / 施工队"
                                placeholderTextColor="#A1A1AA"
                                value={searchText}
                                onChangeText={(text) => {
                                    setSearchText(text);
                                    if (!text.trim() && isSearching) {
                                        setIsSearching(false);
                                    }
                                }}
                                returnKeyType="search"
                                onSubmitEditing={handleGlobalSearch}
                                autoFocus
                            />
                            {searchText.length > 0 && (
                                <TouchableOpacity
                                    onPress={() => {
                                        setSearchText('');
                                        setIsSearching(false);
                                    }}
                                    style={styles.clearSearchBtn}
                                >
                                    <X size={16} color="#71717A" />
                                </TouchableOpacity>
                            )}
                        </View>
                    </>
                ) : (
                    <>
                        {/* 正常状态：位置 + 搜索框 + 图标 */}
                        <TouchableOpacity style={styles.locationBtn}>
                            <MapPin size={16} color="#71717A" />
                            <Text style={styles.locationText}>上海</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.searchBar}
                            activeOpacity={0.7}
                            onPress={() => setIsSearchFocused(true)}
                        >
                            <Search size={16} color="#A1A1AA" />
                            <Text style={styles.searchPlaceholder} numberOfLines={1}>
                                {searchText || '搜索设计师 / 施工队'}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.iconBtn}
                            onPress={() => navigation.navigate('ScanQR' as never)}
                        >
                            <Maximize2 size={20} color="#09090B" />
                        </TouchableOpacity>
                    </>
                )}
            </View>

            <PullToRefresh
                onRefresh={handleRefresh}
                disabled={isSearchFocused || isSearching}
            >

                {/* 可滚动内容区域 */}
                <ScrollView
                    ref={scrollRef}
                    style={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    stickyHeaderIndices={(!isSearchFocused && !isSearching) ? [1] : []}
                    keyboardShouldPersistTaps="handled"
                    scrollEnabled={true}
                    scrollEventThrottle={400}
                    onScroll={({ nativeEvent }) => {
                        const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
                        if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 20) {
                            handleLoadMore();
                        }
                    }}
                >
                    {/* 搜索状态分支 */}
                    {isSearchFocused && !isSearching ? (
                        // 热门搜索词
                        <View style={styles.hotSearchSection}>
                            <Text style={styles.hotSearchTitle}>热门搜索</Text>
                            <View style={styles.hotSearchTags}>
                                {HOT_SEARCH_TERMS.map((term, index) => (
                                    <TouchableOpacity
                                        key={index}
                                        style={styles.hotSearchTag}
                                        onPress={() => {
                                            setSearchText(term);
                                            setIsSearching(true);
                                        }}
                                    >
                                        <Text style={styles.hotSearchTagText}>{term}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    ) : isSearching ? (
                        <View>
                            {/* 搜索结果头部 + 排序 */}
                            <View style={styles.searchResultsHeader}>
                                <Text style={styles.searchResultsInfo}>
                                    共找到 {unifiedSearchResults.length} 个结果
                                </Text>
                                <TouchableOpacity
                                    style={styles.sortBtn}
                                    onPress={() => setShowGlobalSortMenu(!showGlobalSortMenu)}
                                >
                                    <Text style={styles.sortBtnText}>
                                        {GLOBAL_SORT_OPTIONS.find(o => o.id === globalSortBy)?.label || '综合排序'}
                                    </Text>
                                    <ChevronDown size={14} color="#71717A" />
                                </TouchableOpacity>
                            </View>

                            {/* 排序下拉菜单 */}
                            {showGlobalSortMenu && (
                                <View style={styles.sortDropdown}>
                                    {GLOBAL_SORT_OPTIONS.map(option => (
                                        <TouchableOpacity
                                            key={option.id}
                                            style={[
                                                styles.sortDropdownItem,
                                                globalSortBy === option.id && styles.sortDropdownItemActive
                                            ]}
                                            onPress={() => {
                                                setGlobalSortBy(option.id);
                                                setShowGlobalSortMenu(false);
                                            }}
                                        >
                                            <Text style={[
                                                styles.sortDropdownText,
                                                globalSortBy === option.id && styles.sortDropdownTextActive
                                            ]}>
                                                {option.label}
                                            </Text>
                                            {globalSortBy === option.id && (
                                                <Check size={16} color="#09090B" />
                                            )}
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}

                            {/* 搜索结果列表 */}
                            <View style={styles.listSection}>
                                {unifiedSearchResults.length === 0 ? (
                                    <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                                        <Text style={{ fontSize: 16, color: '#71717A' }}>未找到相关结果</Text>
                                        <Text style={{ fontSize: 13, color: '#A1A1AA', marginTop: 8 }}>试试其他关键词</Text>
                                    </View>
                                ) : (
                                    unifiedSearchResults.map((item, index) => (
                                        <TouchableOpacity key={`${item._type}-${item.id}-${index}`} style={styles.searchResultCard}>
                                            {item._type === 'material' ? (
                                                <Image source={{ uri: item.image }} style={styles.searchResultImage} />
                                            ) : (
                                                <Image source={{ uri: item.avatar || item.logo }} style={styles.searchResultAvatar} />
                                            )}
                                            <View style={styles.searchResultInfo}>
                                                <Text style={styles.searchResultName} numberOfLines={1}>{item.name}</Text>
                                                <View style={styles.searchResultMeta}>
                                                    <View style={[
                                                        styles.searchResultTypeBadge,
                                                        { backgroundColor: item._type === 'designer' ? '#F0F9FF' : item._type === 'construction' ? '#FFF7ED' : '#FDF2F8' }
                                                    ]}>
                                                        <Text style={[
                                                            styles.searchResultTypeBadgeText,
                                                            { color: item._type === 'designer' ? '#0369A1' : item._type === 'construction' ? '#C2410C' : '#BE185D' }
                                                        ]}>
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
                        </View>
                    ) : null}

                    {/* 服务分类 - 直接子元素 [0] */}
                    {!isSearchFocused && !isSearching && (
                        <View
                            style={styles.categorySection}
                            onLayout={(e) => setCategoryHeight(e.nativeEvent.layout.height)}
                        >
                            {SERVICE_CATEGORIES.map((cat) => {
                                const IconComponent = cat.icon;
                                const isActive = activeCategory === cat.id;
                                return (
                                    <TouchableOpacity
                                        key={cat.id}
                                        style={styles.categoryTab}
                                        onPress={() => handleCategoryChange(cat.id)}
                                        activeOpacity={1}
                                    >
                                        <View style={[
                                            styles.categoryIconBox,
                                            isActive ? styles.categoryIconBoxActive : styles.categoryIconBoxInactive
                                        ]}>
                                            <IconComponent size={24} color={isActive ? '#FFFFFF' : '#71717A'} strokeWidth={1.5} />
                                        </View>
                                        <Text style={[styles.categoryLabel, isActive && styles.categoryLabelActive]}>
                                            {cat.title}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    )}

                    {/* 筛选排序区域 - 直接子元素 [1] - 吸顶 */}
                    {!isSearchFocused && !isSearching && (
                        <View style={styles.filterSectionWrapper}>
                            {activeCategory === 'designer' && (
                                <View style={styles.filterSection}>
                                    <View style={styles.filterLeft}>
                                        <TouchableOpacity
                                            style={styles.sortBtn}
                                            onPress={toggleDesignerSort}
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
                            )}

                            {activeCategory === 'construction' && (
                                <View style={styles.filterSection}>
                                    <View style={styles.filterLeft}>
                                        <TouchableOpacity
                                            style={styles.sortBtn}
                                            onPress={toggleConstructionSort}
                                        >
                                            <Text style={styles.sortBtnText}>
                                                {CONSTRUCTION_SORT_OPTIONS.find(o => o.id === constructionSortBy)?.label}
                                            </Text>
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
                                                <Text style={[styles.orgFilterText, constructionOrgFilter === org.id && styles.orgFilterTextActive]}>
                                                    {org.label}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                        <TouchableOpacity
                                            style={[styles.filterBtn, !selectedWorkTypes.includes('all') && styles.filterBtnActive]}
                                            onPress={toggleWorkTypeMenu}
                                        >
                                            <SlidersHorizontal size={14} color={!selectedWorkTypes.includes('all') ? '#09090B' : '#71717A'} />
                                            <Text style={[styles.filterBtnText, !selectedWorkTypes.includes('all') && styles.filterBtnTextActive]}>筛选</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}

                            {activeCategory === 'material' && (
                                <View style={styles.filterSection}>
                                    <Text style={styles.comingSoonText}>主材商城即将上线</Text>
                                </View>
                            )}

                            {/* 设计师排序下拉菜单 */}
                            {showDesignerSortMenu && activeCategory === 'designer' && (
                                <View style={styles.sortDropdown}>
                                    {DESIGNER_SORT_OPTIONS.map(option => (
                                        <TouchableOpacity
                                            key={option.id}
                                            style={[
                                                styles.sortDropdownItem,
                                                designerSortBy === option.id && styles.sortDropdownItemActive
                                            ]}
                                            onPress={() => {
                                                setDesignerSortBy(option.id);
                                                setShowDesignerSortMenu(false);
                                            }}
                                        >
                                            <Text style={[
                                                styles.sortDropdownText,
                                                designerSortBy === option.id && styles.sortDropdownTextActive
                                            ]}>
                                                {option.label}
                                            </Text>
                                            {designerSortBy === option.id && <Check size={16} color="#09090B" />}
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}

                            {/* 施工排序下拉菜单 */}
                            {showConstructionSortMenu && activeCategory === 'construction' && (
                                <View style={styles.sortDropdown}>
                                    {CONSTRUCTION_SORT_OPTIONS.map(option => (
                                        <TouchableOpacity
                                            key={option.id}
                                            style={[
                                                styles.sortDropdownItem,
                                                constructionSortBy === option.id && styles.sortDropdownItemActive
                                            ]}
                                            onPress={() => {
                                                setConstructionSortBy(option.id);
                                                setShowConstructionSortMenu(false);
                                            }}
                                        >
                                            <Text style={[
                                                styles.sortDropdownText,
                                                constructionSortBy === option.id && styles.sortDropdownTextActive
                                            ]}>
                                                {option.label}
                                            </Text>
                                            {constructionSortBy === option.id && <Check size={16} color="#09090B" />}
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}

                            {/* 施工工种筛选下拉菜单 (替换原来的 Modal) */}
                            {showWorkTypeModal && activeCategory === 'construction' && (
                                <View style={styles.sortDropdown}>
                                    <View style={styles.workTypeDropdownGrid}>
                                        {WORK_TYPES.map(type => (
                                            <TouchableOpacity
                                                key={type.id}
                                                style={[
                                                    styles.workTypeDropdownItem,
                                                    selectedWorkTypes.includes(type.id) && styles.workTypeDropdownItemActive
                                                ]}
                                                onPress={() => handleWorkTypeToggle(type.id)}
                                            >
                                                <Text style={[
                                                    styles.workTypeDropdownText,
                                                    selectedWorkTypes.includes(type.id) && styles.workTypeDropdownTextActive
                                                ]}>
                                                    {type.label}
                                                </Text>
                                                {selectedWorkTypes.includes(type.id) && <Check size={14} color="#09090B" />}
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                    <View style={styles.dropdownFooter}>
                                        <TouchableOpacity
                                            style={styles.dropdownResetBtn}
                                            onPress={resetWorkTypes}
                                        >
                                            <Text style={styles.dropdownResetBtnText}>重置</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.dropdownConfirmBtn}
                                            onPress={() => setShowWorkTypeModal(false)}
                                        >
                                            <Text style={styles.dropdownConfirmBtnText}>完成</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}
                        </View>
                    )}

                    {/* 设计师列表 - 直接子元素 [2] */}
                    {!isSearchFocused && !isSearching && activeCategory === 'designer' && (
                        <View style={styles.listSection}>
                            {isLoading ? (
                                <LoadingView message="加载设计师中..." />
                            ) : error ? (
                                <NetworkErrorView
                                    type="network"
                                    message={error}
                                    onRetry={handleRefresh}
                                />
                            ) : designers.length === 0 ? (
                                <EmptyView
                                    type="data"
                                    title="暂无设计师数据"
                                    subtitle="请稍后刷新重试"
                                />
                            ) : (
                                designers.map((designer) => (
                                    <TouchableOpacity
                                        key={designer.id}
                                        style={styles.designerCard}
                                        onPress={() => (navigation as any).navigate('DesignerDetail', { designer })}
                                    >
                                        <View style={styles.designerCardHeader}>
                                            <Image
                                                source={{ uri: designer.avatar }}
                                                style={styles.designerAvatar}
                                            />
                                            <View style={styles.designerInfo}>
                                                <Text style={styles.designerName}>{designer.name}</Text>
                                                <View style={styles.designerMeta}>
                                                    <Text style={styles.experienceText}>{designer.yearsExperience}年经验</Text>
                                                    <Text style={styles.divider}>·</Text>
                                                    <Star size={12} color="#F59E0B" fill="#F59E0B" />
                                                    <Text style={styles.ratingText}>{designer.rating}</Text>
                                                    <Text style={styles.reviewCountText}>({designer.reviewCount})</Text>
                                                </View>
                                                <View style={styles.designerOrg}>
                                                    <View style={[styles.orgBadge, styles[designer.orgType as keyof typeof styles] as any]}>
                                                        <Text style={styles.orgBadgeText}>
                                                            {designer.orgType === 'personal' ? '个人' : designer.orgType === 'studio' ? '工作室' : '公司'}
                                                        </Text>
                                                    </View>
                                                    <Text style={styles.orgName} numberOfLines={1}>{designer.orgLabel}</Text>
                                                </View>
                                            </View>
                                        </View>
                                        <View style={styles.designerCardBody}>
                                            <View style={styles.designerTagsRow}>
                                                <View style={styles.distanceInfo}>
                                                    <MapPinned size={12} color="#71717A" />
                                                    <Text style={styles.distanceText}>{designer.distance}</Text>
                                                </View>
                                                <Text style={styles.specialtyText} numberOfLines={1}>{designer.specialty}</Text>
                                            </View>
                                        </View>
                                        <View style={styles.designerCardFooter}>
                                            <TouchableOpacity
                                                style={styles.bookBtnFull}
                                                onPress={() => (navigation as any).navigate('Booking', { provider: designer, providerType: 'designer' })}
                                            >
                                                <Text style={styles.bookBtnText}>立即预约</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </TouchableOpacity>
                                ))
                            )}
                        </View>
                    )}

                    {/* 施工列表 - 直接子元素 [2] */}
                    {!isSearchFocused && !isSearching && activeCategory === 'construction' && (
                        <View style={styles.listSection}>
                            {isLoading ? (
                                <LoadingView message="加载施工人员中..." />
                            ) : error ? (
                                <NetworkErrorView
                                    type="network"
                                    message={error}
                                    onRetry={handleRefresh}
                                />
                            ) : workers.length === 0 ? (
                                <EmptyView
                                    type="data"
                                    title="暂无施工人员数据"
                                    subtitle="请稍后刷新重试"
                                />
                            ) : (
                                workers.map((worker) => (
                                    worker.type === 'personal' ? (
                                        // 个人师傅卡片 - 改为垂直布局
                                        <TouchableOpacity
                                            key={worker.id}
                                            style={styles.workerCard}
                                            onPress={() => (navigation as any).navigate('WorkerDetail', { worker })}
                                        >
                                            <View style={styles.workerCardHeader}>
                                                <Image
                                                    source={{ uri: worker.avatar }}
                                                    style={styles.workerAvatar}
                                                />
                                                <View style={styles.workerInfo}>
                                                    <Text style={styles.workerName}>{worker.name}</Text>
                                                    <View style={styles.workerMeta}>
                                                        <Text style={styles.experienceText}>{worker.yearsExperience}年经验</Text>
                                                        <Text style={styles.divider}>·</Text>
                                                        <Star size={12} color="#F59E0B" fill="#F59E0B" />
                                                        <Text style={styles.ratingText}>{worker.rating}</Text>
                                                        <Text style={styles.reviewCountText}>({worker.reviewCount})</Text>
                                                    </View>
                                                    <View style={styles.workerWorkType}>
                                                        <View style={styles.workTypeBadge}>
                                                            <Text style={styles.workTypeBadgeText}>{worker.workTypeLabels}</Text>
                                                        </View>
                                                    </View>
                                                </View>
                                            </View>
                                            <View style={styles.workerCardBody}>
                                                <View style={styles.workerStatsRow}>
                                                    <Text style={styles.priceInline}>
                                                        ¥{worker.priceRange}<Text style={styles.priceUnit}>/{worker.priceUnit.replace('元/', '')}</Text>
                                                    </Text>
                                                    <Text style={styles.ordersInline}>已完成{worker.completedOrders}单</Text>
                                                    <View style={styles.distanceInline}>
                                                        <MapPinned size={12} color="#A1A1AA" />
                                                        <Text style={styles.distanceInlineText}>{worker.distance}</Text>
                                                    </View>
                                                </View>
                                                <View style={styles.workerTags}>
                                                    {worker.tags.map((tag, idx) => (
                                                        <View key={idx} style={styles.tagBadge}>
                                                            <Text style={styles.tagText}>{tag}</Text>
                                                        </View>
                                                    ))}
                                                </View>
                                            </View>
                                            <View style={styles.workerCardFooter}>
                                                <TouchableOpacity
                                                    style={styles.bookBtnFull}
                                                    onPress={() => (navigation as any).navigate('Booking', { provider: worker, providerType: 'worker' })}
                                                >
                                                    <Text style={styles.bookBtnTextSmall}>立即预约</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </TouchableOpacity>
                                    ) : (
                                        // 公司卡片
                                        <TouchableOpacity
                                            key={worker.id}
                                            style={styles.companyCard}
                                            onPress={() => (navigation as any).navigate('CompanyDetail', {
                                                company: {
                                                    ...worker,
                                                    logo: (worker as any).logo,
                                                    establishedYear: (worker as any).establishedYear,
                                                    teamSize: (worker as any).teamSize,
                                                    certifications: (worker as any).certifications,
                                                }
                                            })}
                                        >
                                            <View style={styles.companyHeader}>
                                                <Image
                                                    source={{ uri: (worker as any).logo }}
                                                    style={styles.companyLogo}
                                                />
                                                <View style={styles.companyTitle}>
                                                    <Text style={styles.companyName}>{worker.name}</Text>
                                                    <View style={styles.companyMeta}>
                                                        <Text style={styles.establishedText}>成立{new Date().getFullYear() - (worker as any).establishedYear}年</Text>
                                                        <Text style={styles.divider}>·</Text>
                                                        <Star size={12} color="#F59E0B" fill="#F59E0B" />
                                                        <Text style={styles.ratingText}>{worker.rating}</Text>
                                                        <Text style={styles.reviewCountText}>({worker.reviewCount})</Text>
                                                    </View>
                                                </View>
                                            </View>
                                            <View style={styles.companyBody}>
                                                <View style={styles.companyStats}>
                                                    <View style={styles.companyStatItem}>
                                                        <Users size={16} color="#71717A" />
                                                        <Text style={styles.statValue}>{(worker as any).teamSize}人</Text>
                                                        <Text style={styles.statLabel}>团队</Text>
                                                    </View>
                                                    <View style={styles.companyStatItem}>
                                                        <Briefcase size={16} color="#71717A" />
                                                        <Text style={styles.statValue}>{worker.completedOrders}</Text>
                                                        <Text style={styles.statLabel}>已完工</Text>
                                                    </View>
                                                    <View style={styles.companyStatItem}>
                                                        <Award size={16} color="#71717A" />
                                                        <Text style={styles.statValue} numberOfLines={1}>{worker.workTypeLabels}</Text>
                                                        <Text style={styles.statLabel}>工种</Text>
                                                    </View>
                                                </View>
                                                <View style={styles.companyCerts}>
                                                    {(worker as any).certifications?.map((cert: string, idx: number) => (
                                                        <View key={idx} style={styles.certBadge}>
                                                            <Text style={styles.certBadgeText}>{cert}</Text>
                                                        </View>
                                                    ))}
                                                </View>
                                                <View style={styles.companyPrice}>
                                                    <Text style={styles.priceLabel}>参考报价</Text>
                                                    <Text style={styles.companyPriceValue}>¥{worker.priceRange}{worker.priceUnit}</Text>
                                                </View>
                                                <View style={styles.workerTags}>
                                                    {worker.tags.map((tag, idx) => (
                                                        <View key={idx} style={styles.tagBadge}>
                                                            <Text style={styles.tagText}>{tag}</Text>
                                                        </View>
                                                    ))}
                                                </View>
                                            </View>
                                            <View style={styles.workerCardFooter}>
                                                <TouchableOpacity
                                                    style={styles.bookBtnFull}
                                                    onPress={() => (navigation as any).navigate('Booking', {
                                                        provider: {
                                                            ...worker,
                                                            logo: (worker as any).logo,
                                                            establishedYear: (worker as any).establishedYear,
                                                            teamSize: (worker as any).teamSize,
                                                            certifications: (worker as any).certifications,
                                                        },
                                                        providerType: 'company'
                                                    })}
                                                >
                                                    <Text style={styles.bookBtnTextSmall}>立即预约</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </TouchableOpacity>
                                    )
                                ))
                            )}
                        </View>
                    )}

                    {/* 主材列表 - 直接子元素 [2] */}
                    {!isSearchFocused && !isSearching && activeCategory === 'material' && (
                        <View style={styles.emptyState}>
                            <Package size={64} color="#E4E4E7" strokeWidth={1} />
                            <Text style={styles.emptyStateTitle}>主材商城即将上线</Text>
                            <Text style={styles.emptyStateSub}>敬请期待，精选建材品牌即将入驻</Text>
                        </View>
                    )}

                    {/* 底部间距 */}
                    {!isSearchFocused && !isSearching && (
                        <View style={{ height: 100 }} />
                    )}
                    {/* 底部加载更多 */}
                    {loadingMore && (
                        <View style={{ paddingVertical: 16, alignItems: 'center' }}>
                            <ActivityIndicator size="small" color="#A1A1AA" />
                            <Text style={{ color: '#A1A1AA', fontSize: 12, marginTop: 4 }}>加载更多数据...</Text>
                        </View>
                    )}
                </ScrollView>
            </PullToRefresh>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
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
    listSection: {
        padding: 16,
    },
    designerCard: {
        flexDirection: 'column',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 12,
            },
            android: {
                elevation: 4,
            },
        }),
    },
    designerCardHeader: {
        flexDirection: 'row',
        marginBottom: 12,
    },
    designerCardBody: {
        marginBottom: 12,
    },
    designerCardFooter: {
        borderTopWidth: 1,
        borderTopColor: '#F4F4F5',
        paddingTop: 12,
    },
    designerAvatar: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#F4F4F5',
    },
    designerInfo: {
        flex: 1,
        marginLeft: 12,
    },
    designerName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#09090B',
        marginBottom: 4,
    },
    designerMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    experienceText: {
        fontSize: 12,
        color: '#71717A',
    },
    divider: {
        marginHorizontal: 4,
        color: '#E4E4E7',
    },
    ratingText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#09090B',
        marginLeft: 4,
    },
    reviewCountText: {
        fontSize: 12,
        color: '#A1A1AA',
        marginLeft: 2,
    },
    designerOrg: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    orgBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        marginRight: 6,
    },
    personal: { backgroundColor: '#F0F9FF' },
    studio: { backgroundColor: '#F5F3FF' },
    company: { backgroundColor: '#ECFDF5' },
    orgBadgeText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#09090B',
    },
    orgName: {
        flex: 1,
        fontSize: 12,
        color: '#71717A',
    },
    designerTags: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    designerTagsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    distanceText: {
        fontSize: 12,
        color: '#71717A',
        marginLeft: 4,
    },
    specialtyText: {
        flex: 1,
        fontSize: 12,
        color: '#A1A1AA',
        textAlign: 'right',
    },
    bookBtn: {
        backgroundColor: '#09090B',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        justifyContent: 'center',
        alignSelf: 'center',
    },
    bookBtnText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '600',
    },
    workerCard: {
        flexDirection: 'column',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 12,
            },
            android: {
                elevation: 4,
            },
        }),
    },
    workerCardHeader: {
        flexDirection: 'row',
        marginBottom: 12,
    },
    workerCardBody: {
        marginBottom: 12,
    },
    workerCardFooter: {
        borderTopWidth: 1,
        borderTopColor: '#F4F4F5',
        paddingTop: 12,
    },
    workerAvatar: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#F4F4F5',
    },
    workerInfo: {
        flex: 1,
        marginLeft: 12,
    },
    workerName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#09090B',
        marginBottom: 4,
    },
    workerMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    workerWorkType: {
        flexDirection: 'row',
        marginBottom: 8,
    },
    workTypeBadge: {
        backgroundColor: 'rgba(9, 9, 11, 0.05)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 4,
    },
    workTypeBadgeText: {
        fontSize: 11,
        color: '#09090B',
        fontWeight: '500',
    },
    workerStatsInline: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
        flexWrap: 'wrap',
    },
    workerStatsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    priceInline: {
        fontSize: 16,
        fontWeight: '700',
        color: '#EF4444',
    },
    priceUnit: {
        fontSize: 11,
        fontWeight: '400',
        color: '#71717A',
    },
    statSep: {
        marginHorizontal: 8,
        color: '#E4E4E7',
        fontSize: 12,
    },
    ordersInline: {
        fontSize: 12,
        color: '#71717A',
    },
    distanceInline: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    distanceInlineText: {
        fontSize: 12,
        color: '#A1A1AA',
        marginLeft: 2,
    },
    workerTags: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    tagBadge: {
        backgroundColor: '#F8F9FA',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        marginRight: 6,
        marginBottom: 4,
    },
    tagText: {
        fontSize: 11,
        color: '#71717A',
    },
    bookBtnSmall: {
        backgroundColor: '#09090B',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 6,
        justifyContent: 'center',
        alignSelf: 'center',
    },
    bookBtnFull: {
        backgroundColor: '#09090B',
        paddingVertical: 10,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    bookBtnTextSmall: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '600',
    },
    companyCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E4E4E7',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.08,
                shadowRadius: 8,
            },
            android: {
                elevation: 3,
            },
        }),
    },
    companyHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    companyLogo: {
        width: 48,
        height: 48,
        borderRadius: 8,
        backgroundColor: '#F4F4F5',
    },
    companyTitle: {
        marginLeft: 12,
        flex: 1,
    },
    companyName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#09090B',
        marginBottom: 2,
    },
    companyMeta: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    establishedText: {
        fontSize: 12,
        color: '#71717A',
    },
    companyBody: {
        marginBottom: 16,
    },
    companyStats: {
        flexDirection: 'row',
        backgroundColor: '#F8F9FA',
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
    },
    companyStatItem: {
        flex: 1,
        alignItems: 'center',
    },
    statValue: {
        fontSize: 14,
        fontWeight: '700',
        color: '#09090B',
        marginTop: 4,
    },
    statLabel: {
        fontSize: 11,
        color: '#A1A1AA',
        marginTop: 2,
    },
    companyCerts: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 12,
    },
    certBadge: {
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        marginRight: 8,
        marginBottom: 6,
    },
    certBadgeText: {
        fontSize: 10,
        color: '#059669',
        fontWeight: '600',
    },
    companyPrice: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    priceLabel: {
        fontSize: 12,
        color: '#71717A',
        marginRight: 8,
    },
    companyPriceValue: {
        fontSize: 16,
        fontWeight: '700',
        color: '#EF4444',
    },
    companyFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#F4F4F5',
    },
    distanceInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    companyBookBtn: {
        alignSelf: 'auto',
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
    // 工种筛选下拉菜单样式
    workTypeDropdownGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        padding: 12,
        justifyContent: 'flex-start',
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
});

export default HomeScreen;
