import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    TouchableOpacity,
    Platform,
    TextInput,
} from 'react-native';
import { ArrowLeft, Eye, EyeOff, Lock, ShieldAlert } from 'lucide-react-native';
import { useToast } from '../components/Toast';
import { userSettingsApi } from '../services/api';

const PRIMARY_GOLD = '#D4AF37';

interface ChangePasswordScreenProps {
    navigation: any;
}

const ChangePasswordScreen: React.FC<ChangePasswordScreenProps> = ({ navigation }) => {
    const { showAlert } = useToast();
    const [oldPassword, setOldPassword] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showOldPassword, setShowOldPassword] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!oldPassword) {
            showAlert('提示', '请输入旧密码');
            return;
        }
        if (!password) {
            showAlert('提示', '请输入新密码');
            return;
        }
        if (password.length < 6) {
            showAlert('提示', '密码长度不能少于6位');
            return;
        }
        if (password !== confirmPassword) {
            showAlert('提示', '两次输入的新密码不一致');
            return;
        }

        setIsSubmitting(true);
        try {
            await userSettingsApi.changePassword({ oldPassword, newPassword: password });
            showAlert('成功', '密码修改成功，请妥善保管', [
                { text: '知道了', onPress: () => navigation.goBack() }
            ]);
        } catch (error: any) {
            showAlert('修改失败', error.response?.data?.message || '无法修改密码，请检查旧密码是否正确');
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
                <Text style={styles.headerTitle}>修改密码</Text>
                <View style={styles.placeholder} />
            </View>

            <View style={styles.content}>
                <View style={styles.tipCard}>
                    <ShieldAlert size={16} color={PRIMARY_GOLD} />
                    <Text style={styles.tipText}>
                        密码长度需至少6位，建议使用字母、数字的组合以提高安全性。
                    </Text>
                </View>

                {/* 旧密码输入 */}
                <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>旧密码</Text>
                    <View style={styles.inputWrapper}>
                        <Lock size={20} color="#A1A1AA" />
                        <TextInput
                            style={styles.input}
                            value={oldPassword}
                            onChangeText={setOldPassword}
                            placeholder="请输入当前密码"
                            placeholderTextColor="#A1A1AA"
                            secureTextEntry={!showOldPassword}
                        />
                        <TouchableOpacity onPress={() => setShowOldPassword(!showOldPassword)}>
                            {showOldPassword ? (
                                <EyeOff size={20} color="#A1A1AA" />
                            ) : (
                                <Eye size={20} color="#A1A1AA" />
                            )}
                        </TouchableOpacity>
                    </View>
                </View>

                {/* 新密码输入 */}
                <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>新密码</Text>
                    <View style={styles.inputWrapper}>
                        <Lock size={20} color="#A1A1AA" />
                        <TextInput
                            style={styles.input}
                            value={password}
                            onChangeText={setPassword}
                            placeholder="请输入新密码（至少6位）"
                            placeholderTextColor="#A1A1AA"
                            secureTextEntry={!showPassword}
                        />
                        <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                            {showPassword ? (
                                <EyeOff size={20} color="#A1A1AA" />
                            ) : (
                                <Eye size={20} color="#A1A1AA" />
                            )}
                        </TouchableOpacity>
                    </View>
                </View>

                {/* 确认密码 */}
                <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>确认密码</Text>
                    <View style={styles.inputWrapper}>
                        <Lock size={20} color="#A1A1AA" />
                        <TextInput
                            style={styles.input}
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            placeholder="请再次输入新密码"
                            placeholderTextColor="#A1A1AA"
                            secureTextEntry={!showConfirmPassword}
                        />
                        <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                            {showConfirmPassword ? (
                                <EyeOff size={20} color="#A1A1AA" />
                            ) : (
                                <Eye size={20} color="#A1A1AA" />
                            )}
                        </TouchableOpacity>
                    </View>
                </View>

                {/* 提交按钮 */}
                <TouchableOpacity
                    style={[styles.submitBtn, (!oldPassword || !password || !confirmPassword || isSubmitting) && styles.submitBtnDisabled]}
                    onPress={handleSubmit}
                    disabled={!oldPassword || !password || !confirmPassword || isSubmitting}
                >
                    <Text style={styles.submitBtnText}>
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
    inputGroup: {
        marginBottom: 20,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: '#09090B',
        marginBottom: 8,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
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
        marginRight: 10,
    },
    submitBtn: {
        backgroundColor: PRIMARY_GOLD,
        borderRadius: 14,
        paddingVertical: 16,
        alignItems: 'center',
        marginTop: 24,
        shadowColor: PRIMARY_GOLD,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 4,
    },
    submitBtnDisabled: {
        backgroundColor: '#D4D4D8',
        shadowOpacity: 0,
        elevation: 0,
    },
    submitBtnText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
    tipCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: '#F5ECD0',
        borderRadius: 12,
        padding: 14,
        marginBottom: 24,
        gap: 10,
    },
    tipText: {
        flex: 1,
        fontSize: 13,
        color: '#78550A',
        lineHeight: 20
    },
});

export default ChangePasswordScreen;
