import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    TouchableOpacity,
    ScrollView,
} from 'react-native';
import { useAuthStore } from '../store/authStore';
import { useToast } from '../components/Toast';

const ProfileScreen = () => {
    const { user, logout } = useAuthStore();
    const { showConfirm } = useToast();

    const handleLogout = () => {
        showConfirm({
            title: '确认退出',
            message: '确定要退出登录吗？',
            confirmText: '退出',
            cancelText: '取消',
            onConfirm: logout,
        });
    };

    const menuItems = [
        { icon: '📋', label: '我的订单', badge: '' },
        { icon: '❤️', label: '我的收藏', badge: '' },
        { icon: '📍', label: '地址管理', badge: '' },
        { icon: '🎫', label: '优惠券', badge: '2' },
        { icon: '⚙️', label: '设置', badge: '' },
        { icon: '❓', label: '帮助与反馈', badge: '' },
    ];

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView>
                {/* 用户信息卡片 */}
                <View style={styles.userCard}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>
                            {user?.nickname?.[0] || user?.phone?.[0] || '👤'}
                        </Text>
                    </View>
                    <View style={styles.userInfo}>
                        <Text style={styles.nickname}>
                            {user?.nickname || `用户${user?.phone?.slice(-4) || ''}`}
                        </Text>
                        <Text style={styles.phone}>
                            {user?.phone?.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') || '未绑定手机'}
                        </Text>
                    </View>
                    <TouchableOpacity style={styles.editBtn}>
                        <Text style={styles.editBtnText}>编辑</Text>
                    </TouchableOpacity>
                </View>

                {/* 统计数据 */}
                <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                        <Text style={styles.statNumber}>0</Text>
                        <Text style={styles.statLabel}>进行中</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={styles.statNumber}>0</Text>
                        <Text style={styles.statLabel}>已完成</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={styles.statNumber}>0</Text>
                        <Text style={styles.statLabel}>待评价</Text>
                    </View>
                </View>

                {/* 菜单列表 */}
                <View style={styles.menuList}>
                    {menuItems.map((item, index) => (
                        <TouchableOpacity key={index} style={styles.menuItem}>
                            <Text style={styles.menuIcon}>{item.icon}</Text>
                            <Text style={styles.menuLabel}>{item.label}</Text>
                            {item.badge ? (
                                <View style={styles.badge}>
                                    <Text style={styles.badgeText}>{item.badge}</Text>
                                </View>
                            ) : null}
                            <Text style={styles.menuArrow}>›</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* 退出登录按钮 */}
                <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                    <Text style={styles.logoutText}>退出登录</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F5F5',
    },
    userCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1890FF',
        padding: 20,
        paddingTop: 40,
    },
    avatar: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(255,255,255,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        fontSize: 28,
        color: '#fff',
    },
    userInfo: {
        flex: 1,
        marginLeft: 16,
    },
    nickname: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
    },
    phone: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.8)',
        marginTop: 4,
    },
    editBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.5)',
    },
    editBtnText: {
        color: '#fff',
        fontSize: 12,
    },
    statsRow: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        paddingVertical: 20,
        marginBottom: 12,
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
    },
    statNumber: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
    },
    statLabel: {
        fontSize: 12,
        color: '#999',
        marginTop: 4,
    },
    menuList: {
        backgroundColor: '#fff',
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    menuIcon: {
        fontSize: 20,
        marginRight: 12,
    },
    menuLabel: {
        flex: 1,
        fontSize: 16,
        color: '#333',
    },
    badge: {
        backgroundColor: '#FF4D4F',
        borderRadius: 10,
        paddingHorizontal: 8,
        paddingVertical: 2,
        marginRight: 8,
    },
    badgeText: {
        color: '#fff',
        fontSize: 12,
    },
    menuArrow: {
        fontSize: 20,
        color: '#ccc',
    },
    logoutBtn: {
        margin: 20,
        backgroundColor: '#fff',
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: 'center',
    },
    logoutText: {
        color: '#FF4D4F',
        fontSize: 16,
    },
});

export default ProfileScreen;
