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
import { ArrowLeft, Heart, Share2, MessageCircle, X, Bookmark } from 'lucide-react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { getWebUrl } from '../config';
import { useToast } from '../components/Toast';

const { width } = Dimensions.get('window');

// ========== Inspiration Detail Screen ==========
// 与 CaseDetailScreen 保持一致的设计风格
export const InspirationDetailScreen = ({ route, navigation }: any) => {
    const { item } = route.params;
    const { showToast } = useToast();
    const [showImageViewer, setShowImageViewer] = useState(false);
    const [viewerIndex, setViewerIndex] = useState(0);
    const [liked, setLiked] = useState(false);
    const [bookmarked, setBookmarked] = useState(false);
    const flatListRef = React.useRef<FlatList>(null);

    const images = item.images || [item.image];

    const openImageViewer = (index: number) => {
        setViewerIndex(index);
        setShowImageViewer(true);
    };

    const handleShare = () => {
        const shareUrl = `${getWebUrl()}/inspiration/${item.id}`;
        Clipboard.setString(shareUrl);
        showToast({ message: '链接已复制到剪贴板', type: 'success' });
    };

    const handleLike = () => {
        setLiked(!liked);
        showToast({ message: liked ? '已取消点赞' : '已点赞', type: 'success' });
    };

    const handleBookmark = () => {
        setBookmarked(!bookmarked);
        showToast({ message: bookmarked ? '已取消收藏' : '已收藏', type: 'success' });
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ArrowLeft size={24} color="#111" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>灵感详情</Text>
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

                    {/* Module 1: Header & Info */}
                    <View style={styles.moduleCard}>
                        {/* Title */}
                        <Text style={styles.premiumTitle}>{item.title}</Text>
                        {item.subtitle && (
                            <Text style={styles.subtitle}>{item.subtitle}</Text>
                        )}

                        {/* Price Row */}
                        {item.price && (
                            <View style={styles.priceRow}>
                                <Text style={styles.priceLabel}>参考价</Text>
                                <Text style={styles.priceValue}>¥{item.price}</Text>
                            </View>
                        )}

                        <View style={styles.divider} />

                        {/* Info Grid */}
                        <View style={styles.premiumGrid}>
                            <View style={styles.premiumGridItem}>
                                <Text style={styles.gridLabel}>户型</Text>
                                <Text style={styles.gridValue}>{item.houseLayout || item.houseType || '暂无'}</Text>
                            </View>
                            <View style={styles.premiumGridItem}>
                                <Text style={styles.gridLabel}>面积</Text>
                                <Text style={styles.gridValue}>{item.area || '暂无'}</Text>
                            </View>
                            <View style={styles.premiumGridItem}>
                                <Text style={styles.gridLabel}>风格</Text>
                                <Text style={styles.gridValue}>{item.style || '暂无'}</Text>
                            </View>
                            <View style={styles.premiumGridItem}>
                                <Text style={styles.gridLabel}>年份</Text>
                                <Text style={styles.gridValue}>{item.year || '-'}年</Text>
                            </View>
                        </View>
                    </View>

                    {/* Module 2: Author */}
                    <View style={styles.moduleCard}>
                        <View style={styles.authorRow}>
                            <Image source={{ uri: item.avatar }} style={styles.avatar} />
                            <View style={styles.authorInfo}>
                                <Text style={styles.authorName}>{item.author}</Text>
                                <Text style={styles.publishTime}>发布于 2小时前</Text>
                            </View>
                            <TouchableOpacity style={styles.followBtn}>
                                <Text style={styles.followBtnText}>关注</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Module 3: Description */}
                    {item.description && (
                        <View style={styles.moduleCard}>
                            <Text style={styles.sectionTitle}>设计理念</Text>
                            <Text style={styles.premiumDesc}>{item.description}</Text>
                        </View>
                    )}

                    {/* Module 4: Gallery */}
                    <View style={styles.moduleCard}>
                        <Text style={styles.sectionTitle}>图片展示 ({images.length})</Text>
                        <View style={styles.verticalGallery}>
                            {images.map((img: string, idx: number) => (
                                <TouchableOpacity
                                    key={idx}
                                    onPress={() => openImageViewer(idx)}
                                    activeOpacity={0.9}
                                    style={styles.galleryImageWrapper}
                                >
                                    <Image
                                        source={{ uri: img }}
                                        style={styles.galleryImage}
                                        resizeMode="cover"
                                    />
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Module 5: Tags */}
                    <View style={styles.moduleCard}>
                        <Text style={styles.sectionTitle}>相关标签</Text>
                        <View style={styles.tagsRow}>
                            {item.style && (
                                <View style={styles.tag}>
                                    <Text style={styles.tagText}>#{item.style}</Text>
                                </View>
                            )}
                            {item.houseType && (
                                <View style={styles.tag}>
                                    <Text style={styles.tagText}>#{item.houseType}</Text>
                                </View>
                            )}
                            <View style={styles.tag}>
                                <Text style={styles.tagText}>#家居灵感</Text>
                            </View>
                            <View style={styles.tag}>
                                <Text style={styles.tagText}>#装修设计</Text>
                            </View>
                        </View>
                    </View>
                </View>
            </ScrollView>

            {/* Bottom Action Bar */}
            <View style={styles.bottomBar}>
                <View style={styles.commentInput}>
                    <Text style={styles.commentPlaceholder}>说点什么...</Text>
                </View>
                <TouchableOpacity style={styles.bottomAction} onPress={handleLike}>
                    <Heart
                        size={22}
                        color={liked ? '#EF4444' : '#666'}
                        fill={liked ? '#EF4444' : 'transparent'}
                    />
                    <Text style={styles.bottomActionText}>{item.likes + (liked ? 1 : 0)}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.bottomAction}>
                    <MessageCircle size={22} color="#666" />
                    <Text style={styles.bottomActionText}>56</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.bottomAction} onPress={handleBookmark}>
                    <Bookmark
                        size={22}
                        color={bookmarked ? '#EAB308' : '#666'}
                        fill={bookmarked ? '#EAB308' : 'transparent'}
                    />
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
                        data={images}
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
                        renderItem={({ item: imgUri }) => (
                            <TouchableOpacity
                                style={styles.viewerImageContainer}
                                activeOpacity={1}
                                onPress={() => setShowImageViewer(false)}
                            >
                                <Image
                                    source={{ uri: imgUri }}
                                    style={styles.viewerImage}
                                    resizeMode="contain"
                                />
                            </TouchableOpacity>
                        )}
                        keyExtractor={(imgUri, index) => index.toString()}
                    />
                    <View style={styles.viewerIndicator}>
                        <Text style={styles.viewerCounter}>{viewerIndex + 1} / {images.length}</Text>
                    </View>
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
        paddingTop: Platform.OS === 'ios' ? 12 : 44,
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
    content: {
        flex: 1,
    },
    verticalContent: {
        backgroundColor: '#F5F5F5',
        padding: 12,
        paddingBottom: 40,
    },
    moduleCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
    },
    premiumTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#111',
        marginBottom: 8,
        lineHeight: 30,
    },
    subtitle: {
        fontSize: 14,
        color: '#9CA3AF',
        marginBottom: 12,
        lineHeight: 20,
    },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        marginTop: 8,
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
        marginBottom: 16,
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
    // Author Section
    authorRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        marginRight: 12,
        backgroundColor: '#eee',
    },
    authorInfo: {
        flex: 1,
    },
    authorName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#111',
    },
    publishTime: {
        fontSize: 12,
        color: '#9CA3AF',
        marginTop: 2,
    },
    followBtn: {
        borderWidth: 1,
        borderColor: '#EAB308',
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 16,
    },
    followBtnText: {
        color: '#EAB308',
        fontSize: 13,
        fontWeight: '600',
    },
    // Section
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#111',
        marginBottom: 12,
    },
    premiumDesc: {
        fontSize: 15,
        color: '#444',
        lineHeight: 28,
        letterSpacing: 0.5,
    },
    // Gallery
    verticalGallery: {
        marginTop: 4,
    },
    galleryImageWrapper: {
        marginBottom: 12,
    },
    galleryImage: {
        width: '100%',
        height: width * 0.65,
        borderRadius: 8,
        backgroundColor: '#f0f0f0',
    },
    // Tags
    tagsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    tag: {
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        marginRight: 8,
        marginBottom: 8,
    },
    tagText: {
        fontSize: 12,
        color: '#6B7280',
    },
    // Bottom Bar
    bottomBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        paddingBottom: 28,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
        backgroundColor: '#fff',
    },
    commentInput: {
        flex: 1,
        backgroundColor: '#F3F4F6',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
        marginRight: 12,
    },
    commentPlaceholder: {
        color: '#9CA3AF',
        fontSize: 14,
    },
    bottomAction: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 16,
    },
    bottomActionText: {
        fontSize: 12,
        color: '#666',
        marginLeft: 4,
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

export default InspirationDetailScreen;
