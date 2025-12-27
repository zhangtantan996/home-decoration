import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    TouchableOpacity,
    Platform,
    TextInput,
    KeyboardAvoidingView,
    Image,
    Keyboard,
    Alert,
    Modal,
} from 'react-native';
import {
    ArrowLeft,
    Send,
    MoreVertical,
    Phone,
    Paperclip,
    AlertCircle,
    CheckCircle,
    Info,
} from 'lucide-react-native';
import { useChatStore, Message } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';

// 主色调
const PRIMARY_GOLD = '#D4AF37';

// 快捷回复
const QUICK_REPLIES = [
    '好的，收到',
    '什么时候方便？',
    '请发详细报价',
    '我再考虑一下',
];

interface ChatRoomScreenProps {
    route: any;
    navigation: any;
}

const ChatRoomScreen: React.FC<ChatRoomScreenProps> = ({ route, navigation }) => {
    const { conversation } = route.params || {};
    const partnerId = conversation?.partnerId || conversation?.id;
    const partnerName = conversation?.partnerName || conversation?.name || '聊天';
    const partnerAvatar = conversation?.partnerAvatar || conversation?.avatar;

    // 从 Store 获取数据
    const currentUser = useAuthStore(state => state.user);
    const currentUserId = currentUser?.id || 1;

    // 生成 conversationId (memoize 防止重复计算)
    const conversationId = useMemo(() => {
        return currentUserId < partnerId
            ? `${currentUserId}_${partnerId}`
            : `${partnerId}_${currentUserId}`;
    }, [currentUserId, partnerId]);

    // 使用稳定的选择器，避免每次返回新数组
    const messagesFromStore = useChatStore(state => state.messages[conversationId]);
    const messages = useMemo(() => messagesFromStore || [], [messagesFromStore]);
    const storeSendMessage = useChatStore(state => state.sendMessage);
    const fetchMessages = useChatStore(state => state.fetchMessages);
    const markAsRead = useChatStore(state => state.markAsRead);
    const isLoadingMessages = useChatStore(state => state.isLoadingMessages);

    const [inputText, setInputText] = useState('');
    const [showQuickReplies, setShowQuickReplies] = useState(true);
    const [showMoreMenu, setShowMoreMenu] = useState(false);
    const [dialogConfig, setDialogConfig] = useState<{
        visible: boolean;
        type: 'info' | 'confirm' | 'success';
        title: string;
        message: string;
        onConfirm?: () => void;
    }>({ visible: false, type: 'info', title: '', message: '' });
    const scrollViewRef = useRef<ScrollView>(null);
    const lastMarkedMsgIdRef = useRef<number | null>(null);

    // 加载历史消息
    useEffect(() => {
        if (conversationId) {
            fetchMessages(conversationId);
        }
    }, [conversationId]);

    // 标记已读 (使用 ref 防止重复调用)
    useEffect(() => {
        if (messages.length > 0) {
            const lastMsg = messages[messages.length - 1];
            if (
                lastMsg.senderId !== currentUserId &&
                !lastMsg.isRead &&
                lastMarkedMsgIdRef.current !== lastMsg.id
            ) {
                lastMarkedMsgIdRef.current = lastMsg.id;
                markAsRead(conversationId, lastMsg.id);
            }
        }
    }, [messages.length]); // 只依赖 messages.length 而非整个 messages

    // 滚动到底部
    const scrollToBottom = () => {
        setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // 发送消息
    const handleSendMessage = (text: string) => {
        if (!text.trim()) return;
        storeSendMessage(partnerId, text.trim());
        setInputText('');
        setShowQuickReplies(false);
        Keyboard.dismiss();
    };

    // 电话按钮点击
    const handlePhonePress = () => {
        setDialogConfig({
            visible: true,
            type: 'info',
            title: '功能开发中',
            message: '语音通话功能正在开发中，敬请期待！',
        });
    };

    // 关闭弹窗
    const closeDialog = () => {
        setDialogConfig(prev => ({ ...prev, visible: false }));
    };

    // 更多菜单选项
    const handleMenuOption = (option: string) => {
        setShowMoreMenu(false);
        switch (option) {
            case 'profile':
                // 跳转到服务商详情页
                if (conversation?.role === 'designer') {
                    navigation.navigate('DesignerDetail', { designer: conversation });
                } else if (conversation?.role === 'worker') {
                    navigation.navigate('WorkerDetail', { worker: conversation });
                } else if (conversation?.role === 'company') {
                    navigation.navigate('CompanyDetail', { company: conversation });
                }
                break;
            case 'clear':
                setDialogConfig({
                    visible: true,
                    type: 'confirm',
                    title: '清空聊天记录',
                    message: '确定要清空与该用户的聊天记录吗？此操作不可恢复。',
                    onConfirm: () => { /* TODO: clear messages API */ },
                });
                break;
            case 'report':
                setDialogConfig({
                    visible: true,
                    type: 'success',
                    title: '举报成功',
                    message: '感谢您的反馈，我们将尽快处理。',
                });
                break;
        }
    };

    // 渲染消息气泡
    const renderMessage = (message: Message, index: number) => {
        const isMe = message.senderId === currentUserId;
        const msgTime = new Date(message.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        const prevMsgTime = index > 0 ? new Date(messages[index - 1]?.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '';
        const showTime = index === 0 || prevMsgTime !== msgTime;

        return (
            <View key={message.id}>
                {showTime && (
                    <Text style={styles.timeLabel}>{msgTime}</Text>
                )}
                <View style={[
                    styles.messageRow,
                    isMe && styles.messageRowMe,
                ]}>
                    {!isMe && (
                        <Image
                            source={{ uri: partnerAvatar || 'https://via.placeholder.com/40' }}
                            style={styles.messageAvatar}
                        />
                    )}
                    <View style={[
                        styles.messageBubble,
                        isMe ? styles.messageBubbleMe : styles.messageBubbleOther,
                    ]}>
                        <Text style={[
                            styles.messageText,
                            isMe && styles.messageTextMe,
                        ]}>
                            {message.content}
                        </Text>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ArrowLeft size={24} color="#09090B" />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>{partnerName}</Text>
                    {conversation?.isOnline && (
                        <Text style={styles.headerSubtitle}>在线</Text>
                    )}
                </View>
                <View style={styles.headerRight}>
                    <TouchableOpacity style={styles.headerBtn} onPress={handlePhonePress}>
                        <Phone size={20} color="#09090B" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.navigate('ChatSettings', { conversation })}>
                        <MoreVertical size={20} color="#09090B" />
                    </TouchableOpacity>
                </View>
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
                {/* 消息列表 */}
                <ScrollView
                    ref={scrollViewRef}
                    style={styles.messageList}
                    contentContainerStyle={styles.messageListContent}
                    showsVerticalScrollIndicator={false}
                    onContentSizeChange={scrollToBottom}
                >
                    {messages.map((message, index) => renderMessage(message, index))}
                </ScrollView>

                {/* 快捷回复 */}
                {showQuickReplies && (
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.quickRepliesContainer}
                        contentContainerStyle={styles.quickRepliesContent}
                    >
                        {QUICK_REPLIES.map((reply, index) => (
                            <TouchableOpacity
                                key={index}
                                style={styles.quickReplyBtn}
                                onPress={() => handleSendMessage(reply)}
                            >
                                <Text style={styles.quickReplyText}>{reply}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                )}

                {/* 输入区域 */}
                <View style={styles.inputContainer}>
                    <TouchableOpacity style={styles.attachBtn}>
                        <Paperclip size={20} color="#71717A" />
                    </TouchableOpacity>
                    <View style={styles.inputWrapper}>
                        <TextInput
                            style={styles.textInput}
                            placeholder="输入消息..."
                            placeholderTextColor="#A1A1AA"
                            value={inputText}
                            onChangeText={setInputText}
                            multiline
                            maxLength={500}
                        />
                    </View>
                    <TouchableOpacity
                        style={[
                            styles.sendBtn,
                            inputText.trim() && styles.sendBtnActive,
                        ]}
                        onPress={() => handleSendMessage(inputText)}
                        disabled={!inputText.trim()}
                    >
                        <Send size={20} color={inputText.trim() ? '#FFFFFF' : '#A1A1AA'} />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>

            {/* 更多菜单弹窗 */}
            <Modal
                visible={showMoreMenu}
                transparent
                animationType="fade"
                onRequestClose={() => setShowMoreMenu(false)}
            >
                <TouchableOpacity
                    style={styles.menuOverlay}
                    activeOpacity={1}
                    onPress={() => setShowMoreMenu(false)}
                >
                    <View style={styles.menuContainer}>
                        <TouchableOpacity
                            style={styles.menuItem}
                            onPress={() => handleMenuOption('profile')}
                        >
                            <Text style={styles.menuItemText}>查看个人主页</Text>
                        </TouchableOpacity>
                        <View style={styles.menuDivider} />
                        <TouchableOpacity
                            style={styles.menuItem}
                            onPress={() => handleMenuOption('clear')}
                        >
                            <Text style={styles.menuItemText}>清空聊天记录</Text>
                        </TouchableOpacity>
                        <View style={styles.menuDivider} />
                        <TouchableOpacity
                            style={styles.menuItem}
                            onPress={() => handleMenuOption('report')}
                        >
                            <Text style={[styles.menuItemText, styles.menuItemDanger]}>举报</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* 自定义弹窗 */}
            <Modal
                visible={dialogConfig.visible}
                transparent
                animationType="fade"
                onRequestClose={closeDialog}
            >
                <View style={styles.dialogOverlay}>
                    <View style={styles.dialogContainer}>
                        {/* 图标 */}
                        <View style={[
                            styles.dialogIconContainer,
                            dialogConfig.type === 'success' && styles.dialogIconSuccess,
                            dialogConfig.type === 'confirm' && styles.dialogIconWarning,
                            dialogConfig.type === 'info' && styles.dialogIconInfo,
                        ]}>
                            {dialogConfig.type === 'success' && <CheckCircle size={32} color="#10B981" />}
                            {dialogConfig.type === 'confirm' && <AlertCircle size={32} color="#F59E0B" />}
                            {dialogConfig.type === 'info' && <Info size={32} color={PRIMARY_GOLD} />}
                        </View>

                        {/* 标题和内容 */}
                        <Text style={styles.dialogTitle}>{dialogConfig.title}</Text>
                        <Text style={styles.dialogMessage}>{dialogConfig.message}</Text>

                        {/* 按钮 */}
                        <View style={styles.dialogButtons}>
                            {dialogConfig.type === 'confirm' ? (
                                <>
                                    <TouchableOpacity
                                        style={[styles.dialogBtn, styles.dialogBtnSecondary]}
                                        onPress={closeDialog}
                                    >
                                        <Text style={styles.dialogBtnSecondaryText}>取消</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.dialogBtn, styles.dialogBtnDanger]}
                                        onPress={() => {
                                            dialogConfig.onConfirm?.();
                                            closeDialog();
                                        }}
                                    >
                                        <Text style={styles.dialogBtnDangerText}>确定</Text>
                                    </TouchableOpacity>
                                </>
                            ) : (
                                <TouchableOpacity
                                    style={[styles.dialogBtn, styles.dialogBtnPrimary]}
                                    onPress={closeDialog}
                                >
                                    <Text style={styles.dialogBtnPrimaryText}>知道了</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'ios' ? 12 : 44,
        paddingBottom: 12,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F4F4F5',
    },
    backBtn: {
        padding: 4,
    },
    headerCenter: {
        flex: 1,
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#09090B',
    },
    headerSubtitle: {
        fontSize: 12,
        color: '#22C55E',
        marginTop: 2,
    },
    headerRight: {
        flexDirection: 'row',
    },
    headerBtn: {
        padding: 8,
    },
    keyboardView: {
        flex: 1,
    },
    // 消息列表
    messageList: {
        flex: 1,
    },
    messageListContent: {
        padding: 16,
        paddingBottom: 8,
    },
    timeLabel: {
        textAlign: 'center',
        fontSize: 12,
        color: '#A1A1AA',
        marginVertical: 12,
    },
    messageRow: {
        flexDirection: 'row',
        marginBottom: 12,
        alignItems: 'flex-end',
    },
    messageRowMe: {
        flexDirection: 'row-reverse',
    },
    messageAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        marginRight: 8,
        backgroundColor: '#E5E7EB',
    },
    messageBubble: {
        maxWidth: '75%',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 16,
    },
    messageBubbleOther: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 4,
    },
    messageBubbleMe: {
        backgroundColor: PRIMARY_GOLD,
        borderTopRightRadius: 4,
    },
    messageText: {
        fontSize: 14,
        color: '#09090B',
        lineHeight: 20,
    },
    messageTextMe: {
        color: '#FFFFFF',
    },
    // 快捷回复
    quickRepliesContainer: {
        maxHeight: 44,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#F4F4F5',
    },
    quickRepliesContent: {
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    quickReplyBtn: {
        paddingHorizontal: 14,
        paddingVertical: 6,
        backgroundColor: '#F4F4F5',
        borderRadius: 16,
        marginHorizontal: 4,
    },
    quickReplyText: {
        fontSize: 13,
        color: '#71717A',
    },
    // 输入区域
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: 12,
        paddingVertical: 8,
        paddingBottom: Platform.OS === 'ios' ? 28 : 20,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#F4F4F5',
    },
    attachBtn: {
        padding: 6,
        marginBottom: 4,
    },
    inputWrapper: {
        flex: 1,
        backgroundColor: '#F4F4F5',
        borderRadius: 16,
        paddingHorizontal: 14,
        paddingVertical: 1,
        marginHorizontal: 8,
        maxHeight: 100,
    },
    textInput: {
        fontSize: 14,
        color: '#09090B',
        maxHeight: 80,
    },
    sendBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#E4E4E7',
        alignItems: 'center',
        justifyContent: 'center',
    },
    sendBtnActive: {
        backgroundColor: PRIMARY_GOLD,
    },
    // 更多菜单
    menuOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        justifyContent: 'flex-start',
        alignItems: 'flex-end',
        paddingTop: Platform.OS === 'ios' ? 100 : 90,
        paddingRight: 16,
    },
    menuContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        minWidth: 160,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 12,
            },
            android: {
                elevation: 8,
            },
        }),
    },
    menuItem: {
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    menuItemText: {
        fontSize: 15,
        color: '#09090B',
    },
    menuItemDanger: {
        color: '#EF4444',
    },
    menuDivider: {
        height: 1,
        backgroundColor: '#F4F4F5',
    },
    // 自定义弹窗
    dialogOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    dialogContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
        width: '100%',
        maxWidth: 320,
    },
    dialogIconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    dialogIconSuccess: {
        backgroundColor: '#ECFDF5',
    },
    dialogIconWarning: {
        backgroundColor: '#FEF3C7',
    },
    dialogIconInfo: {
        backgroundColor: '#FFFBEB',
    },
    dialogTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#09090B',
        marginBottom: 8,
        textAlign: 'center',
    },
    dialogMessage: {
        fontSize: 14,
        color: '#71717A',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 24,
    },
    dialogButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    dialogBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
    },
    dialogBtnPrimary: {
        backgroundColor: PRIMARY_GOLD,
    },
    dialogBtnPrimaryText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    dialogBtnSecondary: {
        backgroundColor: '#F4F4F5',
    },
    dialogBtnSecondaryText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#71717A',
    },
    dialogBtnDanger: {
        backgroundColor: '#FEE2E2',
    },
    dialogBtnDangerText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#EF4444',
    },
});

export default ChatRoomScreen;
