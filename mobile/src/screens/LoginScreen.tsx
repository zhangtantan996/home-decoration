import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    Image,
} from 'react-native';
import { useAuthStore } from '../store/authStore';
import { authApi } from '../services/api';
import { useToast } from '../components/Toast';

const LoginScreen: React.FC = () => {
    const { showToast, showAgreementModal } = useToast();
    const [loginMethod, setLoginMethod] = useState<'code' | 'password'>('code');
    const [phone, setPhone] = useState(''); // 存储纯数字(不含空格)
    const [code, setCode] = useState('');
    const [password, setPassword] = useState('');
    const [agreed, setAgreed] = useState(false);
    const [loading, setLoading] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const [errorMessage, setErrorMessage] = useState('');
    const setAuth = useAuthStore((state) => state.setAuth);

    // 只允许输入数字的过滤函数
    const filterNumeric = (text: string) => text.replace(/[^0-9]/g, '');

    // 手机号格式化显示 (138 0013 8000)
    const formatPhoneDisplay = (rawPhone: string): string => {
        const digits = rawPhone.replace(/\D/g, '');
        if (digits.length <= 3) return digits;
        if (digits.length <= 7) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
        return `${digits.slice(0, 3)} ${digits.slice(3, 7)} ${digits.slice(7, 11)}`;
    };

    // 手机号验证 (11位有效手机号)
    const isPhoneValid = useMemo(() => {
        return /^1[3-9]\d{9}$/.test(phone);
    }, [phone]);

    // 验证码验证 (6位数字)
    const isCodeValid = useMemo(() => {
        return /^\d{6}$/.test(code);
    }, [code]);

    // 是否可以点击"获取验证码"按钮
    const canSendCode = isPhoneValid && countdown === 0;

    // 是否可以点击"进入平台"按钮
    const canSubmit = useMemo(() => {
        if (!isPhoneValid) return false;
        if (loginMethod === 'code') {
            return isCodeValid;
        } else {
            return password.length >= 6;
        }
    }, [isPhoneValid, isCodeValid, loginMethod, password]);

    // 显示内联错误提示（3秒后自动消失）
    const showError = (msg: string) => {
        setErrorMessage(msg);
        setTimeout(() => setErrorMessage(''), 3000);
    };

    // 处理手机号输入变化
    const handlePhoneChange = (text: string) => {
        // 移除所有非数字字符，保留纯数字
        const digits = text.replace(/\D/g, '');
        // 限制最多11位
        setPhone(digits.slice(0, 11));
    };

    useEffect(() => {
        let timer: any;
        if (countdown > 0) {
            timer = setInterval(() => {
                setCountdown((prev) => prev - 1);
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [countdown]);

    const handleSendCode = async () => {
        if (!canSendCode) return;

        try {
            await authApi.sendCode(phone);
            setCountdown(60);
            showToast({ message: '验证码已发送 (测试码: 123456)', type: 'success' });
        } catch (error: any) {
            showToast({ message: error.response?.data?.message || '发送失败，请稍后重试', type: 'error' });
        }
    };

    const handleLogin = async () => {
        // 步骤1: 检查协议勾选
        if (!agreed) {
            showAgreementModal({
                onAgree: () => {
                    setAgreed(true);
                    // 同意后执行登录
                    performLogin();
                },
            });
            return;
        }
        performLogin();
    };

    const performLogin = async () => {
        // 二次校验（防止绕过）
        if (!isPhoneValid) {
            showError('请输入正确的11位手机号');
            return;
        }

        if (loginMethod === 'code') {
            if (!isCodeValid) {
                showError('请输入6位数字验证码');
                return;
            }
        } else {
            if (password.length < 6) {
                showError('请输入密码');
                return;
            }
        }

        setLoading(true);
        try {
            // 统一使用login接口，后端会自动处理未注册用户
            const result = await authApi.login({
                phone,
                code: loginMethod === 'code' ? code : undefined,
                password: loginMethod === 'password' ? password : undefined,
                type: loginMethod
            });

            // 注意：api.ts 拦截器返回的是完整响应对象 { code: 0, data: {...} }
            const res = result as any;
            const { token, user } = res.data || {};

            if (!token || !user) {
                throw new Error('登录返回数据异常');
            }

            setAuth(token, user);
        } catch (error: any) {
            setErrorMessage(error.response?.data?.message || '登录失败，请检查输入');
        } finally {
            setLoading(false);
        }
    };

    const [phoneFocused, setPhoneFocused] = useState(false);
    const [codeFocused, setCodeFocused] = useState(false);

    // ... 保持原有 handlePhoneChange 等逻辑不变

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.webContainer}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.content}
                >
                    {/* 顶部 Logo */}
                    <View style={styles.topBar}>
                        <Image
                            source={require('../assets/logo.png')}
                            style={styles.logo}
                            resizeMode="contain"
                        />
                        <View />
                    </View>

                    {/* 标题 */}
                    <View style={styles.header}>
                        <Text style={styles.welcomeText}>欢迎回来</Text>
                        <Text style={styles.subText}>登录以访问您的专属设计方案</Text>
                    </View>

                    {/* 表单区域 */}
                    <View style={styles.formContainer}>
                        {/* 手机号 */}
                        <View style={styles.inputWrapper}>
                            <Text style={styles.inputLabel}>手机号码</Text>
                            <View style={[styles.inputRow, phoneFocused && styles.inputRowFocused]}>
                                <Text style={styles.prefixText}>+86</Text>
                                <TextInput
                                    style={[
                                        styles.input,
                                        Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}
                                    ]}
                                    placeholder="请输入手机号"
                                    placeholderTextColor="#ccc"
                                    keyboardType="phone-pad"
                                    maxLength={13}
                                    value={formatPhoneDisplay(phone)}
                                    onChangeText={handlePhoneChange}
                                    onFocus={() => {
                                        setPhoneFocused(true);
                                        setErrorMessage('');
                                    }}
                                    onBlur={() => setPhoneFocused(false)}
                                />
                                {isPhoneValid && (
                                    <View style={styles.checkmarkCircle}>
                                        <Text style={styles.checkmarkIcon}>✓</Text>
                                    </View>
                                )}
                            </View>
                            <Text style={styles.phoneHint}>未注册手机号验证后自动创建账号</Text>
                        </View>

                        {/* 验证码 / 密码 输入框 */}
                        <View style={styles.inputWrapper}>
                            <View style={styles.codeLabelRow}>
                                <Text style={styles.inputLabel}>
                                    {loginMethod === 'code' ? '验证码' : '密码'}
                                </Text>
                                <TouchableOpacity onPress={() => setLoginMethod(loginMethod === 'code' ? 'password' : 'code')}>
                                    <Text style={styles.passwordLoginText}>
                                        {loginMethod === 'code' ? '使用密码登录' : '使用验证码登录'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                            <View style={[styles.inputRow, (codeFocused || (loginMethod === 'password' && password.length > 0)) && styles.inputRowFocused]}>
                                {loginMethod === 'code' ? (
                                    <>
                                        <TextInput
                                            style={[
                                                styles.input,
                                                Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}
                                            ]}
                                            placeholder="请输入验证码"
                                            placeholderTextColor="#ccc"
                                            keyboardType="number-pad"
                                            maxLength={6}
                                            value={code}
                                            onChangeText={(text) => {
                                                setCode(filterNumeric(text));
                                                setErrorMessage('');
                                            }}
                                            onFocus={() => setCodeFocused(true)}
                                            onBlur={() => setCodeFocused(false)}
                                        />
                                        <TouchableOpacity
                                            style={[
                                                styles.getCodeBtn,
                                                !canSendCode && styles.getCodeBtnDisabled
                                            ]}
                                            onPress={handleSendCode}
                                            disabled={!canSendCode}
                                        >
                                            <Text style={[
                                                styles.getCodeBtnText,
                                                !canSendCode && styles.getCodeBtnTextDisabled
                                            ]}>
                                                {countdown > 0 ? `${countdown}s` : '获取验证码'}
                                            </Text>
                                        </TouchableOpacity>
                                    </>
                                ) : (
                                    <TextInput
                                        style={[
                                            styles.input,
                                            Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}
                                        ]}
                                        placeholder="请输入密码"
                                        placeholderTextColor="#ccc"
                                        secureTextEntry
                                        value={password}
                                        onChangeText={(text) => {
                                            setPassword(text);
                                            setErrorMessage('');
                                        }}
                                        onFocus={() => setCodeFocused(true)}
                                        onBlur={() => setCodeFocused(false)}
                                    />
                                )}
                            </View>
                            {/* 错误提示 - 内联显示在输入框下方 */}
                            {errorMessage ? (
                                <Text style={styles.inlineErrorText}>{errorMessage}</Text>
                            ) : null}
                        </View>

                        {/* 主按钮 */}
                        <TouchableOpacity
                            style={[
                                styles.mainBtn,
                                (!canSubmit || loading) && styles.mainBtnDisabled
                            ]}
                            onPress={handleLogin}
                            disabled={!canSubmit || loading}
                        >
                            <Text style={[
                                styles.mainBtnText,
                                (!canSubmit || loading) && styles.mainBtnTextDisabled
                            ]}>
                                {loading ? '处理中...' : '进入平台 →'}
                            </Text>
                        </TouchableOpacity>

                        {/* 协议勾选 */}
                        <View style={styles.agreementContainer}>
                            <TouchableOpacity
                                style={[styles.checkbox, !agreed && errorMessage ? styles.checkboxError : null]}
                                onPress={() => setAgreed(!agreed)}
                            >
                                {agreed && <View style={styles.checked} />}
                            </TouchableOpacity>
                            <Text style={styles.agreementText}>
                                我已阅读并同意 <Text style={styles.agreementLink}>用户协议</Text> 和 <Text style={styles.agreementLink}>隐私政策</Text>
                            </Text>
                        </View>
                    </View>

                </KeyboardAvoidingView>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    webContainer: {
        flex: 1,
        width: '100%',
        maxWidth: 480,
        alignSelf: 'center',
        backgroundColor: '#fff',
        ...(Platform.OS === 'web' ? {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.1,
            shadowRadius: 20,
            overflow: 'hidden',
        } : {}),
    },
    content: {
        flex: 1,
        paddingHorizontal: 32,
        paddingTop: 20,
    },
    topBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: Platform.OS === 'ios' ? 12 : 44, // 适配沉浸式状态栏
        marginBottom: 40,
    },
    logo: {
        width: 88,
        height: 88,
        borderRadius: 44,
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
    },
    header: {
        marginBottom: 40,
    },
    welcomeText: {
        fontSize: 32,
        color: '#000',
        marginBottom: 8,
        fontFamily: Platform.OS === 'ios' ? 'Times New Roman' : 'serif',
        fontWeight: '400',
    },
    subText: {
        fontSize: 14,
        color: '#999',
        letterSpacing: 0.5,
    },
    formContainer: {
        flex: 1,
    },
    inputWrapper: {
        marginBottom: 32,
    },
    inputLabel: {
        fontSize: 12,
        color: '#999',
        marginBottom: 12,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        paddingBottom: 8,
    },
    inputRowFocused: {
        borderBottomColor: '#000',
        borderBottomWidth: 1.5,
    },
    checkmarkCircle: {
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: '#D4B106',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
    },
    checkmarkIcon: {
        color: '#fff',
        fontSize: 11,
        fontWeight: 'bold',
    },
    prefixText: {
        fontSize: 18,
        color: '#000',
        marginRight: 16,
        fontWeight: '500',
    },
    input: {
        flex: 1,
        fontSize: 18,
        color: '#000',
        height: 30,
        padding: 0,
    },
    phoneHint: {
        fontSize: 12,
        color: '#999',
        marginTop: 8,
    },
    codeLabelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    passwordLoginText: {
        fontSize: 12,
        color: '#000',
        fontWeight: 'bold',
    },
    getCodeBtn: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: '#000',
        marginLeft: 8,
    },
    getCodeBtnDisabled: {
        borderColor: '#eee',
    },
    getCodeBtnText: {
        fontSize: 12,
        color: '#000',
        fontWeight: 'bold',
    },
    getCodeBtnTextDisabled: {
        color: '#ccc',
    },
    mainBtn: {
        height: 56,
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 16,
        marginBottom: 24,
        borderRadius: 0,
    },
    mainBtnDisabled: {
        backgroundColor: '#ccc',
    },
    mainBtnText: {
        fontSize: 16,
        color: '#fff',
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    mainBtnTextDisabled: {
        color: '#999',
    },
    agreementContainer: {
        flexDirection: 'row',
        justifyContent: 'flex-start',
        paddingRight: 16,
    },
    checkbox: {
        width: 16,
        height: 16,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#ccc',
        marginRight: 8,
        marginTop: 2,
        justifyContent: 'center',
        alignItems: 'center',
    },
    checked: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#000',
    },
    agreementText: {
        fontSize: 12,
        color: '#999',
        lineHeight: 18,
        flex: 1,
    },
    agreementLink: {
        color: '#000',
        fontWeight: 'bold',
        textDecorationLine: 'underline',
    },
    errorText: {
        fontSize: 13,
        color: '#FF4D4F',
        marginBottom: 12,
        textAlign: 'left',
    },
    checkboxError: {
        borderColor: '#FF4D4F',
    },
    inlineErrorText: {
        fontSize: 12,
        color: '#FF4D4F',
        marginTop: 8,
        marginLeft: 4,
    },
});

export default LoginScreen;
