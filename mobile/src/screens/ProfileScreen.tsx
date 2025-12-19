import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    TouchableOpacity,
    ScrollView,
    Platform,
    Image,
    Modal,
} from 'react-native';
import {
    Settings,
    FileText,
    Heart,
    MapPin,
    Ticket,
    MessageCircle,
    Calculator,
    ImageIcon,
    Headphones,
    Shield,
    ChevronRight,
    Info,
} from 'lucide-react-native';
import { useAuthStore } from '../store/authStore';
import { useToast } from '../components/Toast';

// 主色调
const PRIMARY_GOLD = '#D4AF37';

// Mock 当前项目数据
const MOCK_PROJECT = {
    name: '上海·汤臣一品 别墅装修',
    stage: '报价阶段',
    progress: 30,
    budget: '280万',
    estimatedDays: 12,
};

// Mock 最新消息
const MOCK_MESSAGE = {
    sender: '设计顾问 - Jason',
    time: '10:42 AM',
    preview: '您的初步平面布局方案已经调整完毕...',
};

const ProfileScreen = ({ navigation }: any) => {
    const { user, logout } = useAuthStore();
    const { showConfirm } = useToast();
    const [dialogVisible, setDialogVisible] = useState(false);
    const [dialogMessage, setDialogMessage] = useState('');

    const handleServicePress = (label: string) => {
        setDialogMessage(`${label}功能正在开发中，敬请期待！`);
        setDialogVisible(true);
    };

    const handleLogout = () => {
        showConfirm({
            title: '确认退出',
            message: '确定要退出登录吗？',
            confirmText: '退出',
            cancelText: '取消',
            onConfirm: logout,
        });
    };

    // 快捷统计数据
    const quickStats = [
        { label: '我的收藏', value: 12 },
        { label: '浏览足迹', value: 48 },
        { label: '卡券包', value: 3 },
        { label: '待处理', value: 1, hasRedDot: true },
    ];

    // 更多服务
    const moreServices = [
        { icon: Calculator, label: '装修算价' },
        { icon: ImageIcon, label: '设计图库' },
        { icon: Headphones, label: '专属客服' },
        { icon: Shield, label: '隐私保护' },
    ];

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView showsVerticalScrollIndicator={false}>
                {/* 用户信息区 */}
                <View style={styles.userSection}>
                    <View style={styles.userInfo}>
                        <View style={styles.avatar}>
                            {user?.avatar ? (
                                <Image source={{ uri: user.avatar }} style={styles.avatarImage} />
                            ) : (
                                <Text style={styles.avatarText}>
                                    {user?.nickname?.[0] || user?.phone?.[0] || '👤'}
                                </Text>
                            )}
                        </View>
                        <View style={styles.userDetails}>
                            <Text style={styles.userName}>
                                {user?.nickname || `用户${user?.phone?.slice(-4) || ''}`}
                            </Text>
                            <View style={styles.memberBadge}>
                                <Text style={styles.memberBadgeText}>BLACK MEMBER</Text>
                            </View>
                        </View>
                    </View>
                    <TouchableOpacity style={styles.settingsBtn} onPress={() => navigation.navigate('Settings')}>
                        <Settings size={22} color="#71717A" />
                    </TouchableOpacity>
                </View>

                {/* 当前项目卡片 */}
                <View style={styles.projectCard}>
                    <View style={styles.projectHeader}>
                        <View style={styles.projectLabelRow}>
                            <FileText size={16} color={PRIMARY_GOLD} />
                            <Text style={styles.projectLabel}>当前项目</Text>
                        </View>
                        <TouchableOpacity style={styles.viewDetailBtn}>
                            <Text style={styles.viewDetailText}>查看详情</Text>
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.projectName}>{MOCK_PROJECT.name}</Text>

                    {/* 进度条 */}
                    <View style={styles.progressSection}>
                        <View style={styles.progressLabelRow}>
                            <Text style={styles.stageText}>{MOCK_PROJECT.stage}</Text>
                            <Text style={styles.progressText}>已完成 {MOCK_PROJECT.progress}%</Text>
                        </View>
                        <View style={styles.progressBarContainer}>
                            <View style={[styles.progressBar, { width: `${MOCK_PROJECT.progress}%` }]} />
                        </View>
                    </View>

                    {/* 预算和时间 */}
                    <View style={styles.projectStats}>
                        <View style={styles.projectStatItem}>
                            <Text style={styles.projectStatValue}>¥{MOCK_PROJECT.budget}</Text>
                            <Text style={styles.projectStatLabel}>预估报价</Text>
                        </View>
                        <View style={styles.projectStatItem}>
                            <Text style={styles.projectStatValue}>{MOCK_PROJECT.estimatedDays}天</Text>
                            <Text style={styles.projectStatLabel}>预计耗时</Text>
                        </View>
                    </View>
                </View>

                {/* 快捷统计 */}
                <View style={styles.quickStatsRow}>
                    {quickStats.map((stat, index) => (
                        <TouchableOpacity key={index} style={styles.quickStatItem}>
                            <View style={styles.quickStatValueContainer}>
                                <Text style={styles.quickStatValue}>{stat.value}</Text>
                                {stat.hasRedDot && <View style={styles.redDot} />}
                            </View>
                            <Text style={styles.quickStatLabel}>{stat.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* 最新消息预览 */}
                <TouchableOpacity style={styles.messagePreview}>
                    <View style={styles.messageIcon}>
                        <MessageCircle size={20} color="#71717A" />
                    </View>
                    <View style={styles.messageContent}>
                        <View style={styles.messageHeader}>
                            <Text style={styles.messageSender}>{MOCK_MESSAGE.sender}</Text>
                            <Text style={styles.messageTime}>{MOCK_MESSAGE.time}</Text>
                        </View>
                        <Text style={styles.messageText} numberOfLines={1}>
                            {MOCK_MESSAGE.preview}
                        </Text>
                    </View>
                    <View style={styles.messageUnread} />
                </TouchableOpacity>

                {/* 更多服务 */}
                <View style={styles.moreServicesSection}>
                    <Text style={styles.sectionTitle}>更多服务</Text>
                    <View style={styles.servicesGrid}>
                        {moreServices.map((service, index) => (
                            <TouchableOpacity key={index} style={styles.serviceItem} onPress={() => handleServicePress(service.label)}>
                                <View style={styles.serviceIconContainer}>
                                    <service.icon size={24} color="#09090B" />
                                </View>
                                <Text style={styles.serviceLabel}>{service.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>

            {/* 自定义弹窗 */}
            <Modal
                visible={dialogVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setDialogVisible(false)}
            >
                <View style={styles.dialogOverlay}>
                    <View style={styles.dialogContainer}>
                        <View style={styles.dialogIconContainer}>
                            <Info size={32} color={PRIMARY_GOLD} />
                        </View>
                        <Text style={styles.dialogTitle}>功能开发中</Text>
                        <Text style={styles.dialogMessage}>{dialogMessage}</Text>
                        <TouchableOpacity
                            style={styles.dialogBtn}
                            onPress={() => setDialogVisible(false)}
                        >
                            <Text style={styles.dialogBtnText}>知道了</Text>
                        </TouchableOpacity>
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
    // 用户信息区
    userSection: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'ios' ? 20 : 50,
        paddingBottom: 20,
        backgroundColor: '#FFFFFF',
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#E5E7EB',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    avatarImage: {
        width: 56,
        height: 56,
        borderRadius: 28,
    },
    avatarText: {
        fontSize: 24,
        color: '#71717A',
    },
    userDetails: {
        marginLeft: 14,
    },
    userName: {
        fontSize: 18,
        fontWeight: '700',
        color: '#09090B',
        marginBottom: 6,
    },
    memberBadge: {
        backgroundColor: '#1C1C1E',
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 4,
    },
    memberBadgeText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '600',
        letterSpacing: 0.5,
    },
    settingsBtn: {
        padding: 8,
    },
    // 项目卡片
    projectCard: {
        marginHorizontal: 16,
        marginTop: 16,
        backgroundColor: '#1C1C1E',
        borderRadius: 16,
        padding: 20,
    },
    projectHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    projectLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    projectLabel: {
        color: PRIMARY_GOLD,
        fontSize: 13,
        fontWeight: '600',
        marginLeft: 6,
    },
    viewDetailBtn: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
    },
    viewDetailText: {
        color: '#09090B',
        fontSize: 12,
        fontWeight: '600',
    },
    projectName: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 16,
    },
    progressSection: {
        marginBottom: 16,
    },
    progressLabelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    stageText: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 13,
    },
    progressBarContainer: {
        height: 6,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 3,
    },
    progressBar: {
        height: 6,
        backgroundColor: PRIMARY_GOLD,
        borderRadius: 3,
    },
    progressText: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 12,
    },
    projectStats: {
        flexDirection: 'row',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
        paddingTop: 16,
    },
    projectStatItem: {
        flex: 1,
    },
    projectStatValue: {
        color: '#FFFFFF',
        fontSize: 22,
        fontWeight: '700',
        marginBottom: 4,
    },
    projectStatLabel: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 12,
    },
    // 快捷统计
    quickStatsRow: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        marginHorizontal: 16,
        marginTop: 16,
        borderRadius: 12,
        paddingVertical: 20,
    },
    quickStatItem: {
        flex: 1,
        alignItems: 'center',
    },
    quickStatValueContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    quickStatValue: {
        fontSize: 22,
        fontWeight: '700',
        color: '#09090B',
    },
    redDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#EF4444',
        marginLeft: 2,
        marginTop: 2,
    },
    quickStatLabel: {
        fontSize: 12,
        color: '#71717A',
        marginTop: 6,
    },
    // 消息预览
    messagePreview: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        marginHorizontal: 16,
        marginTop: 16,
        borderRadius: 12,
        padding: 16,
    },
    messageIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F4F4F5',
        justifyContent: 'center',
        alignItems: 'center',
    },
    messageContent: {
        flex: 1,
        marginLeft: 12,
    },
    messageHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    messageSender: {
        fontSize: 14,
        fontWeight: '600',
        color: '#09090B',
    },
    messageTime: {
        fontSize: 12,
        color: '#A1A1AA',
    },
    messageText: {
        fontSize: 13,
        color: '#71717A',
    },
    messageUnread: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: PRIMARY_GOLD,
        marginLeft: 8,
    },
    // 更多服务
    moreServicesSection: {
        marginTop: 24,
        paddingHorizontal: 16,
    },
    sectionTitle: {
        fontSize: 14,
        color: '#71717A',
        marginBottom: 12,
    },
    servicesGrid: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        paddingVertical: 20,
    },
    serviceItem: {
        flex: 1,
        alignItems: 'center',
    },
    serviceIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: '#F4F4F5',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    serviceLabel: {
        fontSize: 12,
        color: '#09090B',
    },
    // 退出登录
    logoutBtn: {
        marginHorizontal: 16,
        marginTop: 32,
        backgroundColor: '#FFFFFF',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    logoutText: {
        color: '#EF4444',
        fontSize: 15,
        fontWeight: '600',
    },
    // 弹窗样式
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
        backgroundColor: '#FFFBEB',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
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
    dialogBtn: {
        width: '100%',
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
        backgroundColor: PRIMARY_GOLD,
    },
    dialogBtnText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#FFFFFF',
    },
});

export default ProfileScreen;
