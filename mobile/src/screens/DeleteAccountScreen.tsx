import React, { useState, useRef } from 'react';
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
    AlertTriangle,
    ShieldOff,
    MessageSquare,
    CheckSquare,
    Square,
    Timer,
} from 'lucide-react-native';
import { useAuthStore } from '../store/authStore';
import { useToast } from '../components/Toast';
import { authApi, userSettingsApi } from '../services/api';

interface DeleteAccountScreenProps {
    navigation: any;
}

const DeleteAccountScreen: React.FC<DeleteAccountScreenProps> = ({ navigation }) => {
    const { showAlert } = useToast();
    const { user, logout } = useAuthStore();
    const [agreed, setAgreed] = useState(false);
    const [code, setCode] = useState('');
    const [countdown, setCountdown] = useState(0);
    const timerRef = useRef<any>(null);

    const maskedPhone = user?.phone?.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') || '未绑定手机';

    const handleSendCode = async () => {
        if (countdown > 0) return;
        if (!user?.phone) {
            showAlert('提示', '未绑定手机号无法注销');
            return;
        }

        try {
            await authApi.sendCode(user.phone, 'delete_account');
            showAlert('提示', '验证码已发送至您的手机');
            setCountdown(60);
            timerRef.current = setInterval(() => {
                setCountdown(prev => {
                    if (prev <= 1) {
                        clearInterval(timerRef.current);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        } catch (error: any) {
            showAlert('发送失败', error.response?.data?.message || '无法发送验证码，请稍后重试');
        }
    };

    const canSubmit = agreed && code.length === 6;

    const handleDeleteAccount = async () => {
        showAlert(
            '最终确认',
            '注销后账号将被永久删除，且无法恢复。确认继续吗？',
            [
                { text: '再想想', style: 'cancel' },
                {
                    text: '确认注销',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await userSettingsApi.deleteAccount({ code });
                            showAlert('注销成功', '您的账号已成功注销', [
                                { text: '知道了', onPress: logout },
                            ]);
                        } catch (error: any) {
                            showAlert('失败', error.response?.data?.message || '注销失败，请稍后重试');
                        }
                    },
                },
            ]
        );
    };

    const risks = [
        '账号下所有项目数据、订单记录将被清除',
        '与服务商的合作记录及评价将永久删除',
        '账号内的余额/押金不支持提现',
        '无法找回该手机号绑定的历史数据',
        '注销审核通过后7天内仍可取消注销',
    ];

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ArrowLeft size={24} color="#09090B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>注销账号</Text>
                <View style={styles.placeholder} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* 风险提示 */}
                <View style={styles.warningCard}>
                    <View style={styles.warningHeader}>
                        <View style={styles.warningIconBox}>
                            <AlertTriangle size={24} color="#EF4444" />
                        </View>
                        <View>
                            <Text style={styles.warningTitle}>注销前请确认</Text>
                            <Text style={styles.warningSubtitle}>此操作不可逆，请仔细阅读</Text>
                        </View>
                    </View>
                    <View style={styles.riskList}>
                        {risks.map((risk, i) => (
                            <View key={i} style={styles.riskRow}>
                                <View style={styles.riskDot} />
                                <Text style={styles.riskText}>{risk}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* 账号信息 */}
                <View style={styles.accountCard}>
                    <View style={styles.accountIconBox}>
                        <ShieldOff size={20} color="#71717A" />
                    </View>
                    <View>
                        <Text style={styles.accountLabel}>将注销的账号</Text>
                        <Text style={styles.accountValue}>{maskedPhone}</Text>
                    </View>
                </View>

                {/* 验证码区域 */}
                <View style={styles.formCard}>
                    <Text style={styles.formTitle}>身份验证</Text>
                    <Text style={styles.formDesc}>发送验证码至 {maskedPhone}</Text>
                    <View style={styles.codeRow}>
                        <View style={styles.codeInputBox}>
                            <MessageSquare size={16} color="#A1A1AA" />
                            <TextInput
                                style={styles.codeInput}
                                placeholder="请输入6位验证码"
                                placeholderTextColor="#A1A1AA"
                                keyboardType="number-pad"
                                maxLength={6}
                                value={code}
                                onChangeText={setCode}
                            />
                        </View>
                        <TouchableOpacity
                            style={[styles.sendBtn, countdown > 0 && styles.sendBtnDisabled]}
                            onPress={handleSendCode}
                        >
                            {countdown > 0 ? (
                                <View style={styles.countdownRow}>
                                    <Timer size={14} color="#A1A1AA" />
                                    <Text style={styles.sendBtnTextDisabled}>{countdown}s</Text>
                                </View>
                            ) : (
                                <Text style={styles.sendBtnText}>发送验证码</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>

                {/* 协议勾选 */}
                <TouchableOpacity
                    style={styles.agreeRow}
                    onPress={() => setAgreed(prev => !prev)}
                    activeOpacity={0.7}
                >
                    {agreed
                        ? <CheckSquare size={20} color="#EF4444" />
                        : <Square size={20} color="#D4D4D8" />
                    }
                    <Text style={styles.agreeText}>
                        我已阅读并同意
                        <Text style={styles.agreeLinkText}> 《账号注销协议》</Text>
                        ，自愿注销此账号
                    </Text>
                </TouchableOpacity>

                {/* 注销按钮 */}
                <TouchableOpacity
                    style={[styles.deleteBtn, !canSubmit && styles.deleteBtnDisabled]}
                    onPress={handleDeleteAccount}
                    disabled={!canSubmit}
                >
                    <Text style={styles.deleteBtnText}>
                        {canSubmit ? '确认注销账号' : '请完成上方验证'}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
                    <Text style={styles.cancelBtnText}>暂不注销</Text>
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
    warningCard: {
        backgroundColor: '#FFF5F5',
        borderRadius: 16,
        padding: 18,
        marginTop: 20,
        borderWidth: 1,
        borderColor: '#FECACA',
    },
    warningHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        marginBottom: 16,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#FECACA',
    },
    warningIconBox: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: '#FEE2E2',
        alignItems: 'center',
        justifyContent: 'center',
    },
    warningTitle: { fontSize: 16, fontWeight: '700', color: '#DC2626' },
    warningSubtitle: { fontSize: 12, color: '#EF4444', marginTop: 2 },
    riskList: { gap: 10 },
    riskRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    riskDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#EF4444',
        marginTop: 6,
    },
    riskText: { flex: 1, fontSize: 13, color: '#7F1D1D', lineHeight: 20 },
    accountCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 16,
        marginTop: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 2,
    },
    accountIconBox: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#F4F4F5',
        alignItems: 'center',
        justifyContent: 'center',
    },
    accountLabel: { fontSize: 12, color: '#71717A', marginBottom: 3 },
    accountValue: { fontSize: 15, fontWeight: '600', color: '#09090B' },
    formCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 16,
        marginTop: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 2,
    },
    formTitle: { fontSize: 14, fontWeight: '600', color: '#09090B', marginBottom: 4 },
    formDesc: { fontSize: 12, color: '#71717A', marginBottom: 14 },
    codeRow: { flexDirection: 'row', gap: 10 },
    codeInputBox: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: '#F8F8F8',
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: '#E4E4E7',
    },
    codeInput: { flex: 1, fontSize: 16, color: '#09090B', letterSpacing: 2 },
    sendBtn: {
        backgroundColor: '#09090B',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendBtnDisabled: { backgroundColor: '#F4F4F5' },
    sendBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
    sendBtnTextDisabled: { color: '#A1A1AA', fontSize: 13, fontWeight: '600' },
    countdownRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    agreeRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        marginTop: 20,
        paddingHorizontal: 4,
    },
    agreeText: { flex: 1, fontSize: 13, color: '#52525B', lineHeight: 20 },
    agreeLinkText: { color: '#2563EB', fontWeight: '500' },
    deleteBtn: {
        backgroundColor: '#EF4444',
        borderRadius: 14,
        paddingVertical: 16,
        alignItems: 'center',
        marginTop: 24,
        shadowColor: '#EF4444',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 4,
    },
    deleteBtnDisabled: {
        backgroundColor: '#D4D4D8',
        shadowOpacity: 0,
        elevation: 0,
    },
    deleteBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
    cancelBtn: {
        alignItems: 'center',
        paddingVertical: 16,
        marginTop: 8,
    },
    cancelBtnText: { fontSize: 15, color: '#71717A' },
    bottomSpacer: { height: 40 },
});

export default DeleteAccountScreen;
