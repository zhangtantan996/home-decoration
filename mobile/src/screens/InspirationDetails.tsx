import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Image,
    TouchableOpacity,
    Dimensions,
    StatusBar,
    FlatList,
    Modal,
    Platform,
    TextInput,
    KeyboardAvoidingView,
    ActivityIndicator
} from 'react-native';
import { ArrowLeft, Heart, Share2, MessageCircle, X, Bookmark, Send } from 'lucide-react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { getWebUrl } from '../config';
import { useToast } from '../components/Toast';
import { inspirationApi, caseApi } from '../services/api';

const { width } = Dimensions.get('window');

// ========== Inspiration Detail Screen ==========
export const InspirationDetailScreen = ({ route, navigation }: any) => {
    // 初始数据可能只包含部分信息
    const { item: initialItem } = route.params;
    const { showToast } = useToast();
    
    // 状态管理
    const [item, setItem] = useState<any>(initialItem);
    const [comments, setComments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [commentText, setCommentText] = useState('');
    const [submittingComment, setSubmittingComment] = useState(false);
    
    // 交互状态
    const [liked, setLiked] = useState(initialItem.isLiked || false);
    const [likeCount, setLikeCount] = useState<number>(initialItem.likeCount || initialItem.likes || 0);
    const [bookmarked, setBookmarked] = useState(initialItem.isFavorited || false);
    
    // 图片浏览
    const [showImageViewer, setShowImageViewer] = useState(false);
    const [viewerIndex, setViewerIndex] = useState(0);
    const flatListRef = useRef<FlatList>(null);

    const images = item.images || (item.image ? [item.image] : []) || [];

    // 获取详情和评论
    useEffect(() => {
        const fetchData = async () => {
            try {
                // 并行请求详情和评论
                const [detailRes, commentsRes] = await Promise.all([
                    caseApi.getDetail(item.id).catch(err => {
                        console.log('Fetch detail error (using initial data):', err);
                        return { data: initialItem }; 
                    }),
                    inspirationApi.comments(item.id).catch(err => {
                        console.log('Fetch comments error:', err);
                        return { data: [] };
                    })
                ]);

                // 合并详情数据
                const detailData = detailRes.data || initialItem;
                
                // Parse images if needed (sometimes backend returns stringified JSON)
                if (typeof detailData.images === 'string') {
                    try {
                        detailData.images = JSON.parse(detailData.images);
				} catch {
					detailData.images = [detailData.image || initialItem.image];
				}
			}
                
                // Keep author info from the list item (case detail API doesn't include author today).
                const mergedItem = {
                    ...initialItem,
                    ...detailData,
                    author: initialItem.author || detailData.author,
                };

                setItem(mergedItem);
                setLiked(mergedItem.isLiked || false);
                setBookmarked(mergedItem.isFavorited || false);
                setLikeCount(mergedItem.likeCount || mergedItem.likes || 0);

                // 设置评论
                const commentsList = commentsRes?.data?.list || [];
                setComments(commentsList);
            } catch (error) {
                console.error('Error fetching inspiration details:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [item.id, initialItem]);

    const openImageViewer = (index: number) => {
        setViewerIndex(index);
        setShowImageViewer(true);
    };

    const handleShare = () => {
        const shareUrl = `${getWebUrl()}/inspiration/${item.id}`;
        Clipboard.setString(shareUrl);
        showToast({ message: '链接已复制到剪贴板', type: 'success' });
    };

    const handleLike = async () => {
        // 乐观更新
        const newLiked = !liked;
        setLiked(newLiked);
        setLikeCount(prev => newLiked ? prev + 1 : prev - 1);

        try {
            if (newLiked) {
                await inspirationApi.like(item.id);
            } else {
                await inspirationApi.unlike(item.id);
            }
		} catch {
			// 失败回滚
			setLiked(!newLiked);
			setLikeCount(prev => newLiked ? prev - 1 : prev + 1);
			showToast({ message: '操作失败，请重试', type: 'error' });
		}
    };

    const handleBookmark = async () => {
        // 乐观更新
        const newBookmarked = !bookmarked;
        setBookmarked(newBookmarked);
        showToast({ message: newBookmarked ? '已收藏' : '已取消收藏', type: 'success' });

        try {
            if (newBookmarked) {
                await inspirationApi.favorite(item.id);
            } else {
                await inspirationApi.unfavorite(item.id);
            }
		} catch {
			// 失败回滚
			setBookmarked(!newBookmarked);
			showToast({ message: '操作失败，请重试', type: 'error' });
		}
    };

    const handleSubmitComment = async () => {
        if (!commentText.trim()) return;
        
        setSubmittingComment(true);
        try {
            await inspirationApi.createComment(item.id, commentText);
            setCommentText('');
            showToast({ message: '评论发布成功', type: 'success' });
            // 刷新评论列表
            const res = await inspirationApi.comments(item.id);
            const list = res?.data?.list || [];
            setComments(list);
		} catch {
			showToast({ message: '评论发布失败', type: 'error' });
		} finally {
			setSubmittingComment(false);
		}
    };

    const renderCommentItem = (comment: any, index: number) => (
        <View key={comment.id || index} style={styles.commentItem}>
            <Image 
                source={{ uri: comment.user?.avatar || 'https://via.placeholder.com/40' }} 
                style={styles.commentAvatar} 
            />
            <View style={styles.commentContent}>
                <View style={styles.commentHeader}>
                    <Text style={styles.commentUser}>{comment.user?.nickname || comment.user?.name || '用户'}</Text>
                    <Text style={styles.commentTime}>{comment.createdAt ? new Date(comment.createdAt).toLocaleDateString() : '刚刚'}</Text>
                </View>
                <Text style={styles.commentText}>{comment.content}</Text>
            </View>
        </View>
    );

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
                <ActivityIndicator size="large" color="#000" />
            </View>
        );
    }

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
                        {(item.price || item.budget) && (
                            <View style={styles.priceRow}>
                                <Text style={styles.priceLabel}>参考价</Text>
                                <Text style={styles.priceValue}>¥{item.price || item.budget}</Text>
                            </View>
                        )}

                        <View style={styles.divider} />

                        {/* Info Grid */}
                        <View style={styles.premiumGrid}>
                            <View style={styles.premiumGridItem}>
                                <Text style={styles.gridLabel}>户型</Text>
                                <Text style={styles.gridValue}>{item.houseLayout || item.layout || item.houseType || '暂无'}</Text>
                            </View>
                            <View style={styles.premiumGridItem}>
                                <Text style={styles.gridLabel}>面积</Text>
                                <Text style={styles.gridValue}>{item.area ? `${item.area}㎡` : '暂无'}</Text>
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
                            <Image 
                                source={{ uri: item.author?.avatar || 'https://via.placeholder.com/40' }} 
                                style={styles.avatar} 
                            />
                            <View style={styles.authorInfo}>
                                <Text style={styles.authorName}>{item.author?.name || '未知作者'}</Text>
                                <Text style={styles.publishTime}>发布于 {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '近期'}</Text>
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

                    {/* Module 5: Comments */}
                    <View style={styles.moduleCard}>
                        <Text style={styles.sectionTitle}>评论 ({comments.length})</Text>
                        {comments.length > 0 ? (
                            comments.map((c, i) => renderCommentItem(c, i))
                        ) : (
                            <Text style={styles.emptyComments}>暂无评论，快来抢沙发吧~</Text>
                        )}
                    </View>

                </View>
            </ScrollView>

            {/* Bottom Action Bar */}
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            >
                <View style={styles.bottomBar}>
                    <View style={styles.commentInputContainer}>
                        <TextInput
                            style={styles.commentInput}
                            placeholder="说点什么..."
                            placeholderTextColor="#9CA3AF"
                            value={commentText}
                            onChangeText={setCommentText}
                            returnKeyType="send"
                            onSubmitEditing={handleSubmitComment}
                        />
                        {commentText.length > 0 && (
                            <TouchableOpacity 
                                style={styles.sendBtn}
                                onPress={handleSubmitComment}
                                disabled={submittingComment}
                            >
                                {submittingComment ? (
                                    <ActivityIndicator size="small" color="#3B82F6" />
                                ) : (
                                    <Send size={18} color="#3B82F6" />
                                )}
                            </TouchableOpacity>
                        )}
                    </View>
                    
                    <TouchableOpacity style={styles.bottomAction} onPress={handleLike}>
                        <Heart
                            size={22}
                            color={liked ? '#EF4444' : '#666'}
                            fill={liked ? '#EF4444' : 'transparent'}
                        />
                        <Text style={styles.bottomActionText}>{likeCount}</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity style={styles.bottomAction}>
                        <MessageCircle size={22} color="#666" />
                        <Text style={styles.bottomActionText}>{comments.length}</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity style={styles.bottomAction} onPress={handleBookmark}>
                        <Bookmark
                            size={22}
                            color={bookmarked ? '#EAB308' : '#666'}
                            fill={bookmarked ? '#EAB308' : 'transparent'}
                        />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>

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
    loadingContainer: {
        flex: 1,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'ios' ? 50 : 44,
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
    // Comments
    commentItem: {
        flexDirection: 'row',
        marginBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
        paddingBottom: 16,
    },
    commentAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#eee',
        marginRight: 10,
    },
    commentContent: {
        flex: 1,
    },
    commentHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    commentUser: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
    },
    commentTime: {
        fontSize: 12,
        color: '#9CA3AF',
    },
    commentText: {
        fontSize: 14,
        color: '#555',
        lineHeight: 20,
    },
    emptyComments: {
        textAlign: 'center',
        color: '#9CA3AF',
        paddingVertical: 20,
        fontSize: 14,
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
    commentInputContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        borderRadius: 20,
        paddingHorizontal: 12,
        marginRight: 12,
        height: 40,
    },
    commentInput: {
        flex: 1,
        height: 40,
        fontSize: 14,
        color: '#333',
    },
    sendBtn: {
        padding: 4,
        marginLeft: 4,
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
