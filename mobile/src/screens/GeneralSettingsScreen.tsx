import React, { useState, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    TouchableOpacity,
    Switch,
    Platform,
    Easing, // Added Easing
    Animated,
} from 'react-native';
import {
    ArrowLeft,
    Moon,
    ALargeSmall,
    Globe,
    Trash2,
    CheckCircle,
} from 'lucide-react-native';
import { useToast } from '../components/Toast'; // Added useToast import
import { userSettingsApi } from '../services/api';

const PRIMARY_GOLD = '#D4AF37';
const GOLD_LIGHT = '#F5ECD0';

interface GeneralSettingsScreenProps {
    navigation: any;
}

type FontSize = 'small' | 'medium' | 'large';
type Language = 'zh' | 'en';

const GeneralSettingsScreen: React.FC<GeneralSettingsScreenProps> = ({ navigation }) => {
    const { showAlert, showConfirm } = useToast();
    const [darkMode, setDarkMode] = useState(false);
    const [fontSize, setFontSize] = useState<FontSize>('medium');
    const [language, setLanguage] = useState<Language>('zh');
    const [cacheSize, setCacheSize] = useState('38.6 MB'); // Changed to mutable state
    const [isClearing, setIsClearing] = useState(false); // New state for clearing
    const [cleared, setCleared] = useState(false);
    const spinValue = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(1)).current;

    React.useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const res = await userSettingsApi.getSettings();
            if (res.data) {
                setDarkMode(res.data.GeneralDarkMode ?? false);
                setFontSize(res.data.GeneralFontSize as FontSize ?? 'medium');
                setLanguage(res.data.GeneralLanguage as Language ?? 'zh');
            }
        } catch (error) {
            console.error('Fetch general settings err:', error);
        }
    };

    const updateSetting = async (key: string, value: any) => {
        try {
            await userSettingsApi.updateSettings({ [key]: value });
        } catch (error) {
            showAlert('提示', '无法保存设置，请重试');
            // Re-fetch to revert to actual state in production
            // fetchSettings()
        }
    };

    const handleDarkModeChange = (v: boolean) => {
        setDarkMode(v);
        updateSetting('general_dark_mode', v);
    };

    const handleFontSizeChange = (v: FontSize) => {
        setFontSize(v);
        updateSetting('general_font_size', v);
    };

    const handleLanguageChange = (v: Language) => {
        setLanguage(v);
        updateSetting('general_language', v);
    };

    const handleClearCache = () => {
        if (isClearing) return; // Updated condition
        showConfirm({
            title: '清理缓存',
            message: '清理缓存不会删除您的聊天记录、项目文件等核心数据，确定要清理吗？',
            confirmText: '清理',
            cancelText: '取消',
            onConfirm: () => {
                setIsClearing(true);
                // 模拟清理过程
                Animated.timing(spinValue, {
                    toValue: 1,
                    duration: 1500,
                    easing: Easing.linear,
                    useNativeDriver: true,
                }).start(() => {
                    setIsClearing(false);
                    setCleared(true);
                    setCacheSize('0 B');
                    spinValue.setValue(0);
                    showAlert('清理完成', '缓存已清理');
                });
            },
        });
    };

    const fontSizeOptions: { id: FontSize; label: string }[] = [
        { id: 'small', label: '小' },
        { id: 'medium', label: '标准' },
        { id: 'large', label: '大' },
    ];

    const languageOptions: { id: Language; label: string; sublabel: string }[] = [
        { id: 'zh', label: '简体中文', sublabel: 'Chinese Simplified' },
        { id: 'en', label: 'English', sublabel: '英文' },
    ];

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ArrowLeft size={24} color="#09090B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>通用设置</Text>
                <View style={styles.placeholder} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* 外观 */}
                <Text style={styles.sectionLabel}>外观</Text>
                <View style={styles.card}>
                    <View style={styles.row}>
                        <View style={[styles.iconBox, { backgroundColor: '#1E1B4B' }]}>
                            <Moon size={18} color="#A5B4FC" />
                        </View>
                        <View style={styles.info}>
                            <Text style={styles.label}>深色模式</Text>
                            <Text style={styles.desc}>{darkMode ? '已开启深色主题' : '跟随系统或手动切换'}</Text>
                        </View>
                        <Switch
                            value={darkMode}
                            onValueChange={handleDarkModeChange}
                            trackColor={{ false: '#D4D4D8', true: PRIMARY_GOLD }}
                            thumbColor="#FFFFFF"
                            ios_backgroundColor="#D4D4D8"
                        />
                    </View>
                </View>

                {/* 字体大小 */}
                <Text style={styles.sectionLabel}>字体大小</Text>
                <View style={styles.card}>
                    <View style={styles.row}>
                        <View style={[styles.iconBox, { backgroundColor: '#FFF7ED' }]}>
                            <ALargeSmall size={18} color="#F97316" />
                        </View>
                        <View style={styles.info}>
                            <Text style={styles.label}>字体大小</Text>
                        </View>
                    </View>
                    <View style={styles.fontSizeRow}>
                        {fontSizeOptions.map(opt => (
                            <TouchableOpacity
                                key={opt.id}
                                style={[styles.fontSizeBtn, fontSize === opt.id && styles.fontSizeBtnActive]}
                                onPress={() => handleFontSizeChange(opt.id)}
                            >
                                {fontSize === opt.id && (
                                    <CheckCircle size={14} color={PRIMARY_GOLD} />
                                )}
                                <Text style={[
                                    styles.fontSizeBtnText,
                                    opt.id === 'small' && { fontSize: 12 },
                                    opt.id === 'large' && { fontSize: 18 },
                                    fontSize === opt.id && styles.fontSizeBtnTextActive,
                                ]}>
                                    {opt.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* 语言 */}
                <Text style={styles.sectionLabel}>语言</Text>
                <View style={styles.card}>
                    <View style={[styles.row, { paddingBottom: 10 }]}>
                        <View style={[styles.iconBox, { backgroundColor: '#EFF6FF' }]}>
                            <Globe size={18} color="#3B82F6" />
                        </View>
                        <Text style={[styles.label, { flex: 1 }]}>显示语言</Text>
                    </View>
                    {languageOptions.map((opt, index) => (
                        <View key={opt.id}>
                            {index !== 0 && <View style={styles.divider} />}
                            <TouchableOpacity
                                style={[styles.langRow, language === opt.id && styles.langRowActive]}
                                onPress={() => handleLanguageChange(opt.id)}
                            >
                                <View style={styles.langInfo}>
                                    <Text style={[styles.langLabel, language === opt.id && styles.langLabelActive]}>
                                        {opt.label}
                                    </Text>
                                    <Text style={styles.langSublabel}>{opt.sublabel}</Text>
                                </View>
                                {language === opt.id && (
                                    <CheckCircle size={18} color={PRIMARY_GOLD} />
                                )}
                            </TouchableOpacity>
                        </View>
                    ))}
                </View>

                {/* 存储 */}
                <Text style={styles.sectionLabel}>存储</Text>
                <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                    <TouchableOpacity
                        style={styles.cacheCard}
                        onPress={handleClearCache}
                        activeOpacity={0.8}
                    >
                        <View style={[styles.iconBox, { backgroundColor: cleared ? '#ECFDF5' : '#FFF5F5' }]}>
                            {cleared
                                ? <CheckCircle size={20} color="#22C55E" />
                                : <Trash2 size={20} color="#EF4444" />
                            }
                        </View>
                        <View style={styles.info}>
                            <Text style={styles.label}>清理缓存</Text>
                            <Text style={[styles.desc, cleared && { color: '#22C55E' }]}>
                                {isClearing ? '正在清理...' : cleared ? '缓存已清理完成' : `当前缓存：${cacheSize}`}
                            </Text>
                        </View>
                        {!cleared && (
                            <View style={styles.cleanBadge}>
                                <Text style={styles.cleanBadgeText}>清理</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </Animated.View>

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
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#F0F0F0', marginHorizontal: 16 },
    fontSizeRow: {
        flexDirection: 'row',
        gap: 10,
        paddingHorizontal: 16,
        paddingBottom: 16,
    },
    fontSizeBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        paddingVertical: 10,
        borderRadius: 10,
        backgroundColor: '#F5F5F5',
        borderWidth: 1.5,
        borderColor: 'transparent',
    },
    fontSizeBtnActive: {
        backgroundColor: GOLD_LIGHT,
        borderColor: PRIMARY_GOLD,
    },
    fontSizeBtnText: { fontSize: 15, color: '#71717A', fontWeight: '500' },
    fontSizeBtnTextActive: { color: PRIMARY_GOLD, fontWeight: '600' },
    langRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    langRowActive: { backgroundColor: GOLD_LIGHT },
    langInfo: { flex: 1 },
    langLabel: { fontSize: 15, fontWeight: '500', color: '#09090B' },
    langLabelActive: { color: PRIMARY_GOLD },
    langSublabel: { fontSize: 12, color: '#A1A1AA', marginTop: 2 },
    cacheCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 3,
    },
    cleanBadge: {
        backgroundColor: '#FFF5F5',
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#FECACA',
    },
    cleanBadgeText: { fontSize: 13, color: '#EF4444', fontWeight: '600' },
    bottomSpacer: { height: 40 },
});

export default GeneralSettingsScreen;
