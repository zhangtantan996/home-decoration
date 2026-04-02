import React, { useEffect, useState } from 'react';
import { App, Button, Card, Descriptions, Empty, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';

import AdminReauthModal from '../../components/AdminReauthModal';
import PageHeader from '../../components/PageHeader';
import { adminSecurityApi, type AdminSecurityStatusResponse } from '../../services/api';
import { useAuthStore, type AdminSessionItem } from '../../stores/authStore';
import { formatServerDateTime } from '../../utils/serverTime';
import { getLoginPath } from '../../utils/env';

const { Text } = Typography;

const AdminSecuritySettings: React.FC = () => {
  const { message } = App.useApp();
  const logout = useAuthStore((state) => state.logout);
  const [loading, setLoading] = useState(false);
  const [payload, setPayload] = useState<AdminSecurityStatusResponse | null>(null);
  const [reauthOpen, setReauthOpen] = useState(false);
  const [reauthMode, setReauthMode] = useState<'rebind-2fa' | 'revoke-session' | null>(null);
  const [targetSession, setTargetSession] = useState<AdminSessionItem | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = (await adminSecurityApi.getStatus()) as {
        code?: number;
        message?: string;
        data?: AdminSecurityStatusResponse;
      };
      if (res?.code !== 0 || !res?.data) {
        message.error(res?.message || '加载安全设置失败');
        setPayload(null);
        return;
      }
      setPayload(res.data);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载安全设置失败');
      setPayload(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const openReset2FA = () => {
    setReauthMode('rebind-2fa');
    setTargetSession(null);
    setReauthOpen(true);
  };

  const openRevokeSession = (session: AdminSessionItem) => {
    setReauthMode('revoke-session');
    setTargetSession(session);
    setReauthOpen(true);
  };

  const handleConfirmed = async (payloadData: { reason?: string; recentReauthProof: string }) => {
    if (reauthMode === 'rebind-2fa') {
      const res = (await adminSecurityApi.reset2FA({
        reason: payloadData.reason,
        recentReauthProof: payloadData.recentReauthProof,
      })) as { code?: number; message?: string };
      if (res?.code !== 0) {
        throw new Error(res?.message || '重置 2FA 失败');
      }
      message.success('2FA 已重置，请重新登录完成绑定');
      logout();
      window.location.replace(getLoginPath());
      return;
    }

    if (reauthMode === 'revoke-session' && targetSession) {
      const res = (await adminSecurityApi.revokeSession(targetSession.sessionId, {
        reason: payloadData.reason || '',
        recentReauthProof: payloadData.recentReauthProof,
      })) as { code?: number; message?: string };
      if (res?.code !== 0) {
        throw new Error(res?.message || '撤销会话失败');
      }
      message.success('会话已撤销');
      setReauthOpen(false);
      setTargetSession(null);
      setReauthMode(null);
      await loadData();
    }
  };

  const security = payload?.security;

  const columns: ColumnsType<AdminSessionItem> = [
    {
      title: '设备/IP',
      key: 'clientIp',
      render: (_value, record) => (
        <Space direction="vertical" size={0}>
          <span>{record.clientIp || '-'}</span>
          <Text type="secondary">{record.userAgent || '-'}</Text>
        </Space>
      ),
    },
    {
      title: '登录阶段',
      dataIndex: 'loginStage',
      width: 140,
      render: (value: string) => {
        if (value === 'active') {
          return <Tag color="green">正常会话</Tag>;
        }
        if (value === 'setup_required') {
          return <Tag color="orange">初始化中</Tag>;
        }
        return <Tag color="default">{value || '-'}</Tag>;
      },
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 180,
      render: (value?: string) => formatServerDateTime(value),
    },
    {
      title: '最近活跃',
      dataIndex: 'lastSeenAt',
      width: 180,
      render: (value?: string) => formatServerDateTime(value),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_value, record) =>
        record.current ? (
          <Tag color="blue">当前设备</Tag>
        ) : (
          <Button type="link" size="small" onClick={() => openRevokeSession(record)}>
            踢下线
          </Button>
        ),
    },
  ];

  return (
    <div className="hz-page-stack">
      <PageHeader
        title="安全设置"
        description="查看管理员安全状态、最近登录来源与在线会话，并处理 2FA 重新绑定。"
        extra={(
          <Button onClick={() => void loadData()} loading={loading}>
            刷新
          </Button>
        )}
      />

      <Card className="hz-table-card" loading={loading}>
        {!payload ? (
          <Empty description="暂无安全状态数据" />
        ) : (
          <Descriptions bordered column={2}>
            <Descriptions.Item label="账号">{payload.admin.username}</Descriptions.Item>
            <Descriptions.Item label="角色">{payload.admin.roles?.join(' / ') || '-'}</Descriptions.Item>
            <Descriptions.Item label="当前安全阶段">
              {security?.loginStage === 'active' ? '正常' : security?.loginStage || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="2FA 状态">
              {security?.twoFactorEnabled ? <Tag color="green">已绑定</Tag> : <Tag color="orange">未绑定</Tag>}
            </Descriptions.Item>
            <Descriptions.Item label="是否必须改密">
              {security?.mustResetPassword ? '是' : '否'}
            </Descriptions.Item>
            <Descriptions.Item label="在线会话数">{payload.sessionCount}</Descriptions.Item>
            <Descriptions.Item label="最近登录时间">{formatServerDateTime(payload.admin.lastLoginAt)}</Descriptions.Item>
            <Descriptions.Item label="最近登录 IP">{payload.admin.lastLoginIp || '-'}</Descriptions.Item>
          </Descriptions>
        )}
      </Card>

      <Card
        className="hz-table-card"
        title="二次验证"
        extra={(
          <Button onClick={openReset2FA} disabled={!security?.twoFactorEnabled}>
            重新绑定 TOTP
          </Button>
        )}
      >
        <Space direction="vertical" size={8}>
          <Text>当前仅支持基于 TOTP 的二次验证，重置后将撤销全部在线会话。</Text>
          {!security?.twoFactorEnabled ? (
            <Tag color="orange">当前账号尚未完成绑定</Tag>
          ) : (
            <Tag color="green">当前账号已启用 TOTP</Tag>
          )}
        </Space>
      </Card>

      <Card className="hz-table-card" title="在线会话">
        <Table
          rowKey="sessionId"
          columns={columns}
          dataSource={payload?.sessions || []}
          pagination={false}
          locale={{ emptyText: <Empty description="暂无在线会话" /> }}
          scroll={{ x: 980 }}
        />
      </Card>

      <AdminReauthModal
        open={reauthOpen}
        title={reauthMode === 'rebind-2fa' ? '重新绑定 TOTP' : '撤销管理员会话'}
        description={
          reauthMode === 'rebind-2fa'
            ? '重置 2FA 后，当前管理员所有会话会被立即撤销，需重新登录并重新绑定。'
            : `将撤销设备 ${targetSession?.clientIp || '-'} 的在线会话。`
        }
        confirmText={reauthMode === 'rebind-2fa' ? '确认重置' : '确认踢下线'}
        onCancel={() => {
          setReauthOpen(false);
          setReauthMode(null);
          setTargetSession(null);
        }}
        onConfirmed={handleConfirmed}
      />
    </div>
  );
};

export default AdminSecuritySettings;
