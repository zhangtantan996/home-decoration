import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Platform,
} from 'react-native';
import {
    ArrowLeft,
    CreditCard,
    Plus,
    Trash2,
    Lock,
    ChevronRight,
    ShieldCheck,
    Smartphone,
    Wallet,
    CreditCard as BankCardIcon,
} from 'lucide-react-native';
import { useToast } from '../components/Toast';

const PRIMARY_GOLD = '#D4AF37';
const GOLD_LIGHT = '#F5ECD0';

interface PaymentMethod {
    id: string;
    type: 'wechat' | 'alipay' | 'bank';
    label: string;
    detail: string;
    iconBg: string;
    iconColor: string;
}

const MOCK_METHODS: PaymentMethod[] = [
    { id: '1', type: 'wechat', label: '微信支付', detail: '已绑定', iconBg: '#ECFDF5', iconColor: '#22C55E' },
    { id: '2', type: 'alipay', label: '支付宝', detail: '138****8888 已绑定', iconBg: '#EFF6FF', iconColor: '#3B82F6' },
    { id: '3', type: 'bank', label: '招商银行', detail: '**** **** **** 6688', iconBg: '#FFF7ED', iconColor: '#F97316' },
];

interface PaymentSettingsScreenProps {
    navigation: any;
}

const PaymentSettingsScreen: React.FC<PaymentSettingsScreenProps> = ({ navigation }) => {
    const { showAlert } = useToast();
    const [methods, setMethods] = useState<PaymentMethod[]>(MOCK_METHODS);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [hasPassword, setHasPassword] = useState(false);

    const getIcon = (type: PaymentMethod['type'], color: string) => {
        if (type === 'wechat') return <Smartphone size={20} color={color} />;
        if (type === 'alipay') return <Wallet size={20} color={color} />;
        return <CreditCard size={20} color={color} />;
    };

    const handleUnbind = (method: PaymentMethod) => {
        showAlert(
            '解绑确认',
            `确定要解绑${method.label}吗？`,
            [
                { text: '取消', style: 'cancel' },
                {
                    text: '解绑',
                    style: 'destructive',
                    onPress: () => {
                        setMethods(prev => prev.filter(m => m.id !== method.id));
                    },
                },
            ]
        );
    };

    const handleAddMethod = () => {
        showAlert('提示', '添加支付方式功能开发中');
    };

    const handlePasswordSubmit = () => {
        if (password.length !== 6 || confirmPassword.length !== 6) {
            showAlert('提示', '请输入6位数字密码');
            return;
        }
        if (password !== confirmPassword) {
            showAlert('提示', '两次输入的密码不一致');
            return;
        }
        setShowPasswordModal(false);
        setHasPassword(true);
        setPassword('');
        setConfirmPassword('');
        showAlert('设置成功', '支付密码设置成功', [{ text: '好的' }]);
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ArrowLeft size={24} color="#09090B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>支付设置</Text>
                <View style={styles.placeholder} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* 已绑定支付方式 */}
                <Text style={styles.sectionLabel}>已绑定支付方式</Text>
                <View style={styles.card}>
                    {methods.map((method, index) => (
                        <View key={method.id}>
                            <View style={styles.methodRow}>
                                <View style={[styles.iconBox, { backgroundColor: method.iconBg }]}>
                                    {getIcon(method.type, method.iconColor)}
                                </View>
                                <View style={styles.methodInfo}>
                                    <Text style={styles.methodLabel}>{method.label}</Text>
                                    <Text style={styles.methodDetail}>{method.detail}</Text>
                                </View>
                                <TouchableOpacity
                                    style={styles.unbindBtn}
                                    onPress={() => handleUnbind(method)}
                                >
                                    <Trash2 size={16} color="#EF4444" />
                                </TouchableOpacity>
                            </View>
                            {index !== methods.length - 1 && <View style={styles.divider} />}
                        </View>
                    ))}
                </View>

                {/* 添加支付方式 */}
                <TouchableOpacity style={styles.addCard} onPress={handleAddMethod}>
                    <View style={styles.addIconBox}>
                        <Plus size={20} color={PRIMARY_GOLD} />
                    </View>
                    <Text style={styles.addText}>添加支付方式</Text>
                    <ChevronRight size={18} color="#A1A1AA" />
                </TouchableOpacity>

                {/* 安全设置 */}
                <Text style={styles.sectionLabel}>安全设置</Text>
                <View style={styles.card}>
                    <TouchableOpacity
                        style={styles.methodRow}
                        onPress={() => showAlert('提示', '支付密码功能需要绑定手机号后使用')}
                    >
                        <View style={[styles.iconBox, { backgroundColor: GOLD_LIGHT }]}>
                            <Lock size={20} color={PRIMARY_GOLD} />
                        </View>
                        <View style={styles.methodInfo}>
                            <Text style={styles.methodLabel}>支付密码</Text>
                            <Text style={styles.methodDetail}>用于支付时二次验证</Text>
                        </View>
                        <ChevronRight size={18} color="#A1A1AA" />
                    </TouchableOpacity>
                </View>

                {/* 安全提示 */}
                <View style={styles.secureCard}>
                    <ShieldCheck size={16} color={PRIMARY_GOLD} />
                    <Text style={styles.secureText}>
                        所有支付信息均经过加密传输和安全存储，我们承诺不存储您的完整卡号
                    </Text>
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
    methodRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        gap: 14,
    },
    iconBox: {
        width: 44,
        height: 44,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    methodInfo: { flex: 1 },
    methodLabel: { fontSize: 15, fontWeight: '500', color: '#09090B', marginBottom: 3 },
    methodDetail: { fontSize: 12, color: '#71717A' },
    unbindBtn: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#FFF5F5',
        alignItems: 'center',
        justifyContent: 'center',
    },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#F0F0F0', marginLeft: 74 },
    addCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginTop: 12,
        borderWidth: 1.5,
        borderColor: GOLD_LIGHT,
        borderStyle: 'dashed',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 2,
    },
    addIconBox: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: GOLD_LIGHT,
        alignItems: 'center',
        justifyContent: 'center',
    },
    addText: { flex: 1, fontSize: 15, fontWeight: '500', color: PRIMARY_GOLD },
    secureCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        backgroundColor: GOLD_LIGHT,
        borderRadius: 12,
        padding: 14,
        marginTop: 20,
    },
    secureText: { flex: 1, fontSize: 12, color: '#78550A', lineHeight: 20 },
    bottomSpacer: { height: 40 },
});

export default PaymentSettingsScreen;
