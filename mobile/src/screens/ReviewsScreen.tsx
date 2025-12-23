import React, { useState, useEffect } from 'react';
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
    ActivityIndicator,
    ProgressBarAndroid,
    StatusBar,
    FlatList
} from 'react-native';
import { ArrowLeft, Star, ThumbsUp, MessageSquare, MoreHorizontal, Filter } from 'lucide-react-native';
import { providerApi } from '../services/api';

const { width } = Dimensions.get('window');

export const ReviewsScreen = ({ route, navigation }: any) => {
    const { providerId, providerName, providerType } = route.params || {};
    const [reviews, setReviews] = useState<any[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeTag, setActiveTag] = useState('all');

    const apiType = providerType === 'designer' ? 'designers' :
        providerType === 'company' ? 'companies' : 'foremen';

    // 初始化加载统计数据
    useEffect(() => {
        loadStats();
    }, []);

    // 切换标签时重新加载评价
    useEffect(() => {
        loadReviews(activeTag);
    }, [activeTag]);

    const loadStats = async () => {
        try {
            const res = await providerApi.getReviewStats(apiType, providerId);
            if (res.data) {
                setStats(res.data);
            }
        } catch (error) {
            console.log('加载统计失败:', error);
        }
    };

    const loadReviews = async (filter: string) => {
        setLoading(true);
        try {
            const res = await providerApi.getReviews(apiType, providerId, 1, filter);
            if (res.data && res.data.list) {
                setReviews(res.data.list);
            }
        } catch (error) {
            console.log('加载评价失败:', error);
        } finally {
            setLoading(false);
        }
    };

    // 根据统计数据动态生成标签
    const getReviewTags = () => {
        if (!stats) return [{ id: 'all', label: '全部', count: 0 }];

        const tags = [
            { id: 'all', label: '全部', count: stats.total || 0 },
            { id: 'pic', label: '有图', count: stats.withImage || 0 },
            { id: 'good', label: '好评', count: stats.goodCount || 0 },
        ];

        // 添加动态标签
        if (stats.tags) {
            Object.entries(stats.tags).forEach(([tag, count]) => {
                tags.push({ id: tag, label: tag, count: count as number });
            });
        }

        return tags;
    };



    // 渲染图片网格
    const renderReviewImages = (images: string[]) => {
        if (!images || images.length === 0) return null;

        if (images.length === 1) {
            return (
                <TouchableOpacity activeOpacity={0.9}>
                    <Image source={{ uri: images[0] }} style={styles.singleImage} />
                </TouchableOpacity>
            );
        }

        if (images.length === 2) {
            return (
                <View style={styles.imageGrid}>
                    {images.map((img, i) => (
                        <TouchableOpacity key={i} activeOpacity={0.9} style={styles.halfImageContainer}>
                            <Image source={{ uri: img }} style={styles.gridImage} />
                        </TouchableOpacity>
                    ))}
                </View>
            );
        }

        return (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.reviewImagesScroll}>
                {images.map((img, i) => (
                    <TouchableOpacity key={i} activeOpacity={0.9}>
                        <Image source={{ uri: img }} style={styles.scrollImage} />
                    </TouchableOpacity>
                ))}
            </ScrollView>
        );
    };

    const renderHeader = () => (
        <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                <ArrowLeft size={24} color="#1F2937" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>用户评价</Text>
            <View style={{ width: 24 }} />
        </View>
    );

    const renderOverview = () => {
        const avgRating = stats?.avgRating?.toFixed(1) || '0.0';
        const numRating = parseFloat(avgRating);
        const starDist = stats?.starDistribution || {};
        const total = stats?.total || 1;

        const getPercent = (star: number) => {
            const count = starDist[star] || 0;
            return Math.round((count / total) * 100) + '%';
        };

        let sentiment = "暂无评分";
        if (numRating >= 4.8) sentiment = "超赞口碑";
        else if (numRating >= 4.5) sentiment = "非常满意";
        else if (numRating >= 4.0) sentiment = "值得推荐";
        else if (numRating > 0) sentiment = "一般";

        return (
            <View style={styles.overviewCard}>
                <View style={styles.scoreLeft}>
                    <Text style={styles.sentimentText}>{sentiment}</Text>
                    <Text style={styles.bigScore}>{avgRating}</Text>
                    <View style={styles.starsRow}>
                        {[1, 2, 3, 4, 5].map(i => (
                            <Star key={i} size={14} color="#F59E0B" fill={i <= Math.round(numRating) ? "#F59E0B" : "transparent"} />
                        ))}
                    </View>
                    <Text style={styles.totalCount}>{total} 条真实评价</Text>
                </View>
                <View style={styles.scoreRight}>
                    {[5, 4, 3, 2, 1].map((star) => (
                        <View key={star} style={styles.distRow}>
                            <Text style={styles.distLabel}>{star}</Text>
                            <View style={styles.distBarBg}>
                                <View style={[styles.distBarFill, { width: getPercent(star) as any }]} />
                            </View>
                        </View>
                    ))}
                </View>
            </View>
        );
    };

    const renderTags = () => {
        const reviewTags = getReviewTags();
        return (
            <View style={styles.tagsWrapper}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagsScrollContent}>
                    {reviewTags.map(tag => {
                        const isActive = activeTag === tag.id;
                        return (
                            <TouchableOpacity
                                key={tag.id}
                                style={[styles.capsuleTag, isActive && styles.capsuleTagActive]}
                                onPress={() => setActiveTag(tag.id)}
                            >
                                <Text style={[styles.capsuleText, isActive && styles.capsuleTextActive]}>
                                    {tag.label}
                                </Text>
                                {isActive && <View style={styles.activeDot} />}
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>
        );
    };

    const renderReviewItem = ({ item }: { item: any }) => {
        let images: string[] = [];
        try {
            if (item.images) images = JSON.parse(item.images);
        } catch (e) { }

        return (
            <View style={styles.cardContainer}>
                <View style={styles.cardHeader}>
                    <Image source={{ uri: item.userAvatar || 'https://via.placeholder.com/40' }} style={styles.userAvatar} />
                    <View style={styles.headerInfo}>
                        <Text style={styles.headerName}>{item.userName || '匿名用户'}</Text>
                        <View style={styles.headerMeta}>
                            <View style={styles.miniStars}>
                                {[1, 2, 3, 4, 5].map(i => (
                                    <Star key={i} size={10} color="#F59E0B" fill={i <= item.rating ? "#F59E0B" : "transparent"} />
                                ))}
                            </View>
                            <Text style={styles.headerDate}>{item.createdAt?.split('T')[0]}</Text>
                        </View>
                    </View>
                    <TouchableOpacity>
                        <MoreHorizontal size={20} color="#D1D5DB" />
                    </TouchableOpacity>
                </View>

                <Text style={styles.cardContent}>{item.content}</Text>

                {renderReviewImages(images)}

                <View style={styles.cardFooter}>
                    <View style={styles.metaTags}>
                        <Text style={styles.metaTag}>{item.serviceType || '整装'}</Text>
                        <Text style={styles.metaTag}>{item.area || '100㎡'}</Text>
                        <Text style={styles.metaTag}>{item.style || '现代'}</Text>
                    </View>
                    <TouchableOpacity style={styles.usefulBtn}>
                        <ThumbsUp size={14} color="#6B7280" />
                        <Text style={styles.usefulText}>{item.helpfulCount > 0 ? item.helpfulCount : '很有用'}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            {renderHeader()}

            <FlatList
                data={reviews}
                keyExtractor={(item, index) => item.id?.toString() || index.toString()}
                renderItem={renderReviewItem}
                ListHeaderComponent={() => (
                    <View style={styles.listHeader}>
                        {renderOverview()}
                        {renderTags()}
                    </View>
                )}
                ListFooterComponent={() => (
                    loading ? (
                        <View style={styles.loadingFooter}>
                            <ActivityIndicator size="small" color="#111" />
                        </View>
                    ) : <View style={{ height: 40 }} />
                )}
                contentContainerStyle={styles.flatListContent}
                showsVerticalScrollIndicator={false}
                stickyHeaderIndices={[0]} // 尝试让 ListHeader 吸顶？
            // 注意：ListHeaderComponent 是 index 0 吗？不，它不计入 data index。
            // stickyHeaderIndices 只能用于 data 中的 items。
            // 如果想让 ListHeader 里的 Tags 吸顶，需要复杂的结构。
            // 暂时不使用 stickyHeaderIndices，因为 ListHeaderComponent 包含 Overview，我们不想 Overview 吸顶。
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB', // Cool Gray 50
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'ios' ? 12 : 44,
        paddingBottom: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111',
        letterSpacing: 0.5,
    },
    backBtn: {
        padding: 4,
    },

    // Overview Premium Style
    listHeader: {
        backgroundColor: '#fff',
        marginBottom: 10,
        paddingBottom: 4,
    },
    overviewCard: {
        flexDirection: 'row',
        padding: 24,
        alignItems: 'center',
    },
    scoreLeft: {
        alignItems: 'center',
        paddingRight: 32,
        borderRightWidth: 1,
        borderRightColor: '#F3F4F6',
    },
    sentimentText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#B45309', // Amber-700
        marginBottom: 4,
        backgroundColor: '#FEF3C7',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        overflow: 'hidden',
    },
    bigScore: {
        fontSize: 42,
        fontWeight: '800',
        color: '#1F2937',
        letterSpacing: -1,
        lineHeight: 48,
    },
    starsRow: {
        flexDirection: 'row',
        marginBottom: 6,
    },
    totalCount: {
        fontSize: 11,
        color: '#9CA3AF',
    },
    scoreRight: {
        flex: 1,
        paddingLeft: 24,
        justifyContent: 'center',
    },
    distRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
        height: 12,
    },
    distLabel: {
        width: 12,
        fontSize: 10,
        color: '#9CA3AF',
        marginRight: 8,
        textAlign: 'right',
    },
    distBarBg: {
        flex: 1,
        height: 6,
        backgroundColor: '#F3F4F6',
        borderRadius: 3,
    },
    distBarFill: {
        height: '100%',
        backgroundColor: '#F59E0B',
        borderRadius: 3,
    },

    // Capsule Tags
    tagsWrapper: {
        paddingBottom: 16,
    },
    tagsScrollContent: {
        paddingHorizontal: 20,
    },
    capsuleTag: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 24,
        backgroundColor: '#F3F4F6',
        marginRight: 10,
    },
    capsuleTagActive: {
        backgroundColor: '#1F2937', // Black/Dark Gray
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    capsuleText: {
        fontSize: 13,
        color: '#4B5563',
        fontWeight: '500',
    },
    capsuleTextActive: {
        color: '#FFFFFF',
        fontWeight: '600',
    },
    activeDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#F59E0B',
        marginLeft: 6,
    },

    // Review Card Premium
    flatListContent: {
        paddingBottom: 40,
        backgroundColor: '#F9FAFB',
    },
    cardContainer: {
        backgroundColor: '#fff',
        marginTop: 10,
        paddingHorizontal: 20,
        paddingVertical: 20,
    },
    cardHeader: {
        flexDirection: 'row',
        marginBottom: 14,
    },
    userAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: 12,
        backgroundColor: '#E5E7EB',
    },
    headerInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    headerName: {
        fontSize: 15,
        fontWeight: '700',
        color: '#111',
        marginBottom: 4,
    },
    headerMeta: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    miniStars: {
        flexDirection: 'row',
        marginRight: 8,
    },
    headerDate: {
        fontSize: 11,
        color: '#9CA3AF',
    },
    cardContent: {
        fontSize: 15,
        color: '#374151',
        lineHeight: 24,
        marginBottom: 16,
        letterSpacing: 0.2,
    },
    // Images
    singleImage: {
        width: '100%',
        height: 200,
        borderRadius: 12,
        marginBottom: 12,
        backgroundColor: '#F3F4F6',
    },
    imageGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    halfImageContainer: {
        width: '48.5%',
        aspectRatio: 1,
    },
    gridImage: {
        width: '100%',
        height: '100%',
        borderRadius: 12,
        backgroundColor: '#F3F4F6',
    },
    reviewImagesScroll: {
        marginBottom: 12,
    },
    scrollImage: {
        width: 140,
        height: 140,
        borderRadius: 12,
        marginRight: 10,
        backgroundColor: '#F3F4F6',
    },
    // Footer
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 4,
    },
    metaTags: {
        flexDirection: 'row',
    },
    metaTag: {
        fontSize: 11,
        color: '#6B7280',
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        marginRight: 6,
        overflow: 'hidden',
    },
    usefulBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 6,
    },
    usefulText: {
        fontSize: 12,
        color: '#6B7280',
        marginLeft: 6,
        fontWeight: '500',
    },
    loadingFooter: {
        padding: 24,
        alignItems: 'center',
    },
});
