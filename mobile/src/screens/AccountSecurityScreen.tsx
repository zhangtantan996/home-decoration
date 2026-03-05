import React, { useState, useCallback } from 'react';
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
    Smartphone,
    Lock,
    ShieldCheck,
    ShieldOff,
    UserCheck,
} from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuthStore } from '../store/authStore';
import { userSettingsApi } from '../services/api';

const PRIMARY_GOLD = '#D4AF37';
const GOLD_LIGHT = '#F5ECD0';

interface AccountSecurityScreenProps {
    navigation: any;
}

const AccountSecurityScreen: React.FC<AccountSecurityScreenProps> = ({ navigation }) => {
    const { user } = useAuthStore();
    const [verificationStatus, setVerificationStatus] = useState<string>('未认证');

    useFocusEffect(
        useCallback(() => {
            fetchVerificationStatus();
        }, [])
    );

    const fetchVerificationStatus = async () => {
        try {
            const res = await userSettingsApi.getVerification();
            if (res.data) {
                if (res.data.status === 0) setVerificationStatus('审核中');
                else if (res.data.status === 1) setVerificationStatus('已认证');
                else if (res.data.status === 2) setVerificationStatus('未通过');
                else setVerificationStatus('未认证');
            } else {
                setVerificationStatus('未认证');
            }
        } catch (error) {
            console.error('Failed to fetch verification status', error);
        }
    };

    const menuItems = [
        {
            label: '修改手机号',
            icon: <Smartphone size={18} color="#3B82F6" />,
            iconBg: '#EFF6FF',
            value: user?.phone?.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') || '未绑定',
            onPress: () => navigation.navigate('ChangePhone'),
        },
        {
            label: '修改登录密码',
            icon: <Lock size={18} color="#8B5CF6" />,
            iconBg: '#F3F0FF',
            value: null,
            onPress: () => navigation.navigate('ChangePassword'),
        },
        {
            label: '实名认证',
            icon: <UserCheck size={18} color={PRIMARY_GOLD} />,
            iconBg: GOLD_LIGHT,
            value: verificationStatus,
            onPress: () => navigation.navigate('RealNameAuth'),
        },
        {
            label: '登录设备管理',
            icon: <ShieldCheck size={18} color="#10B981" />,
            iconBg: '#ECFDF5',
            value: null,
            onPress: () => navigation.navigate('LoginDevices'),
        },
        {
            label: '注销账号',
            icon: <ShieldOff size={18} color="#EF4444" />,
            iconBg: '#FFF5F5',
            value: null,
            danger: true,
            hint: '注销后无法恢复，请谨慎操作',
            onPress: () => navigation.navigate('DeleteAccount'),
        },
    ];

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ArrowLeft size={24} color="#09090B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>账号安全</Text>
                <View style={styles.placeholder} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                <Text style={styles.sectionLabel}>安全设置</Text>
                <View style={styles.card}>
                    {menuItems.map((item, index) => (
                        <View key={item.label}>
                            <TouchableOpacity style={styles.menuItem} onPress={item.onPress}>
                                <View style={[styles.iconBox, { backgroundColor: item.iconBg }]}>
                                    {item.icon}
                                </View>
                                <View style={styles.labelContainer}>
                                    <Text style={[styles.menuLabel, item.danger && styles.menuLabelDanger]}>
                                        {item.label}
                                    </Text>
                                    {item.hint && (
                                        <Text style={styles.dangerHint}>{item.hint}</Text>
                                    )}
                                </View>
                                {item.value && (
                                    <Text style={styles.menuValue}>{item.value}</Text>
                                )}
                                <ChevronRight size={18} color="#A1A1AA" />
                            </TouchableOpacity>
                            {index !== menuItems.length - 1 && (
                                <View style={styles.divider} />
                            )}
                        </View>
                    ))}
                </View>

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
    labelContainer: { flex: 1 },
    menuLabel: { fontSize: 16, color: '#09090B' },
    menuLabelDanger: { color: '#EF4444' },
    menuValue: { fontSize: 14, color: '#A1A1AA', marginRight: 4 },
    dangerHint: { fontSize: 11, color: '#EF4444', marginTop: 2 },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#F0F0F0', marginLeft: 68 },
    bottomSpacer: { height: 40 },
});

export default AccountSecurityScreen;
