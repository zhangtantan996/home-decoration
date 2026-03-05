import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    TouchableOpacity,
    Platform,
    TextInput,
} from 'react-native';
import { ArrowLeft, Phone, ShieldCheck } from 'lucide-react-native';
import { useToast } from '../components/Toast';
import { userSettingsApi } from '../services/api';
import authApi from '../services/api';

const PRIMARY_GOLD = '#D4AF37';

interface ChangePhoneScreenProps {
    navigation: any;
}

const ChangePhoneScreen: React.FC<ChangePhoneScreenProps> = ({ navigation }) => {
    const { showAlert } = useToast();
    const [newPhone, setNewPhone] = useState('');
    const [code, setCode] = useState('');
    const [countdown, setCountdown] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // 处理验证码倒计时
    useEffect(() => {
        let timer: any;
        if (countdown > 0) {
            timer = setTimeout(() => setCountdown(countdown - 1), 1000);
        }
        return () => clearTimeout(timer);
    }, [countdown]);

    const handleSendCode = async () => {
        if (!newPhone) {
            showAlert('提示', '请输入新手机号');
            return;
        }
        if (!/^1\d{10}$/.test(newPhone)) {
            showAlert('提示', '请输入正确的手机号格式');
            return;
        }

        try {
            await authApi.post('/send-code', {
                phone: newPhone,
                purpose: 'change_phone',
            });
            showAlert('提示', '验证码已发送，请注意查收');
            setCountdown(60);
        } catch (error: any) {
            showAlert('发送失败', error.response?.data?.message || '无法发送验证码，请稍后重试');
        }
    };

    const handleSubmit = async () => {
        if (!newPhone) {
            showAlert('提示', '请输入新手机号');
            return;
        }
        if (!/^1\d{10}$/.test(newPhone)) {
            showAlert('提示', '请输入正确的手机号格式');
            return;
        }
        if (!code) {
            showAlert('提示', '请输入验证码');
            return;
        }

        setIsSubmitting(true);
        try {
            await userSettingsApi.changePhone({ newPhone, code });
            showAlert('成功', '手机号修改成功', [
                {
                    text: '知道了',
                    onPress: () => {
                        // 回到账号安全页
                        navigation.goBack();
                    }
                }
            ]);
        } catch (error: any) {
            showAlert('修改失败', error.response?.data?.message || '修改手机号失败，请稍后重试');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ArrowLeft size={24} color="#09090B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>修改手机号</Text>
                <View style={styles.placeholder} />
            </View>

            <View style={styles.content}>
                <Text style={styles.tips}>
                    为了保护您的账号安全，修改手机号需要验证新手机号。
                </Text>

                <View style={styles.formContainer}>
                    {/* 新手机号输入 */}
                    <View style={styles.inputGroup}>
                        <View style={styles.inputWrapper}>
                            <Phone size={20} color="#A1A1AA" />
                            <TextInput
                                style={styles.input}
                                value={newPhone}
                                onChangeText={setNewPhone}
                                placeholder="请输入新手机号"
                                placeholderTextColor="#A1A1AA"
                                keyboardType="phone-pad"
                                maxLength={11}
                            />
                        </View>
                    </View>

                    {/* 验证码输入 */}
                    <View style={styles.inputGroup}>
                        <View style={styles.inputWrapper}>
                            <ShieldCheck size={20} color="#A1A1AA" />
                            <TextInput
                                style={styles.input}
                                value={code}
                                onChangeText={setCode}
                                placeholder="请输入短信验证码"
                                placeholderTextColor="#A1A1AA"
                                keyboardType="number-pad"
                                maxLength={6}
                            />
                            <TouchableOpacity
                                style={[styles.sendCodeBtn, countdown > 0 && styles.sendCodeBtnDisabled]}
                                onPress={handleSendCode}
                                disabled={countdown > 0}
                            >
                                <Text style={[styles.sendCodeText, countdown > 0 && styles.sendCodeTextDisabled]}>
                                    {countdown > 0 ? `${countdown}s 后重新获取` : '获取验证码'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                {/* 提交按钮 */}
                <TouchableOpacity
                    style={[styles.submitBtn, (!newPhone || !code || isSubmitting) && styles.submitBtnDisabled]}
                    onPress={handleSubmit}
                    disabled={!newPhone || !code || isSubmitting}
                >
                    <Text style={[styles.submitBtnText, (!newPhone || !code || isSubmitting) && styles.submitBtnTextDisabled]}>
                        {isSubmitting ? '正在提交...' : '确认修改'}
                    </Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'ios' ? 12 : 44,
        paddingBottom: 12,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F4F4F5',
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
        padding: 20,
    },
    tips: {
        fontSize: 14,
        color: '#71717A',
        marginBottom: 24,
        lineHeight: 20,
    },
    formContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.1)',
    },
    inputGroup: {
        marginBottom: 16,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8F9FA',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: '#E4E4E7',
    },
    input: {
        flex: 1,
        fontSize: 15,
        color: '#09090B',
        marginLeft: 10,
    },
    sendCodeBtn: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 16,
        backgroundColor: 'rgba(212, 175, 55, 0.1)',
    },
    sendCodeBtnDisabled: {
        backgroundColor: '#F4F4F5',
    },
    sendCodeText: {
        fontSize: 13,
        color: PRIMARY_GOLD,
        fontWeight: '500',
    },
    sendCodeTextDisabled: {
        color: '#A1A1AA',
    },
    submitBtn: {
        backgroundColor: PRIMARY_GOLD,
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: 24,
        shadowColor: PRIMARY_GOLD,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    submitBtnDisabled: {
        backgroundColor: '#F4F4F5',
        shadowOpacity: 0,
        elevation: 0,
    },
    submitBtnText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    submitBtnTextDisabled: {
        color: '#A1A1AA',
    },
});

export default ChangePhoneScreen;
