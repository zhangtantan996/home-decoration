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
} from 'react-native';
import { providerApi, projectApi } from '../services/api';
import { useAuthStore } from '../store/authStore';

// 金刚区入口配置
const KINGKONG_ITEMS = [
    { id: 'designer', icon: '🎨', title: '找设计师', type: 'designer' },
    { id: 'company', icon: '🏢', title: '装修公司', type: 'company' },
    { id: 'foreman', icon: '👷', title: '找工长', type: 'foreman' },
    { id: 'store', icon: '🏪', title: '逛建材店', type: 'store' },
    { id: 'ai', icon: '🤖', title: 'AI设计', type: 'ai' },
];

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
    const [selectedType, setSelectedType] = useState('designer');
    const user = useAuthStore((state) => state.user);

    const fetchData = async () => {
        try {
            // 获取服务商列表
            let data;
            if (selectedType === 'designer') {
                data = await providerApi.designers();
            } else if (selectedType === 'company') {
                data = await providerApi.companies();
            } else {
                data = await providerApi.foremen();
            }
            setProviders(Array.isArray(data) ? data : []);

            // 获取用户的项目
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
    }, [selectedType]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    const handleKingkongPress = (type: string) => {
        if (['designer', 'company', 'foreman'].includes(type)) {
            setSelectedType(type);
            setLoading(true);
        }
    };

    const getProviderName = (provider: Provider) => {
        return provider.name || provider.nickname || `服务商${provider.id}`;
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#fff" />

            {/* 顶部导航 */}
            <View style={styles.header}>
                <View style={styles.location}>
                    <Text style={styles.locationIcon}>📍</Text>
                    <Text style={styles.locationText}>
                        {user?.nickname || '欢迎使用'}
                    </Text>
                </View>
                <TouchableOpacity style={styles.searchBar}>
                    <Text style={styles.searchIcon}>🔍</Text>
                    <Text style={styles.searchPlaceholder}>搜索设计师、装修公司</Text>
                </TouchableOpacity>
            </View>

            <ScrollView
                style={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
            >
                {/* 金刚区 */}
                <View style={styles.kingkongGrid}>
                    {KINGKONG_ITEMS.map((item) => (
                        <TouchableOpacity
                            key={item.id}
                            style={styles.kingkongItem}
                            onPress={() => handleKingkongPress(item.type)}
                        >
                            <View style={[
                                styles.kingkongIcon,
                                selectedType === item.type && styles.kingkongIconActive
                            ]}>
                                <Text style={styles.kingkongEmoji}>{item.icon}</Text>
                            </View>
                            <Text style={[
                                styles.kingkongTitle,
                                selectedType === item.type && styles.kingkongTitleActive
                            ]}>{item.title}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* 推荐服务商 */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>
                            {selectedType === 'designer' ? '推荐设计师' :
                                selectedType === 'company' ? '装修公司' : '优质工长'}
                        </Text>
                        <TouchableOpacity>
                            <Text style={styles.seeAll}>查看全部 &gt;</Text>
                        </TouchableOpacity>
                    </View>

                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator color="#1890FF" />
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
                                    <Text style={styles.providerName}>
                                        {getProviderName(provider)}
                                    </Text>
                                    <View style={styles.providerMeta}>
                                        <Text style={styles.rating}>
                                            ⭐ {provider.rating?.toFixed(1) || '5.0'}
                                        </Text>
                                        <Text style={styles.projects}>
                                            完成{provider.completed_projects || 0}单
                                        </Text>
                                        {provider.specialty && (
                                            <Text style={styles.specialty}>
                                                {provider.specialty}
                                            </Text>
                                        )}
                                    </View>
                                    {provider.address && (
                                        <Text style={styles.address}>{provider.address}</Text>
                                    )}
                                </View>
                                <TouchableOpacity style={styles.consultBtn}>
                                    <Text style={styles.consultBtnText}>咨询</Text>
                                </TouchableOpacity>
                            </TouchableOpacity>
                        ))
                    )}
                </View>

                {/* 底部占位 */}
                <View style={{ height: 120 }} />
            </ScrollView>

            {/* 我的工地胶囊 */}
            {activeProject && (
                <TouchableOpacity style={styles.siteIsland}>
                    <Text style={styles.siteIcon}>🏗️</Text>
                    <View style={styles.siteInfo}>
                        <Text style={styles.siteTitle}>
                            {activeProject.current_phase || '施工中'} · {activeProject.name}
                        </Text>
                        <Text style={styles.siteStatus}>
                            {activeProject.status === 'in_progress' ? '🟢 进行中' :
                                activeProject.status === 'completed' ? '✅ 已完成' : '⏸️ 待开始'}
                        </Text>
                    </View>
                    <Text style={styles.siteArrow}>&gt;</Text>
                </TouchableOpacity>
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F5F5',
    },
    header: {
        backgroundColor: '#fff',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    location: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    locationIcon: {
        fontSize: 16,
    },
    locationText: {
        fontSize: 15,
        fontWeight: '600',
        marginLeft: 4,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F5F5',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    searchIcon: {
        fontSize: 14,
    },
    searchPlaceholder: {
        marginLeft: 8,
        color: '#999',
        fontSize: 14,
    },
    content: {
        flex: 1,
    },
    kingkongGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        backgroundColor: '#fff',
        paddingVertical: 16,
        marginBottom: 12,
    },
    kingkongItem: {
        width: '20%',
        alignItems: 'center',
        marginBottom: 8,
    },
    kingkongIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#F0F5FF',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    kingkongIconActive: {
        backgroundColor: '#1890FF',
    },
    kingkongEmoji: {
        fontSize: 24,
    },
    kingkongTitle: {
        fontSize: 12,
        color: '#333',
    },
    kingkongTitleActive: {
        color: '#1890FF',
        fontWeight: '600',
    },
    section: {
        backgroundColor: '#fff',
        paddingHorizontal: 16,
        paddingVertical: 16,
        marginBottom: 12,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    seeAll: {
        fontSize: 13,
        color: '#1890FF',
    },
    loadingContainer: {
        paddingVertical: 40,
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 8,
        color: '#999',
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
    },
    providerCard: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#eee',
    },
    providerAvatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#1890FF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    providerInfo: {
        flex: 1,
        marginLeft: 12,
    },
    providerName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#333',
        marginBottom: 4,
    },
    providerMeta: {
        flexDirection: 'row',
        marginBottom: 4,
    },
    rating: {
        fontSize: 12,
        color: '#FF9800',
        marginRight: 8,
    },
    projects: {
        fontSize: 12,
        color: '#666',
        marginRight: 8,
    },
    specialty: {
        fontSize: 12,
        color: '#1890FF',
    },
    address: {
        fontSize: 12,
        color: '#999',
    },
    consultBtn: {
        backgroundColor: '#1890FF',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 16,
    },
    consultBtnText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '500',
    },
    siteIsland: {
        position: 'absolute',
        bottom: 90,
        left: 16,
        right: 16,
        backgroundColor: '#fff',
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    siteIcon: {
        fontSize: 24,
    },
    siteInfo: {
        flex: 1,
        marginLeft: 12,
    },
    siteTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
    },
    siteStatus: {
        fontSize: 12,
        color: '#52C41A',
        marginTop: 2,
    },
    siteArrow: {
        fontSize: 16,
        color: '#999',
    },
});

export default HomeScreen;
