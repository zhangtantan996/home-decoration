import React from 'react';
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
} from 'react-native';
import { ArrowLeft, Heart, Share2, MessageCircle, Send, Eye, Play, Bookmark, MoreHorizontal } from 'lucide-react-native';

const { width, height } = Dimensions.get('window');

// ========== Live Room Screen ==========
export const LiveRoomScreen = ({ route, navigation }: any) => {
    const { item } = route.params;

    return (
        <View style={liveStyles.container}>
            <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
            {/* Fullscreen Image/Video Background */}
            <Image source={{ uri: item.image }} style={liveStyles.background} resizeMode="cover" />
            <View style={liveStyles.overlay} />

            {/* Header */}
            <SafeAreaView style={liveStyles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={liveStyles.backBtn}>
                    <ArrowLeft size={24} color="#fff" />
                </TouchableOpacity>
                <View style={liveStyles.liveBadge}>
                    <View style={liveStyles.liveDot} />
                    <Text style={liveStyles.liveBadgeText}>直播中</Text>
                </View>
                <View style={liveStyles.viewerBadge}>
                    <Eye size={14} color="#fff" />
                    <Text style={liveStyles.viewerText}>{item.viewers} 观看</Text>
                </View>
            </SafeAreaView>

            {/* Bottom Content */}
            <View style={liveStyles.bottomContent}>
                {/* Author Info */}
                <View style={liveStyles.authorRow}>
                    <Image source={{ uri: item.avatar }} style={liveStyles.avatar} />
                    <View>
                        <Text style={liveStyles.authorName}>{item.author}</Text>
                        <Text style={liveStyles.liveTitle}>{item.title}</Text>
                    </View>
                    <TouchableOpacity style={liveStyles.followBtn}>
                        <Text style={liveStyles.followBtnText}>关注</Text>
                    </TouchableOpacity>
                </View>

                {/* Chat Messages Placeholder */}
                <View style={liveStyles.chatArea}>
                    <View style={liveStyles.chatMessage}>
                        <Text style={liveStyles.chatUser}>用户A:</Text>
                        <Text style={liveStyles.chatText}>这个设计太棒了！</Text>
                    </View>
                    <View style={liveStyles.chatMessage}>
                        <Text style={liveStyles.chatUser}>用户B:</Text>
                        <Text style={liveStyles.chatText}>请问这是什么风格？</Text>
                    </View>
                </View>

                {/* Input Bar */}
                <View style={liveStyles.inputBar}>
                    <View style={liveStyles.inputField}>
                        <Text style={liveStyles.inputPlaceholder}>说点什么...</Text>
                    </View>
                    <TouchableOpacity style={liveStyles.giftBtn}>
                        <Heart size={20} color="#fff" fill="#E91E63" />
                    </TouchableOpacity>
                    <TouchableOpacity style={liveStyles.shareBtn}>
                        <Share2 size={20} color="#fff" />
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
};

const liveStyles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    background: {
        ...StyleSheet.absoluteFillObject,
        width: '100%',
        height: '100%',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    header: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'ios' ? 12 : 44, // 适配沉浸式状态栏
    },
    backBtn: {
        padding: 8,
    },
    liveBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E91E63',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        marginLeft: 12,
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
        fontSize: 11,
        fontWeight: 'bold',
    },
    viewerBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        marginLeft: 8,
    },
    viewerText: {
        color: '#fff',
        fontSize: 11,
        marginLeft: 4,
    },
    bottomContent: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingBottom: 34,
        paddingHorizontal: 16,
    },
    authorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: 12,
        borderWidth: 2,
        borderColor: '#fff',
    },
    authorName: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
    },
    liveTitle: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 12,
        marginTop: 2,
    },
    followBtn: {
        marginLeft: 'auto',
        backgroundColor: '#E91E63',
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 16,
    },
    followBtnText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    },
    chatArea: {
        marginBottom: 16,
    },
    chatMessage: {
        flexDirection: 'row',
        marginBottom: 8,
    },
    chatUser: {
        color: '#EAB308',
        fontSize: 12,
        fontWeight: 'bold',
        marginRight: 4,
    },
    chatText: {
        color: '#fff',
        fontSize: 12,
    },
    inputBar: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    inputField: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    inputPlaceholder: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 14,
    },
    giftBtn: {
        marginLeft: 12,
        padding: 8,
    },
    shareBtn: {
        marginLeft: 8,
        padding: 8,
    },
});

// ========== Video Player Screen ==========
export const VideoPlayerScreen = ({ route, navigation }: any) => {
    const { item } = route.params;

    return (
        <View style={videoStyles.container}>
            <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

            {/* Video Area */}
            <View style={videoStyles.videoContainer}>
                <Image source={{ uri: item.image }} style={videoStyles.videoPlaceholder} resizeMode="cover" />
                <TouchableOpacity style={videoStyles.playButton}>
                    <Play size={48} color="#fff" fill="#fff" />
                </TouchableOpacity>
                {/* Back Button */}
                <SafeAreaView style={videoStyles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={videoStyles.backBtn}>
                        <ArrowLeft size={24} color="#fff" />
                    </TouchableOpacity>
                </SafeAreaView>
            </View>

            {/* Content */}
            <ScrollView style={videoStyles.content}>
                <Text style={videoStyles.title}>{item.title}</Text>

                <View style={videoStyles.statsRow}>
                    <Text style={videoStyles.statsText}>{item.playCount} 播放</Text>
                    <Text style={videoStyles.statsText}>· 2小时前</Text>
                </View>

                {/* Author */}
                <View style={videoStyles.authorRow}>
                    <Image source={{ uri: item.avatar }} style={videoStyles.avatar} />
                    <View>
                        <Text style={videoStyles.authorName}>{item.author}</Text>
                        <Text style={videoStyles.followersText}>1.2万 粉丝</Text>
                    </View>
                    <TouchableOpacity style={videoStyles.followBtn}>
                        <Text style={videoStyles.followBtnText}>+ 关注</Text>
                    </TouchableOpacity>
                </View>

                {/* Action Bar */}
                <View style={videoStyles.actionBar}>
                    <TouchableOpacity style={videoStyles.actionItem}>
                        <Heart size={22} color="#333" />
                        <Text style={videoStyles.actionText}>点赞</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={videoStyles.actionItem}>
                        <MessageCircle size={22} color="#333" />
                        <Text style={videoStyles.actionText}>评论</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={videoStyles.actionItem}>
                        <Bookmark size={22} color="#333" />
                        <Text style={videoStyles.actionText}>收藏</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={videoStyles.actionItem}>
                        <Share2 size={22} color="#333" />
                        <Text style={videoStyles.actionText}>分享</Text>
                    </TouchableOpacity>
                </View>

                {/* Comments Placeholder */}
                <View style={videoStyles.commentsSection}>
                    <Text style={videoStyles.commentsTitle}>评论 (128)</Text>
                    <View style={videoStyles.commentItem}>
                        <View style={videoStyles.commentAvatar} />
                        <View style={videoStyles.commentContent}>
                            <Text style={videoStyles.commentUser}>装修小白</Text>
                            <Text style={videoStyles.commentText}>学到了很多，感谢分享！</Text>
                        </View>
                    </View>
                    <View style={videoStyles.commentItem}>
                        <View style={videoStyles.commentAvatar} />
                        <View style={videoStyles.commentContent}>
                            <Text style={videoStyles.commentUser}>设计爱好者</Text>
                            <Text style={videoStyles.commentText}>请问这个灯具是什么品牌的？</Text>
                        </View>
                    </View>
                </View>
            </ScrollView>
        </View>
    );
};

const videoStyles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    videoContainer: {
        width: '100%',
        height: width * 0.75,
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
    },
    videoPlaceholder: {
        ...StyleSheet.absoluteFillObject,
    },
    playButton: {
        backgroundColor: 'rgba(0,0,0,0.4)',
        borderRadius: 40,
        padding: 16,
    },
    header: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
    },
    backBtn: {
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'ios' ? 12 : 44, // 适配沉浸式状态栏
        paddingBottom: 16,
    },
    content: {
        flex: 1,
        padding: 16,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#111',
        marginBottom: 8,
    },
    statsRow: {
        flexDirection: 'row',
        marginBottom: 16,
    },
    statsText: {
        fontSize: 12,
        color: '#9CA3AF',
    },
    authorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        marginRight: 12,
        backgroundColor: '#eee',
    },
    authorName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#111',
    },
    followersText: {
        fontSize: 12,
        color: '#9CA3AF',
        marginTop: 2,
    },
    followBtn: {
        marginLeft: 'auto',
        backgroundColor: '#EAB308',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 16,
    },
    followBtnText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: 'bold',
    },
    actionBar: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    actionItem: {
        alignItems: 'center',
    },
    actionText: {
        fontSize: 11,
        color: '#666',
        marginTop: 4,
    },
    commentsSection: {
        paddingTop: 16,
    },
    commentsTitle: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#111',
        marginBottom: 12,
    },
    commentItem: {
        flexDirection: 'row',
        marginBottom: 16,
    },
    commentAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#E5E7EB',
        marginRight: 12,
    },
    commentContent: {
        flex: 1,
    },
    commentUser: {
        fontSize: 13,
        fontWeight: '600',
        color: '#111',
        marginBottom: 2,
    },
    commentText: {
        fontSize: 13,
        color: '#4B5563',
        lineHeight: 18,
    },
});

// ========== Article Detail Screen ==========
export const ArticleDetailScreen = ({ route, navigation }: any) => {
    const { item } = route.params;

    return (
        <SafeAreaView style={articleStyles.container}>
            {/* 全局已在 App.tsx 配置 StatusBar */}

            {/* Header */}
            <View style={articleStyles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={articleStyles.backBtn}>
                    <ArrowLeft size={24} color="#111" />
                </TouchableOpacity>
                <TouchableOpacity style={articleStyles.moreBtn}>
                    <MoreHorizontal size={24} color="#111" />
                </TouchableOpacity>
            </View>

            <ScrollView style={articleStyles.content} showsVerticalScrollIndicator={false}>
                {/* Cover Image */}
                <Image source={{ uri: item.image }} style={articleStyles.coverImage} resizeMode="cover" />

                {/* Article Content */}
                <View style={articleStyles.articleBody}>
                    <Text style={articleStyles.title}>{item.title}</Text>
                    <Text style={articleStyles.subtitle}>{item.subtitle}</Text>

                    {/* Author Row */}
                    <View style={articleStyles.authorRow}>
                        <Image source={{ uri: item.avatar }} style={articleStyles.avatar} />
                        <View>
                            <Text style={articleStyles.authorName}>{item.author}</Text>
                            <Text style={articleStyles.publishTime}>发布于 2小时前</Text>
                        </View>
                        <TouchableOpacity style={articleStyles.followBtn}>
                            <Text style={articleStyles.followBtnText}>关注</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Article Text */}
                    <View style={articleStyles.articleText}>
                        <Text style={articleStyles.paragraph}>
                            在现代家居设计中，黑白金配色方案正在重新定义奢华的含义。这种经典的色彩组合不仅仅是一种审美选择，更是一种生活态度的表达。
                        </Text>
                        <Text style={articleStyles.paragraph}>
                            黑色代表着深邃与神秘，白色象征着纯净与简约，而金色则为空间注入了温暖与贵气。三者的完美融合，创造出既现代又永恒的居住空间。
                        </Text>
                        <Text style={articleStyles.paragraph}>
                            设计师建议在使用这一配色方案时，应注意比例的把控。通常以白色作为主色调，黑色用于勾勒轮廓和增加层次感，金色则作为点缀提升整体质感。
                        </Text>
                    </View>

                    {/* Tags */}
                    <View style={articleStyles.tagsRow}>
                        <View style={articleStyles.tag}><Text style={articleStyles.tagText}>#现代奢华</Text></View>
                        <View style={articleStyles.tag}><Text style={articleStyles.tagText}>#配色方案</Text></View>
                        <View style={articleStyles.tag}><Text style={articleStyles.tagText}>#室内设计</Text></View>
                    </View>
                </View>
            </ScrollView>

            {/* Bottom Action Bar */}
            <View style={articleStyles.bottomBar}>
                <View style={articleStyles.commentInput}>
                    <Text style={articleStyles.commentPlaceholder}>说点什么...</Text>
                </View>
                <TouchableOpacity style={articleStyles.bottomAction}>
                    <Heart size={22} color="#666" />
                    <Text style={articleStyles.bottomActionText}>{item.likes}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={articleStyles.bottomAction}>
                    <MessageCircle size={22} color="#666" />
                    <Text style={articleStyles.bottomActionText}>56</Text>
                </TouchableOpacity>
                <TouchableOpacity style={articleStyles.bottomAction}>
                    <Share2 size={22} color="#666" />
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

const articleStyles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'ios' ? 12 : 44, // 适配沉浸式状态栏
        paddingBottom: 12,
        backgroundColor: '#FFFFFF',
    },
    backBtn: {
        padding: 8,
    },
    moreBtn: {
        padding: 8,
    },
    content: {
        flex: 1,
    },
    coverImage: {
        width: '100%',
        height: 240,
    },
    articleBody: {
        padding: 20,
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#111',
        marginBottom: 8,
        lineHeight: 30,
    },
    subtitle: {
        fontSize: 14,
        color: '#9CA3AF',
        marginBottom: 20,
        lineHeight: 20,
    },
    authorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
        marginBottom: 20,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: 12,
        backgroundColor: '#eee',
    },
    authorName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111',
    },
    publishTime: {
        fontSize: 12,
        color: '#9CA3AF',
        marginTop: 2,
    },
    followBtn: {
        marginLeft: 'auto',
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
    articleText: {
        marginBottom: 20,
    },
    paragraph: {
        fontSize: 15,
        color: '#4B5563',
        lineHeight: 26,
        marginBottom: 16,
    },
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
    bottomBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
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
});
