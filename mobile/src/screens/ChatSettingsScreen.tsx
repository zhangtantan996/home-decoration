import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    TouchableOpacity,
    Platform,
    Switch,
    TextInput,
    Modal,
    Image,
} from 'react-native';
import {
    ArrowLeft,
    Trash2,
    ChevronRight,
    AlertCircle,
    CheckCircle,
    Info,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { reportApi, tinodeApi } from '../services/api';

// 主色调
const PRIMARY_GOLD = '#D4AF37';

interface ChatSettingsScreenProps {
    route: any;
    navigation: any;
}

const ChatSettingsScreen: React.FC<ChatSettingsScreenProps> = ({ route, navigation }) => {
    const params = route.params || {};
    const conversation = params.conversation || {};
    const chatTopic: string =
        params.topic || conversation?.conversationID || conversation?.topic || '';
    const chatPartner: string =
        params.partnerID || conversation?.partnerID || '';
    const chatPartnerIdentifier: string =
        params.partnerIdentifier || conversation?.partnerIdentifier || chatPartner;
    const chatPartnerPublicId: string =
        params.partnerPublicId || conversation?.partnerPublicId || '';
    const [isPinned, setIsPinned] = useState(false);
    const [isBlocked, setIsBlocked] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false);
    const [reportContent, setReportContent] = useState('');
    const [submittingReport, setSubmittingReport] = useState(false);
    const [dialogConfig, setDialogConfig] = useState<{
        visible: boolean;
        type: 'info' | 'confirm' | 'success';
        title: string;
        message: string;
        onConfirm?: () => void;
    }>({ visible: false, type: 'info', title: '', message: '' });

    // 关闭弹窗
    const closeDialog = () => {
        setDialogConfig(prev => ({ ...prev, visible: false }));
    };

    // 查找聊天记录
    const handleSearch = () => {
        setDialogConfig({
            visible: true,
            type: 'info',
            title: '功能开发中',
            message: '查找聊天记录功能正在开发中，敬请期待！',
        });
    };

    // 清空聊天记录
    const handleClearChat = () => {
        setDialogConfig({
            visible: true,
            type: 'confirm',
            title: '清空聊天记录',
            message: '确定要清空与该用户的聊天记录吗？此操作不可恢复。',
            onConfirm: async () => {
                if (!chatTopic) {
                    setTimeout(() => {
                        setDialogConfig({
                            visible: true,
                            type: 'info',
                            title: '清空失败',
                            message: '缺少会话信息，无法清空聊天记录。',
                        });
                    }, 0);
                    return;
                }

                try {
                    await tinodeApi.clearTopicMessages(chatTopic);
                } catch (error) {
                    console.error('[ChatSettings] Failed to clear messages on server:', error);
                    setTimeout(() => {
                        setDialogConfig({
                            visible: true,
                            type: 'info',
                            title: '清空失败',
                            message: '服务端清空失败，请稍后重试。',
                        });
                    }, 0);
                    return;
                }

                const now = Date.now();
                try {
                    await AsyncStorage.setItem(`chat_clear_${chatTopic}`, String(now));
                } catch (e) {
                    console.warn('[ChatSettings] Failed to persist clear marker:', e);
                }

                setTimeout(() => {
                    setDialogConfig({
                        visible: true,
                        type: 'success',
                        title: '清空成功',
                        message: '聊天记录已清空。',
                    });
                }, 0);
            },
        });
    };

    // 提交举报
    const handleSubmitReport = async () => {
        const reason = reportContent.trim();
        if (!reason) {
            setDialogConfig({
                visible: true,
                type: 'info',
                title: '请输入举报内容',
                message: '请填写您要举报的具体原因。',
            });
            return;
        }

        if (!chatTopic) {
            setDialogConfig({
                visible: true,
                type: 'info',
                title: '举报失败',
                message: '缺少会话信息，无法提交举报。',
            });
            return;
        }

        setSubmittingReport(true);
        try {
            await reportApi.submitChatReport({
                topic: chatTopic,
                reason,
                partner: chatPartnerPublicId ? String(chatPartnerPublicId) : chatPartnerIdentifier ? String(chatPartnerIdentifier) : undefined,
            });

            setShowReportModal(false);
            setReportContent('');
            setDialogConfig({
                visible: true,
                type: 'success',
                title: '举报成功',
                message: '感谢您的反馈，我们将尽快处理。',
            });
        } catch (error) {
            console.error('[ChatSettings] Failed to submit report:', error);
            setDialogConfig({
                visible: true,
                type: 'info',
                title: '举报失败',
                message: '提交失败，请稍后重试。',
            });
        } finally {
            setSubmittingReport(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ArrowLeft size={24} color="#09090B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>聊天信息</Text>
                <View style={styles.placeholder} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* 用户信息卡片 */}
                <View style={styles.userCard}>
                    <Image
                        source={{ uri: conversation?.avatar || 'https://via.placeholder.com/60' }}
                        style={styles.userAvatar}
                    />
                    <Text style={styles.userName}>{conversation?.name || '用户'}</Text>
                    <Text style={styles.userRole}>{conversation?.roleLabel || '服务商'}</Text>
                </View>

                {/* 功能列表 */}
                <View style={styles.section}>
                    {/* 查找聊天记录 */}
                    <TouchableOpacity style={styles.menuItem} onPress={handleSearch}>
                        <Text style={styles.menuItemText}>查找聊天记录</Text>
                        <ChevronRight size={20} color="#A1A1AA" />
                    </TouchableOpacity>

                    <View style={styles.divider} />

                    {/* 置顶聊天 */}
                    <View style={styles.menuItem}>
                        <Text style={styles.menuItemText}>置顶聊天</Text>
                        <Switch
                            value={isPinned}
                            onValueChange={setIsPinned}
                            trackColor={{ false: '#E4E4E7', true: PRIMARY_GOLD }}
                            thumbColor="#FFFFFF"
                        />
                    </View>

                    <View style={styles.divider} />

                    {/* 屏蔽消息 */}
                    <View style={styles.menuItemColumn}>
                        <View style={styles.menuItem}>
                            <Text style={styles.menuItemText}>屏蔽消息</Text>
                            <Switch
                                value={isBlocked}
                                onValueChange={setIsBlocked}
                                trackColor={{ false: '#E4E4E7', true: PRIMARY_GOLD }}
                                thumbColor="#FFFFFF"
                            />
                        </View>
                        <Text style={styles.menuItemHint}>开启后将不再接收TA的消息</Text>
                    </View>
                </View>

                {/* 举报区域 */}
                <View style={styles.section}>
                    <TouchableOpacity style={styles.menuItem} onPress={() => setShowReportModal(true)}>
                        <Text style={styles.menuItemText}>举报</Text>
                        <ChevronRight size={20} color="#A1A1AA" />
                    </TouchableOpacity>
                </View>

                {/* 清空聊天记录按钮 */}
                <TouchableOpacity style={styles.clearBtn} onPress={handleClearChat}>
                    <Trash2 size={18} color="#EF4444" />
                    <Text style={styles.clearBtnText}>清空聊天记录</Text>
                </TouchableOpacity>

                <View style={{ height: 40 }} />
            </ScrollView>

            {/* 举报弹窗 */}
            <Modal
                visible={showReportModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowReportModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.reportModal}>
                        <Text style={styles.reportTitle}>举报用户</Text>
                        <Text style={styles.reportSubtitle}>请填写举报原因（100字以内）</Text>

                        <View style={styles.reportInputContainer}>
                            <TextInput
                                style={styles.reportInput}
                                placeholder="请描述您要举报的具体问题..."
                                placeholderTextColor="#A1A1AA"
                                value={reportContent}
                                onChangeText={(text) => setReportContent(text.slice(0, 100))}
                                multiline
                                maxLength={100}
                            />
                            <Text style={styles.charCount}>{reportContent.length}/100</Text>
                        </View>

                        <View style={styles.reportButtons}>
                            <TouchableOpacity
                                style={[styles.reportBtn, styles.reportBtnCancel]}
                                onPress={() => {
                                    setShowReportModal(false);
                                    setReportContent('');
                                }}
                                disabled={submittingReport}
                            >
                                <Text style={styles.reportBtnCancelText}>取消</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.reportBtn,
                                    styles.reportBtnSubmit,
                                    submittingReport && styles.reportBtnDisabled,
                                ]}
                                onPress={handleSubmitReport}
                                disabled={submittingReport}
                            >
                                <Text style={styles.reportBtnSubmitText}>
                                    {submittingReport ? '提交中...' : '提交'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
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

                        <Text style={styles.dialogTitle}>{dialogConfig.title}</Text>
                        <Text style={styles.dialogMessage}>{dialogConfig.message}</Text>

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
    headerTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: '#09090B',
    },
    placeholder: {
        width: 32,
    },
    content: {
        flex: 1,
    },
    // 用户信息卡片
    userCard: {
        alignItems: 'center',
        paddingVertical: 24,
        backgroundColor: '#FFFFFF',
        marginBottom: 12,
    },
    userAvatar: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#E5E7EB',
        marginBottom: 12,
    },
    userName: {
        fontSize: 18,
        fontWeight: '700',
        color: '#09090B',
        marginBottom: 4,
    },
    userRole: {
        fontSize: 13,
        color: '#71717A',
    },
    // 功能区块
    section: {
        backgroundColor: '#FFFFFF',
        marginBottom: 12,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    menuItemColumn: {
        paddingBottom: 14,
    },
    menuItemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    menuIcon: {
        width: 36,
        height: 36,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    menuItemText: {
        fontSize: 15,
        color: '#09090B',
    },
    menuItemHint: {
        fontSize: 12,
        color: '#A1A1AA',
        marginLeft: 16,
        marginTop: -4,
    },
    divider: {
        height: 1,
        backgroundColor: '#F4F4F5',
        marginLeft: 16,
    },
    // 清空按钮
    clearBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        paddingVertical: 16,
        marginTop: 12,
    },
    clearBtnText: {
        fontSize: 15,
        color: '#EF4444',
        fontWeight: '500',
        marginLeft: 8,
    },
    // 举报弹窗
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    reportModal: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 20,
        width: '100%',
        maxWidth: 340,
    },
    reportTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#09090B',
        textAlign: 'center',
        marginBottom: 8,
    },
    reportSubtitle: {
        fontSize: 13,
        color: '#71717A',
        textAlign: 'center',
        marginBottom: 16,
    },
    reportInputContainer: {
        backgroundColor: '#F4F4F5',
        borderRadius: 10,
        padding: 12,
        marginBottom: 16,
    },
    reportInput: {
        fontSize: 14,
        color: '#09090B',
        minHeight: 100,
        textAlignVertical: 'top',
    },
    charCount: {
        fontSize: 12,
        color: '#A1A1AA',
        textAlign: 'right',
        marginTop: 8,
    },
    reportButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    reportBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
    },
    reportBtnCancel: {
        backgroundColor: '#F4F4F5',
    },
    reportBtnCancelText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#71717A',
    },
    reportBtnSubmit: {
        backgroundColor: PRIMARY_GOLD,
    },
    reportBtnDisabled: {
        opacity: 0.6,
    },
    reportBtnSubmitText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#FFFFFF',
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

export default ChatSettingsScreen;
