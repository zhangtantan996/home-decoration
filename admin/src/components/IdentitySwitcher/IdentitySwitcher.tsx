import React, { useEffect } from 'react';
import { Dropdown, Badge, Button, message, Spin } from 'antd';
import { UserOutlined, SwapOutlined, CheckCircleOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { useIdentityStore } from '../../stores/identityStore';
import { useAuthStore } from '../../stores/authStore';

const IdentitySwitcher: React.FC = () => {
    const { identities, currentIdentity, loading, error, fetchIdentities, switchIdentity, clearError } = useIdentityStore();
    const { admin } = useAuthStore();

    useEffect(() => {
        // 组件挂载时获取身份列表
        if (admin) {
            fetchIdentities();
        }
    }, [admin]);

    useEffect(() => {
        // 显示错误消息
        if (error) {
            message.error(error);
            clearError();
        }
    }, [error]);

    const handleSwitchIdentity = async (targetRole: string) => {
        if (loading) return;

        try {
            const currentRole = currentIdentity?.identityType || admin?.activeRole;
            await switchIdentity(targetRole, currentRole);
            message.success('身份切换成功');
            // 刷新页面以更新所有数据
            window.location.reload();
        } catch (err: any) {
            message.error(err.message || '切换身份失败');
        }
    };

    // 身份类型图标映射
    const identityIcons: Record<string, React.ReactNode> = {
        owner: '👤',
        provider: '🏢',
        worker: '👷',
        admin: '👨‍💼',
    };

    // 身份类型颜色映射
    const identityColors: Record<string, string> = {
        owner: '#1890ff',
        provider: '#52c41a',
        worker: '#faad14',
        admin: '#f5222d',
    };

    // 构建下拉菜单项
    const menuItems: MenuProps['items'] = identities.map((identity) => {
        const isCurrent = currentIdentity?.id === identity.id;
        return {
            key: identity.id,
            label: (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>
                        <span style={{ marginRight: 8 }}>{identityIcons[identity.identityType]}</span>
                        {identity.displayName}
                    </span>
                    {isCurrent && <CheckCircleOutlined style={{ color: '#52c41a' }} />}
                </div>
            ),
            onClick: () => {
                if (!isCurrent) {
                    handleSwitchIdentity(identity.identityType);
                }
            },
            disabled: isCurrent || identity.status !== 1, // 当前身份或未激活的身份不可点击
        };
    });

    // 添加"申请新身份"选项
    menuItems.push({
        type: 'divider',
    });
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

    // 当前身份显示
    const currentDisplayName = currentIdentity?.displayName || admin?.activeRole || '未知身份';
    const currentType = currentIdentity?.identityType || 'owner';
    const currentColor = identityColors[currentType];

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
                        <Badge color={currentColor} />
                        <span>{currentDisplayName}</span>
                    </>
                )}
            </Button>
        </Dropdown>
    );
};

export default IdentitySwitcher;
