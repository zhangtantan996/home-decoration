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
    Modal,
} from 'react-native';
import {
    ArrowLeft,
    Send,
    MoreVertical,
    Phone,
    Plus,
    Camera,
    Image as ImageIcon,
    File,
    AlertCircle,
    CheckCircle,
    Info,
} from 'lucide-react-native';
import { useAuthStore } from '../store/authStore';
import TencentIMService from '../services/TencentIMService';
import TIM from '@tencentcloud/chat';
import { parseEmojiText } from '../utils/emojiParser';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import DocumentPicker from '@react-native-documents/picker';
import { fileApi } from '../services/api';
import { getApiUrl } from '../config'; // Use config to get base URL for constructing full image paths if needed

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

// UI 消息类型
interface UIMessage {
    id: string;
    senderId: string;
    content: string;
    createdAt: number;
    isRead: boolean;
    isMe: boolean;
}

const ChatRoomScreen: React.FC<ChatRoomScreenProps> = ({ route, navigation }) => {
    // 从 MessageScreen 传递的参数
    const { conversationID, partnerID, name: partnerName, avatar: partnerAvatar } = route.params || {};
    const defaultAvatar = 'https://via.placeholder.com/80/E5E7EB/71717A?text=U';

    // 从 Store 获取数据
    const currentUser = useAuthStore(state => state.user);
    const currentUserId = String(currentUser?.id || '');

    const [messages, setMessages] = useState<UIMessage[]>([]);
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
    const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
    const scrollViewRef = useRef<ScrollView>(null);

    // 解析 TIM 消息为 UI 消息
    const parseTIMMessages = (timMessages: any[]): UIMessage[] => {
        return timMessages.map(msg => ({
            id: msg.ID,
            senderId: msg.from,
            content: msg.type === TIM.TYPES.MSG_TEXT ? parseEmojiText(msg.payload.text) : '[非文本消息]',
            createdAt: msg.time * 1000,
            isRead: msg.isRead,
            isMe: msg.from === currentUserId
        }));
    };

    // 加载历史消息
    const loadMessages = async () => {
        const chat = TencentIMService.getChat();
        if (!chat || !conversationID) return;

        try {
            const imResponse = await chat.getMessageList({ conversationID: conversationID });
            const history = imResponse.data.messageList;
            setMessages(parseTIMMessages(history));

            // 标记已读
            chat.setMessageRead({ conversationID });
        } catch (error) {
            console.error('Failed to load messages:', error);
        }
    };

    useEffect(() => {
        loadMessages();
    }, [conversationID]);

    // 监听新消息
    useEffect(() => {
        const chat = TencentIMService.getChat();
        if (!chat) return;

        const onMessageReceived = (event: any) => {
            // 筛选当前会话的消息
            const newMsgs = event.data.filter((msg: any) => msg.conversationID === conversationID);
            if (newMsgs.length > 0) {
                setMessages(prev => [...prev, ...parseTIMMessages(newMsgs)]);
                chat.setMessageRead({ conversationID });
                scrollToBottom();
            }
        };

        chat.on(TIM.EVENT.MESSAGE_RECEIVED, onMessageReceived);

        return () => {
            chat.off(TIM.EVENT.MESSAGE_RECEIVED, onMessageReceived);
        };
    }, [conversationID]);

    // 滚动到底部
    const scrollToBottom = () => {
        setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages.length]);

    // 发送消息
    const handleSendMessage = async (text: string) => {
        if (!text.trim()) return;

        const chat = TencentIMService.getChat();
        console.log('[ChatRoom] handleSendMessage - chat:', !!chat, 'partnerID:', partnerID, 'isLoggedIn:', TencentIMService.getIsLoggedIn());

        if (!chat || !partnerID) {
            console.warn('[ChatRoom] Cannot send: chat or partnerID is missing');
            // IM 未初始化时尝试重新初始化
            if (!TencentIMService.getIsLoggedIn()) {
                console.log('[ChatRoom] Attempting to reinitialize IM...');
                const success = await TencentIMService.init();
                if (!success) {
                    setDialogConfig({
                        visible: true,
                        type: 'info',
                        title: 'IM 未就绪',
                        message: '即时通信服务未就绪，请稍后再试',
                    });
                    return;
                }
            }
            return;
        }
        try {
            // 1. 创建消息
            console.log('[ChatRoom] Creating text message to:', partnerID);
            const message = chat.createTextMessage({
                to: partnerID,
                conversationType: TIM.TYPES.CONV_C2C,
                payload: {
                    text: text.trim()
                }
            });
            console.log('[ChatRoom] Message created:', message.ID);

            // 先上屏 (临时消息)
            const uiMsg: UIMessage = {
                id: message.ID, // 使用 TIM 生成的 ID 作为临时 ID
                senderId: currentUserId,
                content: text.trim(),
                createdAt: Date.now(),
                isRead: false,
                isMe: true
            };
            setMessages(prev => [...prev, uiMsg]);
            scrollToBottom();

            setInputText('');
            setShowQuickReplies(false);
            Keyboard.dismiss();

            // 2. 发送消息
            console.log('[ChatRoom] Sending message...');
            const promise = chat.sendMessage(message);
            const res = await promise;

            console.log('✅ [ChatRoom] Send success:', res);

            // 腾讯IM SDK通常会自动触发 MESSAGE_RECEIVED 事件来更新消息状态和ID，
            // 但如果需要更即时的UI更新，可以根据 res.data.message 更新本地消息列表。
            // 这里我们依赖 MESSAGE_RECEIVED 事件来处理最终状态。
            // 如果需要手动更新，可以这样做：
            // if (res.code === 0 && res.data && res.data.message) {
            //     setMessages(prev => prev.map(msg =>
            //         msg.id === uiMsg.id ? { ...msg, id: res.data.message.ID, createdAt: res.data.message.time * 1000 } : msg
            //     ));
            // }

        } catch (error: any) {
            console.error('❌ [ChatRoom] Send failed:', error);
            // 打印完整的错误对象
            if (error.data) console.error('   Error Data:', error.data);

            setDialogConfig({
                visible: true,
                type: 'info',
                title: '发送失败',
                message: '消息发送失败，请重试',
            });
        }
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
                // TODO: 跳转逻辑需要根据 role 判断，目前 conversation 对象不完整
                setDialogConfig({
                    visible: true,
                    type: 'info',
                    title: '提示',
                    message: '查看资料功能待修复'
                });
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

    // 通用文件上传并发送 helper
    const uploadAndSendFile = async (file: { uri: string; type: string; name: string }, msgType: string) => {
        const chat = TencentIMService.getChat();
        if (!chat || !partnerID) return;

        try {
            // 1. 上传文件到应用后端
            console.log('[ChatRoom] Uploading file...', file.name);
            const uploadRes = await fileApi.upload(file);
            console.log('[ChatRoom] Upload success:', uploadRes.data);

            const fileUrl = uploadRes.data.url;
            // 注意：腾讯云IM SDK 发送图片/文件通常需要先上传到腾讯云对象存储(COS)，
            // 或者使用 external 方式。
            // 简单做法：我们发送自定义消息或者文本消息带链接？
            // 不，TUIKit 标准做法是 CreateImageMessage，但需要传入 file object (web) 或 path (native)。
            // React Native SDK createMessage 本地路径即可，SDK 会自动上传到腾讯云。

            // 纠正：Chat SDK for RN 通常会自动上传。我们不需要自己上传到后端，除非为了备份。
            // 但是为了与管理后台互通（管理后台可能只认后端 URL？），或者为了统一管理。
            // 如果 SDK 自动上传到腾讯云，那最好。
            // 让我们尝试直接使用 SDK 的 createMessage 方法。

            let message;
            if (msgType === TIM.TYPES.MSG_IMAGE) {
                // Image Message
                message = chat.createImageMessage({
                    to: partnerID,
                    conversationType: TIM.TYPES.CONV_C2C,
                    payload: {
                        file: {
                            uri: file.uri, // 本地路径
                            type: file.type,
                            name: file.name,
                        }
                    }
                });
            } else if (msgType === TIM.TYPES.MSG_FILE) {
                message = chat.createFileMessage({
                    to: partnerID,
                    conversationType: TIM.TYPES.CONV_C2C,
                    payload: {
                        file: {
                            uri: file.uri,
                            type: file.type,
                            name: file.name,
                        }
                    }
                });
            } else {
                return;
            }

            // 先上屏
            const uiMsg: UIMessage = {
                id: String(Date.now()), // 临时 ID
                senderId: currentUserId,
                content: msgType === TIM.TYPES.MSG_IMAGE ? '[图片]' : '[文件]',
                createdAt: Date.now(),
                isRead: false,
                isMe: true
            };
            setMessages(prev => [...prev, uiMsg]);
            scrollToBottom();

            // 发送
            const res = await chat.sendMessage(message);
            if (res.code === 0) {
                // 成功，更新 ID 等信息，或者等待 event
                console.log('✅ [ChatRoom] Attachment sent:', res);
            }
        } catch (error: any) {
            console.error('❌ [ChatRoom] Send attachment failed:', error);
            setDialogConfig({
                visible: true,
                type: 'info',
                title: '发送失败',
                message: '附件发送失败，请重试',
            });
        }
    };

    // 拍照
    const handleCamera = async () => {
        setShowAttachmentMenu(false);
        try {
            const result = await launchCamera({
                mediaType: 'photo',
                quality: 0.8,
            });

            if (result.didCancel) return;
            if (result.errorCode) {
                console.error('Camera Error:', result.errorMessage);
                return;
            }

            const asset = result.assets?.[0];
            if (asset && asset.uri) {
                await uploadAndSendFile({
                    uri: asset.uri,
                    type: asset.type || 'image/jpeg',
                    name: asset.fileName || 'photo.jpg',
                }, TIM.TYPES.MSG_IMAGE);
            }
        } catch (error) {
            console.error('Handle Camera Error:', error);
        }
    };

    // 相册
    const handleGallery = async () => {
        setShowAttachmentMenu(false);
        try {
            const result = await launchImageLibrary({
                mediaType: 'photo',
                quality: 0.8,
                selectionLimit: 1,
            });
            if (result.didCancel) return;
            if (result.errorCode) {
                console.error('Gallery Error:', result.errorMessage);
                return;
            }

            const asset = result.assets?.[0];
            if (asset && asset.uri) {
                await uploadAndSendFile({
                    uri: asset.uri,
                    type: asset.type || 'image/jpeg',
                    name: asset.fileName || 'image.jpg',
                }, TIM.TYPES.MSG_IMAGE);
            }
        } catch (error) {
            console.error('Handle Gallery Error:', error);
        }
    };

    // 文件文档
    const handleFile = async () => {
        setShowAttachmentMenu(false);
        try {
            const res = await DocumentPicker.pick({
                type: [DocumentPicker.types.allFiles],
            });
            const file = res[0];
            if (file && file.uri) {
                await uploadAndSendFile({
                    uri: file.uri,
                    type: file.type || 'application/octet-stream',
                    name: file.name || 'document',
                }, TIM.TYPES.MSG_FILE);
            }
        } catch (err) {
            if (DocumentPicker.isCancel(err)) {
                // cancelled
            } else {
                console.error('DocumentPicker Error:', err);
            }
        }
    };

    // 渲染消息气泡
    const renderMessage = (message: UIMessage, index: number) => {
        const isMe = message.isMe;
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
                            source={{ uri: partnerAvatar || defaultAvatar }}
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
                    {/* 在线状态暂未接入 */}
                </View>
                <View style={styles.headerRight}>
                    <TouchableOpacity style={styles.headerBtn} onPress={handlePhonePress}>
                        <Phone size={20} color="#09090B" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.headerBtn} onPress={() => setShowMoreMenu(true)}>
                        <MoreVertical size={20} color="#09090B" />
                    </TouchableOpacity>
                </View>
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
                keyboardVerticalOffset={Platform.OS === 'android' ? 0 : 0}
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
                    <TouchableOpacity
                        style={styles.attachBtn}
                        onPress={() => setShowAttachmentMenu(true)}
                    >
                        <Plus size={22} color="#71717A" />
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

            {/* 附件菜单弹窗 */}
            <Modal
                visible={showAttachmentMenu}
                transparent
                animationType="slide"
                onRequestClose={() => setShowAttachmentMenu(false)}
            >
                <TouchableOpacity
                    style={styles.attachmentOverlay}
                    activeOpacity={1}
                    onPress={() => setShowAttachmentMenu(false)}
                >
                    <View style={styles.attachmentContainer}>
                        <View style={styles.attachmentHandle} />
                        <Text style={styles.attachmentTitle}>发送</Text>
                        <View style={styles.attachmentGrid}>
                            <TouchableOpacity
                                style={styles.attachmentItem}
                                onPress={handleCamera}
                            >
                                <View style={[styles.attachmentIcon, { backgroundColor: '#FEF3C7' }]}>
                                    <Camera size={24} color="#F59E0B" />
                                </View>
                                <Text style={styles.attachmentLabel}>拍照</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.attachmentItem}
                                onPress={handleGallery}
                            >
                                <View style={[styles.attachmentIcon, { backgroundColor: '#DBEAFE' }]}>
                                    <ImageIcon size={24} color="#3B82F6" />
                                </View>
                                <Text style={styles.attachmentLabel}>相册</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.attachmentItem}
                                onPress={handleFile}
                            >
                                <View style={[styles.attachmentIcon, { backgroundColor: '#F3E8FF' }]}>
                                    <File size={24} color="#8B5CF6" />
                                </View>
                                <Text style={styles.attachmentLabel}>文件</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </TouchableOpacity>
            </Modal>
        </SafeAreaView>
    );
};

// ... keep styles same
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
    // 附件菜单样式
    attachmentOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        justifyContent: 'flex-end',
    },
    attachmentContainer: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingHorizontal: 16,
        paddingBottom: Platform.OS === 'ios' ? 34 : 24,
    },
    attachmentHandle: {
        width: 40,
        height: 4,
        backgroundColor: '#E4E4E7',
        borderRadius: 2,
        alignSelf: 'center',
        marginTop: 12,
        marginBottom: 16,
    },
    attachmentTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#09090B',
        textAlign: 'center',
        marginBottom: 20,
    },
    attachmentGrid: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingHorizontal: 20,
    },
    attachmentItem: {
        alignItems: 'center',
    },
    attachmentIcon: {
        width: 56,
        height: 56,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    attachmentLabel: {
        fontSize: 13,
        color: '#71717A',
    },
});

export default ChatRoomScreen;
