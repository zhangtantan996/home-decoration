import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    TouchableOpacity,
    Platform,
} from 'react-native';
import {
    ArrowLeft,
    ChevronRight,
    User,
    Shield,
    Eye,
    CreditCard,
    Bell,
    Settings,
    Info,
    MessageSquarePlus,
    LogOut,
} from 'lucide-react-native';
import { useAuthStore } from '../store/authStore';
import { useToast } from '../components/Toast';

const PRIMARY_GOLD = '#D4AF37';
const GOLD_LIGHT = '#F5ECD0';

interface SettingsScreenProps {
    navigation: any;
}

interface MenuItem {
    label: string;
    icon: React.ReactNode;
    iconBg: string;
    onPress: () => void;
    value?: string;
    danger?: boolean;
}

interface Section {
    title: string;
    items: MenuItem[];
}

const SettingsScreen: React.FC<SettingsScreenProps> = ({ navigation }) => {
    const { logout } = useAuthStore();
    const { showConfirm } = useToast();

    const handleLogout = () => {
        showConfirm({
            title: '确认退出',
            message: '确定要退出登录吗？',
            confirmText: '退出',
            cancelText: '取消',
            onConfirm: logout,
        });
    };

    const sections: Section[] = [
        {
            title: '账号',
            items: [
                {
                    label: '个人信息',
                    icon: <User size={18} color="#3B82F6" />,
                    iconBg: '#EFF6FF',
                    onPress: () => navigation.navigate('PersonalInfo'),
                },
                {
                    label: '账号安全',
                    icon: <Shield size={18} color="#8B5CF6" />,
                    iconBg: '#F3F0FF',
                    onPress: () => navigation.navigate('AccountSecurity'),
                },
                {
                    label: '隐私设置',
                    icon: <Eye size={18} color="#10B981" />,
                    iconBg: '#ECFDF5',
                    onPress: () => navigation.navigate('PrivacySettings'),
                },
            ],
        },
        {
            title: '偏好',
            items: [
                {
                    label: '支付设置',
                    icon: <CreditCard size={18} color={PRIMARY_GOLD} />,
                    iconBg: GOLD_LIGHT,
                    onPress: () => navigation.navigate('PaymentSettings'),
                },
                {
                    label: '消息通知',
                    icon: <Bell size={18} color="#F97316" />,
                    iconBg: '#FFF7ED',
                    onPress: () => navigation.navigate('NotificationSettings'),
                },
                {
                    label: '通用设置',
                    icon: <Settings size={18} color="#6366F1" />,
                    iconBg: '#EEF2FF',
                    onPress: () => navigation.navigate('GeneralSettings'),
                },
            ],
        },
        {
            title: '关于',
            items: [
                {
                    label: '关于',
                    icon: <Info size={18} color="#0EA5E9" />,
                    iconBg: '#F0F9FF',
                    onPress: () => navigation.navigate('About'),
                },
                {
                    label: '意见反馈',
                    icon: <MessageSquarePlus size={18} color="#EC4899" />,
                    iconBg: '#FDF2F8',
                    onPress: () => navigation.navigate('Feedback'),
                },
            ],
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
                {sections.map((section, si) => (
                    <View key={si}>
                        <Text style={styles.sectionLabel}>{section.title}</Text>
                        <View style={styles.card}>
                            {section.items.map((item, ii) => (
                                <View key={ii}>
                                    <TouchableOpacity style={styles.menuItem} onPress={item.onPress}>
                                        <View style={[styles.iconBox, { backgroundColor: item.iconBg }]}>
                                            {item.icon}
                                        </View>
                                        <Text style={styles.menuLabel}>{item.label}</Text>
                                        <ChevronRight size={18} color="#A1A1AA" />
                                    </TouchableOpacity>
                                    {ii !== section.items.length - 1 && (
                                        <View style={styles.divider} />
                                    )}
                                </View>
                            ))}
                        </View>
                    </View>
                ))}

                {/* 退出登录 */}
                <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                    <LogOut size={18} color="#EF4444" />
                    <Text style={styles.logoutText}>退出登录</Text>
                </TouchableOpacity>

                <View style={styles.bottomSpacer} />
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F5F7FA' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'ios' ? 12 : 44,
        paddingBottom: 12,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#E4E4E7',
    },
    backBtn: { padding: 4 },
    headerTitle: { fontSize: 17, fontWeight: '600', color: '#09090B' },
    placeholder: { width: 32 },
    content: { flex: 1, paddingHorizontal: 16 },
    sectionLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#71717A',
        marginTop: 22,
        marginBottom: 10,
        marginLeft: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 3,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        gap: 14,
    },
    iconBox: {
        width: 38,
        height: 38,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    menuLabel: { flex: 1, fontSize: 16, color: '#09090B' },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#F0F0F0', marginLeft: 68 },
    logoutBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: 28,
        backgroundColor: '#FFFFFF',
        paddingVertical: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#FECACA',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 2,
    },
    logoutText: { color: '#EF4444', fontSize: 16, fontWeight: '600' },
    bottomSpacer: { height: 40 },
});

export default SettingsScreen;
