import React, { useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    TouchableOpacity,
    ActivityIndicator,
    FlatList,
    Platform,
} from 'react-native';
import { ArrowLeft, User, Briefcase, HardHat, Building2, Shield, CheckCircle2, ChevronRight } from 'lucide-react-native';
import { useIdentityStore, type Identity } from '../store/identityStore';
import { useToast } from '../components/Toast';

const PRIMARY_GOLD = '#D4AF37';

interface IdentityManagementScreenProps {
    navigation: any;
}

const IDENTITY_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
    owner: { label: '业主', icon: User, color: '#3B82F6' },
    user: { label: '业主', icon: User, color: '#3B82F6' },
    provider: { label: '服务商', icon: Building2, color: '#10B981' },
    designer: { label: '设计师', icon: Briefcase, color: '#8B5CF6' },
    foreman: { label: '工长', icon: HardHat, color: '#F59E0B' },
    worker: { label: '工长', icon: HardHat, color: '#F59E0B' },
    company: { label: '装修公司', icon: Building2, color: '#10B981' },
    admin: { label: '管理员', icon: Shield, color: '#EF4444' },
};

const statusText = (status: number) => {
    switch (status) {
        case 1:
            return '已认证';
        case 0:
            return '审核中';
        case 2:
            return '未通过';
        case 3:
            return '已停用';
        default:
            return '未知状态';
    }
};

const normalizeProviderSubType = (value?: string | null): 'designer' | 'company' | 'foreman' | undefined => {
    const normalized = String(value || '').toLowerCase();
    if (normalized === 'designer') {
        return 'designer';
    }
    if (normalized === 'company') {
        return 'company';
    }
    if (normalized === 'foreman' || normalized === 'worker') {
        return 'foreman';
    }
    return undefined;
};

const getIdentityKey = (identity?: Identity | null) => {
    if (!identity) {
        return 'owner';
    }
    if (identity.identityType === 'provider') {
        return normalizeProviderSubType(identity.providerSubType) || 'provider';
    }
    return identity.identityType;
};

const IdentityManagementScreen: React.FC<IdentityManagementScreenProps> = ({ navigation }) => {
    const {
        identities,
        currentIdentity,
        loading,
        error,
        fetchIdentities,
        switchIdentity,
        clearError,
    } = useIdentityStore();
    const { showToast, showConfirm } = useToast();

    useEffect(() => {
        fetchIdentities();
    }, [fetchIdentities]);

    const handleSwitch = (item: Identity) => {
        if (item.status !== 1 || currentIdentity?.id === item.id || loading) {
            return;
        }

        const identityKey = getIdentityKey(item);

        showConfirm({
            title: '确认切换',
            message: `切换为${IDENTITY_CONFIG[identityKey]?.label || item.identityType}后，功能权限将同步更新`,
            confirmText: '确认',
            cancelText: '取消',
            onConfirm: async () => {
                try {
                    await switchIdentity(item.id, item.identityType);
                    showToast({ message: '身份已切换', type: 'success' });
                } catch (switchError: any) {
                    showToast({
                        message: switchError?.message || '切换身份失败，请稍后重试',
                        type: 'error',
                    });
                }
            },
        });
    };

    const renderItem = ({ item }: { item: Identity }) => {
        const config = IDENTITY_CONFIG[getIdentityKey(item)] || IDENTITY_CONFIG.owner;
        const Icon = config.icon;
        const isActive = currentIdentity?.id === item.id;
        const canSwitch = item.status === 1 && !isActive;

        return (
            <TouchableOpacity
                style={[styles.identityCard, isActive && styles.identityCardActive, !canSwitch && !isActive && styles.identityCardDisabled]}
                disabled={!canSwitch}
                onPress={() => handleSwitch(item)}
            >
                <View style={styles.identityLeft}>
                    <View style={[styles.iconContainer, { backgroundColor: `${config.color}20` }]}>
                        <Icon size={22} color={config.color} />
                    </View>
                    <View>
                        <Text style={styles.identityName}>{config.label}</Text>
                        <Text style={styles.identityStatus}>{statusText(item.status)}</Text>
                    </View>
                </View>

                {isActive ? (
                    <CheckCircle2 size={20} color={PRIMARY_GOLD} />
                ) : (
                    <ChevronRight size={18} color={canSwitch ? '#A1A1AA' : '#D4D4D8'} />
                )}
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ArrowLeft size={24} color="#09090B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>身份管理</Text>
                <View style={styles.placeholder} />
            </View>

            {loading && identities.length === 0 ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={PRIMARY_GOLD} />
                    <Text style={styles.loadingText}>加载中...</Text>
                </View>
            ) : error ? (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorTitle}>查询身份失败</Text>
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity
                        style={styles.retryBtn}
                        onPress={() => {
                            clearError();
                            fetchIdentities();
                        }}
                    >
                        <Text style={styles.retryBtnText}>重新加载</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    data={identities}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    ListHeaderComponent={
                        <Text style={styles.hintText}>当前身份：{IDENTITY_CONFIG[getIdentityKey(currentIdentity)]?.label || '业主'}</Text>
                    }
                    ListFooterComponent={
                        <TouchableOpacity
                            style={styles.applyBtn}
                            onPress={() => navigation.navigate('IdentityApplication')}
                        >
                            <Text style={styles.applyBtnText}>申请新身份</Text>
                            <ChevronRight size={16} color="#71717A" />
                        </TouchableOpacity>
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>暂无可用身份</Text>
                        </View>
                    }
                />
            )}
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
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 10,
        fontSize: 14,
        color: '#71717A',
    },
    errorContainer: {
        marginHorizontal: 16,
        marginTop: 18,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 18,
    },
    errorTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#09090B',
        marginBottom: 8,
    },
    errorText: {
        fontSize: 13,
        color: '#71717A',
        lineHeight: 20,
        marginBottom: 14,
    },
    retryBtn: {
        backgroundColor: PRIMARY_GOLD,
        borderRadius: 10,
        alignItems: 'center',
        paddingVertical: 12,
    },
    retryBtnText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    listContent: {
        paddingHorizontal: 16,
        paddingBottom: 32,
    },
    hintText: {
        fontSize: 13,
        color: '#71717A',
        marginTop: 8,
        marginBottom: 12,
    },
    identityCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 14,
        marginBottom: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'transparent',
    },
    identityCardActive: {
        borderColor: PRIMARY_GOLD,
        backgroundColor: '#FFFBEB',
    },
    identityCardDisabled: {
        opacity: 0.65,
    },
    identityLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    identityName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#09090B',
        marginBottom: 4,
    },
    identityStatus: {
        fontSize: 12,
        color: '#71717A',
    },
    applyBtn: {
        marginTop: 10,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    applyBtnText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#09090B',
    },
    emptyContainer: {
        marginTop: 48,
        alignItems: 'center',
    },
    emptyText: {
        color: '#A1A1AA',
        fontSize: 14,
    },
});

export default IdentityManagementScreen;
