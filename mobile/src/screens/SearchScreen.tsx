import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    TextInput,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
} from 'react-native';
import { providerApi } from '../services/api';

interface Provider {
    id: number;
    name?: string;
    nickname?: string;
    rating?: number;
    completed_projects?: number;
    service_type?: string;
    specialty?: string;
    address?: string;
}

const TABS = [
    { key: 'all', label: '全部' },
    { key: 'designer', label: '设计师' },
    { key: 'company', label: '装修公司' },
    { key: 'foreman', label: '工长' },
];

const SearchScreen: React.FC = () => {
    const [searchText, setSearchText] = useState('');
    const [activeTab, setActiveTab] = useState('all');
    const [results, setResults] = useState<Provider[]>([]);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);

    const fetchAllProviders = async () => {
        setLoading(true);
        try {
            let allProviders: Provider[] = [];

            if (activeTab === 'all' || activeTab === 'designer') {
                const designers: any = await providerApi.designers();
                if (Array.isArray(designers)) {
                    allProviders = [...allProviders, ...designers.map(d => ({ ...d, service_type: 'designer' }))];
                }
            }
            if (activeTab === 'all' || activeTab === 'company') {
                const companies: any = await providerApi.companies();
                if (Array.isArray(companies)) {
                    allProviders = [...allProviders, ...companies.map(c => ({ ...c, service_type: 'company' }))];
                }
            }
            if (activeTab === 'all' || activeTab === 'foreman') {
                const foremen: any = await providerApi.foremen();
                if (Array.isArray(foremen)) {
                    allProviders = [...allProviders, ...foremen.map(f => ({ ...f, service_type: 'foreman' }))];
                }
            }

            // 搜索过滤
            if (searchText.trim()) {
                allProviders = allProviders.filter(p => {
                    const name = p.name || p.nickname || '';
                    const specialty = p.specialty || '';
                    const address = p.address || '';
                    const keyword = searchText.toLowerCase();
                    return name.toLowerCase().includes(keyword) ||
                        specialty.toLowerCase().includes(keyword) ||
                        address.toLowerCase().includes(keyword);
                });
            }

            setResults(allProviders);
            setSearched(true);
        } catch (error) {
            console.log('Search failed:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (searched) {
            fetchAllProviders();
        }
    }, [activeTab]);

    const handleSearch = () => {
        fetchAllProviders();
    };

    const getProviderName = (provider: Provider) => {
        return provider.name || provider.nickname || `服务商${provider.id}`;
    };

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'designer': return '设计师';
            case 'company': return '装修公司';
            case 'foreman': return '工长';
            default: return '服务商';
        }
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'designer': return '#722ED1';
            case 'company': return '#13C2C2';
            case 'foreman': return '#FA8C16';
            default: return '#1890FF';
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* 搜索栏 */}
            <View style={styles.searchHeader}>
                <View style={styles.searchInputWrapper}>
                    <Text style={styles.searchIcon}>🔍</Text>
                    <TextInput
                        style={styles.searchInput}
                        placeholder="搜索设计师、装修公司、工长"
                        placeholderTextColor="#999"
                        value={searchText}
                        onChangeText={setSearchText}
                        onSubmitEditing={handleSearch}
                        returnKeyType="search"
                    />
                    {searchText.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchText('')}>
                            <Text style={styles.clearIcon}>✕</Text>
                        </TouchableOpacity>
                    )}
                </View>
                <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
                    <Text style={styles.searchBtnText}>搜索</Text>
                </TouchableOpacity>
            </View>

            {/* 分类标签 */}
            <View style={styles.tabsContainer}>
                {TABS.map((tab) => (
                    <TouchableOpacity
                        key={tab.key}
                        style={[
                            styles.tab,
                            activeTab === tab.key && styles.tabActive
                        ]}
                        onPress={() => setActiveTab(tab.key)}
                    >
                        <Text style={[
                            styles.tabText,
                            activeTab === tab.key && styles.tabTextActive
                        ]}>
                            {tab.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* 搜索结果 */}
            <ScrollView style={styles.content}>
                {!searched ? (
                    <View style={styles.placeholderContainer}>
                        <Text style={styles.placeholderIcon}>🔍</Text>
                        <Text style={styles.placeholderTitle}>发现优质服务商</Text>
                        <Text style={styles.placeholderText}>
                            输入关键词搜索设计师、装修公司或工长
                        </Text>

                        <View style={styles.hotKeywords}>
                            <Text style={styles.hotTitle}>热门搜索</Text>
                            <View style={styles.keywordsList}>
                                {['北欧风格', '日式设计', '全屋定制', '老房翻新', '局部装修'].map((keyword) => (
                                    <TouchableOpacity
                                        key={keyword}
                                        style={styles.keyword}
                                        onPress={() => {
                                            setSearchText(keyword);
                                            setTimeout(handleSearch, 100);
                                        }}
                                    >
                                        <Text style={styles.keywordText}>{keyword}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    </View>
                ) : loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#1890FF" />
                        <Text style={styles.loadingText}>搜索中...</Text>
                    </View>
                ) : results.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyIcon}>📭</Text>
                        <Text style={styles.emptyText}>暂无相关结果</Text>
                        <Text style={styles.emptyHint}>试试其他关键词</Text>
                    </View>
                ) : (
                    <>
                        <Text style={styles.resultCount}>
                            共找到 {results.length} 个结果
                        </Text>
                        {results.map((provider) => (
                            <TouchableOpacity key={`${provider.service_type}-${provider.id}`} style={styles.resultCard}>
                                <View style={styles.resultAvatar}>
                                    <Text style={styles.avatarText}>
                                        {getProviderName(provider)[0]}
                                    </Text>
                                </View>
                                <View style={styles.resultInfo}>
                                    <View style={styles.resultHeader}>
                                        <Text style={styles.resultName}>
                                            {getProviderName(provider)}
                                        </Text>
                                        <View style={[
                                            styles.typeTag,
                                            { backgroundColor: getTypeColor(provider.service_type || '') + '20' }
                                        ]}>
                                            <Text style={[
                                                styles.typeTagText,
                                                { color: getTypeColor(provider.service_type || '') }
                                            ]}>
                                                {getTypeLabel(provider.service_type || '')}
                                            </Text>
                                        </View>
                                    </View>
                                    <View style={styles.resultMeta}>
                                        <Text style={styles.rating}>
                                            ⭐ {provider.rating?.toFixed(1) || '5.0'}
                                        </Text>
                                        <Text style={styles.projects}>
                                            {provider.completed_projects || 0}单
                                        </Text>
                                        {provider.specialty && (
                                            <Text style={styles.specialty}>{provider.specialty}</Text>
                                        )}
                                    </View>
                                </View>
                                <TouchableOpacity style={styles.contactBtn}>
                                    <Text style={styles.contactBtnText}>联系</Text>
                                </TouchableOpacity>
                            </TouchableOpacity>
                        ))}
                    </>
                )}

                <View style={{ height: 20 }} />
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F5F5',
    },
    searchHeader: {
        backgroundColor: '#fff',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    searchInputWrapper: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F5F5',
        borderRadius: 20,
        paddingHorizontal: 12,
        height: 40,
    },
    searchIcon: {
        fontSize: 16,
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        color: '#333',
        padding: 0,
    },
    clearIcon: {
        fontSize: 14,
        color: '#999',
        padding: 4,
    },
    searchBtn: {
        marginLeft: 12,
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    searchBtnText: {
        color: '#1890FF',
        fontSize: 15,
        fontWeight: '500',
    },
    tabsContainer: {
        backgroundColor: '#fff',
        flexDirection: 'row',
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    tab: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        marginRight: 8,
    },
    tabActive: {
        borderBottomWidth: 2,
        borderBottomColor: '#1890FF',
    },
    tabText: {
        fontSize: 14,
        color: '#666',
    },
    tabTextActive: {
        color: '#1890FF',
        fontWeight: '600',
    },
    content: {
        flex: 1,
    },
    placeholderContainer: {
        paddingVertical: 60,
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    placeholderIcon: {
        fontSize: 48,
        marginBottom: 16,
    },
    placeholderTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
        marginBottom: 8,
    },
    placeholderText: {
        fontSize: 14,
        color: '#999',
        textAlign: 'center',
    },
    hotKeywords: {
        marginTop: 32,
        width: '100%',
    },
    hotTitle: {
        fontSize: 14,
        color: '#666',
        marginBottom: 12,
    },
    keywordsList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    keyword: {
        backgroundColor: '#fff',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 16,
        marginRight: 8,
        marginBottom: 8,
    },
    keywordText: {
        fontSize: 13,
        color: '#666',
    },
    loadingContainer: {
        paddingVertical: 60,
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        color: '#999',
    },
    emptyContainer: {
        paddingVertical: 60,
        alignItems: 'center',
    },
    emptyIcon: {
        fontSize: 48,
        marginBottom: 16,
    },
    emptyText: {
        fontSize: 16,
        color: '#333',
        marginBottom: 4,
    },
    emptyHint: {
        fontSize: 14,
        color: '#999',
    },
    resultCount: {
        padding: 16,
        fontSize: 13,
        color: '#999',
    },
    resultCard: {
        backgroundColor: '#fff',
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        marginHorizontal: 16,
        marginBottom: 12,
        borderRadius: 12,
    },
    resultAvatar: {
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
    resultInfo: {
        flex: 1,
        marginLeft: 12,
    },
    resultHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    resultName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#333',
        marginRight: 8,
    },
    typeTag: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    typeTagText: {
        fontSize: 11,
    },
    resultMeta: {
        flexDirection: 'row',
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
    contactBtn: {
        backgroundColor: '#1890FF',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 16,
    },
    contactBtnText: {
        color: '#fff',
        fontSize: 13,
    },
});

export default SearchScreen;
