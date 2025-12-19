import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    TouchableOpacity,
    Platform,
    Modal,
} from 'react-native';
import { ArrowLeft, ChevronRight, Info } from 'lucide-react-native';
import { useAuthStore } from '../store/authStore';

const PRIMARY_GOLD = '#D4AF37';

interface AccountSecurityScreenProps {
    navigation: any;
}

const AccountSecurityScreen: React.FC<AccountSecurityScreenProps> = ({ navigation }) => {
    const { user } = useAuthStore();
    const [devModalVisible, setDevModalVisible] = useState(false);
    const [devMessage, setDevMessage] = useState('');

    // 显示开发中弹框
    const showDevModal = (feature: string) => {
        setDevMessage(`${feature}功能正在开发中，敬请期待！`);
        setDevModalVisible(true);
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ArrowLeft size={24} color="#09090B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>账号安全</Text>
                <View style={styles.placeholder} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.section}>
                    {/* 修改手机号 */}
                    <TouchableOpacity style={styles.menuItem} onPress={() => showDevModal('修改手机号')}>
                        <Text style={styles.menuLabel}>修改手机号</Text>
                        <View style={styles.menuRight}>
                            <Text style={styles.menuValue}>
                                {user?.phone?.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') || '未绑定'}
                            </Text>
                            <ChevronRight size={18} color="#A1A1AA" />
                        </View>
                    </TouchableOpacity>

                    {/* 修改登录密码 */}
                    <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('ChangePassword')}>
                        <Text style={styles.menuLabel}>修改登录密码</Text>
                        <ChevronRight size={18} color="#A1A1AA" />
                    </TouchableOpacity>

                    {/* 实名认证 */}
                    <TouchableOpacity style={styles.menuItem} onPress={() => showDevModal('实名认证')}>
                        <Text style={styles.menuLabel}>实名认证</Text>
                        <View style={styles.menuRight}>
                            <Text style={styles.menuValue}>未认证</Text>
                            <ChevronRight size={18} color="#A1A1AA" />
                        </View>
                    </TouchableOpacity>

                    {/* 登录设备管理 */}
                    <TouchableOpacity style={styles.menuItem} onPress={() => showDevModal('登录设备管理')}>
                        <Text style={styles.menuLabel}>登录设备管理</Text>
                        <ChevronRight size={18} color="#A1A1AA" />
                    </TouchableOpacity>

                    {/* 注销账号 */}
                    <TouchableOpacity style={[styles.menuItem, styles.menuItemLast]} onPress={() => showDevModal('注销账号')}>
                        <View>
                            <Text style={styles.menuLabel}>注销账号</Text>
                            <Text style={styles.dangerHint}>注销后无法恢复，请谨慎操作</Text>
                        </View>
                        <ChevronRight size={18} color="#A1A1AA" />
                    </TouchableOpacity>
                </View>
            </ScrollView>

            {/* 开发中弹框 */}
            <Modal visible={devModalVisible} transparent animationType="fade">
                <View style={styles.dialogOverlay}>
                    <View style={styles.dialogContainer}>
                        <View style={styles.dialogIconContainer}>
                            <Info size={32} color={PRIMARY_GOLD} />
                        </View>
                        <Text style={styles.dialogTitle}>功能开发中</Text>
                        <Text style={styles.dialogMessage}>{devMessage}</Text>
                        <TouchableOpacity style={styles.dialogBtn} onPress={() => setDevModalVisible(false)}>
                            <Text style={styles.dialogBtnText}>知道了</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F5F5',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'ios' ? 12 : 44,
        paddingBottom: 12,
        backgroundColor: '#F5F5F5',
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
        flex: 1,
        paddingHorizontal: 16,
    },
    section: {
        backgroundColor: '#FFFFFF',
        marginTop: 12,
        borderRadius: 12,
        overflow: 'hidden',
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#F0F0F0',
    },
    menuItemLast: {
        borderBottomWidth: 0,
    },
    menuLabel: {
        fontSize: 16,
        color: '#09090B',
    },
    menuRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    menuValue: {
        fontSize: 14,
        color: '#A1A1AA',
        marginRight: 6,
    },
    dangerHint: {
        fontSize: 11,
        color: '#EF4444',
        marginTop: 2,
    },
    // 弹窗样式
    dialogOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    dialogContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
        width: '100%',
        maxWidth: 320,
    },
    dialogIconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#FFFBEB',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    dialogTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#09090B',
        marginBottom: 8,
    },
    dialogMessage: {
        fontSize: 14,
        color: '#71717A',
        textAlign: 'center',
        marginBottom: 24,
    },
    dialogBtn: {
        width: '100%',
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
        backgroundColor: PRIMARY_GOLD,
    },
    dialogBtnText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#FFFFFF',
    },
});

export default AccountSecurityScreen;
