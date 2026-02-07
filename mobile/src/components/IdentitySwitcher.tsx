import React, { useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    FlatList,
    ActivityIndicator,
} from 'react-native';
import { X, User, Briefcase, HardHat, Building2, CheckCircle2 } from 'lucide-react-native';
import { useIdentityStore } from '../store/identityStore';
import { useToast } from './Toast';

interface IdentitySwitcherProps {
    visible: boolean;
    onClose: () => void;
}

const PRIMARY_GOLD = '#D4AF37';

const IDENTITY_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
    owner: { label: '业主', icon: User, color: '#3B82F6' },
    user: { label: '业主', icon: User, color: '#3B82F6' },
    provider: { label: '服务商', icon: Building2, color: '#10B981' },
    designer: { label: '设计师', icon: Briefcase, color: '#8B5CF6' },
    foreman: { label: '工长', icon: HardHat, color: '#F59E0B' },
    worker: { label: '工长', icon: HardHat, color: '#F59E0B' },
    company: { label: '装修公司', icon: Building2, color: '#10B981' },
    admin: { label: '管理员', icon: User, color: '#EF4444' },
};

const statusLabel = (status: number) => {
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

const getIdentityKey = (item: any): string => {
    const type = String(item?.identityType || '').toLowerCase();
    if (type === 'provider') {
        return normalizeProviderSubType(item?.providerSubType) || 'provider';
    }
    if (type === 'worker') {
        return 'foreman';
    }
    return type || 'owner';
};

export const IdentitySwitcher: React.FC<IdentitySwitcherProps> = ({ visible, onClose }) => {
    const { identities, currentIdentity, loading, error, fetchIdentities, switchIdentity, clearError } = useIdentityStore();
    const { showConfirm, showToast } = useToast();

    useEffect(() => {
        if (visible) {
            fetchIdentities();
        }
    }, [visible, fetchIdentities]);

    const handleSwitch = async (identityId: number) => {
        showConfirm({
            title: '确认切换',
            message: '切换身份后，您将以新身份登录系统',
            confirmText: '确认',
            cancelText: '取消',
            onConfirm: async () => {
                try {
                    await switchIdentity(identityId);
                    showToast({ message: '身份切换成功', type: 'success' });
                    onClose();
                } catch {
                    showToast({ message: error || '切换身份失败', type: 'error' });
                }
            },
        });
    };

    const renderIdentityCard = ({ item }: { item: any }) => {
        const key = getIdentityKey(item);
        const config = IDENTITY_CONFIG[key] || IDENTITY_CONFIG.user;
        const Icon = config.icon;
        const isActive = currentIdentity?.id === item.id;
        const isApproved = item.status === 1;

        return (
            <TouchableOpacity
                style={[
                    styles.identityCard,
                    isActive && styles.identityCardActive,
                    !isApproved && styles.identityCardDisabled,
                ]}
                onPress={() => isApproved && !isActive && handleSwitch(item.id)}
                disabled={!isApproved || isActive}
            >
                <View style={styles.identityCardContent}>
                    <View style={[styles.iconContainer, { backgroundColor: `${config.color}20` }]}>
                        <Icon size={24} color={config.color} />
                    </View>
                    <View style={styles.identityInfo}>
                        <Text style={styles.identityLabel}>{config.label}</Text>
                        <Text style={styles.identityStatus}>{statusLabel(item.status)}</Text>
                    </View>
                    {isActive && (
                        <View style={styles.activeIndicator}>
                            <CheckCircle2 size={20} color={PRIMARY_GOLD} />
                        </View>
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <View style={styles.header}>
                        <Text style={styles.title}>切换身份</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <X size={24} color="#71717A" />
                        </TouchableOpacity>
                    </View>

                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={PRIMARY_GOLD} />
                            <Text style={styles.loadingText}>加载中...</Text>
                        </View>
                    ) : error ? (
                        <View style={styles.errorContainer}>
                            <Text style={styles.errorText}>{error}</Text>
                            <TouchableOpacity
                                style={styles.retryBtn}
                                onPress={() => {
                                    clearError();
                                    fetchIdentities();
                                }}
                            >
                                <Text style={styles.retryBtnText}>重试</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <FlatList
                            data={identities}
                            renderItem={renderIdentityCard}
                            keyExtractor={(item) => item.id.toString()}
                            contentContainerStyle={styles.listContent}
                            ListEmptyComponent={
                                <View style={styles.emptyContainer}>
                                    <Text style={styles.emptyText}>暂无可用身份</Text>
                                </View>
                            }
                        />
                    )}
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    container: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '80%',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F4F4F5',
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: '#09090B',
    },
    closeBtn: {
        padding: 4,
    },
    listContent: {
        padding: 20,
    },
    identityCard: {
        backgroundColor: '#F8F9FA',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    identityCardActive: {
        borderColor: PRIMARY_GOLD,
        backgroundColor: '#FFFBEB',
    },
    identityCardDisabled: {
        opacity: 0.5,
    },
    identityCardContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    identityInfo: {
        flex: 1,
        marginLeft: 12,
    },
    identityLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#09090B',
        marginBottom: 4,
    },
    identityStatus: {
        fontSize: 13,
        color: '#71717A',
    },
    activeIndicator: {
        marginLeft: 8,
    },
    loadingContainer: {
        padding: 40,
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: '#71717A',
    },
    errorContainer: {
        padding: 40,
        alignItems: 'center',
    },
    errorText: {
        fontSize: 14,
        color: '#EF4444',
        marginBottom: 16,
        textAlign: 'center',
    },
    retryBtn: {
        paddingHorizontal: 24,
        paddingVertical: 10,
        backgroundColor: PRIMARY_GOLD,
        borderRadius: 8,
    },
    retryBtnText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    emptyContainer: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 14,
        color: '#71717A',
    },
});
