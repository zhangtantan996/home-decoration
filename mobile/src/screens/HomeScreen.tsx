import React, { useState } from 'react';
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
} from 'react-native';
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
    Users
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
const DESIGNERS = [
    {
        id: 1,
        name: '张明远',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&auto=format&fit=crop&face',
        yearsExperience: 8,
        rating: 4.9,
        reviewCount: 326,
        orgType: 'personal',
        orgLabel: '独立设计师',
        distance: '1.2km',
        specialty: '现代简约 · 北欧风格',
    },
    {
        id: 2,
        name: '李雅婷',
        avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=200&auto=format&fit=crop&face',
        yearsExperience: 12,
        rating: 4.8,
        reviewCount: 512,
        orgType: 'studio',
        orgLabel: '雅居设计工作室',
        distance: '2.5km',
        specialty: '新中式 · 轻奢风格',
    },
    {
        id: 3,
        name: '王建国',
        avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=200&auto=format&fit=crop&face',
        yearsExperience: 15,
        rating: 4.7,
        reviewCount: 892,
        orgType: 'company',
        orgLabel: '华美装饰设计公司',
        distance: '3.8km',
        specialty: '欧式古典 · 别墅大宅',
    },
    {
        id: 4,
        name: '陈思琪',
        avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=200&auto=format&fit=crop&face',
        yearsExperience: 5,
        rating: 4.9,
        reviewCount: 186,
        orgType: 'personal',
        orgLabel: '独立设计师',
        distance: '0.8km',
        specialty: '日式原木 · 极简主义',
    },
    {
        id: 5,
        name: '刘伟强',
        avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=200&auto=format&fit=crop&face',
        yearsExperience: 10,
        rating: 4.6,
        reviewCount: 445,
        orgType: 'studio',
        orgLabel: '强设计工作室',
        distance: '4.2km',
        specialty: '工业风 · Loft空间',
    },
    {
        id: 6,
        name: '周晓燕',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop&face',
        yearsExperience: 7,
        rating: 4.8,
        reviewCount: 278,
        orgType: 'company',
        orgLabel: '燕归来设计公司',
        distance: '5.1km',
        specialty: '法式浪漫 · 田园风格',
    },
];

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
const CONSTRUCTION_WORKERS = [
    {
        id: 1,
        type: 'personal',
        name: '老李师傅',
        avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?q=80&w=200&auto=format&fit=crop&face',
        yearsExperience: 20,
        rating: 4.9,
        reviewCount: 568,
        workTypes: ['mason', 'general'],
        workTypeLabels: '瓦工 · 综合施工',
        priceRange: '300-500',
        priceUnit: '元/天',
        completedOrders: 1256,
        distance: '1.5km',
        tags: ['手艺精湛', '准时守信', '价格公道'],
    },
    {
        id: 2,
        type: 'personal',
        name: '张电工',
        avatar: 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?q=80&w=200&auto=format&fit=crop&face',
        yearsExperience: 15,
        rating: 4.8,
        reviewCount: 423,
        workTypes: ['electrician'],
        workTypeLabels: '电工',
        priceRange: '350-600',
        priceUnit: '元/天',
        completedOrders: 892,
        distance: '2.3km',
        tags: ['持证上岗', '安全第一', '经验丰富'],
    },
    {
        id: 3,
        type: 'company',
        name: '匠心装修工程有限公司',
        logo: 'https://images.unsplash.com/photo-1599305445671-ac291c95aaa9?q=80&w=200&auto=format&fit=crop',
        establishedYear: 2010,
        rating: 4.7,
        reviewCount: 1256,
        workTypes: ['mason', 'electrician', 'carpenter', 'painter', 'plumber'],
        workTypeLabels: '全工种覆盖',
        priceRange: '8-15',
        priceUnit: '万/全包',
        completedOrders: 3568,
        teamSize: 45,
        certifications: ['建筑装饰二级资质', 'ISO9001认证'],
        distance: '3.2km',
        tags: ['正规资质', '售后保障', '一站式服务'],
    },
    {
        id: 4,
        type: 'personal',
        name: '王木匠',
        avatar: 'https://images.unsplash.com/photo-1557862921-37829c790f19?q=80&w=200&auto=format&fit=crop&face',
        yearsExperience: 25,
        rating: 4.9,
        reviewCount: 312,
        workTypes: ['carpenter'],
        workTypeLabels: '木工',
        priceRange: '400-700',
        priceUnit: '元/天',
        completedOrders: 756,
        distance: '4.1km',
        tags: ['老师傅', '传统手艺', '细节控'],
    },
    {
        id: 5,
        type: 'company',
        name: '鑫盛建筑装饰公司',
        logo: 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?q=80&w=200&auto=format&fit=crop',
        establishedYear: 2015,
        rating: 4.6,
        reviewCount: 867,
        workTypes: ['mason', 'electrician', 'carpenter', 'painter'],
        workTypeLabels: '瓦/电/木/油',
        priceRange: '6-12',
        priceUnit: '万/全包',
        completedOrders: 2134,
        teamSize: 32,
        certifications: ['建筑装饰三级资质'],
        distance: '5.8km',
        tags: ['性价比高', '工期准时', '品质保障'],
    },
    {
        id: 6,
        type: 'personal',
        name: '刘师傅',
        avatar: 'https://images.unsplash.com/photo-1552058544-f2b08422138a?q=80&w=200&auto=format&fit=crop&face',
        yearsExperience: 12,
        rating: 4.7,
        reviewCount: 245,
        workTypes: ['painter'],
        workTypeLabels: '油漆工',
        priceRange: '280-450',
        priceUnit: '元/天',
        completedOrders: 534,
        distance: '1.8km',
        tags: ['环保材料', '无异味', '细心负责'],
    },
];

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
const MATERIALS = [
    {
        id: 1,
        name: '马可波罗瓷砖 现代简约灰色大理石',
        image: 'https://images.unsplash.com/photo-1615971677499-5467cbab01c0?q=80&w=400&auto=format&fit=crop',
        brand: '马可波罗',
        category: 'tile',
        price: 89,
        originalPrice: 128,
        unit: '片',
        specs: '800x800mm',
        sales: 15680,
        rating: 4.9,
        reviewCount: 3256,
        tags: ['热销', '包邮'],
        shopName: '马可波罗官方旗舰店',
        isOfficial: true,
    },
    {
        id: 2,
        name: '圣象地板 E0级环保三层实木复合',
        image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?q=80&w=400&auto=format&fit=crop',
        brand: '圣象',
        category: 'floor',
        price: 268,
        originalPrice: 358,
        unit: '㎡',
        specs: '1215x195x12mm',
        sales: 8956,
        rating: 4.8,
        reviewCount: 2134,
        tags: ['环保认证', '免费安装'],
        shopName: '圣象地板官方店',
        isOfficial: true,
    },
    {
        id: 3,
        name: 'TOTO智能马桶一体机 自动翻盖',
        image: 'https://images.unsplash.com/photo-1585412727339-54e4bae3bbf9?q=80&w=400&auto=format&fit=crop',
        brand: 'TOTO',
        category: 'bathroom',
        price: 6999,
        originalPrice: 8999,
        unit: '套',
        specs: '智能款 CW887B',
        sales: 3256,
        rating: 4.9,
        reviewCount: 1856,
        tags: ['品牌直降', '送安装'],
        shopName: 'TOTO卫浴旗舰店',
        isOfficial: true,
    },
    {
        id: 4,
        name: '欧派整体橱柜 现代轻奢定制',
        image: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?q=80&w=400&auto=format&fit=crop',
        brand: '欧派',
        category: 'cabinet',
        price: 1999,
        originalPrice: 2599,
        unit: '延米',
        specs: '定制款',
        sales: 5623,
        rating: 4.7,
        reviewCount: 1523,
        tags: ['免费设计', '上门测量'],
        shopName: '欧派家居旗舰店',
        isOfficial: true,
    },
    {
        id: 5,
        name: 'TATA木门 现代简约室内门',
        image: 'https://images.unsplash.com/photo-1558618047-f4b511f5c6a3?q=80&w=400&auto=format&fit=crop',
        brand: 'TATA',
        category: 'door',
        price: 1580,
        originalPrice: 1980,
        unit: '樘',
        specs: '标准尺寸可定制',
        sales: 4521,
        rating: 4.8,
        reviewCount: 986,
        tags: ['静音门', '包安装'],
        shopName: 'TATA木门官方店',
        isOfficial: true,
    },
    {
        id: 6,
        name: '立邦乳胶漆 净味全效内墙面漆',
        image: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?q=80&w=400&auto=format&fit=crop',
        brand: '立邦',
        category: 'paint',
        price: 458,
        originalPrice: 598,
        unit: '桶/15L',
        specs: '白色 可调色',
        sales: 12356,
        rating: 4.9,
        reviewCount: 4523,
        tags: ['净味环保', '抗甲醛'],
        shopName: '立邦官方旗舰店',
        isOfficial: true,
    },
    {
        id: 7,
        name: '欧普照明 客厅吸顶灯LED',
        image: 'https://images.unsplash.com/photo-1524484485831-a92ffc0de03f?q=80&w=400&auto=format&fit=crop',
        brand: '欧普',
        category: 'lighting',
        price: 899,
        originalPrice: 1299,
        unit: '套',
        specs: '三室两厅套餐',
        sales: 7865,
        rating: 4.8,
        reviewCount: 2365,
        tags: ['智能调光', '全屋套餐'],
        shopName: '欧普照明旗舰店',
        isOfficial: true,
    },
    {
        id: 8,
        name: '东鹏瓷砖 仿古砖客厅地砖',
        image: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?q=80&w=400&auto=format&fit=crop',
        brand: '东鹏',
        category: 'tile',
        price: 68,
        originalPrice: 98,
        unit: '片',
        specs: '600x600mm',
        sales: 9856,
        rating: 4.7,
        reviewCount: 1896,
        tags: ['防滑耐磨', '送踢脚线'],
        shopName: '东鹏瓷砖专卖店',
        isOfficial: false,
    },
];

const HomeScreen: React.FC = () => {
    const [activeCategory, setActiveCategory] = useState('designer');

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

    // 根据筛选条件过滤设计师
    const filteredDesigners = DESIGNERS.filter(d => {
        if (designerOrgFilter && d.orgType !== designerOrgFilter) return false;
        return true;
    });

    // 根据排序条件排序设计师
    const sortedDesigners = [...filteredDesigners].sort((a, b) => {
        switch (designerSortBy) {
            case 'distance':
                return parseFloat(a.distance) - parseFloat(b.distance);
            case 'rating':
                return b.rating - a.rating;
            case 'experience':
                return b.yearsExperience - a.yearsExperience;
            default:
                return 0;
        }
    });

    // 根据筛选条件过滤施工
    const filteredWorkers = CONSTRUCTION_WORKERS.filter(w => {
        if (constructionOrgFilter && w.type !== constructionOrgFilter) return false;
        if (!selectedWorkTypes.includes('all')) {
            const hasMatchingWorkType = w.workTypes.some(wt => selectedWorkTypes.includes(wt));
            if (!hasMatchingWorkType) return false;
        }
        return true;
    });

    // 根据排序条件排序施工
    const sortedWorkers = [...filteredWorkers].sort((a, b) => {
        switch (constructionSortBy) {
            case 'rating':
                return b.rating - a.rating;
            case 'price_low':
                return parseFloat(a.priceRange.split('-')[0]) - parseFloat(b.priceRange.split('-')[0]);
            case 'price_high':
                return parseFloat(b.priceRange.split('-')[1]) - parseFloat(a.priceRange.split('-')[1]);
            case 'orders':
                return b.completedOrders - a.completedOrders;
            default:
                return 0;
        }
    });

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

    // 获取当前排序选项和标签
    const currentSortOptions = activeCategory === 'designer' ? DESIGNER_SORT_OPTIONS : CONSTRUCTION_SORT_OPTIONS;
    const currentSortBy = activeCategory === 'designer' ? designerSortBy : constructionSortBy;
    const currentSortLabel = currentSortOptions.find(o => o.id === currentSortBy)?.label || '综合排序';

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

            {/* 固定Header - 始终在顶部 */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.locationBtn}>
                    <MapPin size={16} color="#71717A" />
                    <Text style={styles.locationText}>上海</Text>
                </TouchableOpacity>

                <View style={styles.searchBar}>
                    <Search size={16} color="#A1A1AA" />
                    <Text style={styles.searchPlaceholder}>搜索设计师 / 施工队 / 主材</Text>
                </View>

                <TouchableOpacity style={styles.iconBtn}>
                    <Bell size={20} color="#09090B" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconBtn}>
                    <Maximize2 size={20} color="#09090B" />
                </TouchableOpacity>
            </View>

            {/* 可滚动内容区域 */}
            <ScrollView
                style={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                stickyHeaderIndices={[1]} // 筛选栏吸顶
            >
                {/* 服务分类 */}
                <View style={styles.categorySection}>
                    {SERVICE_CATEGORIES.map((cat) => {
                        const IconComponent = cat.icon;
                        const isActive = activeCategory === cat.id;
                        return (
                            <TouchableOpacity
                                key={cat.id}
                                style={styles.categoryTab}
                                onPress={() => handleCategoryChange(cat.id)}
                            >
                                <View style={[styles.categoryIconBox, isActive && styles.categoryIconBoxActive]}>
                                    <IconComponent size={24} color={isActive ? '#09090B' : '#71717A'} strokeWidth={1.5} />
                                </View>
                                <Text style={[styles.categoryLabel, isActive && styles.categoryLabelActive]}>
                                    {cat.title}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* 筛选排序区域 (被 stickyHeaderIndices 锁定) */}
                <View style={styles.filterSectionWrapper}>
                    {activeCategory === 'designer' && (
                        <View style={styles.filterSection}>
                            <View style={styles.filterLeft}>
                                <TouchableOpacity
                                    style={styles.sortBtn}
                                    onPress={() => setShowDesignerSortMenu(!showDesignerSortMenu)}
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
                                    onPress={() => setShowConstructionSortMenu(!showConstructionSortMenu)}
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
                                    onPress={() => setShowWorkTypeModal(true)}
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
                </View>

                {/* 设计师列表 */}
                {activeCategory === 'designer' && (
                    <View style={styles.listSection}>
                        {sortedDesigners.map((designer) => (
                            <TouchableOpacity key={designer.id} style={styles.designerCard}>
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
                                        <View style={[styles.orgBadge, (styles as any)[designer.orgType]]}>
                                            <Text style={styles.orgBadgeText}>
                                                {designer.orgType === 'personal' ? '个人' :
                                                    designer.orgType === 'studio' ? '工作室' : '公司'}
                                            </Text>
                                        </View>
                                        <Text style={styles.orgName} numberOfLines={1}>{designer.orgLabel}</Text>
                                    </View>
                                    <View style={styles.designerTags}>
                                        <MapPinned size={12} color="#71717A" />
                                        <Text style={styles.distanceText}>{designer.distance}</Text>
                                        <Text style={styles.specialtyText} numberOfLines={1}>{designer.specialty}</Text>
                                    </View>
                                </View>
                                <TouchableOpacity style={styles.bookBtn}>
                                    <Text style={styles.bookBtnText}>立即预约</Text>
                                </TouchableOpacity>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                {/* 施工列表 */}
                {activeCategory === 'construction' && (
                    <View style={styles.listSection}>
                        {sortedWorkers.map((worker) => (
                            worker.type === 'personal' ? (
                                // 个人师傅卡片
                                <TouchableOpacity key={worker.id} style={[styles.workerCard, styles.personal]}>
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
                                        <View style={styles.workerStatsInline}>
                                            <Text style={styles.priceInline}>
                                                ¥{worker.priceRange}<Text style={styles.priceUnit}>/{worker.priceUnit.replace('元/', '')}</Text>
                                            </Text>
                                            <Text style={styles.statSep}>|</Text>
                                            <Text style={styles.ordersInline}>已完成{worker.completedOrders}单</Text>
                                            <Text style={styles.statSep}>|</Text>
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
                                    <TouchableOpacity style={styles.bookBtnSmall}>
                                        <Text style={styles.bookBtnTextSmall}>立即预约</Text>
                                    </TouchableOpacity>
                                </TouchableOpacity>
                            ) : (
                                // 公司卡片
                                <TouchableOpacity key={worker.id} style={styles.companyCard}>
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
                                    <View style={styles.companyFooter}>
                                        <View style={styles.distanceInfo}>
                                            <MapPinned size={14} color="#71717A" />
                                            <Text style={styles.distanceText}>{worker.distance}</Text>
                                        </View>
                                        <TouchableOpacity style={[styles.bookBtn, styles.companyBookBtn]}>
                                            <Text style={styles.bookBtnText}>获取报价</Text>
                                        </TouchableOpacity>
                                    </View>
                                </TouchableOpacity>
                            )
                        ))}
                    </View>
                )}

                {/* 主材列表 */}
                {activeCategory === 'material' && (
                    <View style={styles.emptyState}>
                        <Package size={64} color="#E4E4E7" strokeWidth={1} />
                        <Text style={styles.emptyStateTitle}>主材商城即将上线</Text>
                        <Text style={styles.emptyStateSub}>敬请期待，精选建材品牌即将入驻</Text>
                    </View>
                )}

                <View style={{ height: 100 }} />
            </ScrollView>

            {/* 工种筛选弹窗 */}
            <Modal
                visible={showWorkTypeModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowWorkTypeModal(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowWorkTypeModal(false)}
                >
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>选择工种</Text>
                            <TouchableOpacity onPress={() => setShowWorkTypeModal(false)}>
                                <X size={20} color="#09090B" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.modalBody}>
                            <View style={styles.workTypeGrid}>
                                {WORK_TYPES.map(type => (
                                    <TouchableOpacity
                                        key={type.id}
                                        style={[
                                            styles.workTypeItem,
                                            selectedWorkTypes.includes(type.id) && styles.workTypeItemActive
                                        ]}
                                        onPress={() => handleWorkTypeToggle(type.id)}
                                    >
                                        <Text style={[
                                            styles.workTypeItemText,
                                            selectedWorkTypes.includes(type.id) && styles.workTypeItemTextActive
                                        ]}>
                                            {type.label}
                                        </Text>
                                        {selectedWorkTypes.includes(type.id) && (
                                            <Check size={14} color="#09090B" />
                                        )}
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </ScrollView>
                        <View style={styles.modalFooter}>
                            <TouchableOpacity
                                style={styles.confirmBtn}
                                onPress={() => setShowWorkTypeModal(false)}
                            >
                                <Text style={styles.confirmBtnText}>确定</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </TouchableOpacity>
            </Modal>


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
        paddingVertical: 12,
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
    },
    searchPlaceholder: {
        fontSize: 13,
        color: '#A1A1AA',
        marginLeft: 8,
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
    },
    categoryIconBox: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#F8F9FA',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.03)',
    },
    categoryIconBoxActive: {
        backgroundColor: '#F4F4F5',
        borderColor: '#09090B',
    },
    categoryLabel: {
        fontSize: 13,
        fontWeight: '500',
        color: '#71717A',
    },
    categoryLabelActive: {
        color: '#09090B',
        fontWeight: '600',
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
        borderBottomWidth: 1,
        borderBottomColor: '#F4F4F5',
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
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 12,
        marginBottom: 16,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 8,
            },
            android: {
                elevation: 4,
            },
        }),
    },
    designerAvatar: {
        width: 80,
        height: 100,
        borderRadius: 12,
        backgroundColor: '#F4F4F5',
    },
    designerInfo: {
        flex: 1,
        marginLeft: 12,
        justifyContent: 'center',
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
    distanceText: {
        fontSize: 11,
        color: '#71717A',
        marginLeft: 2,
        marginRight: 6,
    },
    specialtyText: {
        flex: 1,
        fontSize: 11,
        color: '#A1A1AA',
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
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 12,
        marginBottom: 16,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.08,
                shadowRadius: 10,
            },
            android: {
                elevation: 3,
            },
        }),
    },
    workerAvatar: {
        width: 70,
        height: 70,
        borderRadius: 35,
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
    },
    priceInline: {
        fontSize: 15,
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
    bookBtnTextSmall: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '600',
    },
    companyCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#F4F4F5',
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
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#F4F4F5',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#09090B',
    },
    modalBody: {
        padding: 16,
    },
    workTypeGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    workTypeItem: {
        width: (SCREEN_WIDTH - 48) / 2,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F8F9FA',
        padding: 16,
        borderRadius: 12,
        margin: 4,
    },
    workTypeItemActive: {
        backgroundColor: 'rgba(9, 9, 11, 0.05)',
        borderWidth: 1,
        borderColor: '#09090B',
    },
    workTypeItemText: {
        fontSize: 14,
        color: '#71717A',
    },
    workTypeItemTextActive: {
        color: '#09090B',
        fontWeight: '600',
    },
    modalFooter: {
        padding: 16,
        paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    },
    confirmBtn: {
        backgroundColor: '#09090B',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    confirmBtnText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default HomeScreen;
