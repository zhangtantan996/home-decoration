import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    SafeAreaView,
    StatusBar,
    ActivityIndicator,
    RefreshControl,
    Image,
} from 'react-native';
import { providerApi, projectApi } from '../services/api';
import { useAuthStore } from '../store/authStore';

// 金刚区入口配置 - 匹配设计稿
const SERVICE_CATEGORIES = [
    { id: 'designer', icon: '🎨', title: '找设计师', color: '#E8F4FD' },
    { id: 'company', icon: '🏢', title: '装修公司', color: '#FFF4E8' },
    { id: 'foreman', icon: '👷', title: '找工长', color: '#E8FDF4' },
    { id: 'worker', icon: '🔧', title: '找工人', color: '#F4E8FD' },
    { id: 'material', icon: '🧱', title: '建材商城', color: '#FDE8E8' },
    { id: 'ai', icon: '🤖', title: 'AI设计', color: '#E8E8FD' },
    { id: 'quote', icon: '📋', title: '免费报价', color: '#FDF8E8' },
    { id: 'case', icon: '🏠', title: '案例参考', color: '#E8FDE8' },
];

// 热门服务标签
const HOT_TAGS = ['全屋定制', '老房翻新', '局部改造', '新房装修'];

interface Provider {
    id: number;
    user_id?: number;
    name?: string;
    nickname?: string;
    rating?: number;
    completed_projects?: number;
    service_type?: string;
    specialty?: string;
    address?: string;
    phone?: string;
    avatar?: string;
    years_experience?: number;
}

interface Project {
    id: number;
    name: string;
    address: string;
    current_phase: string;
    status: string;
    progress?: number;
}

const HomeScreen: React.FC = () => {
    const [providers, setProviders] = useState<Provider[]>([]);
    const [activeProject, setActiveProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState('designer');
    const user = useAuthStore((state) => state.user);

    const fetchData = async () => {
        try {
            let data;
            if (selectedCategory === 'designer') {
                data = await providerApi.designers();
            } else if (selectedCategory === 'company') {
                data = await providerApi.companies();
            } else {
                data = await providerApi.foremen();
            }
            setProviders(Array.isArray(data) ? data : []);

            const projects: any = await projectApi.list();
            if (Array.isArray(projects) && projects.length > 0) {
                const active = projects.find((p: Project) => p.status === 'in_progress') || projects[0];
                setActiveProject(active);
            }
        } catch (error) {
            console.log('Failed to fetch data:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [selectedCategory]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    const handleCategoryPress = (id: string) => {
        if (['designer', 'company', 'foreman'].includes(id)) {
            setSelectedCategory(id);
            setLoading(true);
        }
    };

    const getProviderName = (provider: Provider) => {
        return provider.name || provider.nickname || `服务商${provider.id}`;
    };

    const getSectionTitle = () => {
        switch (selectedCategory) {
            case 'designer': return '精选设计师';
            case 'company': return '推荐装修公司';
            case 'foreman': return '金牌工长';
            default: return '推荐服务商';
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#fff" />

            {/* 顶部区域 */}
            <View style={styles.header}>
                {/* 位置信息 */}
                <View style={styles.topRow}>
                    <TouchableOpacity style={styles.locationBtn}>
                        <Text style={styles.locationIcon}>📍</Text>
                        <Text style={styles.locationText}>北京</Text>
                        <Text style={styles.arrowDown}>▼</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.notificationBtn}>
                        <Text style={styles.notificationIcon}>🔔</Text>
                    </TouchableOpacity>
                </View>

                {/* 搜索框 */}
                <TouchableOpacity style={styles.searchBar}>
                    <Text style={styles.searchIcon}>🔍</Text>
                    <Text style={styles.searchPlaceholder}>搜索装修公司、设计师</Text>
                </TouchableOpacity>

                {/* 热门标签 */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.hotTagsContainer}
                >
                    {HOT_TAGS.map((tag, index) => (
                        <TouchableOpacity key={index} style={styles.hotTag}>
                            <Text style={styles.hotTagText}>{tag}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            <ScrollView
                style={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
            >
                {/* Banner 区域 */}
                <View style={styles.bannerContainer}>
                    <View style={styles.banner}>
                        <Text style={styles.bannerTitle}>🏠 新用户专享</Text>
                        <Text style={styles.bannerSubtitle}>免费获取3套设计方案+报价</Text>
                        <TouchableOpacity style={styles.bannerBtn}>
                            <Text style={styles.bannerBtnText}>立即领取</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* 服务分类金刚区 */}
                <View style={styles.categorySection}>
                    <View style={styles.categoryGrid}>
                        {SERVICE_CATEGORIES.map((item) => (
                            <TouchableOpacity
                                key={item.id}
                                style={styles.categoryItem}
                                onPress={() => handleCategoryPress(item.id)}
                            >
                                <View style={[
                                    styles.categoryIcon,
                                    { backgroundColor: item.color },
                                    selectedCategory === item.id && styles.categoryIconActive
                                ]}>
                                    <Text style={styles.categoryEmoji}>{item.icon}</Text>
                                </View>
                                <Text style={[
                                    styles.categoryTitle,
                                    selectedCategory === item.id && styles.categoryTitleActive
                                ]}>{item.title}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* 推荐服务商列表 */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>{getSectionTitle()}</Text>
                        <TouchableOpacity style={styles.seeAllBtn}>
                            <Text style={styles.seeAllText}>查看全部</Text>
                            <Text style={styles.seeAllArrow}>›</Text>
                        </TouchableOpacity>
                    </View>

                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator color="#C8A45B" size="large" />
                            <Text style={styles.loadingText}>加载中...</Text>
                        </View>
                    ) : providers.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyIcon}>📭</Text>
                            <Text style={styles.emptyText}>暂无服务商数据</Text>
                        </View>
                    ) : (
                        providers.map((provider) => (
                            <TouchableOpacity key={provider.id} style={styles.providerCard}>
                                <View style={styles.providerAvatar}>
                                    <Text style={styles.avatarText}>
                                        {getProviderName(provider)[0]}
                                    </Text>
                                </View>
                                <View style={styles.providerInfo}>
                                    <View style={styles.providerNameRow}>
                                        <Text style={styles.providerName}>
                                            {getProviderName(provider)}
                                        </Text>
                                        {provider.years_experience && (
                                            <View style={styles.expBadge}>
                                                <Text style={styles.expBadgeText}>
                                                    {provider.years_experience}年经验
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                    <View style={styles.providerMeta}>
                                        <View style={styles.ratingContainer}>
                                            <Text style={styles.ratingStar}>★</Text>
                                            <Text style={styles.ratingText}>
                                                {provider.rating?.toFixed(1) || '5.0'}
                                            </Text>
                                        </View>
                                        <Text style={styles.projectCount}>
                                            已完成 {provider.completed_projects || 0} 单
                                        </Text>
                                    </View>
                                    {provider.specialty && (
                                        <View style={styles.specialtyContainer}>
                                            <Text style={styles.specialtyTag}>
                                                {provider.specialty}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                                <TouchableOpacity style={styles.contactBtn}>
                                    <Text style={styles.contactBtnText}>立即咨询</Text>
                                </TouchableOpacity>
                            </TouchableOpacity>
                        ))
                    )}
                </View>

                {/* 装修攻略入口 */}
                <View style={styles.guideSection}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>装修攻略</Text>
                        <TouchableOpacity style={styles.seeAllBtn}>
                            <Text style={styles.seeAllText}>更多</Text>
                            <Text style={styles.seeAllArrow}>›</Text>
                        </TouchableOpacity>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {['装修预算怎么做', '选材避坑指南', '工期把控秘籍'].map((title, index) => (
                            <TouchableOpacity key={index} style={styles.guideCard}>
                                <View style={styles.guideCardImage}>
                                    <Text style={styles.guideCardEmoji}>
                                        {index === 0 ? '💰' : index === 1 ? '🛠️' : '📅'}
                                    </Text>
                                </View>
                                <Text style={styles.guideCardTitle}>{title}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* 底部占位 */}
                <View style={{ height: 100 }} />
            </ScrollView>

            {/* 我的工地浮窗 */}
            {activeProject && (
                <TouchableOpacity style={styles.siteFloat}>
                    <View style={styles.siteFloatLeft}>
                        <Text style={styles.siteFloatIcon}>🏗️</Text>
                        <View>
                            <Text style={styles.siteFloatTitle}>我的工地</Text>
                            <Text style={styles.siteFloatSubtitle}>
                                {activeProject.current_phase || '施工中'}
                            </Text>
                        </View>
                    </View>
                    <Text style={styles.siteFloatArrow}>›</Text>
                </TouchableOpacity>
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F8F8',
    },
    header: {
        backgroundColor: '#fff',
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    topRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    locationBtn: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    locationIcon: {
        fontSize: 16,
    },
    locationText: {
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 4,
        color: '#1A1A1A',
    },
    arrowDown: {
        fontSize: 10,
        color: '#999',
        marginLeft: 4,
    },
    notificationBtn: {
        padding: 4,
    },
    notificationIcon: {
        fontSize: 20,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F5F5',
        borderRadius: 24,
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    searchIcon: {
        fontSize: 16,
    },
    searchPlaceholder: {
        marginLeft: 8,
        color: '#999',
        fontSize: 14,
    },
    hotTagsContainer: {
        marginTop: 12,
    },
    hotTag: {
        backgroundColor: '#FFF8E8',
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 6,
        marginRight: 8,
    },
    hotTagText: {
        fontSize: 12,
        color: '#C8A45B',
    },
    content: {
        flex: 1,
    },
    bannerContainer: {
        paddingHorizontal: 16,
        paddingTop: 16,
    },
    banner: {
        backgroundColor: '#C8A45B',
        borderRadius: 12,
        padding: 16,
    },
    bannerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 4,
    },
    bannerSubtitle: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.9)',
        marginBottom: 12,
    },
    bannerBtn: {
        backgroundColor: '#fff',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 8,
        alignSelf: 'flex-start',
    },
    bannerBtnText: {
        color: '#C8A45B',
        fontSize: 13,
        fontWeight: '600',
    },
    categorySection: {
        backgroundColor: '#fff',
        marginTop: 12,
        paddingVertical: 16,
    },
    categoryGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 8,
    },
    categoryItem: {
        width: '25%',
        alignItems: 'center',
        marginBottom: 16,
    },
    categoryIcon: {
        width: 52,
        height: 52,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    categoryIconActive: {
        borderWidth: 2,
        borderColor: '#C8A45B',
    },
    categoryEmoji: {
        fontSize: 24,
    },
    categoryTitle: {
        fontSize: 12,
        color: '#333',
    },
    categoryTitleActive: {
        color: '#C8A45B',
        fontWeight: '600',
    },
    section: {
        backgroundColor: '#fff',
        marginTop: 12,
        paddingHorizontal: 16,
        paddingVertical: 16,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1A1A1A',
    },
    seeAllBtn: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    seeAllText: {
        fontSize: 13,
        color: '#999',
    },
    seeAllArrow: {
        fontSize: 16,
        color: '#999',
        marginLeft: 2,
    },
    loadingContainer: {
        paddingVertical: 40,
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        color: '#999',
        fontSize: 14,
    },
    emptyContainer: {
        paddingVertical: 40,
        alignItems: 'center',
    },
    emptyIcon: {
        fontSize: 48,
        marginBottom: 8,
    },
    emptyText: {
        color: '#999',
        fontSize: 14,
    },
    providerCard: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#F0F0F0',
    },
    providerAvatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#C8A45B',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        color: '#fff',
        fontSize: 22,
        fontWeight: 'bold',
    },
    providerInfo: {
        flex: 1,
        marginLeft: 12,
    },
    providerNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    providerName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1A1A1A',
    },
    expBadge: {
        backgroundColor: '#FFF8E8',
        borderRadius: 4,
        paddingHorizontal: 6,
        paddingVertical: 2,
        marginLeft: 8,
    },
    expBadgeText: {
        fontSize: 10,
        color: '#C8A45B',
    },
    providerMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    ratingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 12,
    },
    ratingStar: {
        fontSize: 12,
        color: '#FFB800',
    },
    ratingText: {
        fontSize: 12,
        color: '#FFB800',
        marginLeft: 2,
    },
    projectCount: {
        fontSize: 12,
        color: '#999',
    },
    specialtyContainer: {
        flexDirection: 'row',
    },
    specialtyTag: {
        fontSize: 11,
        color: '#C8A45B',
        backgroundColor: '#FFF8E8',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    contactBtn: {
        backgroundColor: '#1A1A1A',
        borderRadius: 20,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    contactBtnText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '500',
    },
    guideSection: {
        backgroundColor: '#fff',
        marginTop: 12,
        paddingVertical: 16,
        paddingLeft: 16,
    },
    guideCard: {
        width: 140,
        marginRight: 12,
    },
    guideCardImage: {
        height: 90,
        backgroundColor: '#F5F5F5',
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    guideCardEmoji: {
        fontSize: 36,
    },
    guideCardTitle: {
        fontSize: 13,
        color: '#333',
    },
    siteFloat: {
        position: 'absolute',
        bottom: 80,
        left: 16,
        right: 16,
        backgroundColor: '#fff',
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 6,
    },
    siteFloatLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    siteFloatIcon: {
        fontSize: 28,
        marginRight: 12,
    },
    siteFloatTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1A1A1A',
    },
    siteFloatSubtitle: {
        fontSize: 12,
        color: '#52C41A',
        marginTop: 2,
    },
    siteFloatArrow: {
        fontSize: 24,
        color: '#999',
    },
});

export default HomeScreen;
