import React, { useState } from 'react';
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
} from 'react-native';
import { Heart, Share2, Play, Eye } from 'lucide-react-native';

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = (width - 48) / 2; // 2 columns with padding

// Mock Data
const LIVE_ITEMS = [
    {
        id: 1,
        title: '豪宅设计实景探访',
        image: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
        viewers: '1.2k',
        author: 'W-Design 事务所',
        avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&q=80',
    },
    {
        id: 2,
        title: '极简风格施工现场直击',
        image: 'https://images.unsplash.com/photo-1507089947368-19c1da9775ae?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
        viewers: '856',
        author: '匠心营造',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&q=80',
    },
    {
        id: 3,
        title: '软装搭配在线答疑',
        image: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
        viewers: '2.5k',
        author: '软装搭配师 Amy',
        avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&q=80',
    }
];

const VIDEO_ITEMS = [
    {
        id: 1,
        title: '全屋智能灯光设计解析',
        image: 'https://images.unsplash.com/photo-1565538810643-b5bdb714032a?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
        playCount: '12k',
        author: 'TechHome',
        avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&q=80',
        height: 280,
    },
    {
        id: 2,
        title: '法式轻奢软装搭配指南',
        image: 'https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
        playCount: '8.5k',
        author: 'Lisa Decor',
        avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&q=80',
        height: 320,
    },
    {
        id: 3,
        title: '2024厨房设计流行趋势',
        image: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
        playCount: '5.6k',
        author: '设计前沿',
        avatar: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&q=80',
        height: 260,
    },
    {
        id: 4,
        title: '小户型收纳神器推荐',
        image: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
        playCount: '3.2k',
        author: '收纳控',
        avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&q=80',
        height: 300,
    }
];

const ARTICLE_ITEMS = [
    {
        id: 1,
        title: '黑白金配色：重新定义现代奢华',
        subtitle: 'Black, white and gold color scheme: redefining modern luxury',
        image: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
        author: 'ID 杂志',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&q=80',
        likes: 245,
    },
    {
        id: 2,
        title: '探索自然光影：极简别墅设计案例',
        subtitle: 'Exploring natural light and shadow: minimalist villa design case',
        image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
        author: '建筑视野',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&q=80',
        likes: 189,
    },
    {
        id: 3,
        title: '把森林搬回家：植物系家居指南',
        subtitle: 'Bring the forest home: a guide to plant-based homes',
        image: 'https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
        author: 'Green Life',
        avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&q=80',
        likes: 562,
    }
];

const TABS = ['直播', '视频', '图文'];

import { useNavigation } from '@react-navigation/native';

const InspirationScreen = () => {
    const [activeTab, setActiveTab] = useState('图文');
    const navigation = useNavigation<any>();

    const renderLiveItem = (item: any) => (
        <TouchableOpacity
            key={item.id}
            style={styles.liveCard}
            activeOpacity={0.9}
            onPress={() => navigation.navigate('LiveRoom', { item })}
        >
            <Image source={{ uri: item.image }} style={styles.liveImage} resizeMode="cover" />
            <View style={styles.liveOverlay} />
            <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveBadgeText}>直播中</Text>
            </View>
            <View style={styles.liveViewerBadge}>
                <Eye size={10} color="#fff" />
                <Text style={styles.liveViewerText}>{item.viewers}</Text>
            </View>
            <View style={styles.liveContent}>
                <Text style={styles.liveTitle}>{item.title}</Text>
                <View style={styles.liveAuthorRow}>
                    <Image source={{ uri: item.avatar }} style={styles.liveAvatar} />
                    <Text style={styles.liveAuthorName}>{item.author}</Text>
                </View>
            </View>
        </TouchableOpacity>
    );

    const renderVideoItem = (item: any) => (
        <TouchableOpacity
            key={item.id}
            style={styles.videoCard}
            activeOpacity={0.9}
            onPress={() => navigation.navigate('VideoPlayer', { item })}
        >
            <View style={[styles.videoImageContainer, { height: item.height }]}>
                <Image source={{ uri: item.image }} style={styles.videoImage} resizeMode="cover" />
                <View style={styles.playIconContainer}>
                    <Play size={20} color="#fff" fill="#fff" />
                </View>
                <View style={styles.videoStats}>
                    <Play size={10} color="#fff" fill="#fff" />
                    <Text style={styles.videoStatsText}>{item.playCount}</Text>
                </View>
            </View>
            <Text style={styles.videoTitle} numberOfLines={2}>{item.title}</Text>
            <View style={styles.videoAuthorRow}>
                <Image source={{ uri: item.avatar }} style={styles.videoAvatar} />
                <Text style={styles.videoAuthorName}>{item.author}</Text>
            </View>
        </TouchableOpacity>
    );

    const renderArticleItem = (item: any) => (
        <TouchableOpacity
            key={item.id}
            style={styles.articleCard}
            activeOpacity={0.9}
            onPress={() => navigation.navigate('ArticleDetail', { item })}
        >
            <View style={styles.articleImageContainer}>
                <Image source={{ uri: item.image }} style={styles.articleImage} resizeMode="cover" />
                <View style={styles.articleTypeTag}>
                    <Text style={styles.articleTypeTagText}>图文</Text>
                </View>
            </View>
            <Text style={styles.articleTitle}>{item.title}</Text>
            <Text style={styles.articleSubtitle}>{item.subtitle}</Text>
            <View style={styles.articleFooter}>
                <View style={styles.articleAuthor}>
                    <Image source={{ uri: item.avatar }} style={styles.articleAvatar} />
                    <Text style={styles.articleAuthorName}>{item.author}</Text>
                </View>
                <View style={styles.articleInteractions}>
                    <Heart size={16} color="#666" />
                    <Text style={styles.articleInteractionText}>{item.likes}</Text>
                    <Share2 size={16} color="#666" style={{ marginLeft: 16 }} />
                    <Text style={styles.articleInteractionText}>分享</Text>
                </View>
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>灵感图库</Text>
            </View>

            {/* Tabs */}
            <View style={styles.tabContainer}>
                {TABS.map((tab) => (
                    <TouchableOpacity
                        key={tab}
                        onPress={() => setActiveTab(tab)}
                        style={styles.tabItem}
                    >
                        <Text style={[
                            styles.tabText,
                            activeTab === tab && styles.activeTabText
                        ]}>
                            {tab}
                        </Text>
                        {activeTab === tab && <View style={styles.activeIndicator} />}
                    </TouchableOpacity>
                ))}
            </View>

            {/* Content Switcher */}
            <ScrollView
                style={styles.content}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {activeTab === '直播' && (
                    <View style={styles.feedList}>
                        {LIVE_ITEMS.map(renderLiveItem)}
                    </View>
                )}

                {activeTab === '视频' && (
                    <View style={styles.videoGrid}>
                        <View style={styles.videoColumn}>
                            {VIDEO_ITEMS.filter((_, i) => i % 2 === 0).map(renderVideoItem)}
                        </View>
                        <View style={styles.videoColumn}>
                            {VIDEO_ITEMS.filter((_, i) => i % 2 === 1).map(renderVideoItem)}
                        </View>
                    </View>
                )}

                {activeTab === '图文' && (
                    <View style={styles.feedList}>
                        {ARTICLE_ITEMS.map(renderArticleItem)}
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'ios' ? 12 : 44, // 适配沉浸式状态栏
        paddingBottom: 4,
        backgroundColor: '#fff',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#000',
    },
    tabContainer: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        marginBottom: 10,
        backgroundColor: '#fff',
    },
    tabItem: {
        marginRight: 24,
        paddingVertical: 12,
        position: 'relative',
    },
    tabText: {
        fontSize: 16,
        color: '#9CA3AF',
        fontWeight: '500',
    },
    activeTabText: {
        color: '#000',
        fontWeight: 'bold',
    },
    activeIndicator: {
        position: 'absolute',
        bottom: 4,
        height: 3,
        backgroundColor: '#EAB308',
        borderRadius: 1.5,
        width: 16,
        alignSelf: 'center',
    },
    content: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingBottom: 20,
    },
    feedList: {
        gap: 20,
    },
    // Live Styles
    liveCard: {
        height: 240,
        borderRadius: 16,
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: '#f0f0f0',
    },
    liveImage: {
        width: '100%',
        height: '100%',
    },
    liveOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.3)', // gradient overlay simulated
    },
    liveBadge: {
        position: 'absolute',
        top: 12,
        left: 12,
        backgroundColor: '#EAB308',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    liveDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#fff',
        marginRight: 4,
    },
    liveBadgeText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
    },
    liveViewerBadge: {
        position: 'absolute',
        top: 12,
        left: 70, // Offset from live badge
        backgroundColor: 'rgba(0,0,0,0.5)',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    liveViewerText: {
        color: '#fff',
        fontSize: 10,
        marginLeft: 4,
    },
    liveContent: {
        position: 'absolute',
        bottom: 16,
        left: 16,
        right: 16,
    },
    liveTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 8,
        textShadowColor: 'rgba(0, 0, 0, 0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },
    liveAuthorRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    liveAvatar: {
        width: 20,
        height: 20,
        borderRadius: 10,
        marginRight: 8,
        borderWidth: 1,
        borderColor: '#fff',
    },
    liveAuthorName: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '500',
    },
    // Video Styles
    videoGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    videoColumn: {
        width: COLUMN_WIDTH,
        gap: 12,
    },
    videoCard: {
        marginBottom: 8,
    },
    videoImageContainer: {
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 8,
        position: 'relative',
        backgroundColor: '#f0f0f0',
    },
    videoImage: {
        width: '100%',
        height: '100%',
    },
    playIconContainer: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: [{ translateX: -10 }, { translateY: -10 }], // Center 20px icon
        backgroundColor: 'rgba(0,0,0,0.2)',
        borderRadius: 20,
        padding: 8,
    },
    videoStats: {
        position: 'absolute',
        bottom: 8,
        left: 8,
        flexDirection: 'row',
        alignItems: 'center',
    },
    videoStatsText: {
        color: '#fff',
        fontSize: 10,
        marginLeft: 4,
        fontWeight: '500',
    },
    videoTitle: {
        fontSize: 14,
        color: '#111',
        fontWeight: '600',
        marginBottom: 4,
        lineHeight: 20,
    },
    videoAuthorRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    videoAvatar: {
        width: 16,
        height: 16,
        borderRadius: 8,
        marginRight: 4,
        backgroundColor: '#eee',
    },
    videoAuthorName: {
        fontSize: 11,
        color: '#9CA3AF',
    },
    // Article Styles
    articleCard: {
        marginBottom: 12,
    },
    articleImageContainer: {
        position: 'relative',
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 12,
        backgroundColor: '#f0f0f0',
    },
    articleImage: {
        width: '100%',
        height: 220,
    },
    articleTypeTag: {
        position: 'absolute',
        top: 12,
        right: 12,
        backgroundColor: '#fff',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    articleTypeTagText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#000',
    },
    articleTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#EAB308', // Gold/Yellow color from ref
        marginBottom: 6,
    },
    articleSubtitle: {
        fontSize: 13,
        color: '#9CA3AF',
        marginBottom: 12,
        lineHeight: 18,
    },
    articleFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    articleAuthor: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    articleAvatar: {
        width: 28,
        height: 28,
        borderRadius: 14,
        marginRight: 8,
        backgroundColor: '#000',
    },
    articleAuthorName: {
        fontSize: 13,
        color: '#000',
        fontWeight: '500',
    },
    articleInteractions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    articleInteractionText: {
        fontSize: 12,
        color: '#9CA3AF',
        marginLeft: 4,
    },
});

export default InspirationScreen;
