import React, { useState } from 'react';
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
    Smartphone,
    Monitor,
    Tablet,
    CheckCircle,
    Wifi,
    LogOut,
    MapPin,
} from 'lucide-react-native';
import { useToast } from '../components/Toast';
import { userSettingsApi } from '../services/api';
import { formatServerDate } from '../utils/serverTime';

const PRIMARY_GOLD = '#D4AF37';
const GOLD_LIGHT = '#F5ECD0';

interface Device {
    id: string;
    name: string;
    os: string;
    location: string;
    lastActive: string;
    isCurrent: boolean;
    type: 'mobile' | 'desktop' | 'tablet';
}

interface LoginDevicesScreenProps {
    navigation: any;
}

const MOCK_DEVICES: Device[] = [
    {
        id: '1',
        name: 'iPhone 15 Pro',
        os: 'iOS 17.2',
        location: '上海市 · 中国移动',
        lastActive: '当前设备',
        isCurrent: true,
        type: 'mobile',
    },
    {
        id: '2',
        name: 'Xiaomi 14 Ultra',
        os: 'Android 14',
        location: '北京市 · 联通',
        lastActive: '3天前',
        isCurrent: false,
        type: 'mobile',
    },
    {
        id: '3',
        name: 'MacBook Pro',
        os: 'macOS Sonoma',
        location: '上海市 · 电信',
        lastActive: '1周前',
        isCurrent: false,
        type: 'desktop',
    },
    {
        id: '4',
        name: 'iPad Pro',
        os: 'iPadOS 17',
        location: '广州市 · 移动',
        lastActive: '2周前',
        isCurrent: false,
        type: 'tablet',
    },
];

const LoginDevicesScreen: React.FC<LoginDevicesScreenProps> = ({ navigation }) => {
    const { showAlert } = useToast();
    const [devices, setDevices] = useState<Device[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchDevices = async () => {
        try {
            setLoading(true);
            const res = await userSettingsApi.getDevices();
            if (res.data?.devices) {
                // Map API response to Component format
                const mappedDevices = res.data.devices.map((d: any) => ({
                    id: d.id.toString(),
                    name: d.deviceName || 'Unknown Device',
                    os: d.os || 'Unknown OS',
                    location: d.location || 'Unknown Location',
                    lastActive: d.isCurrent ? '当前设备' : formatServerDate(d.lastLoginAt, '未知'),
                    isCurrent: d.isCurrent,
                    type: d.deviceType || 'mobile',
                }));
                setDevices(mappedDevices);
            }
        } catch (error) {
            console.error('Fetch devices err:', error);
            showAlert('提示', '无法获取设备列表');
        } finally {
            setLoading(false);
        }
    };

    React.useEffect(() => {
        fetchDevices();
    }, []);

    const DeviceIcon = ({ type }: { type: Device['type'] }) => {
        const iconProps = { size: 22, color: PRIMARY_GOLD };
        if (type === 'desktop') return <Monitor {...iconProps} />;
        if (type === 'tablet') return <Tablet {...iconProps} />;
        return <Smartphone {...iconProps} />;
    };

    const handleSignOut = (device: Device) => {
        showAlert(
            '下线确认',
            `确定要将「${device.name}」下线吗？`,
            [
                { text: '取消', style: 'cancel' },
                {
                    text: '下线',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await userSettingsApi.removeDevice(parseInt(device.id, 10));
                            setDevices(prev => prev.filter(d => d.id !== device.id));
                            showAlert('成功', '设备已下线');
                        } catch (error: any) {
                            showAlert('失败', error.response?.data?.message || '操作失败');
                        }
                    },
                },
            ]
        );
    };

    const handleSignOutAll = () => {
        const others = devices.filter(d => !d.isCurrent);
        if (others.length === 0) {
            showAlert('提示', '没有其他设备需要下线');
            return;
        }
        showAlert(
            '批量下线',
            `确定要下线全部 ${others.length} 台其他设备吗？`,
            [
                { text: '取消', style: 'cancel' },
                {
                    text: '全部下线',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await userSettingsApi.removeAllDevices();
                            setDevices(prev => prev.filter(d => d.isCurrent));
                            showAlert('成功', '已下线全部其他设备');
                        } catch (error: any) {
                            showAlert('失败', error.response?.data?.message || '操作失败');
                        }
                    },
                },
            ]
        );
    };

    const otherCount = devices.filter(d => !d.isCurrent).length;

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ArrowLeft size={24} color="#09090B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>登录设备管理</Text>
                <View style={styles.placeholder} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* 安全提示 */}
                <View style={styles.tipCard}>
                    <Wifi size={16} color={PRIMARY_GOLD} />
                    <Text style={styles.tipText}>
                        如发现陌生设备，请立即下线并修改密码，保障账号安全
                    </Text>
                </View>

                {/* 设备列表 */}
                <Text style={styles.sectionTitle}>
                    已登录设备（{devices.length}台）
                </Text>

                <View style={styles.deviceList}>
                    {devices.map((device, index) => (
                        <View
                            key={device.id}
                            style={[
                                styles.deviceCard,
                                device.isCurrent && styles.deviceCardCurrent,
                                index === devices.length - 1 && styles.deviceCardLast,
                            ]}
                        >
                            <View style={styles.deviceIconBox}>
                                <DeviceIcon type={device.type} />
                            </View>
                            <View style={styles.deviceInfo}>
                                <View style={styles.deviceNameRow}>
                                    <Text style={styles.deviceName}>{device.name}</Text>
                                    {device.isCurrent && (
                                        <View style={styles.currentBadge}>
                                            <CheckCircle size={10} color="#22C55E" />
                                            <Text style={styles.currentBadgeText}>当前</Text>
                                        </View>
                                    )}
                                </View>
                                <Text style={styles.deviceOs}>{device.os}</Text>
                                <View style={styles.deviceMeta}>
                                    <MapPin size={11} color="#A1A1AA" />
                                    <Text style={styles.deviceMetaText}>{device.location}</Text>
                                    <Text style={styles.deviceDot}>·</Text>
                                    <Text style={styles.deviceMetaText}>{device.lastActive}</Text>
                                </View>
                            </View>
                            {!device.isCurrent && (
                                <TouchableOpacity
                                    style={styles.signOutBtn}
                                    onPress={() => handleSignOut(device)}
                                >
                                    <Text style={styles.signOutText}>下线</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    ))}
                </View>

                {/* 全部下线按钮 */}
                {otherCount > 0 && (
                    <TouchableOpacity style={styles.signOutAllBtn} onPress={handleSignOutAll}>
                        <LogOut size={18} color="#EF4444" />
                        <Text style={styles.signOutAllText}>
                            下线全部其他设备（{otherCount}台）
                        </Text>
                    </TouchableOpacity>
                )}

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
    tipCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: GOLD_LIGHT,
        borderRadius: 12,
        padding: 14,
        marginTop: 16,
        gap: 10,
    },
    tipText: { flex: 1, fontSize: 13, color: '#78550A', lineHeight: 20 },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#52525B',
        marginTop: 22,
        marginBottom: 10,
        marginLeft: 4,
    },
    deviceList: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 3,
    },
    deviceCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#F0F0F0',
    },
    deviceCardCurrent: { backgroundColor: '#FAFFFE' },
    deviceCardLast: { borderBottomWidth: 0 },
    deviceIconBox: {
        width: 46,
        height: 46,
        borderRadius: 12,
        backgroundColor: GOLD_LIGHT,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
    },
    deviceInfo: { flex: 1 },
    deviceNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
    deviceName: { fontSize: 15, fontWeight: '600', color: '#09090B' },
    currentBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: '#F0FDF4',
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 6,
    },
    currentBadgeText: { fontSize: 11, color: '#22C55E', fontWeight: '600' },
    deviceOs: { fontSize: 12, color: '#71717A', marginBottom: 4 },
    deviceMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    deviceMetaText: { fontSize: 11, color: '#A1A1AA' },
    deviceDot: { fontSize: 11, color: '#A1A1AA' },
    signOutBtn: {
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#EF4444',
    },
    signOutText: { fontSize: 13, color: '#EF4444', fontWeight: '500' },
    signOutAllBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        paddingVertical: 16,
        marginTop: 16,
        borderWidth: 1,
        borderColor: '#FECACA',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 2,
    },
    signOutAllText: { fontSize: 15, color: '#EF4444', fontWeight: '600' },
    bottomSpacer: { height: 40 },
});

export default LoginDevicesScreen;
