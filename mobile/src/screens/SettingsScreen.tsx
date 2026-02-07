import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    TouchableOpacity,
    Platform,
    Modal,
} from 'react-native';
import { ArrowLeft, ChevronRight, Info } from 'lucide-react-native';
import { useAuthStore } from '../store/authStore';
import { useToast } from '../components/Toast';

const PRIMARY_GOLD = '#D4AF37';

interface SettingsScreenProps {
    navigation: any;
}

const SettingsScreen: React.FC<SettingsScreenProps> = ({ navigation }) => {
    const { logout } = useAuthStore();
    const { showConfirm } = useToast();
    const [devModalVisible, setDevModalVisible] = useState(false);
    const [devMessage, setDevMessage] = useState('');

    // 显示开发中弹框
    const showDevModal = (feature: string) => {
        setDevMessage(`${feature}功能正在开发中，敬请期待！`);
        setDevModalVisible(true);
    };

    // 退出登录
    const handleLogout = () => {
        showConfirm({
            title: '确认退出',
            message: '确定要退出登录吗？',
            confirmText: '退出',
            cancelText: '取消',
            onConfirm: logout,
        });
    };

    // 设置菜单项
    const menuSections = [
        {
            items: [
                { label: '个人信息', onPress: () => navigation.navigate('PersonalInfo') },
            ]
        },
        {
            items: [
                { label: '账号安全', onPress: () => navigation.navigate('AccountSecurity') },
                { label: '身份管理', onPress: () => navigation.navigate('IdentityManagement') },
                { label: '隐私设置', onPress: () => showDevModal('隐私设置') },
            ]
        },
        {
            items: [
                { label: '支付设置', onPress: () => showDevModal('支付设置') },
                { label: '消息通知', onPress: () => showDevModal('消息通知') },
                { label: '通用设置', onPress: () => showDevModal('通用设置') },
                { label: '清理缓存', onPress: () => showDevModal('清理缓存') },
            ]
        },
        {
            items: [
                { label: '关于', onPress: () => showDevModal('关于') },
                { label: '意见反馈', onPress: () => showDevModal('意见反馈') },
            ]
        },
    ];

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ArrowLeft size={24} color="#09090B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>设置</Text>
                <View style={styles.placeholder} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {menuSections.map((section, sectionIndex) => (
                    <View key={sectionIndex} style={styles.section}>
                        {section.items.map((item, itemIndex) => (
                            <TouchableOpacity
                                key={itemIndex}
                                style={[
                                    styles.menuItem,
                                    itemIndex === section.items.length - 1 && styles.menuItemLast
                                ]}
                                onPress={item.onPress}
                            >
                                <Text style={styles.menuLabel}>{item.label}</Text>
                                <ChevronRight size={18} color="#A1A1AA" />
                            </TouchableOpacity>
                        ))}
                    </View>
                ))}

                {/* 退出登录 */}
                <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                    <Text style={styles.logoutText}>退出登录</Text>
                </TouchableOpacity>

                <View style={styles.bottomSpacer} />
            </ScrollView>

            {/* 开发中弹框 */}
            <Modal visible={devModalVisible} transparent animationType="fade">
                <View style={styles.dialogOverlay}>
                    <View style={styles.dialogContainer}>
                        <View style={styles.dialogIconContainer}>
                            <Info size={32} color={PRIMARY_GOLD} />
                        </View>
                        <Text style={styles.dialogTitle}>功能开发中</Text>
                        <Text style={styles.dialogMessage}>{devMessage}</Text>
                        <TouchableOpacity style={styles.dialogBtn} onPress={() => setDevModalVisible(false)}>
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
        backgroundColor: '#F5F5F5',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'ios' ? 12 : 44,
        paddingBottom: 12,
        backgroundColor: '#F5F5F5',
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
        paddingHorizontal: 16,
    },
    section: {
        backgroundColor: '#FFFFFF',
        marginTop: 12,
        borderRadius: 12,
        overflow: 'hidden',
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        paddingHorizontal: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#F0F0F0',
    },
    menuItemLast: {
        borderBottomWidth: 0,
    },
    menuLabel: {
        fontSize: 16,
        color: '#09090B',
    },
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
        fontSize: 16,
        fontWeight: '500',
    },
    bottomSpacer: {
        height: 40,
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
    },
    dialogMessage: {
        fontSize: 14,
        color: '#71717A',
        textAlign: 'center',
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

export default SettingsScreen;
