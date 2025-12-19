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
    StatusBar,
    FlatList,
    Modal,
    Platform,
} from 'react-native';
import { ArrowLeft, Share2, Star, MessageCircle, X } from 'lucide-react-native';

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = (width - 48) / 2;

// Mock case data
const MOCK_CASES = [
    {
        id: 1,
        title: '现代简约三居室改造',
        coverImage: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
        style: '现代简约',
        area: '120㎡',
        year: '2024',
        description: '本案例位于城市中心高档社区，业主是一对年轻夫妇。他们希望打造一个简洁大气、功能完善的现代化住宅。设计师通过开放式布局、明亮的色彩搭配和精选的家具，成功实现了业主的愿望。',
        images: [
            'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
            'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
            'https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
            'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
        ],
        height: 180,
    },
    {
        id: 2,
        title: '北欧风格小户型焕新',
        coverImage: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
        style: '北欧风格',
        area: '85㎡',
        year: '2024',
        description: '这是一套位于老城区的小户型公寓改造项目。通过巧妙的空间规划和北欧风格的设计语言，让原本局促的空间焕发新生。大量使用白色和原木色，营造出清新自然的居住氛围。',
        images: [
            'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
            'https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
        ],
        height: 220,
    },
    {
        id: 3,
        title: '新中式别墅设计',
        coverImage: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
        style: '新中式',
        area: '280㎡',
        year: '2023',
        description: '这套别墅项目融合了传统中式元素与现代设计理念。通过木质格栅、水墨画元素和东方园林的设计手法，打造出既有文化底蕴又不失现代感的居住空间。',
        images: [
            'https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
            'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
            'https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
        ],
        height: 200,
    },
    {
        id: 4,
        title: '轻奢法式公寓',
        coverImage: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
        style: '法式轻奢',
        area: '150㎡',
        year: '2024',
        description: '法式轻奢风格的公寓设计，注重细节与品质。通过精致的石膏线条、优雅的配色和高端软装，打造出浪漫又不失格调的居住环境。',
        images: [
            'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
            'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
        ],
        height: 160,
    },
    {
        id: 5,
        title: '工业风Loft改造',
        coverImage: 'https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
        style: '工业风',
        area: '100㎡',
        year: '2023',
        description: '将老厂房改造成现代化的Loft住宅。保留了原有的裸露管道和砖墙，结合现代化的家具和灯具设计，营造出独特的工业美学氛围。',
        images: [
            'https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
        ],
        height: 190,
    },
    {
        id: 6,
        title: '日式禅意住宅',
        coverImage: 'https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
        style: '日式',
        area: '95㎡',
        year: '2024',
        description: '追求极致简约的日式设计，通过留白、自然材质和柔和光线，创造出宁静致远的禅意空间。',
        images: [
            'https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
            'https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
        ],
        height: 210,
    },
];

// ========== Case Gallery Screen ==========
export const CaseGalleryScreen = ({ route, navigation }: any) => {
    const { providerName, providerType } = route.params || {};

    const renderCaseCard = (caseItem: any) => (
        <TouchableOpacity
            key={caseItem.id}
            style={[styles.caseCard, { height: caseItem.height + 60 }]}
            onPress={() => navigation.navigate('CaseDetail', { caseItem, providerName, providerType })}
        >
            <Image
                source={{ uri: caseItem.coverImage }}
                style={[styles.caseCover, { height: caseItem.height }]}
                resizeMode="cover"
            />
            <View style={styles.caseInfo}>
                <Text style={styles.caseTitle} numberOfLines={1}>{caseItem.title}</Text>
                <Text style={styles.caseStyle}>{caseItem.style}</Text>
            </View>
        </TouchableOpacity>
    );

    const leftColumn = MOCK_CASES.filter((_, i) => i % 2 === 0);
    const rightColumn = MOCK_CASES.filter((_, i) => i % 2 === 1);

    return (
        <SafeAreaView style={styles.container}>
            {/* 全局已在 App.tsx 配置 StatusBar */}

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ArrowLeft size={24} color="#111" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>作品案例</Text>
                <View style={styles.placeholder} />
            </View>

            {/* Gallery Grid */}
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.galleryGrid}>
                    <View style={styles.column}>
                        {leftColumn.map(renderCaseCard)}
                    </View>
                    <View style={styles.column}>
                        {rightColumn.map(renderCaseCard)}
                    </View>
                </View>
                <View style={{ height: 20 }} />
            </ScrollView>
        </SafeAreaView>
    );
};

// ========== Case Detail Screen ==========
export const CaseDetailScreen = ({ route, navigation }: any) => {
    const { caseItem, providerName, providerType } = route.params;
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [showImageViewer, setShowImageViewer] = useState(false);
    const [viewerIndex, setViewerIndex] = useState(0);
    const flatListRef = React.useRef<FlatList>(null);

    const openImageViewer = (index: number) => {
        setViewerIndex(index);
        setShowImageViewer(true);
    };

    const goToImage = (index: number) => {
        if (index >= 0 && index < caseItem.images.length) {
            setViewerIndex(index);
            flatListRef.current?.scrollToIndex({ index, animated: true });
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* 全局已在 App.tsx 配置 StatusBar */}

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ArrowLeft size={24} color="#111" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>案例详情</Text>
                <TouchableOpacity style={styles.shareBtn}>
                    <Share2 size={20} color="#111" />
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Main Image */}
                {/* Main Image Carousel */}
                <View>
                    <ScrollView
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        onMomentumScrollEnd={(event) => {
                            const slideSize = event.nativeEvent.layoutMeasurement.width;
                            const index = Math.floor(event.nativeEvent.contentOffset.x / slideSize);
                            setCurrentImageIndex(index);
                        }}
                    >
                        {caseItem.images.map((img: string, idx: number) => (
                            <TouchableOpacity key={idx} onPress={() => openImageViewer(idx)} activeOpacity={0.9}>
                                <Image
                                    source={{ uri: img }}
                                    style={[styles.mainImage, { width: width }]}
                                    resizeMode="cover"
                                />
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    {/* Image Indicators */}
                    {caseItem.images.length > 1 && (
                        <View style={styles.indicatorsOverlay}>
                            {caseItem.images.map((_: any, idx: number) => (
                                <View
                                    key={idx}
                                    style={[styles.indicator, currentImageIndex === idx && styles.activeIndicator]}
                                />
                            ))}
                        </View>
                    )}
                </View>

                {/* Case Info */}
                <View style={styles.caseInfoSection}>
                    <Text style={styles.caseDetailTitle}>{caseItem.title}</Text>
                    <View style={styles.caseMeta}>
                        <Text style={styles.caseMetaText}>{caseItem.style}</Text>
                        <Text style={styles.caseMetaDivider}>|</Text>
                        <Text style={styles.caseMetaText}>{caseItem.area}</Text>
                        <Text style={styles.caseMetaDivider}>|</Text>
                        <Text style={styles.caseMetaText}>{caseItem.year}年</Text>
                    </View>
                </View>

                {/* Description */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>项目介绍</Text>
                    <Text style={styles.descText}>{caseItem.description}</Text>
                </View>

                {/* More Images */}
                {caseItem.images.length > 1 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>更多图片</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.moreImagesScroll}>
                            {caseItem.images.map((img: string, idx: number) => (
                                <TouchableOpacity key={idx} onPress={() => openImageViewer(idx)}>
                                    <Image source={{ uri: img }} style={styles.moreImage} />
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}



                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Bottom Action Bar */}
            <View style={styles.bottomBar}>
                <TouchableOpacity
                    style={styles.consultBtn}
                    onPress={() => navigation.navigate('ChatRoom', {
                        conversation: {
                            id: caseItem.id,
                            name: caseItem.designer,
                            avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100',
                            role: 'designer',
                            roleLabel: '设计师',
                            isOnline: true,
                        }
                    })}
                >
                    <MessageCircle size={18} color="#111" />
                    <Text style={styles.consultBtnText}>在线咨询</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.bookBtn}>
                    <Text style={styles.bookBtnText}>立即预约</Text>
                </TouchableOpacity>
            </View>

            {/* Image Viewer Modal */}
            <Modal visible={showImageViewer} transparent animationType="fade">
                <View style={styles.imageViewer}>
                    <TouchableOpacity style={styles.closeBtn} onPress={() => setShowImageViewer(false)}>
                        <X size={28} color="#fff" />
                    </TouchableOpacity>
                    <FlatList
                        ref={flatListRef}
                        data={caseItem.images}
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        initialScrollIndex={viewerIndex}
                        getItemLayout={(data, index) => ({
                            length: width,
                            offset: width * index,
                            index,
                        })}
                        onMomentumScrollEnd={(event) => {
                            const index = Math.round(event.nativeEvent.contentOffset.x / width);
                            setViewerIndex(index);
                        }}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={styles.viewerImageContainer}
                                activeOpacity={1}
                                onPress={() => setShowImageViewer(false)}
                            >
                                <Image
                                    source={{ uri: item }}
                                    style={styles.viewerImage}
                                    resizeMode="contain"
                                />
                            </TouchableOpacity>
                        )}
                        keyExtractor={(item, index) => index.toString()}
                    />
                </View>
            </Modal>
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
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'ios' ? 12 : 44, // 适配沉浸式状态栏
        paddingBottom: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    backBtn: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: '#111',
    },
    shareBtn: {
        padding: 4,
    },
    placeholder: {
        width: 28,
    },
    content: {
        flex: 1,
    },
    // Gallery styles
    galleryGrid: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingTop: 16,
    },
    column: {
        flex: 1,
        marginHorizontal: 4,
    },
    caseCard: {
        marginBottom: 16,
        borderRadius: 12,
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
        overflow: 'hidden',
    },
    caseCover: {
        width: '100%',
        backgroundColor: '#E5E7EB',
    },
    caseInfo: {
        padding: 12,
    },
    caseTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111',
        marginBottom: 4,
    },
    caseStyle: {
        fontSize: 12,
        color: '#9CA3AF',
    },
    // Detail styles
    mainImage: {
        width: '100%',
        height: 280,
        backgroundColor: '#E5E7EB',
    },
    indicatorsOverlay: {
        position: 'absolute',
        bottom: 16,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'center',
    },
    indicator: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: 'rgba(255, 255, 255, 0.5)',
        marginHorizontal: 4,
    },
    activeIndicator: {
        backgroundColor: '#fff',
        width: 16,
    },
    caseInfoSection: {
        padding: 20,
        borderBottomWidth: 8,
        borderBottomColor: '#F3F4F6',
    },
    caseDetailTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#111',
        marginBottom: 12,
    },
    caseMeta: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    caseMetaText: {
        fontSize: 14,
        color: '#6B7280',
    },
    caseMetaDivider: {
        marginHorizontal: 12,
        color: '#D1D5DB',
    },
    section: {
        padding: 20,
        borderBottomWidth: 8,
        borderBottomColor: '#F3F4F6',
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#111',
        marginBottom: 12,
    },
    descText: {
        fontSize: 14,
        color: '#4B5563',
        lineHeight: 24,
    },
    moreImagesScroll: {
        marginTop: 4,
    },
    moreImage: {
        width: 120,
        height: 90,
        borderRadius: 8,
        marginRight: 12,
        backgroundColor: '#E5E7EB',
    },
    providerCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 16,
    },
    providerAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#E5E7EB',
        marginRight: 12,
    },
    providerInfo: {
        flex: 1,
    },
    providerName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#111',
        marginBottom: 4,
    },
    providerRating: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    providerRatingText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#111',
        marginLeft: 4,
    },
    providerReviews: {
        fontSize: 12,
        color: '#9CA3AF',
        marginLeft: 4,
    },
    viewProfileBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    viewProfileText: {
        fontSize: 12,
        color: '#6B7280',
    },
    // Bottom Bar
    bottomBar: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 10,
        paddingBottom: 24,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
        backgroundColor: '#fff',
    },
    consultBtn: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
        paddingVertical: 10,
        borderRadius: 8,
        marginRight: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    consultBtnText: {
        color: '#111',
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 6,
    },
    bookBtn: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#111',
        paddingVertical: 10,
        borderRadius: 8,
    },
    bookBtnText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    // Image Viewer
    imageViewer: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.95)',
    },
    closeBtn: {
        position: 'absolute',
        top: 60,
        right: 20,
        zIndex: 10,
        padding: 8,
    },
    viewerImageContainer: {
        width: width,
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    viewerImage: {
        width: width,
        height: width * 0.75,
    },
    viewerIndicator: {
        position: 'absolute',
        bottom: 60,
        alignSelf: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 16,
    },
    viewerCounter: {
        color: '#fff',
        fontSize: 14,
    },
});
