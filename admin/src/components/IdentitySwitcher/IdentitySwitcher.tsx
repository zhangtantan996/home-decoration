import React, { useEffect } from 'react';
import { Dropdown, Badge, Button, message, Spin } from 'antd';
import { UserOutlined, SwapOutlined, CheckCircleOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { useIdentityStore, type Identity } from '../../stores/identityStore';
import { useAuthStore } from '../../stores/authStore';

const IdentitySwitcher: React.FC = () => {
    const { identities, currentIdentity, loading, error, fetchIdentities, switchIdentity, clearError } = useIdentityStore();
    const { admin } = useAuthStore();

    useEffect(() => {
        if (admin) {
            fetchIdentities();
        }
    }, [admin]);

    useEffect(() => {
        if (error) {
            message.error(error);
            clearError();
        }
    }, [error]);

    const getIdentityKey = (identity: Identity) => {
        if (identity.identityType !== 'provider') {
            return identity.identityType;
        }
        return identity.providerSubType || 'provider';
    };

    const getIdentityLabel = (identity: Identity) => {
        if (identity.displayName) {
            return identity.displayName;
        }

        switch (getIdentityKey(identity)) {
            case 'owner':
                return '业主';
            case 'designer':
                return '设计师';
            case 'company':
                return '装修公司';
            case 'foreman':
                return '工长';
            case 'provider':
                return '服务商';
            case 'admin':
                return '管理员';
            default:
                return identity.identityType;
        }
    };

    const handleSwitchIdentity = async (identity: Identity) => {
        if (loading) {
            return;
        }

        try {
            const currentRole = currentIdentity?.identityType || admin?.activeRole;
            await switchIdentity(identity.id, currentRole);
            message.success('身份切换成功');
            window.location.reload();
        } catch (err: any) {
            message.error(err.message || '切换身份失败');
        }
    };

    const identityIcons: Record<string, React.ReactNode> = {
        owner: '👤',
        provider: '🏢',
        designer: '🎨',
        company: '🏬',
        foreman: '👷',
        admin: '👨‍💼',
    };

    const identityColors: Record<string, string> = {
        owner: '#1890ff',
        provider: '#52c41a',
        designer: '#722ed1',
        company: '#13c2c2',
        foreman: '#fa8c16',
        admin: '#f5222d',
    };

    const menuItems: MenuProps['items'] = identities.map((identity) => {
        const isCurrent = currentIdentity?.id === identity.id;
        const key = getIdentityKey(identity);
        return {
            key: identity.id,
            label: (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>
                        <span style={{ marginRight: 8 }}>{identityIcons[key] || identityIcons.owner}</span>
                        {getIdentityLabel(identity)}
                    </span>
                    {isCurrent && <CheckCircleOutlined style={{ color: '#52c41a' }} />}
                </div>
            ),
            onClick: () => {
                if (!isCurrent) {
                    handleSwitchIdentity(identity);
                }
            },
            disabled: isCurrent || identity.status !== 1,
        };
    });

    menuItems.push({ type: 'divider' });
    menuItems.push({
        key: 'apply',
        label: (
            <span>
                <SwapOutlined style={{ marginRight: 8 }} />
                申请新身份
            </span>
        ),
        onClick: () => {
            message.info('申请新身份功能开发中');
        },
    });

    const currentIdentityKey = currentIdentity ? getIdentityKey(currentIdentity) : 'owner';
    const currentDisplayName = currentIdentity ? getIdentityLabel(currentIdentity) : (admin?.activeRole || '未知身份');

    return (
        <Dropdown menu={{ items: menuItems }} placement="bottomRight" disabled={loading}>
            <Button
                type="text"
                icon={<UserOutlined />}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                }}
            >
                {loading ? (
                    <Spin size="small" />
                ) : (
                    <>
                        <Badge color={identityColors[currentIdentityKey] || '#1890ff'} />
                        <span>{currentDisplayName}</span>
                    </>
                )}
            </Button>
        </Dropdown>
    );
};

export default IdentitySwitcher;
