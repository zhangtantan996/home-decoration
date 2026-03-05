import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    TouchableOpacity,
    Switch,
    Platform,
} from 'react-native';
import {
    ArrowLeft,
    Bell,
    ShoppingBag,
    Megaphone,
    MessageSquare,
    Volume2,
    Vibrate,
    Moon,
    ChevronRight,
} from 'lucide-react-native';
import { useToast } from '../components/Toast';
import { userSettingsApi } from '../services/api';

const PRIMARY_GOLD = '#D4AF37';

interface NotificationSettingsScreenProps {
    navigation: any;
}

interface NotifItem {
    id: string;
    icon: React.ReactNode;
    iconBg: string;
    label: string;
    desc: string;
}

const NotificationSettingsScreen: React.FC<NotificationSettingsScreenProps> = ({ navigation }) => {
    const { showAlert } = useToast();
    const [settings, setSettings] = useState<Record<string, boolean>>({
        system: true,
        order: true,
        promo: false,
        message: true,
        sound: true,
        vibrate: true,
        doNotDisturb: false,
    });
    const [loading, setLoading] = useState(true);

    React.useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const res = await userSettingsApi.getSettings();
            if (res.data) {
                setSettings({
                    system: res.data.NotifSystem ?? true,
                    order: res.data.NotifOrder ?? true,
                    promo: res.data.NotifPromo ?? false,
                    message: res.data.NotifMessage ?? true,
                    sound: res.data.NotifSound ?? true,
                    vibrate: res.data.NotifVibrate ?? true,
                    doNotDisturb: res.data.NotifDoNotDisturb ?? false,
                });
            }
        } catch (error) {
            console.error('Fetch notif settings err:', error);
        } finally {
            setLoading(false);
        }
    };

    const toggle = async (id: string, backendKey: string) => {
        const newValue = !settings[id];
        setSettings(prev => ({ ...prev, [id]: newValue }));

        try {
            await userSettingsApi.updateSettings({ [backendKey]: newValue });
        } catch (error) {
            // Revert back
            setSettings(prev => ({ ...prev, [id]: !newValue }));
            showAlert('提示', '无法保存设置，请重试');
        }
    };

    const pushItems: NotifItem[] = [
        {
            id: 'system',
            icon: <Bell size={18} color="#8B5CF6" />,
            iconBg: '#F3F0FF',
            label: '系统通知',
            desc: '账号安全、服务公告等系统消息',
        },
        {
            id: 'order',
            icon: <ShoppingBag size={18} color="#F97316" />,
            iconBg: '#FFF7ED',
            label: '订单通知',
            desc: '订单状态变更、付款提醒等',
        },
        {
            id: 'promo',
            icon: <Megaphone size={18} color="#EC4899" />,
            iconBg: '#FDF2F8',
            label: '活动推送',
            desc: '促销活动、新品推荐等营销通知',
        },
        {
            id: 'message',
            icon: <MessageSquare size={18} color="#3B82F6" />,
            iconBg: '#EFF6FF',
            label: '消息提醒',
            desc: '与服务商的私信消息提醒',
        },
    ];

    const alertItems: NotifItem[] = [
        {
            id: 'sound',
            icon: <Volume2 size={18} color="#10B981" />,
            iconBg: '#ECFDF5',
            label: '声音',
            desc: '消息到达时播放提示音',
        },
        {
            id: 'vibrate',
            icon: <Vibrate size={18} color="#6366F1" />,
            iconBg: '#EEF2FF',
            label: '振动',
            desc: '消息到达时振动提醒',
        },
    ];

    const renderToggleGroup = (items: NotifItem[]) => (
        <View style={styles.card}>
            {items.map((item, index) => (
                <View key={item.id}>
                    <View style={styles.row}>
                        <View style={[styles.iconBox, { backgroundColor: item.iconBg }]}>
                            {item.icon}
                        </View>
                        <View style={styles.info}>
                            <Text style={styles.label}>{item.label}</Text>
                            <Text style={styles.desc}>{item.desc}</Text>
                        </View>
                        <Switch
                            value={settings[item.id]}
                            onValueChange={() => {
                                let backendKey = '';
                                if (item.id === 'system') backendKey = 'notif_system';
                                else if (item.id === 'order') backendKey = 'notif_order';
                                else if (item.id === 'promo') backendKey = 'notif_promo';
                                else if (item.id === 'message') backendKey = 'notif_message';
                                else if (item.id === 'sound') backendKey = 'notif_sound';
                                else if (item.id === 'vibrate') backendKey = 'notif_vibrate';

                                toggle(item.id, backendKey);
                            }}
                            trackColor={{ false: '#D4D4D8', true: PRIMARY_GOLD }}
                            thumbColor="#FFFFFF"
                            ios_backgroundColor="#D4D4D8"
                            disabled={loading}
                        />
                    </View>
                    {index !== items.length - 1 && <View style={styles.divider} />}
                </View>
            ))}
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ArrowLeft size={24} color="#09090B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>消息通知</Text>
                <View style={styles.placeholder} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                <Text style={styles.sectionLabel}>推送通知</Text>
                {renderToggleGroup(pushItems)}

                <Text style={styles.sectionLabel}>提醒方式</Text>
                {renderToggleGroup(alertItems)}

                {/* 免打扰 */}
                <Text style={styles.sectionLabel}>免打扰</Text>
                <View style={styles.card}>
                    <View style={styles.row}>
                        <View style={[styles.iconBox, { backgroundColor: '#F0F9FF' }]}>
                            <Moon size={18} color="#0EA5E9" />
                        </View>
                        <View style={styles.info}>
                            <Text style={styles.label}>免打扰模式</Text>
                            <Text style={styles.desc}>开启后将静默所有通知</Text>
                        </View>
                        <Switch
                            value={settings.doNotDisturb}
                            onValueChange={() => toggle('doNotDisturb', 'notif_do_not_disturb')}
                            trackColor={{ false: '#D4D4D8', true: PRIMARY_GOLD }}
                            thumbColor="#FFFFFF"
                            ios_backgroundColor="#D4D4D8"
                            disabled={loading}
                        />
                    </View>
                    {settings.doNotDisturb && (
                        <>
                            <View style={styles.divider} />
                            <TouchableOpacity style={styles.row}>
                                <View style={[styles.iconBox, { backgroundColor: '#F0F9FF', opacity: 0 }]}>
                                    <Moon size={18} color="#0EA5E9" />
                                </View>
                                <View style={styles.info}>
                                    <Text style={styles.label}>免打扰时段</Text>
                                    <Text style={[styles.desc, { color: PRIMARY_GOLD }]}>22:00 — 08:00</Text>
                                </View>
                                <ChevronRight size={18} color="#A1A1AA" />
                            </TouchableOpacity>
                        </>
                    )}
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
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        gap: 14,
    },
    iconBox: {
        width: 38,
        height: 38,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    info: { flex: 1 },
    label: { fontSize: 15, fontWeight: '500', color: '#09090B', marginBottom: 3 },
    desc: { fontSize: 12, color: '#71717A', lineHeight: 17 },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#F0F0F0', marginLeft: 68 },
    bottomSpacer: { height: 40 },
});

export default NotificationSettingsScreen;
