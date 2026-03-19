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
import { ArrowLeft, Star, MapPin, MessageCircle, Calendar, Award, Briefcase, Users, Clock, ChevronRight, Heart, Share2, Store } from 'lucide-react-native';
import { useToast } from '../components/Toast';
import { getWebUrl } from '../config';
import { providerApi } from '../services/api';

const { width } = Dimensions.get('window');

// 格式化粉丝数
const formatFollowers = (count: number) => {
    if (count >= 1000) return (count / 1000).toFixed(1) + 'k';
    return count.toString();
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

// ========== Material Shop Detail Screen ==========
export const MaterialShopDetailScreen = ({ route, navigation }: any) => {
    const { shop } = route.params;
    const { showToast } = useToast();
    const scrollY = useRef(new Animated.Value(0)).current;

    // TODO: Connect to real API for shop details
    // For now, use data passed from list
    const [detail, setDetail] = useState<any>(shop);
    const [loading, setLoading] = useState(false);
    const [isFavorited, setIsFavorited] = useState(false);
    // Mock 收藏数
    const [collectCount, setCollectCount] = useState(shop.collectCount || 368);
    const isSettled = shop?.isSettled !== false;

    const handleShare = () => {
        const shareUrl = `${getWebUrl()}/shop/${shop.id}`;
        Clipboard.setString(shareUrl);
        showToast({ message: '链接已复制到剪贴板', type: 'success' });
    };

    const handleFavorite = async () => {
        // Mock API call
        setIsFavorited(!isFavorited);
        setCollectCount((prev: number) => isFavorited ? prev - 1 : prev + 1);
        showToast({ message: isFavorited ? '已取消收藏' : '已收藏', type: 'success' });
    };

    const displayData = {
        name: shop.name,
        coverImage: shop.cover || 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=1200',
        rating: shop.rating || 4.9,
        reviewCount: shop.reviewCount || 128,
        mainProducts: shop.mainProducts || ['瓷砖', '地板', '卫浴'],
        address: shop.address || '西安市雁塔区含光路南段',
        distance: shop.distance || '2.5km',
        tags: shop.tags || ['正品保证', '免费测量', '送货上门'],
        openTime: '09:00 - 21:00',
        phone: '138-1234-5678', // 增加电话展示格式化
        description: '本店主营各类高档瓷砖、木地板，品牌直供，价格优惠。提供免费上门测量、设计铺贴方案等服务。欢迎进店咨询选购。',
        products: [
            { id: 1, name: '马可波罗瓷砖 800x800', price: '68', unit: '片', image: 'https://images.unsplash.com/photo-1620626011761-996317b8d101?w=400' },
            { id: 2, name: '圣象强化复合地板', price: '128', unit: 'm²', image: 'https://images.unsplash.com/photo-1581858726768-7589d36de636?w=400' },
            { id: 3, name: 'TOTO 智能马桶', price: '3299', unit: '套', image: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=400' },
        ]
    };

    return (
        <ParallaxScrollLayout
            scrollY={scrollY}
            headerHeight={280}
            renderHeader={() => (
                <ImageBackground
                    source={{ uri: displayData.coverImage }}
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
                            </View>
                            <View style={styles.heroBadgeRow}>
                                {isSettled ? (
                                    <View style={styles.settledBadge}>
                                        <Text style={styles.settledBadgeText}>已认证</Text>
                                    </View>
                                ) : (
                                    <View style={styles.unsettledBadge}>
                                        <Text style={styles.unsettledBadgeText}>未入驻</Text>
                                    </View>
                                )}
                                <View style={styles.heroBadge}>
                                    <Store size={12} color="#fff" style={{ marginRight: 4 }} />
                                    <Text style={styles.heroBadgeText}>{shop.type === 'brand' ? '品牌直营' : '建材市场'}</Text>
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
            bottomBar={isSettled ? null : (
                <View style={styles.floatBottomBar}>
                    <Text style={styles.unsettledHintText}>该商家信息来源于公开渠道，尚未在本平台入驻。</Text>
                </View>
            )}
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
                    <Text style={styles.dashValue}>{formatFollowers(collectCount)}</Text>
                    <Text style={styles.dashLabel}>收藏数</Text>
                </View>
                <View style={styles.dashDivider} />
                <View style={styles.dashItem}>
                    <Text style={[styles.dashValue, { fontSize: 14, marginTop: 4 }]}>{displayData.openTime}</Text>
                    <Text style={styles.dashLabel}>营业时间</Text>
                </View>
            </View>

            {/* Address & Intro */}
            <View style={styles.magazineSection}>
                <Text style={styles.magSectionTitle}>门店信息</Text>
                <View style={styles.addressRow}>
                    <MapPin size={16} color="#71717A" />
                    <Text style={styles.addressText}>{displayData.address}</Text>
                    <Text style={styles.distanceText}>{displayData.distance}</Text>
                </View>
                {isSettled && (
                <TouchableOpacity style={styles.phoneRow} onPress={() => { Clipboard.setString(displayData.phone); showToast({ message: '电话已复制', type: 'success' }) }}>
                    <View style={styles.phoneIconBox}>
                        <MessageCircle size={14} color="#FFFFFF" />
                    </View>
                    <Text style={styles.phoneText}>联系电话：{displayData.phone}</Text>
                    <View style={styles.copyTag}>
                        <Text style={styles.copyTagText}>复制</Text>
                    </View>
                </TouchableOpacity>
                )}
                <Text style={styles.magDescText}>{displayData.description}</Text>
                <View style={styles.tagsContainer}>
                    {displayData.tags.map((tag: string, idx: number) => (
                        <View key={idx} style={styles.tag}>
                            <Text style={styles.tagText}>{tag}</Text>
                        </View>
                    ))}
                </View>
            </View>

            {/* Main Products */}
            <View style={styles.magazineSection}>
                <Text style={styles.magSectionTitle}>推荐商品</Text>
                <View style={styles.productList}>
                    {displayData.products.map((item, idx) => (
                        <TouchableOpacity key={item.id} style={styles.productCard}>
                            <Image source={{ uri: item.image }} style={styles.productImage} />
                            <View style={styles.productInfo}>
                                <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
                                <Text style={styles.productPrice}>¥{item.price}<Text style={styles.productUnit}>/{item.unit}</Text></Text>
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>
        </ParallaxScrollLayout>
    );
};

const styles = StyleSheet.create({
    parallaxContainer: {
        flex: 1,
        backgroundColor: '#F8F9FA',
    },
    parallaxHeader: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        overflow: 'hidden',
        zIndex: 0,
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
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F4F4F5',
    },
    stickyNavContent: {
        height: 44,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        marginTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },
    stickyActionBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    contentCard: {
        borderTopRightRadius: 24,
        backgroundColor: '#F8F9FA',
        minHeight: 800,
    },
    heroContent: {
        padding: 24,
        paddingBottom: 100,
    },
    heroInfo: {
        marginBottom: 16,
    },
    heroName: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#FFFFFF',
        flex: 1,
        marginRight: 12,
        textShadowColor: 'rgba(0, 0, 0, 0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },
    heroBadgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
    },
    heroBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        marginRight: 8,
    },
    heroBadgeText: {
        fontSize: 12,
        color: '#FFFFFF',
        fontWeight: '500',
    },
    followBtn: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    followedBtn: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.4)',
    },
    followText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#09090B',
    },
    followedText: {
        color: '#FFFFFF',
    },
    flexRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    dashboardCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 4,
        marginBottom: 16,
    },
    dashItem: {
        flex: 1,
        alignItems: 'center',
    },
    dashValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#09090B',
        marginBottom: 4,
    },
    dashLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    dashLabel: {
        fontSize: 11,
        color: '#71717A',
        marginLeft: 2,
    },
    dashDivider: {
        width: 1,
        height: 24,
        backgroundColor: '#F4F4F5',
    },
    magazineSection: {
        backgroundColor: '#FFFFFF',
        marginHorizontal: 16,
        marginBottom: 16,
        borderRadius: 16,
        padding: 20,
    },
    magSectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#09090B',
        marginBottom: 16,
    },
    magDescText: {
        fontSize: 14,
        color: '#52525B',
        lineHeight: 22,
        marginBottom: 16,
    },
    addressRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    addressText: {
        fontSize: 14,
        color: '#09090B',
        marginLeft: 6,
        flex: 1,
    },
    distanceText: {
        fontSize: 12,
        color: '#71717A',
    },
    tagsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    tag: {
        backgroundColor: '#F4F4F5',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        marginRight: 8,
        marginTop: 8,
    },
    tagText: {
        fontSize: 12,
        color: '#52525B',
    },
    productList: {
        marginTop: 8,
    },
    productCard: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        marginBottom: 12,
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#F4F4F5',
    },
    productImage: {
        width: 100,
        height: 100,
    },
    productInfo: {
        flex: 1,
        padding: 12,
        justifyContent: 'space-between',
    },
    productName: {
        fontSize: 14,
        fontWeight: '500',
        color: '#09090B',
    },
    productPrice: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#EF4444',
    },
    productUnit: {
        fontSize: 12,
        color: '#9CA3AF',
        fontWeight: 'normal',
    },
    floatBottomContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#F4F4F5',
        paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    },
    floatBottomBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 12,
    },
    floatIconBtn: {
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 24,
    },
    floatIconText: {
        fontSize: 10,
        color: '#09090B',
        marginTop: 4,
    },
    floatPrimaryBtn: {
        flex: 1,
        height: 44,
        backgroundColor: '#09090B',
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    floatPrimaryText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    // New Styles
    phoneRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F4F4F5',
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
    },
    phoneIconBox: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#09090B',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
    },
    phoneText: {
        fontSize: 14,
        color: '#09090B',
        fontWeight: '500',
        flex: 1,
    },
    copyTag: {
        borderWidth: 1,
        borderColor: '#E4E4E7',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        backgroundColor: '#FFFFFF',
    },
    copyTagText: {
        fontSize: 10,
        color: '#71717A',
    },
    settledBadge: {
        backgroundColor: '#e6f7ee',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        marginRight: 8,
    },
    settledBadgeText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#389e6a',
    },
    unsettledBadge: {
        backgroundColor: '#fff7ed',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        marginRight: 8,
    },
    unsettledBadgeText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#d97706',
    },
    unsettledHintText: {
        fontSize: 13,
        color: '#71717A',
        textAlign: 'center',
        flex: 1,
    },
});
