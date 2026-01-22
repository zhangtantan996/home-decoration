import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    FlatList,
    TouchableOpacity,
    Image,
    ActivityIndicator,
    Platform,
    StatusBar,
    RefreshControl
} from 'react-native';
import { ChevronLeft, Store, Image as ImageIcon } from 'lucide-react-native';
import { userApi, materialShopApi } from '../services/api';
import { useToast } from '../components/Toast';

interface FavoriteItem {
    id: number;
    targetId: number;
    targetType: string;
    title: string;
    coverImage: string;
    createdAt: string;
}

const FavoritesScreen = ({ navigation }: any) => {
    const { showToast } = useToast();
    const [activeTab, setActiveTab] = useState<'case' | 'material_shop'>('case');
    const [list, setList] = useState<FavoriteItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [hasMore, setHasMore] = useState(true);

    const PAGE_SIZE = 20;
    const nextPageRef = useRef(1);
    const loadingRef = useRef(false);

    const loadData = useCallback(async (isRefresh = false) => {
        if (loadingRef.current) return;

        const currentPage = isRefresh ? 1 : nextPageRef.current;
        loadingRef.current = true;
        setLoading(true);

        try {
            const res = await userApi.favorites({
                type: activeTab,
                page: currentPage,
                pageSize: PAGE_SIZE
            });
            
            const newData = res.data.list || [];
            const total = res.data.total || 0;

            setList(prev => (isRefresh ? newData : [...prev, ...newData]));

            const hasMoreNext = currentPage* PAGE_SIZE < total;
            setHasMore(hasMoreNext);
            nextPageRef.current = hasMoreNext ? currentPage + 1 : currentPage;
        } catch (error) {
            console.error('Fetch favorites error:', error);
            showToast({ message: '加载失败', type: 'error' });
        } finally {
            setLoading(false);
            setRefreshing(false);
            loadingRef.current = false;
        }
    }, [activeTab, showToast]);

    useEffect(() => {
        setList([]);
        setHasMore(true);
        nextPageRef.current = 1;
        loadData(true);
    }, [activeTab, loadData]);

    const onRefresh = () => {
        setRefreshing(true);
        loadData(true);
    };

    const onEndReached = () => {
        if (hasMore && !loading) {
            loadData(false);
        }
    };

    const handlePress = async (item: FavoriteItem) => {
        if (activeTab === 'case') {
            navigation.navigate('InspirationDetail', {
                item: {
                    id: item.targetId,
                    title: item.title,
                    coverImage: item.coverImage,
                    isFavorited: true,
                }
            });
        } else {
            try {
                const res = await materialShopApi.detail(item.targetId);
                if (res.data) {
                    navigation.navigate('MaterialShopDetail', { shop: res.data });
                }
            } catch (error) {
                console.error('Fetch shop detail error:', error);
                showToast({ message: '无法加载门店详情', type: 'error' });
            }
        }
    };

    const renderItem = ({ item }: { item: FavoriteItem }) => (
        <TouchableOpacity
            style={styles.itemCard}
            onPress={() => handlePress(item)}
            activeOpacity={0.7}
        >
            <Image source={{ uri: item.coverImage }} style={styles.itemImage} />
            <View style={styles.itemInfo}>
                <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
                <View style={styles.itemMeta}>
                    {activeTab === 'case' ? (
                        <View style={styles.badge}>
                            <ImageIcon size={10} color="#71717A" />
                            <Text style={styles.badgeText}>案例</Text>
                        </View>
                    ) : (
                        <View style={[styles.badge, styles.shopBadge]}>
                            <Store size={10} color="#09090B" />
                            <Text style={[styles.badgeText, styles.shopBadgeText]}>门店</Text>
                        </View>
                    )}
                    <Text style={styles.dateText}>
                        {new Date(item.createdAt).toLocaleDateString()}
                    </Text>
                </View>
            </View>
        </TouchableOpacity>
    );

    const renderEmpty = () => (
        !loading ? (
            <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>暂无收藏内容</Text>
            </View>
        ) : null
    );

    const renderFooter = () => (
        loading && !refreshing ? (
            <View style={styles.footer}>
                <ActivityIndicator size="small" color="#9CA3AF" />
            </View>
        ) : <View style={styles.footer} />
    );

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar
                barStyle="dark-content"
                backgroundColor="transparent"
                translucent
            />
            
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ChevronLeft size={24} color="#09090B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>我的收藏</Text>
                <View style={styles.placeholder} />
            </View>

            <View style={styles.tabBar}>
                <TouchableOpacity 
                    style={[styles.tabItem, activeTab === 'case' && styles.activeTab]}
                    onPress={() => setActiveTab('case')}
                >
                    <Text style={[styles.tabText, activeTab === 'case' && styles.activeTabText]}>
                        案例
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    style={[styles.tabItem, activeTab === 'material_shop' && styles.activeTab]}
                    onPress={() => setActiveTab('material_shop')}
                >
                    <Text style={[styles.tabText, activeTab === 'material_shop' && styles.activeTabText]}>
                        建材门店
                    </Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={list}
                renderItem={renderItem}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#09090B']} />
                }
                onEndReached={onEndReached}
                onEndReachedThreshold={0.2}
                ListEmptyComponent={renderEmpty}
                ListFooterComponent={renderFooter}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA',
        paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#FFFFFF',
    },
    backBtn: {
        padding: 4,
        marginLeft: -4,
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: '#09090B',
    },
    placeholder: {
        width: 32,
    },
    tabBar: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F4F4F5',
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    activeTab: {
        borderBottomColor: '#09090B',
    },
    tabText: {
        fontSize: 14,
        color: '#71717A',
        fontWeight: '500',
    },
    activeTabText: {
        color: '#09090B',
        fontWeight: '600',
    },
    listContent: {
        padding: 16,
        minHeight: '100%',
    },
    itemCard: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    itemImage: {
        width: 80,
        height: 80,
        borderRadius: 8,
        backgroundColor: '#F4F4F5',
    },
    itemInfo: {
        flex: 1,
        marginLeft: 12,
        justifyContent: 'space-between',
        paddingVertical: 2,
    },
    itemTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#09090B',
        lineHeight: 22,
    },
    itemMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F4F4F5',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    shopBadge: {
        backgroundColor: '#F0F9FF',
    },
    badgeText: {
        fontSize: 10,
        color: '#71717A',
        marginLeft: 2,
        fontWeight: '500',
    },
    shopBadgeText: {
        color: '#0284C7',
    },
    dateText: {
        fontSize: 12,
        color: '#A1A1AA',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 100,
    },
    emptyText: {
        color: '#9CA3AF',
        fontSize: 14,
    },
    footer: {
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default FavoritesScreen;
