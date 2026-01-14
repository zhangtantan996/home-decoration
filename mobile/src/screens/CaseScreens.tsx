import React, { useCallback, useEffect, useState } from 'react';
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
    ActivityIndicator,
} from 'react-native';
import { ArrowLeft, Share2, X } from 'lucide-react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { caseApi, providerApi } from '../services/api';
import { getWebUrl } from '../config';
import { useToast } from '../components/Toast';

const { width } = Dimensions.get('window');
// Mock case data
const MOCK_CASES = [
    {
        id: 1,
        title: '现代简约三居室改造',
        coverImage: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
        style: '现代简约',
        area: '120㎡',
        houseLayout: '3室2厅2卫',
        year: '2024',
        price: '18.5万',
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
        houseLayout: '2客1厅1卫',
        year: '2024',
        price: '12.8万',
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
        houseLayout: '5客3厅3卫',
        year: '2023',
        price: '45.0万',
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
        houseLayout: '4宨2厅2卫',
        year: '2024',
        price: '28.0万',
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
        houseLayout: '1客1厅1卫',
        year: '2023',
        price: '15.0万',
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
        houseLayout: '2客1厅1卫',
        year: '2024',
        price: '13.5万',
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
    const { providerId, providerName, providerType } = route.params || {};
    const [cases, setCases] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadCases = async () => {
            try {
                const apiType = providerType === 'designer' ? 'designers' :
                    providerType === 'company' ? 'companies' : 'foremen';
                const res = await providerApi.getCases(apiType, providerId);
                if (res.data && res.data.list) {
                    const casesWithHeight = res.data.list.map((c: any, idx: number) => ({
                        ...c,
                        height: 160 + (idx % 3) * 30,
                    }));
                    setCases(casesWithHeight);
                }
            } catch (error) {
                console.log('加载案例失败:', error);
                setCases(MOCK_CASES);
            } finally {
                setLoading(false);
            }
        };

        loadCases();
    }, [providerId, providerType]);

    const renderCaseCard = (caseItem: any) => (
        <TouchableOpacity
            key={caseItem.id}
            style={[styles.caseCard, { height: (caseItem.height || 180) + 60 }]}
            onPress={() => navigation.navigate('CaseDetail', {
                caseId: caseItem.id,
                initialData: {
                    title: caseItem.title,
                    coverImage: caseItem.coverImage,
                    style: caseItem.style,
                    area: caseItem.area,
                    year: caseItem.year,
                },
                providerName,
                providerType
            })}
        >
            <Image
                source={{ uri: caseItem.coverImage }}
                style={[styles.caseCover, { height: caseItem.height || 180 }]}
                resizeMode="cover"
            />
            <View style={styles.caseInfo}>
                <Text style={styles.caseTitle} numberOfLines={1}>{caseItem.title}</Text>
                <Text style={styles.caseStyle}>{caseItem.style}</Text>
            </View>
        </TouchableOpacity>
    );

    const leftColumn = cases.filter((_, i) => i % 2 === 0);
    const rightColumn = cases.filter((_, i) => i % 2 === 1);

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ArrowLeft size={24} color="#111" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>作品案例</Text>
                <View style={styles.placeholder} />
            </View>

            {/* Gallery Grid */}
            {loading ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color="#111" />
                </View>
            ) : cases.length === 0 ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ color: '#9CA3AF' }}>暂无案例</Text>
                </View>
            ) : (
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
            )}
        </SafeAreaView>
    );
};

// ========== Case Detail Screen ==========
export const CaseDetailScreen = ({ route, navigation }: any) => {
    const params = route.params || {};
    const numericCaseId = Number(params.caseId ?? params.caseItem?.id);
    const initialData = params.initialData;

    const { showToast } = useToast();
    const [caseItem, setCaseItem] = useState<any>(params.caseItem || null);
    const [_loading, setLoading] = useState(true);
    const [showImageViewer, setShowImageViewer] = useState(false);
    const [viewerIndex, setViewerIndex] = useState(0);
    const flatListRef = React.useRef<FlatList>(null);

    const normalizeCaseItem = useCallback((raw: any) => {
        const imagesRaw = raw?.images;
        let images: string[] = [];
        if (Array.isArray(imagesRaw)) {
            images = imagesRaw;
        } else if (typeof imagesRaw === 'string' && imagesRaw.trim() !== '') {
            try {
                const parsed = JSON.parse(imagesRaw);
                images = Array.isArray(parsed) ? parsed : [];
            } catch {
                images = [];
            }
        }

        if (images.length === 0 && raw?.coverImage) {
            images = [raw.coverImage];
        }

        return {
            ...raw,
            id: raw?.id ?? numericCaseId,
            images,
        };
    }, [numericCaseId]);

    useEffect(() => {
        if (!numericCaseId) {
            showToast({ message: '缺少案例ID', type: 'error' });
            navigation.goBack();
            return;
        }

        let cancelled = false;
        const loadDetail = async () => {
            setLoading(true);
            if (initialData && !params.caseItem) {
                setCaseItem(normalizeCaseItem({ ...initialData, id: numericCaseId }));
            }
            try {
                const res = await caseApi.getDetail(numericCaseId);
                if (!cancelled && res.data) {
                    setCaseItem(normalizeCaseItem(res.data));
                }
            } catch {
                if (!cancelled) {
                    if (initialData && !params.caseItem) {
                        setCaseItem(normalizeCaseItem({ ...initialData, id: numericCaseId }));
                    } else {
                        showToast({ message: '加载失败，请稍后重试', type: 'error' });
                    }
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        loadDetail();
        return () => {
            cancelled = true;
        };
    }, [initialData, normalizeCaseItem, numericCaseId, navigation, params.caseItem, showToast]);

    const openImageViewer = (index: number) => {
        setViewerIndex(index);
        setShowImageViewer(true);
    };

    const handleShare = () => {
        const shareUrl = `${getWebUrl()}/case/${numericCaseId}`;
        Clipboard.setString(shareUrl);
        showToast({ message: '链接已复制到剪贴板', type: 'success' });
    };

    if (!caseItem) {
        return (
            <View style={styles.container}>
                <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <ArrowLeft size={24} color="#111" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>案例详情</Text>
                    <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
                        <Share2 size={20} color="#111" />
                    </TouchableOpacity>
                </View>

                <View style={[styles.content, { justifyContent: 'center', alignItems: 'center' }]}>
                    <ActivityIndicator size="large" color="#111" />
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

            {/* Simple Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ArrowLeft size={24} color="#111" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>案例详情</Text>
                <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
                    <Share2 size={20} color="#111" />
                </TouchableOpacity>
            </View>



            <ScrollView
                style={styles.content}
                showsVerticalScrollIndicator={false}
                bounces={false}
            >
                {/* Gray Content Area */}
                <View style={styles.verticalContent}>

                    {/* Module 1: Header & Info (Merged) */}
                    <View style={styles.moduleCard}>
                        {/* Title & Price */}
                        <Text style={styles.premiumTitle}>{caseItem.title}</Text>
                        <View style={styles.priceRow}>
                            <Text style={styles.priceLabel}>参考价</Text>
                            <Text style={styles.priceValue}>{caseItem.price ? `¥${caseItem.price}` : '暂无报价'}</Text>
                        </View>

                        <View style={styles.divider} />

                        {/* Info Grid */}
                        <View style={styles.premiumGrid}>
                            <View style={styles.premiumGridItem}>
                                <Text style={styles.gridLabel}>户型</Text>
                                <Text style={styles.gridValue}>{caseItem.houseLayout || '暂无'}</Text>
                            </View>
                            <View style={styles.premiumGridItem}>
                                <Text style={styles.gridLabel}>面积</Text>
                                <Text style={styles.gridValue}>{caseItem.area}</Text>
                            </View>
                            <View style={styles.premiumGridItem}>
                                <Text style={styles.gridLabel}>风格</Text>
                                <Text style={styles.gridValue}>{caseItem.style}</Text>
                            </View>
                            <View style={styles.premiumGridItem}>
                                <Text style={styles.gridLabel}>完工</Text>
                                <Text style={styles.gridValue}>{caseItem.year || '-'}年</Text>
                            </View>
                        </View>
                    </View>

                    {/* Module 3: Description */}
                    <View style={styles.moduleCard}>
                        <Text style={styles.sectionTitle}>设计理念</Text>
                        <Text style={styles.premiumDesc}>{caseItem.description}</Text>
                    </View>

                    {/* Module 4: Gallery */}
                    <View style={styles.moduleCard}>
                        <Text style={styles.sectionTitle}>案例图赏 ({caseItem.images.length})</Text>
                        <View style={styles.verticalGallery}>
                            {caseItem.images.map((img: string, idx: number) => (
                                <TouchableOpacity key={idx} onPress={() => openImageViewer(idx)} activeOpacity={0.9} style={{ marginBottom: 16 }}>
                                    <Image
                                        source={{ uri: img }}
                                        style={{ width: '100%', height: width * 0.75 - 32, borderRadius: 8, backgroundColor: '#f0f0f0' }}
                                        resizeMode="cover"
                                    />
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                </View>


            </ScrollView>


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
        </View>
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
    },
    caseDetailTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#111',
        marginBottom: 12,
    },

    infoGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    infoItem: {
        width: '50%',
        marginBottom: 12,
    },
    infoLabel: {
        fontSize: 12,
        color: '#9CA3AF',
        marginBottom: 4,
    },
    infoValue: {
        fontSize: 14,
        fontWeight: '500',
        color: '#111',
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
    // New Premium Styles
    // New Premium Styles
    // floatingHeader & circleBtn removed
    verticalContent: {
        backgroundColor: '#F5F5F5', // Gray background
        padding: 12, // Outer padding
        paddingBottom: 40,
    },
    moduleCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
    },
    verticalGallery: {
        marginTop: 12,
    },
    // cardHeader removed/merged into moduleCard
    premiumTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#111',
        marginBottom: 12,
        lineHeight: 30,
    },
    // premiumSubtitle removed
    priceRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    priceLabel: {
        fontSize: 14,
        color: '#FF4D4F',
        marginRight: 4,
        fontWeight: '500',
    },
    priceValue: {
        fontSize: 28,
        fontWeight: '800',
        color: '#FF4D4F',
    },
    divider: {
        height: 1,
        backgroundColor: '#F3F4F6',
        marginTop: 16,
        marginBottom: 16,
    },
    premiumGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    premiumGridItem: {
        width: '50%',
        marginBottom: 24,
    },
    gridLabel: {
        fontSize: 12,
        color: '#999',
        marginBottom: 6,
        letterSpacing: 1,
    },
    gridValue: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    premiumDesc: {
        fontSize: 15,
        color: '#444',
        lineHeight: 28,
        letterSpacing: 0.5,
    },
    premiumMoreImage: {
        width: 140,
        height: 100,
        borderRadius: 12,
        marginRight: 16,
        backgroundColor: '#F3F4F6',
    },

    // Provider Card (Not used in original detail, but kept for gallery?) No, original didn't have provider card in detail.
    // Keeping shared styles safe.
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

