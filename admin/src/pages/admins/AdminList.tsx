import React, { useEffect, useState } from 'react';
import { App, Button, Card, Form, Input, Modal, Select, Space, Switch, Table, Tag, Tooltip } from 'antd';
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';

import AdminReauthModal from '../../components/AdminReauthModal';
import PageHeader from '../../components/PageHeader';
import ToolbarCard from '../../components/ToolbarCard';
import { ADMIN_PASSWORD_MIN_LENGTH } from '../../constants/security';
import { adminManageApi, adminRoleApi } from '../../services/api';
import { useAdaptiveTableScroll } from '../../hooks/useAdaptiveTableScroll';
import { formatServerDateTime } from '../../utils/serverTime';

interface Role {
  id: number;
  name: string;
  key: string;
  remark: string;
}

interface Admin {
  id: number;
  username: string;
  nickname?: string;
  phone: string;
  email: string;
  isSuperAdmin: boolean;
  status: number;
  roles: Role[];
  createdAt: string;
  lastLoginAt?: string;
  lastLoginIp?: string;
  securityStatus?: 'setup_required' | 'active';
  twoFactorEnabled?: boolean;
  twoFactorRequired?: boolean;
  sessionCount?: number;
  disabledReason?: string;
}

type ReauthAction = 'submit' | 'delete' | 'status' | null;

const getSecurityStatusTag = (record: Admin) => {
  if (record.status !== 1) {
    return <Tag color="red">已禁用</Tag>;
  }
  if (record.securityStatus === 'setup_required') {
    return <Tag color="orange">未初始化</Tag>;
  }
  return <Tag color="green">正常</Tag>;
};

const AdminList: React.FC = () => {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [keyword, setKeyword] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<Admin | null>(null);
  const [reauthOpen, setReauthOpen] = useState(false);
  const [reauthAction, setReauthAction] = useState<ReauthAction>(null);
  const [pendingDelete, setPendingDelete] = useState<Admin | null>(null);
  const [pendingStatus, setPendingStatus] = useState<{ record: Admin; status: number } | null>(null);
  const [pendingSubmit, setPendingSubmit] = useState<Record<string, unknown> | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    void loadData();
  }, [page]);

  useEffect(() => {
    void loadRoles();
  }, []);

  const loadRoles = async () => {
    try {
      const res = (await adminRoleApi.list()) as { code?: number; data?: { list?: Role[] } };
      if (res.code === 0 && Array.isArray(res.data?.list)) {
        setRoles(res.data.list);
      }
    } catch (error) {
      console.error('加载角色失败:', error);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const res = (await adminManageApi.list({ page, pageSize, keyword })) as {
        code?: number;
        data?: { list?: Admin[]; total?: number };
      };
      if (res.code === 0) {
        setAdmins(res.data?.list || []);
        setTotal(res.data?.total || 0);
      }
    } catch (error) {
      console.error(error);
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    void loadData();
  };

  const handleAdd = () => {
    setEditingAdmin(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: Admin) => {
    setEditingAdmin(record);
    form.setFieldsValue({
      username: record.username,
      nickname: record.nickname,
      phone: record.phone,
      email: record.email,
      roleIds: record.roles?.map((role) => role.id) || [],
      password: '',
      reason: '',
    });
    setModalVisible(true);
  };

  const requestDelete = (record: Admin) => {
    if (record.isSuperAdmin) {
      message.warning('不能删除超级管理员账号');
      return;
    }
    setPendingDelete(record);
    setReauthAction('delete');
    setReauthOpen(true);
  };

  const requestStatusChange = (record: Admin, status: number) => {
    if (record.isSuperAdmin && status === 0) {
      message.warning('不能禁用超级管理员');
      return;
    }
    setPendingStatus({ record, status });
    setReauthAction('status');
    setReauthOpen(true);
  };

  const requestSubmit = async () => {
    try {
      const values = await form.validateFields();
      setPendingSubmit(values);
      setReauthAction('submit');
      setReauthOpen(true);
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in error) {
        return;
      }
      message.error(error instanceof Error ? error.message : '表单校验失败');
    }
  };

  const handleReauthConfirmed = async (payload: { reason?: string; recentReauthProof: string }) => {
    if (reauthAction === 'submit' && pendingSubmit) {
      const submitPayload = {
        ...pendingSubmit,
        recentReauthProof: payload.recentReauthProof,
      };
      if (editingAdmin) {
        await adminManageApi.update(editingAdmin.id, submitPayload);
        message.success('管理员已更新');
      } else {
        await adminManageApi.create(submitPayload);
        message.success('管理员已创建');
      }
      setModalVisible(false);
      setPendingSubmit(null);
      await loadData();
      return;
    }

    if (reauthAction === 'delete' && pendingDelete) {
      await adminManageApi.delete(pendingDelete.id, {
        reason: payload.reason,
        recentReauthProof: payload.recentReauthProof,
      });
      message.success('管理员已删除');
      setPendingDelete(null);
      await loadData();
      return;
    }

    if (reauthAction === 'status' && pendingStatus) {
      await adminManageApi.updateStatus(pendingStatus.record.id, {
        status: pendingStatus.status,
        reason: payload.reason,
        disabledReason: pendingStatus.status === 0 ? payload.reason : undefined,
        recentReauthProof: payload.recentReauthProof,
      });
      message.success('状态更新成功');
      setPendingStatus(null);
      await loadData();
    }
  };

  const columns = [
    {
      title: 'ID',
      key: 'id',
      dataIndex: 'id',
      width: 112,
      fixed: 'left' as const,
      className: 'hz-table-id-cell',
      render: (value: number) => value,
    },
    {
      title: '用户名',
      key: 'username',
      dataIndex: 'username',
      width: 160,
      fixed: 'left' as const,
      className: 'hz-table-cell-nowrap',
      render: (value: string) => (
        <Tooltip title={value || '-'}>
          <span className="hz-table-ellipsis-text">{value || '-'}</span>
        </Tooltip>
      ),
    },
    {
      title: '昵称',
      key: 'nickname',
      dataIndex: 'nickname',
      width: 140,
      render: (value: string) => (
        <Tooltip title={value || '-'}>
          <span className="hz-table-ellipsis-text">{value || '-'}</span>
        </Tooltip>
      ),
    },
    {
      title: '角色',
      key: 'roles',
      dataIndex: 'roles',
      width: 220,
      render: (items: Role[], record: Admin) => {
        if (record.isSuperAdmin) {
          return <Tag color="red">超级管理员</Tag>;
        }
        if (!items?.length) {
          return <Tag>无角色</Tag>;
        }
        return (
          <Space size={4} className="hz-status-tag-line">
            {items.map((role) => (
              <Tag key={role.id} color="blue">
                {role.name}
              </Tag>
            ))}
          </Space>
        );
      },
    },
    {
      title: '账号状态',
      key: 'securityStatus',
      width: 120,
      render: (_value: unknown, record: Admin) => getSecurityStatusTag(record),
    },
    {
      title: '2FA',
      key: 'twoFactorEnabled',
      width: 120,
      render: (_value: unknown, record: Admin) =>
        record.twoFactorEnabled ? <Tag color="green">已绑定</Tag> : <Tag color="orange">未绑定</Tag>,
    },
    {
      title: '在线会话',
      key: 'sessionCount',
      dataIndex: 'sessionCount',
      width: 100,
      className: 'hz-table-cell-nowrap',
      render: (value?: number) => value || 0,
    },
    {
      title: '最后登录',
      key: 'lastLoginAt',
      dataIndex: 'lastLoginAt',
      width: 170,
      className: 'hz-table-cell-nowrap',
      render: (value?: string) => formatServerDateTime(value),
    },
    {
      title: '最后登录 IP',
      key: 'lastLoginIp',
      dataIndex: 'lastLoginIp',
      width: 150,
      className: 'hz-table-cell-nowrap',
      render: (value?: string) => (
        <Tooltip title={value || '-'}>
          <span className="hz-table-ellipsis-text">{value || '-'}</span>
        </Tooltip>
      ),
    },
    {
      title: '启停',
      key: 'status',
      dataIndex: 'status',
      width: 120,
      className: 'hz-table-cell-nowrap',
      render: (value: number, record: Admin) => (
        <Switch
          checked={value === 1}
          checkedChildren="启用"
          unCheckedChildren="禁用"
          disabled={record.isSuperAdmin}
          onChange={(checked) => requestStatusChange(record, checked ? 1 : 0)}
        />
      ),
    },
    {
      title: '创建时间',
      key: 'createdAt',
      dataIndex: 'createdAt',
      width: 170,
      className: 'hz-table-cell-nowrap',
      render: (value: string) => formatServerDateTime(value),
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      fixed: 'right' as const,
      className: 'hz-table-action-cell',
      render: (_value: unknown, record: Admin) => (
        <Space size={6} className="hz-table-action-group">
          <Button type="link" size="small" onClick={() => handleEdit(record)}>
            编辑
          </Button>
          {!record.isSuperAdmin ? (
            <Button type="link" size="small" danger onClick={() => requestDelete(record)}>
              删除
            </Button>
          ) : null}
        </Space>
      ),
    },
  ];
  const {
    tableContainerRef,
    tableClassName,
    tableColumns,
    tableScroll,
  } = useAdaptiveTableScroll(columns, { growColumnKey: 'roles' });

  return (
    <div className="hz-page-stack">
      <PageHeader
        title="管理员管理"
        description="维护后台管理账号、角色分配、2FA 状态与在线会话情况。"
      />

      <ToolbarCard>
        <div className="hz-toolbar">
          <Input
            placeholder="搜索用户名/手机号/昵称"
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            onPressEnter={handleSearch}
            style={{ width: 250 }}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
            搜索
          </Button>
          <Button icon={<ReloadOutlined />} onClick={() => void loadData()}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            添加管理员
          </Button>
        </div>
      </ToolbarCard>

      <Card className="hz-table-card">
        <div ref={tableContainerRef}>
          <Table
            className={tableClassName}
            loading={loading}
            dataSource={admins}
            columns={tableColumns}
            rowKey="id"
            scroll={tableScroll}
            tableLayout="fixed"
            sticky
            pagination={{
              current: page,
              pageSize,
              total,
              onChange: setPage,
              showTotal: (value) => `共 ${value} 条`,
              showSizeChanger: false,
            }}
          />
        </div>
      </Card>

      <Modal
        title={editingAdmin ? '编辑管理员' : '添加管理员'}
        open={modalVisible}
        onOk={() => void requestSubmit()}
        onCancel={() => setModalVisible(false)}
        width={640}
        okText={editingAdmin ? '提交更新' : '提交创建'}
        cancelText="取消"
      >
        <Form form={form} labelCol={{ span: 6 }} wrapperCol={{ span: 16 }}>
          <Form.Item label="用户名" name="username" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input placeholder="登录账号" />
          </Form.Item>

          <Form.Item label="昵称" name="nickname">
            <Input placeholder="显示名称（可选）" />
          </Form.Item>

          <Form.Item
            label="手机号"
            name="phone"
            rules={[{ pattern: /^1[3-9]\d{9}$/, message: '请输入有效的手机号' }]}
          >
            <Input placeholder="11位手机号（可选）" />
          </Form.Item>

          <Form.Item label="邮箱" name="email" rules={[{ type: 'email', message: '请输入有效的邮箱' }]}>
            <Input placeholder="邮箱地址（可选）" />
          </Form.Item>

          <Form.Item
            label="角色"
            name="roleIds"
            rules={[{ required: true, message: '请至少选择一个角色' }]}
          >
            <Select mode="multiple" placeholder="请选择角色（可多选）" optionFilterProp="label">
              {roles.map((role) => (
                <Select.Option key={role.id} value={role.id} label={role.name}>
                  <div>
                    <div style={{ fontWeight: 500 }}>{role.name}</div>
                    {role.remark ? <div style={{ fontSize: 12, color: '#999' }}>{role.remark}</div> : null}
                  </div>
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          {!editingAdmin ? (
            <Form.Item
              label="临时密码"
              name="password"
              rules={[
                { required: true, message: '请输入临时密码' },
                { min: ADMIN_PASSWORD_MIN_LENGTH, message: `密码至少 ${ADMIN_PASSWORD_MIN_LENGTH} 位` },
              ]}
            >
              <Input.Password placeholder="首次登录后将被强制修改" />
            </Form.Item>
          ) : (
            <Form.Item
              label="重置密码"
              name="password"
              rules={[{ min: ADMIN_PASSWORD_MIN_LENGTH, message: `密码至少 ${ADMIN_PASSWORD_MIN_LENGTH} 位` }]}
              extra="留空则不修改密码；填写后目标账号将被强制重新改密。"
            >
              <Input.Password placeholder={`至少 ${ADMIN_PASSWORD_MIN_LENGTH} 位字符（可选）`} />
            </Form.Item>
          )}

          <Form.Item
            label="操作原因"
            name="reason"
            rules={[
              { required: true, message: '请填写操作原因' },
              { min: 2, message: '原因至少 2 个字符' },
            ]}
          >
            <Input.TextArea rows={3} maxLength={300} showCount placeholder="例如：新增值班管理员、调整角色权限范围" />
          </Form.Item>
        </Form>
      </Modal>

      <AdminReauthModal
        open={reauthOpen}
        title={
          reauthAction === 'delete'
            ? '删除管理员账号'
            : reauthAction === 'status'
              ? '变更管理员状态'
              : editingAdmin
                ? '更新管理员账号'
                : '创建管理员账号'
        }
        description={
          reauthAction === 'delete'
            ? `删除后「${pendingDelete?.username || '-'}」将立即失效并被踢下线。`
            : reauthAction === 'status'
              ? `将对「${pendingStatus?.record.username || '-'}」执行${pendingStatus?.status === 1 ? '启用' : '禁用'}。`
              : '管理员账号、角色和状态变更属于高危操作，提交前必须再次认证。'
        }
        reasonRequired={reauthAction !== 'submit'}
        onCancel={() => {
          setReauthOpen(false);
          setReauthAction(null);
          setPendingDelete(null);
          setPendingStatus(null);
        }}
        onConfirmed={handleReauthConfirmed}
      />
    </div>
  );
};

export default AdminList;
