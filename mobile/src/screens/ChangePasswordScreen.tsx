import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    TouchableOpacity,
    Platform,
    TextInput,
    Alert,
} from 'react-native';
import { ArrowLeft, Eye, EyeOff, Lock } from 'lucide-react-native';

const PRIMARY_GOLD = '#D4AF37';

interface ChangePasswordScreenProps {
    navigation: any;
}

const ChangePasswordScreen: React.FC<ChangePasswordScreenProps> = ({ navigation }) => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const handleSubmit = () => {
        if (!password) {
            Alert.alert('提示', '请输入新密码');
            return;
        }
        if (password.length < 6) {
            Alert.alert('提示', '密码长度不能少于6位');
            return;
        }
        if (password !== confirmPassword) {
            Alert.alert('提示', '两次输入的密码不一致');
            return;
        }
        // TODO: 调用API修改密码
        Alert.alert('成功', '密码修改成功', [
            { text: '确定', onPress: () => navigation.goBack() }
        ]);
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
                {/* 密码输入 */}
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
                <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
                    <Text style={styles.submitBtnText}>确认修改</Text>
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
        borderRadius: 10,
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: 20,
    },
    submitBtnText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default ChangePasswordScreen;
