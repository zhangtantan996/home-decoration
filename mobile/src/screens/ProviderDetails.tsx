import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    Image,
    TouchableOpacity,
    Dimensions,
    StatusBar,
    Platform,
    ActivityIndicator,
    ImageBackground,
    Animated,
} from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import Clipboard from '@react-native-clipboard/clipboard';
import { ArrowLeft, Star, MapPin, MessageCircle, Calendar, Award, Briefcase, Users, Clock, ChevronRight, Heart, Share2 } from 'lucide-react-native';
import { useToast } from '../components/Toast';
import { getWebUrl } from '../config';
import { providerApi } from '../services/api';

const { width } = Dimensions.get('window');

// 格式化粉丝数
const formatFollowers = (count: number) => {
    if (count >= 1000) return (count / 1000).toFixed(1) + 'k';
    return count.toString();
};

// 工种英文转中文
const translateWorkType = (workType: string): string => {
    const map: Record<string, string> = {
        'carpenter': '木工',
        'electrician': '电工',
        'plumber': '水管工',
        'painter': '油漆工',
        'mason': '泥瓦工',
        'tiler': '瓷砖工',
        'hvac': '暖通工',
        'general': '全屋装修',
        'demolition': '拆除',
        '水电工': '水电工',
        '木工': '木工',
        '油漆工': '油漆工',
    };
    // 处理逗号分隔的多个工种
    if (workType.includes(',')) {
        return workType.split(',').map(t => map[t.trim()] || t.trim()).join(' · ');
    }
    return map[workType] || workType;
};

// ========== Parallax Scroll Layout ==========
const ParallaxScrollLayout = ({
    scrollY,
    headerHeight = 280,
    renderHeader,
    renderStickyNav,
    children,
    bottomBar
}: any) => {
    // Animations
    const imageTranslateY = scrollY.interpolate({
        inputRange: [0, headerHeight],
        outputRange: [0, -headerHeight / 2],
        extrapolate: 'clamp',
    });
    const imageScale = scrollY.interpolate({
        inputRange: [-headerHeight, 0],
        outputRange: [2, 1],
        extrapolate: 'clamp',
    });
    const navOpacity = scrollY.interpolate({
        inputRange: [0, 200],
        outputRange: [0, 1],
        extrapolate: 'clamp',
    });

    return (
        <View style={styles.parallaxContainer}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

            {/* 1. Parallax Header */}
            <Animated.View style={[styles.parallaxHeader, { height: headerHeight, transform: [{ translateY: imageTranslateY }, { scale: imageScale }] }]}>
                {renderHeader()}
            </Animated.View>

            {/* 2. Sticky Nav */}
            <View style={styles.stickyNavContainer}>
                <Animated.View style={[styles.stickyNavBg, { opacity: navOpacity }]} />
                <SafeAreaView>
                    {renderStickyNav(navOpacity)}
                </SafeAreaView>
            </View>

            {/* 3. Content */}
            <Animated.ScrollView
                style={{ flex: 1, backgroundColor: 'transparent' }}
                contentContainerStyle={{ paddingTop: headerHeight - 30, paddingBottom: 100 }}
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                    { useNativeDriver: true }
                )}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.contentCard}>
                    {children}
                </View>
            </Animated.ScrollView>

            {/* Floating Bottom Bar */}
            {bottomBar && (
                <View style={styles.floatBottomContainer}>
                    {bottomBar}
                </View>
            )}
        </View>
    );
};

// ========== Designer Detail Screen ==========
export const DesignerDetailScreen = ({ route, navigation }: any) => {
    const params = route.params || {};
    // 支持直接传 id，或者传完整的 designer 对象
    const designerId = params.id || params.designer?.id;
    // 初始数据可能是 undefined，需要做空保护
    const initialDesigner = params.designer || { id: designerId, name: '加载中...' };

    const { showToast } = useToast();
    const scrollY = useRef(new Animated.Value(0)).current;

    // API 数据状态
    const [detail, setDetail] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isFollowed, setIsFollowed] = useState(false);
    const [isFavorited, setIsFavorited] = useState(false);
    const [followersCount, setFollowersCount] = useState(0);
    const [isIntroExpanded, setIsIntroExpanded] = useState(false);

    useEffect(() => {
        if (designerId) {
            loadDetail();
            loadUserStatus();
        }
    }, [designerId]);

    const loadDetail = async () => {
        try {
            const res = await providerApi.designerDetail(designerId);
            if (res.data) {
                setDetail(res.data);
                setFollowersCount(res.data.provider?.followersCount || 0);
            }
        } catch (error) {
            console.log('加载详情失败:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadUserStatus = async () => {
        try {
            const res = await providerApi.getUserStatus(designerId);
            if (res.data) {
                setIsFollowed(res.data.isFollowed);
                setIsFavorited(res.data.isFavorited);
            }
        } catch (error) {
            // 未登录或其他错误，静默失败
            console.log('加载用户状态失败:', error);
        }
    };

    const handleShare = () => {
        const shareUrl = `${getWebUrl()}/designer/${designerId}`;
        Clipboard.setString(shareUrl);
        showToast({ message: '链接已复制到剪贴板', type: 'success' });
    };

    const handleFollow = async () => {
        try {
            if (isFollowed) {
                await providerApi.unfollow(designerId, 'designer');
                setFollowersCount(prev => Math.max(0, prev - 1));
            } else {
                await providerApi.follow(designerId, 'designer');
                setFollowersCount(prev => prev + 1);
            }
            setIsFollowed(!isFollowed);
        } catch (error) {
            showToast({ message: '操作失败，请重试', type: 'error' });
        }
    };

    const handleFavorite = async () => {
        try {
            if (isFavorited) {
                await providerApi.unfavorite(designerId, 'provider');
            } else {
                await providerApi.favorite(designerId, 'provider');
            }
            setIsFavorited(!isFavorited);
        } catch (error) {
            showToast({ message: '操作失败，请重试', type: 'error' });
        }
    };

    // 使用 API 数据或降级使用传入数据
    const provider = detail?.provider || {};
    const user = detail?.user || {};
    const cases = detail?.cases || [];
    const reviews = detail?.reviews || [];
    const caseCount = detail?.caseCount || 0;

    // 合并数据（API 优先，降级使用传入的 initialDesigner）
    const displayData = {
        name: user.nickname || initialDesigner.name || '设计师',
        avatar: user.avatar || initialDesigner.avatar,
        coverImage: provider.coverImage || provider.avatar || initialDesigner.avatar,
        rating: provider.rating || initialDesigner.rating || 5.0,
        reviewCount: detail?.reviewCount || provider.reviewCount || initialDesigner.reviewCount || 0,
        yearsExperience: provider.yearsExperience || initialDesigner.yearsExperience || 0,
        specialty: provider.specialty || initialDesigner.specialty || '',
        orgType: provider.subType || initialDesigner.orgType || 'personal',
        orgLabel: provider.companyName || initialDesigner.orgLabel || '',
        distance: initialDesigner.distance || '3km',
        completedCnt: provider.completedCnt || 0,
        followersCount: provider.followersCount || 0,
        serviceIntro: provider.serviceIntro || '专注现代简约、北欧风格设计，擅长空间规划与色彩搭配。提供从平面布局、效果图设计到软装搭配的全流程服务。',
        priceMin: provider.priceMin || 300,
        priceMax: provider.priceMax || 500,
    };



    // ========== Magazine Style UI ==========
    return (
        <ParallaxScrollLayout
            scrollY={scrollY}
            headerHeight={280}
            renderHeader={() => (
                <ImageBackground
                    source={{ uri: displayData.avatar || 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200' }}
                    style={{ width: '100%', height: '100%', justifyContent: 'flex-end' }}
                >
                    <Svg height="100%" width="100%" style={StyleSheet.absoluteFillObject}>
                        <Defs>
                            <LinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                                <Stop offset="0.3" stopColor="black" stopOpacity="0" />
                                <Stop offset="1" stopColor="black" stopOpacity="0.8" />
                            </LinearGradient>
                        </Defs>
                        <Rect x="0" y="0" width="100%" height="100%" fill="url(#grad)" />
                    </Svg>

                    <View style={styles.heroContent}>
                        <View style={styles.heroInfo}>
                            <View style={[styles.flexRow, { marginBottom: 8 }]}>
                                <Text style={[styles.heroName, { marginBottom: 0 }]}>{displayData.name}</Text>
                                <TouchableOpacity
                                    style={[styles.followBtn, isFollowed && styles.followedBtn]}
                                    onPress={handleFollow}
                                    activeOpacity={0.7}
                                >
                                    <Text style={[styles.followText, isFollowed && styles.followedText]}>
                                        {isFollowed ? '已关注' : '+ 关注'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                            <View style={styles.heroBadgeRow}>
                                <View style={styles.heroBadge}>
                                    <Text style={styles.heroBadgeText}>{displayData.specialty?.replace(/[,，]/g, ' · ')}</Text>
                                </View>
                                <View style={[styles.heroBadge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                                    <Text style={styles.heroBadgeText}>{displayData.yearsExperience}年经验</Text>
                                </View>
                            </View>
                        </View>
                    </View>
                </ImageBackground>
            )}
            renderStickyNav={(navOpacity: any) => (
                <View style={styles.stickyNavContent}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.stickyActionBtn}>
                        <View style={{ width: 24, height: 24, justifyContent: 'center', alignItems: 'center' }}>
                            <ArrowLeft size={24} color="#fff" style={{ position: 'absolute' }} />
                            <Animated.View style={{ opacity: navOpacity }}>
                                <ArrowLeft size={24} color="#111" />
                            </Animated.View>
                        </View>
                    </TouchableOpacity>

                    {/* Title Fades In */}
                    <View style={{ flex: 1, alignItems: 'center', marginHorizontal: 8 }}>
                        <Animated.Text
                            numberOfLines={1}
                            ellipsizeMode="tail"
                            style={{ opacity: navOpacity, fontSize: 16, fontWeight: '600', color: '#111' }}
                        >
                            {displayData.name}
                        </Animated.Text>
                    </View>

                    <View style={styles.headerActions}>
                        <TouchableOpacity style={[styles.stickyActionBtn, { marginLeft: 8 }]} onPress={handleFavorite}>
                            <View style={{ width: 24, height: 24, justifyContent: 'center', alignItems: 'center' }}>
                                <Heart size={20} color={isFavorited ? "#EF4444" : "#fff"} fill={isFavorited ? "#EF4444" : "none"} style={{ position: 'absolute' }} />
                                <Animated.View style={{ opacity: navOpacity }}>
                                    <Heart size={20} color={isFavorited ? "#EF4444" : "#333"} fill={isFavorited ? "#EF4444" : "none"} />
                                </Animated.View>
                            </View>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.stickyActionBtn, { marginLeft: 8 }]} onPress={handleShare}>
                            <View style={{ width: 24, height: 24, justifyContent: 'center', alignItems: 'center' }}>
                                <Share2 size={20} color="#fff" style={{ position: 'absolute' }} />
                                <Animated.View style={{ opacity: navOpacity }}>
                                    <Share2 size={20} color="#333" />
                                </Animated.View>
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>
            )}
            bottomBar={
                <View style={styles.floatBottomBar}>
                    <TouchableOpacity
                        style={styles.floatIconBtn}
                        onPress={() => navigation.navigate('ChatRoom', {
                            conversation: {
                                id: Number(designerId),
                                name: displayData.name,
                                avatar: displayData.avatar,
                                role: 'designer',
                                roleLabel: '设计师',
                                isOnline: true,
                            }
                        })}
                    >
                        <MessageCircle size={22} color="#111" />
                        <Text style={styles.floatIconText}>咨询</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.floatPrimaryBtn}
                        onPress={() => navigation.navigate('Booking', {
                            provider: {
                                id: Number(designerId),
                                name: displayData.name,
                                avatar: displayData.avatar,
                                rating: displayData.rating,
                                yearsExperience: displayData.yearsExperience,
                                specialty: displayData.specialty,
                            },
                            providerType: 'designer'
                        })}
                    >
                        <Text style={styles.floatPrimaryText}>立即预约设计</Text>
                    </TouchableOpacity>
                </View>
            }
        >
            {/* 2. Dashboard Stats (Floating) */}
            <View style={[styles.dashboardCard, { marginTop: -40, alignSelf: 'center', width: '90%' }]}>
                <View style={styles.dashItem}>
                    <Text style={styles.dashValue}>{displayData.rating}</Text>
                    <View style={styles.dashLabelRow}>
                        <Star size={10} color="#F59E0B" fill="#F59E0B" />
                        <Text style={styles.dashLabel}>综合评分</Text>
                    </View>
                </View>
                <View style={styles.dashDivider} />
                <View style={styles.dashItem}>
                    <Text style={styles.dashValue}>{formatFollowers(followersCount)}</Text>
                    <Text style={styles.dashLabel}>粉丝关注</Text>
                </View>
                <View style={styles.dashDivider} />
                <View style={styles.dashItem}>
                    <Text style={styles.dashValue}>{displayData.completedCnt}</Text>
                    <Text style={styles.dashLabel}>完成案例</Text>
                </View>
            </View>

            {/* Service Area Section */}
            <View style={styles.magazineSection}>
                <Text style={styles.magSectionTitle}>服务区域</Text>
                <View style={styles.tagsContainer}>
                    {(provider.serviceArea ? JSON.parse(provider.serviceArea) : ['雁塔区', '曲江新区', '高新区']).map((area: string, idx: number) => (
                        <View key={idx} style={styles.tag}>
                            <Text style={styles.tagText}>{area}</Text>
                        </View>
                    ))}
                </View>
            </View>

            {/* 4. Service Intro */}
            <View style={styles.magazineSection}>
                <Text style={styles.magSectionTitle}>设计理念</Text>

                <Text style={styles.magDescText} numberOfLines={isIntroExpanded ? undefined : 3}>
                    {displayData.serviceIntro}
                </Text>
                {displayData.serviceIntro && displayData.serviceIntro.length > 60 && (
                    <TouchableOpacity
                        onPress={() => setIsIntroExpanded(!isIntroExpanded)}
                        style={{ marginTop: 4, alignSelf: 'flex-end' }}
                    >
                        <Text style={{ color: '#6B7280', fontSize: 13 }}>
                            {isIntroExpanded ? '收起' : '展开'}
                        </Text>
                    </TouchableOpacity>
                )}

                <View style={styles.priceTagRow}>
                    <Text style={styles.priceTagLabel}>设计费</Text>
                    <Text style={styles.priceTagValue}>¥{displayData.priceMin}-{displayData.priceMax}/m²</Text>
                </View>
            </View>

            {/* 4. Portfolio Showcase */}
            <View style={styles.magazineSection}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.magSectionTitle}>精选作品</Text>
                    <TouchableOpacity
                        onPress={() => navigation.navigate('CaseGallery', { providerId: designerId, providerName: displayData.name, providerType: 'designer' })}
                    >
                        <Text style={styles.moreLink}>全部作品</Text>
                    </TouchableOpacity>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.magPortfolioList}>
                    {cases.length > 0 ? cases.slice(0, 5).map((caseItem: any, idx: number) => (
                        <TouchableOpacity
                            key={caseItem.id || idx}
                            style={styles.magCaseCard}
                            activeOpacity={0.9}
                            onPress={() => navigation.navigate('CaseDetail', {
                                caseItem: {
                                    id: caseItem.id,
                                    title: caseItem.title,
                                    coverImage: caseItem.coverImage,
                                    style: caseItem.style,
                                    area: caseItem.area,
                                    year: caseItem.year,
                                    description: caseItem.description,
                                    images: caseItem.images ? JSON.parse(caseItem.images) : [caseItem.coverImage],
                                },
                                providerName: displayData.name,
                                providerType: 'designer'
                            })}
                        >
                            <Image source={{ uri: caseItem.coverImage }} style={styles.magCaseImg} />
                            <View style={styles.magCaseOverlay}>
                                <Text style={styles.magCaseTitle} numberOfLines={1}>{caseItem.title}</Text>
                                <Text style={styles.magCaseMeta}>{caseItem.style} · {caseItem.area}</Text>
                            </View>
                        </TouchableOpacity>
                    )) : (
                        <View style={styles.emptyCase}>
                            <Text style={styles.emptyText}>暂无作品展示</Text>
                        </View>
                    )}
                </ScrollView>
            </View>

            {/* 5. Reviews Preview */}
            <View style={[styles.magazineSection, { paddingBottom: 0 }]}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.magSectionTitle}>口碑评价</Text>
                    <TouchableOpacity
                        onPress={() => navigation.navigate('Reviews', { providerId: designerId, providerName: displayData.name, providerType: 'designer' })}
                    >
                        <Text style={styles.moreLink}>全部 {displayData.reviewCount} 条</Text>
                    </TouchableOpacity>
                </View>

                {reviews.length > 0 ? (
                    <View style={styles.magReviewList}>
                        {reviews.slice(0, 2).map((review: any, idx: number) => (
                            <View key={review.id || idx} style={styles.magReviewCard}>
                                <View style={styles.magReviewHeader}>
                                    <Image source={{ uri: review.userAvatar || 'https://via.placeholder.com/32' }} style={styles.magReviewAvatar} />
                                    <Text style={styles.magReviewName}>{review.userName || '匿名用户'}</Text>
                                    <View style={{ flex: 1 }} />
                                    <View style={styles.flexRow}>
                                        <Star size={10} color="#F59E0B" fill="#F59E0B" />
                                        <Text style={styles.miniRating}>{review.rating}</Text>
                                    </View>
                                </View>
                                <Text style={styles.magReviewContent} numberOfLines={2}>{review.content}</Text>
                            </View>
                        ))}
                        <TouchableOpacity
                            style={styles.checkAllReviewsBtn}
                            onPress={() => navigation.navigate('Reviews', { providerId: designerId, providerName: displayData.name, providerType: 'designer' })}
                        >
                            <Text style={styles.checkAllReviewsText}>查看所有评价</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.emptyReview}>
                        <Text style={styles.emptyText}>暂无评价</Text>
                    </View>
                )}
            </View>
        </ParallaxScrollLayout>
    );
};


// ========== Worker Detail Screen ==========
export const WorkerDetailScreen = ({ route, navigation }: any) => {
    const params = route.params || {};
    const workerId = params.id || params.worker?.id;
    const initialWorker = params.worker || { id: workerId, name: '加载中...' };

    const { showToast } = useToast();
    const scrollY = useRef(new Animated.Value(0)).current;

    // API 数据状态
    const [detail, setDetail] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isFollowed, setIsFollowed] = useState(false);
    const [isFavorited, setIsFavorited] = useState(false);
    const [followersCount, setFollowersCount] = useState(0);

    useEffect(() => {
        if (workerId) {
            loadDetail();
            loadUserStatus();
        }
    }, [workerId]);

    const loadDetail = async () => {
        try {
            const res = await providerApi.foremanDetail(workerId);
            if (res.data) {
                setDetail(res.data);
                setFollowersCount(res.data.provider?.followersCount || 0);
            }
        } catch (error) {
            console.log('加载详情失败:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadUserStatus = async () => {
        try {
            const res = await providerApi.getUserStatus(workerId);
            if (res.data) {
                setIsFollowed(res.data.isFollowed);
                setIsFavorited(res.data.isFavorited);
            }
        } catch (error) {
            console.log('加载用户状态失败:', error);
        }
    };

    const handleShare = () => {
        const shareUrl = `${getWebUrl()}/worker/${workerId}`;
        Clipboard.setString(shareUrl);
        showToast({ message: '链接已复制到剪贴板', type: 'success' });
    };

    const handleFollow = async () => {
        try {
            if (isFollowed) {
                await providerApi.unfollow(workerId, 'foreman');
                setFollowersCount(prev => Math.max(0, prev - 1));
            } else {
                await providerApi.follow(workerId, 'foreman');
                setFollowersCount(prev => prev + 1);
            }
            setIsFollowed(!isFollowed);
        } catch (error) {
            showToast({ message: '操作失败，请重试', type: 'error' });
        }
    };

    const handleFavorite = async () => {
        try {
            if (isFavorited) {
                await providerApi.unfavorite(workerId, 'provider');
            } else {
                await providerApi.favorite(workerId, 'provider');
            }
            setIsFavorited(!isFavorited);
        } catch (error) {
            showToast({ message: '操作失败，请重试', type: 'error' });
        }
    };

    // 使用 API 数据或降级使用传入数据
    const provider = detail?.provider || {};
    const user = detail?.user || {};
    const cases = detail?.cases || [];
    const reviews = detail?.reviews || [];

    // 合并数据（API 优先，降级使用传入的 initialWorker）
    const displayData = {
        name: user.nickname || initialWorker.name || '工人',
        avatar: user.avatar || initialWorker.avatar,
        rating: provider.rating || initialWorker.rating || 5.0,
        reviewCount: detail?.reviewCount || provider.reviewCount || initialWorker.reviewCount || 0,
        yearsExperience: provider.yearsExperience || initialWorker.yearsExperience || 0,
        completedOrders: provider.completedCnt || initialWorker.completedOrders || 0,
        workTypeLabels: translateWorkType(provider.workTypes || initialWorker.workTypeLabels || '水电工'),
        tags: initialWorker.tags || ['准时守信', '技术过硬', '收费透明'],
        serviceIntro: provider.serviceIntro || `专注${initialWorker.workTypeLabels || '施工'}服务${initialWorker.yearsExperience || 5}年，经验丰富，做工细致。`,
        priceMin: provider.priceMin || initialWorker.priceRange?.split('-')[0] || 200,
        priceMax: provider.priceMax || initialWorker.priceRange?.split('-')[1] || 400,
        priceUnit: provider.priceUnit || initialWorker.priceUnit || '/m²',
    };

    // 案例图片（优先使用API数据）
    const caseImages = cases.length > 0
        ? cases.map((c: any) => c.coverImage)
        : [
            'https://images.unsplash.com/photo-1484154218962-a1c002085aac?w=400',
            'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400',
            'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400',
        ];






    // ========== Magazine Style UI for Worker ==========
    return (
        <ParallaxScrollLayout
            scrollY={scrollY}
            headerHeight={280}
            renderHeader={() => (
                <ImageBackground
                    source={{ uri: displayData.avatar || 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=1200' }}
                    style={{ width: '100%', height: '100%', justifyContent: 'flex-end' }}
                >
                    <Svg height="100%" width="100%" style={StyleSheet.absoluteFillObject}>
                        <Defs>
                            <LinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                                <Stop offset="0.3" stopColor="black" stopOpacity="0" />
                                <Stop offset="1" stopColor="black" stopOpacity="0.8" />
                            </LinearGradient>
                        </Defs>
                        <Rect x="0" y="0" width="100%" height="100%" fill="url(#grad)" />
                    </Svg>
                    <View style={styles.heroContent}>
                        <View style={styles.heroInfo}>
                            <View style={[styles.flexRow, { marginBottom: 8 }]}>
                                <Text style={[styles.heroName, { marginBottom: 0 }]}>{displayData.name}</Text>
                                <TouchableOpacity
                                    style={[styles.followBtn, isFollowed && styles.followedBtn]}
                                    onPress={handleFollow}
                                    activeOpacity={0.7}
                                >
                                    <Text style={[styles.followText, isFollowed && styles.followedText]}>
                                        {isFollowed ? '已关注' : '+ 关注'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                            <View style={styles.heroBadgeRow}>
                                <View style={[styles.heroBadge, { backgroundColor: '#EAB308' }]}>
                                    <Text style={[styles.heroBadgeText, { color: '#fff', fontWeight: 'bold' }]}>{displayData.workTypeLabels}</Text>
                                </View>
                                <View style={[styles.heroBadge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                                    <Text style={styles.heroBadgeText}>{displayData.yearsExperience}年经验</Text>
                                </View>
                            </View>
                        </View>
                    </View>
                </ImageBackground>
            )}
            renderStickyNav={(navOpacity: any) => (
                <View style={styles.stickyNavContent}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.stickyActionBtn}>
                        <View style={{ width: 24, height: 24, justifyContent: 'center', alignItems: 'center' }}>
                            <ArrowLeft size={24} color="#fff" style={{ position: 'absolute' }} />
                            <Animated.View style={{ opacity: navOpacity }}>
                                <ArrowLeft size={24} color="#111" />
                            </Animated.View>
                        </View>
                    </TouchableOpacity>

                    {/* Title */}
                    <View style={{ flex: 1, alignItems: 'center', marginHorizontal: 8 }}>
                        <Animated.Text
                            numberOfLines={1}
                            ellipsizeMode="tail"
                            style={{ opacity: navOpacity, fontSize: 16, fontWeight: '600', color: '#111' }}
                        >
                            {displayData.name}
                        </Animated.Text>
                    </View>

                    <View style={styles.headerActions}>
                        <TouchableOpacity style={[styles.stickyActionBtn, { marginLeft: 8 }]} onPress={handleFavorite}>
                            <View style={{ width: 24, height: 24, justifyContent: 'center', alignItems: 'center' }}>
                                <Heart size={20} color={isFavorited ? "#EF4444" : "#fff"} fill={isFavorited ? "#EF4444" : "none"} style={{ position: 'absolute' }} />
                                <Animated.View style={{ opacity: navOpacity }}>
                                    <Heart size={20} color={isFavorited ? "#EF4444" : "#333"} fill={isFavorited ? "#EF4444" : "none"} />
                                </Animated.View>
                            </View>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.stickyActionBtn, { marginLeft: 8 }]} onPress={handleShare}>
                            <View style={{ width: 24, height: 24, justifyContent: 'center', alignItems: 'center' }}>
                                <Share2 size={20} color="#fff" style={{ position: 'absolute' }} />
                                <Animated.View style={{ opacity: navOpacity }}>
                                    <Share2 size={20} color="#333" />
                                </Animated.View>
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>
            )}
            bottomBar={
                <View style={styles.floatBottomBar}>
                    <TouchableOpacity
                        style={styles.floatIconBtn}
                        onPress={() => navigation.navigate('ChatRoom', {
                            conversation: {
                                id: Number(workerId),
                                name: initialWorker.name,
                                avatar: initialWorker.avatar,
                                role: 'worker',
                                roleLabel: '工人',
                                isOnline: true,
                            }
                        })}
                    >
                        <MessageCircle size={22} color="#111" />
                        <Text style={styles.floatIconText}>咨询</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.floatPrimaryBtn}
                        onPress={() => navigation.navigate('Booking', {
                            provider: {
                                id: Number(workerId),
                                name: displayData.name,
                                avatar: displayData.avatar,
                                rating: displayData.rating,
                                yearsExperience: displayData.yearsExperience,
                                specialty: displayData.workTypeLabels, // Workers use workTypeLabels as specialty
                            },
                            providerType: 'worker'
                        })}
                    >
                        <Text style={styles.floatPrimaryText}>立即预约施工</Text>
                    </TouchableOpacity>
                </View>
            }
        >
            {/* Dashboard Stats */}
            <View style={[styles.dashboardCard, { marginTop: -40, alignSelf: 'center', width: '90%' }]}>
                <View style={styles.dashItem}>
                    <Text style={styles.dashValue}>{displayData.rating}</Text>
                    <View style={styles.dashLabelRow}>
                        <Star size={10} color="#F59E0B" fill="#F59E0B" />
                        <Text style={styles.dashLabel}>综合评分</Text>
                    </View>
                </View>
                <View style={styles.dashDivider} />
                <View style={styles.dashItem}>
                    <Text style={styles.dashValue}>{formatFollowers(followersCount)}</Text>
                    <Text style={styles.dashLabel}>粉丝关注</Text>
                </View>
                <View style={styles.dashDivider} />
                <View style={styles.dashItem}>
                    <Text style={styles.dashValue}>{displayData.completedOrders}</Text>
                    <Text style={styles.dashLabel}>完成案例</Text>
                </View>
            </View>

            {/* Service Area */}
            <View style={styles.magazineSection}>
                <Text style={styles.magSectionTitle}>服务区域</Text>
                <View style={styles.tagsContainer}>
                    {(provider.serviceArea ? JSON.parse(provider.serviceArea) : ['雁塔区', '曲江新区', '高新区']).map((area: string, idx: number) => (
                        <View key={idx} style={styles.tag}>
                            <Text style={styles.tagText}>{area}</Text>
                        </View>
                    ))}
                </View>
            </View>

            {/* Service Intro */}
            <View style={styles.magazineSection}>
                <Text style={styles.magSectionTitle}>服务介绍</Text>
                <Text style={styles.magDescText}>
                    {displayData.serviceIntro}
                </Text>
                <View style={styles.tagsContainer}>
                    {displayData.tags && displayData.tags.map((tag: string, idx: number) => (
                        <View key={idx} style={styles.tag}>
                            <Text style={styles.tagText}>{tag}</Text>
                        </View>
                    ))}
                </View>

                <View style={styles.priceTagRow}>
                    <Text style={styles.priceTagLabel}>施工费</Text>
                    <Text style={styles.priceTagValue}>¥{displayData.priceMin}-{displayData.priceMax}{displayData.priceUnit?.replace('平米', 'm²') || '/m²'}</Text>
                </View>
            </View>

            {/* Portfolio Showcase */}
            <View style={styles.magazineSection}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.magSectionTitle}>施工案例</Text>
                    <TouchableOpacity
                        onPress={() => navigation.navigate('CaseGallery', { providerId: Number(workerId), providerName: displayData.name, providerType: 'foreman' })}
                    >
                        <Text style={styles.moreLink}>全部案例</Text>
                    </TouchableOpacity>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.magPortfolioList}>
                    {cases.length > 0 ? cases.slice(0, 5).map((caseItem: any, idx: number) => (
                        <TouchableOpacity
                            key={caseItem.id || idx}
                            style={styles.magCaseCard}
                            activeOpacity={0.9}
                            onPress={() => navigation.navigate('CaseDetail', {
                                caseItem: {
                                    id: caseItem.id,
                                    title: caseItem.title,
                                    coverImage: caseItem.coverImage,
                                    style: caseItem.style,
                                    area: caseItem.area,
                                    year: caseItem.year,
                                    description: caseItem.description,
                                    images: caseItem.images ? JSON.parse(caseItem.images) : [caseItem.coverImage],
                                    height: 200
                                },
                                providerName: displayData.name,
                                providerType: 'foreman'
                            })}
                        >
                            <Image source={{ uri: caseItem.coverImage }} style={styles.magCaseImg} />
                            <View style={styles.magCaseOverlay}>
                                <Text style={styles.magCaseTitle} numberOfLines={1}>{caseItem.title}</Text>
                                <Text style={styles.magCaseMeta}>{caseItem.year} · {caseItem.style || '完工'}</Text>
                            </View>
                        </TouchableOpacity>
                    )) : (
                        <View style={styles.emptyCase}>
                            <Text style={styles.emptyText}>暂无案例</Text>
                        </View>
                    )}
                </ScrollView>
            </View>

            {/* Reviews Preview */}
            <View style={[styles.magazineSection, { paddingBottom: 0 }]}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.magSectionTitle}>用户口碑</Text>
                    <TouchableOpacity
                        onPress={() => navigation.navigate('Reviews', { providerId: Number(workerId), providerName: displayData.name, providerType: 'foreman' })}
                    >
                        <Text style={styles.moreLink}>全部 {displayData.reviewCount} 条</Text>
                    </TouchableOpacity>
                </View>

                {reviews.length > 0 ? (
                    <View style={styles.magReviewList}>
                        {reviews.slice(0, 2).map((review: any, idx: number) => (
                            <View key={review.id || idx} style={styles.magReviewCard}>
                                <View style={styles.magReviewHeader}>
                                    <Image source={{ uri: review.userAvatar || 'https://via.placeholder.com/32' }} style={styles.magReviewAvatar} />
                                    <Text style={styles.magReviewName}>{review.userName || '匿名用户'}</Text>
                                    <View style={{ flex: 1 }} />
                                    <View style={styles.flexRow}>
                                        <Star size={10} color="#F59E0B" fill="#F59E0B" />
                                        <Text style={styles.miniRating}>{review.rating}</Text>
                                    </View>
                                </View>
                                <Text style={styles.magReviewContent} numberOfLines={2}>{review.content}</Text>
                            </View>
                        ))}
                        <TouchableOpacity
                            style={styles.checkAllReviewsBtn}
                            onPress={() => navigation.navigate('Reviews', { providerId: Number(workerId), providerName: displayData.name, providerType: 'foreman' })}
                        >
                            <Text style={styles.checkAllReviewsText}>查看所有评价</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.emptyReview}>
                        <Text style={styles.emptyText}>暂无评价</Text>
                    </View>
                )}
            </View>
        </ParallaxScrollLayout>
    );
};


// ========== Company Detail Screen ==========
export const CompanyDetailScreen = ({ route, navigation }: any) => {
    const params = route.params || {};
    const companyId = params.id || params.company?.id;
    const initialCompany = params.company || { id: companyId, name: '加载中...' };

    const { showToast } = useToast();
    const scrollY = useRef(new Animated.Value(0)).current;

    // API 数据状态
    const [detail, setDetail] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isFollowed, setIsFollowed] = useState(false);
    const [isFavorited, setIsFavorited] = useState(false);
    const [followersCount, setFollowersCount] = useState(0);

    useEffect(() => {
        if (companyId) {
            loadDetail();
            loadUserStatus();
        }
    }, [companyId]);

    const loadDetail = async () => {
        try {
            const res = await providerApi.companyDetail(companyId);
            if (res.data) {
                setDetail(res.data);
                setFollowersCount(res.data.provider?.followersCount || 0);
            }
        } catch (error) {
            console.log('加载详情失败:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadUserStatus = async () => {
        try {
            const res = await providerApi.getUserStatus(companyId);
            if (res.data) {
                setIsFollowed(res.data.isFollowed);
                setIsFavorited(res.data.isFavorited);
            }
        } catch (error) {
            console.log('加载用户状态失败:', error);
        }
    };

    const handleShare = () => {
        const shareUrl = `${getWebUrl()}/company/${companyId}`;
        Clipboard.setString(shareUrl);
        showToast({ message: '链接已复制到剪贴板', type: 'success' });
    };

    const handleFollow = async () => {
        try {
            if (isFollowed) {
                await providerApi.unfollow(companyId, 'company');
                setFollowersCount(prev => Math.max(0, prev - 1));
            } else {
                await providerApi.follow(companyId, 'company');
                setFollowersCount(prev => prev + 1);
            }
            setIsFollowed(!isFollowed);
        } catch (error) {
            showToast({ message: '操作失败，请重试', type: 'error' });
        }
    };

    const handleFavorite = async () => {
        try {
            if (isFavorited) {
                await providerApi.unfavorite(companyId, 'provider');
            } else {
                await providerApi.favorite(companyId, 'provider');
            }
            setIsFavorited(!isFavorited);
        } catch (error) {
            showToast({ message: '操作失败，请重试', type: 'error' });
        }
    };

    // 使用 API 数据或降级使用传入数据
    const provider = detail?.provider || {};
    const user = detail?.user || {};
    const cases = detail?.cases || [];
    const reviews = detail?.reviews || [];

    // 合并数据（API 优先，降级使用传入的 initialCompany）
    const displayData = {
        name: provider.companyName || initialCompany.name || '装修公司',
        logo: user.avatar || initialCompany.logo,
        rating: provider.rating || initialCompany.rating || 5.0,
        reviewCount: detail?.reviewCount || provider.reviewCount || initialCompany.reviewCount || 0,
        completedOrders: provider.completedCnt || initialCompany.completedOrders || 0,
        teamSize: provider.teamSize || initialCompany.teamSize || 20,
        establishedYear: provider.establishedYear || initialCompany.establishedYear || 2015,
        workTypeLabels: translateWorkType(provider.workTypes || initialCompany.workTypeLabels || '全包'),
        certifications: initialCompany.certifications || ['建筑装饰资质', '设计甲级资质'],
        serviceIntro: provider.serviceIntro || `${initialCompany.name || '本公司'}成立于${initialCompany.establishedYear || 2015}年，提供专业的装修设计与施工服务。`,
        priceMin: provider.priceMin || 800,
        priceMax: provider.priceMax || 1500,
        priceUnit: provider.priceUnit || '/m²',
    };

    // 案例图片（优先使用API数据）
    const caseImages = cases.length > 0
        ? cases.map((c: any) => c.coverImage)
        : [
            'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=400',
            'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400',
            'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=400',
        ];




    // ========== Magazine Style UI for Company ==========
    return (
        <ParallaxScrollLayout
            scrollY={scrollY}
            headerHeight={280}
            renderHeader={() => (
                <ImageBackground
                    source={{ uri: displayData.logo || 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200' }}
                    style={{ width: '100%', height: '100%', justifyContent: 'flex-end' }}
                >
                    <Svg height="100%" width="100%" style={StyleSheet.absoluteFillObject}>
                        <Defs>
                            <LinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                                <Stop offset="0.3" stopColor="black" stopOpacity="0" />
                                <Stop offset="1" stopColor="black" stopOpacity="0.8" />
                            </LinearGradient>
                        </Defs>
                        <Rect x="0" y="0" width="100%" height="100%" fill="url(#grad)" />
                    </Svg>

                    <View style={styles.heroContent}>
                        <View style={styles.heroInfo}>
                            <View style={[styles.flexRow, { marginBottom: 8 }]}>
                                <Text style={[styles.heroName, { marginBottom: 0 }]}>{displayData.name}</Text>
                                <TouchableOpacity
                                    style={[styles.followBtn, isFollowed && styles.followedBtn]}
                                    onPress={handleFollow}
                                    activeOpacity={0.7}
                                >
                                    <Text style={[styles.followText, isFollowed && styles.followedText]}>
                                        {isFollowed ? '已关注' : '+ 关注'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                            <View style={styles.heroBadgeRow}>
                                <View style={styles.heroBadge}>
                                    <Text style={styles.heroBadgeText}>{displayData.establishedYear}年成立</Text>
                                </View>
                                <View style={[styles.heroBadge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                                    <Text style={styles.heroBadgeText}>团队{displayData.teamSize}人</Text>
                                </View>
                            </View>
                        </View>
                    </View>
                </ImageBackground>
            )}
            renderStickyNav={(navOpacity: any) => (
                <View style={styles.stickyNavContent}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.stickyActionBtn}>
                        <View style={{ width: 24, height: 24, justifyContent: 'center', alignItems: 'center' }}>
                            <ArrowLeft size={24} color="#fff" style={{ position: 'absolute' }} />
                            <Animated.View style={{ opacity: navOpacity }}>
                                <ArrowLeft size={24} color="#111" />
                            </Animated.View>
                        </View>
                    </TouchableOpacity>

                    {/* Title */}
                    <View style={{ flex: 1, alignItems: 'center', marginHorizontal: 8 }}>
                        <Animated.Text
                            numberOfLines={1}
                            ellipsizeMode="tail"
                            style={{ opacity: navOpacity, fontSize: 16, fontWeight: '600', color: '#111' }}
                        >
                            {displayData.name}
                        </Animated.Text>
                    </View>

                    <View style={styles.headerActions}>
                        <TouchableOpacity style={[styles.stickyActionBtn, { marginLeft: 8 }]} onPress={handleFavorite}>
                            <View style={{ width: 24, height: 24, justifyContent: 'center', alignItems: 'center' }}>
                                <Heart size={20} color={isFavorited ? "#EF4444" : "#fff"} fill={isFavorited ? "#EF4444" : "none"} style={{ position: 'absolute' }} />
                                <Animated.View style={{ opacity: navOpacity }}>
                                    <Heart size={20} color={isFavorited ? "#EF4444" : "#333"} fill={isFavorited ? "#EF4444" : "none"} />
                                </Animated.View>
                            </View>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.stickyActionBtn, { marginLeft: 8 }]} onPress={handleShare}>
                            <View style={{ width: 24, height: 24, justifyContent: 'center', alignItems: 'center' }}>
                                <Share2 size={20} color="#fff" style={{ position: 'absolute' }} />
                                <Animated.View style={{ opacity: navOpacity }}>
                                    <Share2 size={20} color="#333" />
                                </Animated.View>
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>
            )}
            bottomBar={
                <View style={styles.floatBottomBar}>
                    <TouchableOpacity
                        style={styles.floatIconBtn}
                        onPress={() => navigation.navigate('ChatRoom', {
                            conversation: {
                                id: Number(companyId),
                                name: displayData.name,
                                logo: displayData.logo,
                                role: 'company',
                                roleLabel: '公司',
                                isOnline: true,
                            }
                        })}
                    >
                        <MessageCircle size={22} color="#111" />
                        <Text style={styles.floatIconText}>咨询</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.floatPrimaryBtn}
                        onPress={() => navigation.navigate('Booking', {
                            provider: {
                                id: Number(companyId),
                                name: displayData.name,
                                avatar: displayData.logo,
                                rating: displayData.rating,
                            },
                            providerType: 'company'
                        })}
                    >
                        <Text style={styles.floatPrimaryText}>立即预约</Text>
                    </TouchableOpacity>
                </View>
            }
        >
            {/* 2. Dashboard Stats (Floating) */}
            <View style={[styles.dashboardCard, { marginTop: -40, alignSelf: 'center', width: '90%' }]}>
                <View style={styles.dashItem}>
                    <Text style={styles.dashValue}>{displayData.rating}</Text>
                    <View style={styles.dashLabelRow}>
                        <Star size={10} color="#F59E0B" fill="#F59E0B" />
                        <Text style={styles.dashLabel}>综合评分</Text>
                    </View>
                </View>
                <View style={styles.dashDivider} />
                <View style={styles.dashItem}>
                    <Text style={styles.dashValue}>{displayData.reviewCount}</Text>
                    <Text style={styles.dashLabel}>评价数</Text>
                </View>
                <View style={styles.dashDivider} />
                <View style={styles.dashItem}>
                    <Text style={styles.dashValue}>{displayData.completedOrders}</Text>
                    <Text style={styles.dashLabel}>竣工项目</Text>
                </View>
            </View>

            {/* Service Area */}
            <View style={styles.magazineSection}>
                <Text style={styles.magSectionTitle}>服务区域</Text>
                <View style={styles.tagsContainer}>
                    {(provider.serviceArea ? JSON.parse(provider.serviceArea) : ['雁塔区', '曲江新区', '高新区']).map((area: string, idx: number) => (
                        <View key={idx} style={styles.tag}>
                            <Text style={styles.tagText}>{area}</Text>
                        </View>
                    ))}
                </View>
            </View>

            {/* 3. Service & Certs */}
            <View style={styles.magazineSection}>
                <Text style={styles.magSectionTitle}>公司介绍</Text>
                <Text style={styles.magDescText}>
                    {displayData.serviceIntro}
                </Text>

                <View style={{ height: 16 }} />
                <Text style={[styles.magSectionTitle, { fontSize: 16 }]}>资质认证</Text>
                <View style={styles.certsContainer}>
                    {displayData.certifications?.map((cert: string, idx: number) => (
                        <View key={idx} style={styles.certBadge}>
                            <Award size={14} color="#059669" />
                            <Text style={styles.certText}>{cert}</Text>
                        </View>
                    ))}
                </View>

                <View style={styles.priceTagRow}>
                    <Text style={styles.priceTagLabel}>参考均价</Text>
                    <Text style={styles.priceTagValue}>¥{displayData.priceMin}-{displayData.priceMax}{displayData.priceUnit?.replace('平米', 'm²')}</Text>
                </View>
            </View>

            {/* 4. Portfolio Showcase */}
            <View style={styles.magazineSection}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.magSectionTitle}>工程案例</Text>
                    <TouchableOpacity
                        onPress={() => navigation.navigate('CaseGallery', { providerId: Number(companyId), providerName: displayData.name, providerType: 'company' })}
                    >
                        <Text style={styles.moreLink}>全部案例</Text>
                    </TouchableOpacity>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.magPortfolioList}>
                    {cases.length > 0 ? cases.slice(0, 5).map((caseItem: any, idx: number) => (
                        <TouchableOpacity
                            key={caseItem.id || idx}
                            style={styles.magCaseCard}
                            activeOpacity={0.9}
                            onPress={() => navigation.navigate('CaseDetail', {
                                caseItem: {
                                    id: caseItem.id,
                                    title: caseItem.title,
                                    coverImage: caseItem.coverImage,
                                    style: caseItem.style,
                                    area: caseItem.area,
                                    year: caseItem.year,
                                    description: caseItem.description,
                                    images: caseItem.images ? JSON.parse(caseItem.images) : [caseItem.coverImage],
                                    height: 200
                                },
                                providerName: displayData.name,
                                providerType: 'company'
                            })}
                        >
                            <Image source={{ uri: caseItem.coverImage }} style={styles.magCaseImg} />
                            <View style={styles.magCaseOverlay}>
                                <Text style={styles.magCaseTitle} numberOfLines={1}>{caseItem.title}</Text>
                                <Text style={styles.magCaseMeta}>{caseItem.year} · {caseItem.style || '完工'}</Text>
                            </View>
                        </TouchableOpacity>
                    )) : (
                        <View style={styles.emptyCase}>
                            <Text style={styles.emptyText}>暂无案例</Text>
                        </View>
                    )}
                </ScrollView>
            </View>

            {/* 5. Reviews Preview */}
            <View style={[styles.magazineSection, { paddingBottom: 0 }]}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.magSectionTitle}>客户评价</Text>
                    <TouchableOpacity
                        onPress={() => navigation.navigate('Reviews', { providerId: Number(companyId), providerName: displayData.name, providerType: 'company' })}
                    >
                        <Text style={styles.moreLink}>全部 {displayData.reviewCount} 条</Text>
                    </TouchableOpacity>
                </View>

                {reviews.length > 0 ? (
                    <View style={styles.magReviewList}>
                        {reviews.slice(0, 2).map((review: any, idx: number) => (
                            <View key={review.id || idx} style={styles.magReviewCard}>
                                <View style={styles.magReviewHeader}>
                                    <Image source={{ uri: review.userAvatar || 'https://via.placeholder.com/32' }} style={styles.magReviewAvatar} />
                                    <Text style={styles.magReviewName}>{review.userName || '匿名用户'}</Text>
                                    <View style={{ flex: 1 }} />
                                    <View style={styles.flexRow}>
                                        <Star size={10} color="#F59E0B" fill="#F59E0B" />
                                        <Text style={styles.miniRating}>{review.rating}</Text>
                                    </View>
                                </View>
                                <Text style={styles.magReviewContent} numberOfLines={2}>{review.content}</Text>
                            </View>
                        ))}
                        <TouchableOpacity
                            style={styles.checkAllReviewsBtn}
                            onPress={() => navigation.navigate('Reviews', { providerId: Number(companyId), providerName: displayData.name, providerType: 'company' })}
                        >
                            <Text style={styles.checkAllReviewsText}>查看所有评价</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.emptyReview}>
                        <Text style={styles.emptyText}>暂无评价</Text>
                    </View>
                )}
            </View>
        </ParallaxScrollLayout>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    // Common
    content: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    flexRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },

    // ========== Magazine Theme Styles ==========
    heroHeader: {
        width: '100%',
        height: 380,
        justifyContent: 'flex-end',
    },
    heroOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.3)',
        // gradient would be better, but generic view is fine
    },
    heroNav: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
        zIndex: 10,
    },
    heroBackBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: 20,
    },
    heroActions: {
        flexDirection: 'row',
    },
    heroActionBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: 20,
        marginLeft: 12,
    },
    heroContent: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: 20,
        paddingBottom: 60, // Leave room for floating card
    },
    heroAvatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 2,
        borderColor: '#fff',
        marginRight: 16,
    },
    heroInfo: {
        flex: 1,
        marginLeft: 16,
        marginBottom: 8,
    },
    heroName: {
        fontSize: 26,
        fontWeight: 'bold',
        color: '#fff',
        // marginBottom: 8,
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },
    followBtn: {
        marginLeft: 12,
        paddingHorizontal: 14,
        paddingVertical: 6,
        backgroundColor: '#111',
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    followedBtn: {
        backgroundColor: '#E5E7EB',
    },
    followText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#fff',
    },
    followedText: {
        color: '#374151',
    },
    heroBadgeRow: {
        flexDirection: 'row',
    },
    heroBadge: {
        backgroundColor: '#D4AF37', // Gold
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 4,
        marginRight: 8,
    },
    heroBadgeText: {
        fontSize: 12,
        color: '#fff',
        fontWeight: '600',
    },

    // Floating Dashboard
    dashboardCard: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        marginHorizontal: 16,
        marginTop: -40, // Overlap Hero
        borderRadius: 16,
        paddingVertical: 20,
        paddingHorizontal: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 5,
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    dashItem: {
        flex: 1,
        alignItems: 'center',
    },
    dashValue: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1F2937',
        marginBottom: 4,
    },
    dashLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    dashLabel: {
        fontSize: 12,
        color: '#6B7280',
        marginLeft: 4,
    },
    dashDivider: {
        width: 1,
        height: 24,
        backgroundColor: '#F3F4F6',
    },

    // Magazine Content Sections
    magazineSection: {
        marginTop: 24,
        paddingHorizontal: 20,
    },
    magSectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#111',
        marginBottom: 12,
        letterSpacing: 0.5,
    },
    magDescText: {
        fontSize: 15,
        color: '#4B5563',
        lineHeight: 24,
    },
    priceTagRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        backgroundColor: '#FFFBEB',
        alignSelf: 'flex-start',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    priceTagLabel: {
        fontSize: 12,
        color: '#B45309',
        marginRight: 6,
    },
    priceTagValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#B45309',
    },

    // Portfolio
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    moreLink: {
        fontSize: 14,
        color: '#9CA3AF',
    },
    magPortfolioList: {
        // paddingRight: 20,
    },
    magCaseCard: {
        width: 220,
        height: 160,
        marginRight: 16,
        borderRadius: 12,
        overflow: 'hidden',
    },
    magCaseImg: {
        width: '100%',
        height: '100%',
        backgroundColor: '#E5E7EB',
    },
    magCaseOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 12,
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    magCaseTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 2,
    },
    magCaseMeta: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.8)',
    },
    emptyCase: {
        width: '100%',
        padding: 24,
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
    },

    // Reviews
    magReviewList: {
        marginTop: 4,
    },
    magReviewCard: {
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#F3F4F6',
    },
    magReviewHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    magReviewAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        marginRight: 10,
        backgroundColor: '#F3F4F6',
    },
    magReviewName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
    },
    miniRating: {
        fontSize: 12,
        color: '#F59E0B',
        marginLeft: 4,
        fontWeight: '600',
    },
    magReviewContent: {
        fontSize: 14,
        color: '#4B5563',
        lineHeight: 20,
    },
    checkAllReviewsBtn: {
        marginTop: 8,
        paddingVertical: 12,
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        alignItems: 'center',
    },
    checkAllReviewsText: {
        fontSize: 14,
        color: '#6B7280',
        fontWeight: '500',
    },
    emptyReview: {
        padding: 20,
        alignItems: 'center',
    },
    emptyText: {
        color: '#9CA3AF',
    },

    // Floating Bottom Bar
    floatBottomContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 20,
        paddingBottom: Platform.OS === 'ios' ? 24 : 20,
        backgroundColor: 'transparent',
    },
    floatBottomBar: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        borderRadius: 32,
        padding: 6,
        paddingHorizontal: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
    },
    floatIconBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 24,
    },
    floatIconText: {
        marginLeft: 6,
        fontSize: 15,
        fontWeight: '600',
        color: '#1F2937',
    },
    floatPrimaryBtn: {
        flex: 1,
        backgroundColor: '#111',
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
        paddingVertical: 12,
    },
    floatPrimaryText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
    },

    // Legacy Styles for Worker/Company (Compatibility)
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'ios' ? 12 : 44,
        paddingBottom: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    headerTitle: { fontSize: 17, fontWeight: '600', color: '#111' },
    backBtn: { padding: 4 },
    shareBtn: { padding: 4 },
    profileSection: { flexDirection: 'row', padding: 20 },
    avatar: { width: 80, height: 80, borderRadius: 8, marginRight: 16 },
    profileInfo: { flex: 1, justifyContent: 'center' },
    name: { fontSize: 20, fontWeight: 'bold', color: '#111', marginBottom: 6 },
    ratingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    ratingText: { fontSize: 14, fontWeight: 'bold', color: '#F59E0B', marginHorizontal: 4 },
    reviewCount: { fontSize: 12, color: '#9CA3AF' },
    metaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    metaText: { fontSize: 13, color: '#6B7280' },
    metaDivider: { marginHorizontal: 8, color: '#D1D5DB' },
    orgRow: { flexDirection: 'row', alignItems: 'center' },
    orgBadge: { backgroundColor: '#F3F4F6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginRight: 8 },
    orgBadgeText: { fontSize: 11, color: '#6B7280' },
    orgName: { fontSize: 13, color: '#4B5563' },
    statsSection: { flexDirection: 'row', padding: 20, borderTopWidth: 8, borderTopColor: '#F3F4F6', borderBottomWidth: 8, borderBottomColor: '#F3F4F6', backgroundColor: '#fff' },
    statItem: { flex: 1, alignItems: 'center' },
    statValue: { fontSize: 18, fontWeight: 'bold', color: '#111', marginBottom: 4 },
    statLabel: { fontSize: 12, color: '#6B7280' },
    statDivider: { width: 1, height: 30, backgroundColor: '#F3F4F6' },
    section: { padding: 20, borderBottomWidth: 8, borderBottomColor: '#F3F4F6', backgroundColor: '#fff' },
    sectionTitle: { fontSize: 18, fontWeight: '600', color: '#111', marginBottom: 16 },
    companyPrice: { fontSize: 24, fontWeight: 'bold', color: '#EF4444', marginTop: 8 },
    moreBtn: { flexDirection: 'row', alignItems: 'center' },
    moreText: { fontSize: 13, color: '#9CA3AF' },

    // ... Additional legacy styles ... 
    workTypeBadges: { flexDirection: 'row', flexWrap: 'wrap' },
    workTypeBadge: { backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    workTypeBadgeText: { fontSize: 11, color: '#D97706' },
    priceSection: {
        padding: 20,
        borderBottomWidth: 8,
        borderBottomColor: '#F3F4F6',
    },
    priceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    priceLabel: {
        fontSize: 14,
        color: '#6B7280',
    },
    priceValue: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#EF4444',
    },
    priceUnit: {
        fontSize: 13,
        fontWeight: 'normal',
        color: '#9CA3AF',
    },
    bottomBar: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, paddingBottom: 24, borderTopWidth: 1, borderTopColor: '#F3F4F6', backgroundColor: '#fff' },
    consultBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff', paddingVertical: 10, borderRadius: 8, marginRight: 12, borderWidth: 1, borderColor: '#E5E7EB' },
    consultBtnText: { color: '#111', fontSize: 14, fontWeight: '600', marginLeft: 6 },
    bookBtn: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#111', paddingVertical: 10, borderRadius: 8 },
    bookBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
    portfolioScroll: { marginTop: 12 },
    portfolioImage: { width: 140, height: 100, borderRadius: 8, marginRight: 12, backgroundColor: '#E5E7EB' },
    descText: { fontSize: 14, color: '#4B5563', lineHeight: 22, marginTop: 12, },
    reviewCard: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 16, marginTop: 12 },
    reviewHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    reviewAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#E5E7EB', marginRight: 12 },
    reviewUser: { fontSize: 14, fontWeight: '600', color: '#111' },
    reviewStars: { flexDirection: 'row', marginTop: 2 },
    reviewDate: { marginLeft: 'auto', fontSize: 12, color: '#9CA3AF' },
    reviewText: { fontSize: 14, color: '#4B5563', lineHeight: 20 },
    // Company specific
    companyHeaderSection: {
        alignItems: 'center',
        padding: 24,
        borderBottomWidth: 8,
        borderBottomColor: '#F3F4F6',
    },
    companyLogo: {
        width: 80,
        height: 80,
        borderRadius: 12,
        backgroundColor: '#E5E7EB',
        marginBottom: 16,
    },
    companyName: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#111',
        marginBottom: 8,
    },
    companyEstablished: {
        fontSize: 13,
        color: '#9CA3AF',
        marginTop: 8,
    },
    certsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 12,
    },
    certBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 6,
        marginRight: 8,
        marginBottom: 8,
    },
    certText: {
        fontSize: 12,
        color: '#059669',
        marginLeft: 4,
    },
    // Header actions for Worker/Company screens
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerActionBtn: {
        padding: 8,
        marginLeft: 8,
    },
    // Tags
    tagsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 12,
    },
    tag: {
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 6,
        marginRight: 8,
        marginBottom: 8,
    },
    tagText: {
        fontSize: 12,
        color: '#4B5563',
    },
    profileFollowBtn: {
        backgroundColor: '#111',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        marginLeft: 12,
    },
    profileFollowedText: {
        color: '#6B7280',
    },
    // ===========================
    // Parallax Header Styles
    // ===========================
    parallaxContainer: {
        flex: 1,
        backgroundColor: '#fff',
    },
    parallaxHeader: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        overflow: 'hidden',
    },
    parallaxContentWrapper: {
        paddingHorizontal: 20,
        position: 'absolute',
        bottom: 30,
        left: 0,
        right: 0,
        zIndex: 2,
    },
    contentCard: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingTop: 24,
        paddingBottom: 100,
        minHeight: 800,
        marginTop: 0,
    },
    stickyNavContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
    },
    stickyNavBg: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#fff',
        borderBottomWidth: 0.5,
        borderBottomColor: '#E5E7EB',
    },
    stickyNavContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingBottom: 10,
        paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 10 : 0,
    },
    stickyActionBtn: {
        padding: 8,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.1)', // backup bg for visibility
    },
});

