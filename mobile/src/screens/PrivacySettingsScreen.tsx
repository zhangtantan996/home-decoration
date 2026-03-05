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
    Sparkles,
    MapPin,
    Target,
    FileText,
    ChevronRight,
    Eye,
} from 'lucide-react-native';
import { useToast } from '../components/Toast';
import { userSettingsApi } from '../services/api';

const PRIMARY_GOLD = '#D4AF37';
const GOLD_LIGHT = '#F5ECD0';

interface PrivacySettingsScreenProps {
    navigation: any;
}

interface PrivacyToggle {
    id: string;
    icon: React.ReactNode;
    iconBg: string;
    label: string;
    desc: string;
    value: boolean;
}

const PrivacySettingsScreen: React.FC<PrivacySettingsScreenProps> = ({ navigation }) => {
    const { showAlert } = useToast();
    const [settings, setSettings] = useState<Record<string, boolean>>({
        personalized: true,
        location: false,
        adTracking: false,
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
                    personalized: res.data.PrivacyPersonalized ?? true,
                    location: res.data.PrivacyLocation ?? false,
                    adTracking: res.data.PrivacyAdTracking ?? false,
                });
            }
        } catch (error) {
            console.error('Fetch settings err:', error);
        } finally {
            setLoading(false);
        }
    };

    const toggles: PrivacyToggle[] = [
        {
            id: 'personalized',
            icon: <Sparkles size={18} color="#8B5CF6" />,
            iconBg: '#F3F0FF',
            label: '个性化推荐',
            desc: '基于浏览行为推荐装修案例和服务商',
            value: settings.personalized,
        },
        {
            id: 'location',
            icon: <MapPin size={18} color="#3B82F6" />,
            iconBg: '#EFF6FF',
            label: '位置信息',
            desc: '用于匹配附近服务商和本地化内容',
            value: settings.location,
        },
        {
            id: 'adTracking',
            icon: <Target size={18} color="#F97316" />,
            iconBg: '#FFF7ED',
            label: '广告追踪',
            desc: '允许向您展示相关广告内容',
            value: settings.adTracking,
        },
    ];

    const handleToggle = async (id: string, backendKey: string) => {
        const newValue = !settings[id];
        setSettings(prev => ({ ...prev, [id]: newValue }));

        try {
            await userSettingsApi.updateSettings({ [backendKey]: newValue });
        } catch (error) {
            // Revert on failure
            setSettings(prev => ({ ...prev, [id]: !newValue }));
            showAlert('提示', '无法保存设置，请检查网络连接');
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ArrowLeft size={24} color="#09090B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>隐私设置</Text>
                <View style={styles.placeholder} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* 顶部说明 */}
                <View style={styles.tipCard}>
                    <Eye size={18} color={PRIMARY_GOLD} />
                    <Text style={styles.tipText}>
                        我们重视您的隐私，您可以随时调整以下设置以控制您的数据使用方式
                    </Text>
                </View>

                {/* 隐私开关 */}
                <Text style={styles.sectionLabel}>数据权限管理</Text>
                <View style={styles.card}>
                    {toggles.map((item, index) => (
                        <View key={item.id}>
                            <View style={styles.toggleRow}>
                                <View style={[styles.iconBox, { backgroundColor: item.iconBg }]}>
                                    {item.icon}
                                </View>
                                <View style={styles.toggleInfo}>
                                    <Text style={styles.toggleLabel}>{item.label}</Text>
                                    <Text style={styles.toggleDesc}>{item.desc}</Text>
                                </View>
                                <Switch
                                    value={item.value}
                                    onValueChange={() => {
                                        let backendKey = "";
                                        if (item.id === "personalized") backendKey = "privacy_personalized";
                                        else if (item.id === "location") backendKey = "privacy_location";
                                        else if (item.id === "adTracking") backendKey = "privacy_ad_tracking";

                                        handleToggle(item.id, backendKey);
                                    }}
                                    trackColor={{ false: '#D4D4D8', true: PRIMARY_GOLD }}
                                    thumbColor="#FFFFFF"
                                    ios_backgroundColor="#D4D4D8"
                                    disabled={loading}
                                />
                            </View>
                            {index !== toggles.length - 1 && <View style={styles.divider} />}
                        </View>
                    ))}
                </View>

                {/* 数据说明卡片 */}
                <Text style={styles.sectionLabel}>数据使用说明</Text>
                <View style={styles.dataCard}>
                    <Text style={styles.dataCardText}>
                        我们收集的数据仅用于改善您的使用体验、提供个性化服务以及保障平台安全。我们不会将您的数据出售给任何第三方。
                    </Text>
                    <Text style={[styles.dataCardText, { marginTop: 8 }]}>
                        根据法律要求，部分基础数据（如账号信息）为必需收集项，不受上述开关控制。
                    </Text>
                </View>

                {/* 文档链接 */}
                <Text style={styles.sectionLabel}>相关协议</Text>
                <View style={styles.card}>
                    {[
                        { label: '隐私政策', icon: <FileText size={18} color="#3B82F6" />, bg: '#EFF6FF' },
                        { label: '用户协议', icon: <FileText size={18} color="#10B981" />, bg: '#ECFDF5' },
                        { label: '数据安全报告', icon: <FileText size={18} color="#8B5CF6" />, bg: '#F3F0FF' },
                    ].map((item, index, arr) => (
                        <View key={item.label}>
                            <TouchableOpacity style={styles.toggleRow} onPress={() => showAlert('提示', `${item.label}页面开发中`)}>
                                <View style={[styles.iconBox, { backgroundColor: item.bg }]}>
                                    {item.icon}
                                </View>
                                <Text style={styles.linkLabel}>{item.label}</Text>
                                <ChevronRight size={18} color="#A1A1AA" />
                            </TouchableOpacity>
                            {index !== arr.length - 1 && <View style={styles.divider} />}
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
    toggleRow: {
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
    toggleInfo: { flex: 1 },
    toggleLabel: { fontSize: 15, fontWeight: '500', color: '#09090B', marginBottom: 3 },
    toggleDesc: { fontSize: 12, color: '#71717A', lineHeight: 17 },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#F0F0F0', marginLeft: 68 },
    dataCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 3,
    },
    dataCardText: { fontSize: 13, color: '#52525B', lineHeight: 22 },
    linkLabel: { flex: 1, fontSize: 15, color: '#09090B' },
    bottomSpacer: { height: 40 },
});

export default PrivacySettingsScreen;
