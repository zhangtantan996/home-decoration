import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
} from 'react-native';
import { useAuthStore } from '../store/authStore';
import { authApi } from '../services/api';
import { useToast } from '../components/Toast';

const LoginScreen: React.FC = () => {
    const { showToast } = useToast();
    const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
    const [loginMethod, setLoginMethod] = useState<'code' | 'password'>('code');
    const [phone, setPhone] = useState('');
    const [code, setCode] = useState('');
    const [password, setPassword] = useState('');
    const [agreed, setAgreed] = useState(false);
    const [loading, setLoading] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const setAuth = useAuthStore((state) => state.setAuth);

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
        if (!phone || phone.length !== 11) {
            showToast({ message: '请输入正确的11位手机号', type: 'warning' });
            return;
        }
        try {
            await authApi.sendCode(phone);
            setCountdown(60);
            showToast({ message: '验证码已发送 (测试码: 123456)', type: 'success' });
        } catch (error: any) {
            showToast({ message: error.response?.data?.message || '发送失败，请稍后重试', type: 'error' });
        }
    };

    const handleLogin = async () => {
        if (!agreed) {
            showToast({ message: '请先阅读并同意用户协议和隐私政策', type: 'warning' });
            return;
        }
        if (!phone) {
            showToast({ message: '请输入手机号', type: 'warning' });
            return;
        }

        if (activeTab === 'login') {
            if (loginMethod === 'code' && !code) {
                showToast({ message: '请输入验证码', type: 'warning' });
                return;
            }
            if (loginMethod === 'password' && !password) {
                showToast({ message: '请输入密码', type: 'warning' });
                return;
            }
        } else {
            // 注册
            if (!code) {
                showToast({ message: '请输入验证码', type: 'warning' });
                return;
            }
        }

        setLoading(true);
        try {
            let result;
            if (activeTab === 'login') {
                result = await authApi.login({
                    phone,
                    code: loginMethod === 'code' ? code : undefined,
                    password: loginMethod === 'password' ? password : undefined,
                    type: loginMethod
                });
            } else {
                result = await authApi.register({ phone, code });
            }

            const { token, user } = result as any;
            setAuth(token, user);
        } catch (error: any) {
            showToast({ message: error.response?.data?.message || '操作失败，请检查输入', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const isRegister = activeTab === 'register';

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.webContainer}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.content}
                >
                    {/* 顶部 Logo */}
                    <View style={styles.topBar}>
                        <View style={styles.logoBox}>
                            <Text style={styles.logoText}>L</Text>
                        </View>
                        {/* 用户要求不增加游客浏览 */}
                        <View />
                    </View>

                    {/* 标题 - 根据状态动态显示 */}
                    <View style={styles.header}>
                        <Text style={styles.welcomeText}>
                            {isRegister ? '创建账号' : '欢迎回来'}
                        </Text>
                        <Text style={styles.subText}>
                            {isRegister ? '开启您的极简奢华装修之旅' : '登录以访问您的专属设计方案'}
                        </Text>
                    </View>

                    {/* Tab 切换 */}
                    <View style={styles.tabContainer}>
                        <TouchableOpacity
                            style={styles.tabItem}
                            onPress={() => setActiveTab('login')}
                        >
                            <Text style={[styles.tabText, !isRegister && styles.tabTextActive]}>
                                登录
                            </Text>
                            {!isRegister && <View style={styles.activeLine} />}
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.tabItem}
                            onPress={() => setActiveTab('register')}
                        >
                            <Text style={[styles.tabText, isRegister && styles.tabTextActive]}>
                                注册
                            </Text>
                            {isRegister && <View style={styles.activeLine} />}
                        </TouchableOpacity>
                    </View>


                    {/* 表单区域 */}
                    <View style={styles.formContainer}>
                        {/* 手机号 */}
                        <View style={styles.inputWrapper}>
                            <Text style={styles.inputLabel}>手机号码</Text>
                            <View style={styles.inputRow}>
                                <Text style={styles.prefixText}>+86</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="请输入手机号"
                                    placeholderTextColor="#ccc"
                                    keyboardType="phone-pad"
                                    maxLength={11}
                                    value={phone}
                                    onChangeText={setPhone}
                                />
                            </View>
                        </View>

                        {/* 验证码 / 密码 输入框 */}
                        <View style={styles.inputWrapper}>
                            <View style={styles.codeLabelRow}>
                                <Text style={styles.inputLabel}>
                                    {isRegister ? '验证码' : (loginMethod === 'code' ? '验证码' : '密码')}
                                </Text>
                                {!isRegister && (
                                    <TouchableOpacity onPress={() => setLoginMethod(loginMethod === 'code' ? 'password' : 'code')}>
                                        <Text style={styles.passwordLoginText}>
                                            {loginMethod === 'code' ? '使用密码登录' : '使用验证码登录'}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                            <View style={styles.inputRow}>
                                {isRegister || loginMethod === 'code' ? (
                                    <>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="请输入验证码"
                                            placeholderTextColor="#ccc"
                                            keyboardType="number-pad"
                                            maxLength={6}
                                            value={code}
                                            onChangeText={setCode}
                                        />
                                        <TouchableOpacity
                                            style={styles.getCodeBtn}
                                            onPress={handleSendCode}
                                            disabled={countdown > 0}
                                        >
                                            <Text style={[
                                                styles.getCodeBtnText,
                                                countdown > 0 && styles.getCodeBtnTextDisabled
                                            ]}>
                                                {countdown > 0 ? `${countdown}s` : '获取验证码'}
                                            </Text>
                                        </TouchableOpacity>
                                    </>
                                ) : (
                                    <TextInput
                                        style={styles.input}
                                        placeholder="请输入密码"
                                        placeholderTextColor="#ccc"
                                        secureTextEntry
                                        value={password}
                                        onChangeText={setPassword}
                                    />
                                )}
                            </View>
                        </View>

                        {/* 主按钮 */}
                        <TouchableOpacity
                            style={styles.mainBtn}
                            onPress={handleLogin}
                            disabled={loading}
                        >
                            <Text style={styles.mainBtnText}>
                                {loading ? '处理中...' : (isRegister ? '立即注册 →' : '进入平台 →')}
                            </Text>
                        </TouchableOpacity>

                        {/* 协议勾选 */}
                        <View style={styles.agreementContainer}>
                            <TouchableOpacity
                                style={styles.checkbox}
                                onPress={() => setAgreed(!agreed)}
                            >
                                {agreed && <View style={styles.checked} />}
                            </TouchableOpacity>
                            <Text style={styles.agreementText}>
                                我已阅读并同意 <Text style={styles.agreementLink}>用户协议</Text> 和 <Text style={styles.agreementLink}>隐私政策</Text>。未注册手机号将自动创建账号。
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
        maxWidth: 480, // 限制最大宽度模拟移动端
        alignSelf: 'center', // 居中显示
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
        marginBottom: 40,
    },
    logoBox: {
        width: 48,
        height: 48,
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
    },
    logoText: {
        color: '#fff',
        fontSize: 28,
        fontFamily: Platform.OS === 'ios' ? 'Times New Roman' : 'serif',
        fontWeight: 'bold',
    },
    guestText: {
        fontSize: 14,
        color: '#999',
    },
    header: {
        marginBottom: 40,
    },
    welcomeText: {
        fontSize: 32,
        color: '#000',
        marginBottom: 8,
        // 尝试模拟衬线体效果
        fontFamily: Platform.OS === 'ios' ? 'Times New Roman' : 'serif',
        fontWeight: '400',
    },
    subText: {
        fontSize: 14,
        color: '#999',
        letterSpacing: 0.5,
    },
    tabContainer: {
        flexDirection: 'row',
        marginBottom: 32,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    tabItem: {
        marginRight: 32,
        paddingBottom: 12,
        position: 'relative',
    },
    tabText: {
        fontSize: 16,
        color: '#999',
        fontWeight: 'bold',
    },
    tabTextActive: {
        color: '#000',
    },
    activeLine: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        width: 24, // 短下划线
        height: 3,
        backgroundColor: '#000',
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
    prefixText: {
        fontSize: 18,
        color: '#000',
        marginRight: 16,
        fontWeight: '500',
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: '#000',
        height: 40,
        padding: 0, // 移除默认padding以对齐
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
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#000',
        marginLeft: 8,
    },
    getCodeBtnText: {
        fontSize: 12,
        color: '#000',
        fontWeight: 'bold',
    },
    getCodeBtnTextDisabled: {
        color: '#999',
        borderColor: '#999',
    },
    mainBtn: {
        height: 56,
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 16,
        marginBottom: 24,
        borderRadius: 0, // 直角矩形
    },
    mainBtnText: {
        fontSize: 16,
        color: '#fff',
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    agreementContainer: {
        flexDirection: 'row',
        justifyContent: 'flex-start',
        paddingRight: 16,
    },
    checkbox: {
        width: 16,
        height: 16,
        borderRadius: 8, // 圆形
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
    footer: {
        paddingBottom: 40,
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 32,
    },
    line: {
        width: 60,
        height: 1,
        backgroundColor: '#f0f0f0',
    },
    dividerText: {
        fontSize: 12,
        color: '#ccc',
        marginHorizontal: 16,
    },
    socialIcons: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 40,
    },
    iconCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#F8F9FA',
        justifyContent: 'center',
        alignItems: 'center',
    },
    socialIcon: {
        fontSize: 20,
        color: '#333',
    },
});

export default LoginScreen;
