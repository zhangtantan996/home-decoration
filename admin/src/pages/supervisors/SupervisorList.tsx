import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  message,
} from 'antd';
import {
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

import AdminReauthModal from '../../components/AdminReauthModal';
import {
  adminSupervisorApi,
  type AdminSupervisorListItem,
  type AdminSupervisorUpdateInput,
} from '../../services/api';
import {
  adminSupervisorAccountApi,
  adminSupervisorWhitelistApi,
  type AdminSupervisorWhitelistItem,
} from '../../services/api_supervisor';
import { regionApi } from '../../services/regionApi';
import { formatServerDateTime } from '../../utils/serverTime';
import styles from './SupervisorPages.module.css';

const ACCOUNT_STATUS_OPTIONS = [
  { label: '全部状态', value: undefined },
  { label: '启用', value: 1 },
  { label: '禁用', value: 0 },
];

const WHITELIST_STATUS_OPTIONS = [
  { label: '全部', value: '' },
  { label: '启用', value: '1' },
  { label: '禁用', value: '0' },
];

type ReauthPayload = { reason?: string; recentReauthProof: string };
type PendingReauthAction =
  | { type: 'invite'; values: { phone: string; expiresAt?: string; note?: string } }
  | { type: 'profileUpdate'; record: AdminSupervisorListItem; values: AdminSupervisorUpdateInput }
  | { type: 'accountStatus'; record: AdminSupervisorListItem; status: number }
  | { type: 'whitelistStatus'; record: AdminSupervisorWhitelistItem; status: number };

const accountEnabled = (record: AdminSupervisorListItem) =>
  record.accountStatus ? record.accountStatus === 'active' : record.status === 1;

const SupervisorList: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'accounts' | 'whitelist'>('accounts');

  const [accountLoading, setAccountLoading] = useState(false);
  const [accounts, setAccounts] = useState<AdminSupervisorListItem[]>([]);
  const [accountTotal, setAccountTotal] = useState(0);
  const [accountPage, setAccountPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<number | undefined>(undefined);
  const [cityCode, setCityCode] = useState('');
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<AdminSupervisorListItem | null>(null);
  const [editForm] = Form.useForm();
  const [cityOptions, setCityOptions] = useState<Array<{ label: string; value: string }>>([]);

  const [wlLoading, setWlLoading] = useState(false);
  const [wlItems, setWlItems] = useState<AdminSupervisorWhitelistItem[]>([]);
  const [wlTotal, setWlTotal] = useState(0);
  const [wlPage, setWlPage] = useState(1);
  const [wlKeyword, setWlKeyword] = useState('');
  const [wlStatus, setWlStatus] = useState('');
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [inviteForm] = Form.useForm();
  const [reauthOpen, setReauthOpen] = useState(false);
  const [pendingReauth, setPendingReauth] = useState<PendingReauthAction | null>(null);

  useEffect(() => {
    const loadCities = async () => {
      try {
        const cities = await regionApi.getServiceCities();
        setCityOptions(cities.map((city) => ({ label: city.name, value: city.code })));
      } catch {
        setCityOptions([]);
      }
    };
    void loadCities();
  }, []);

  const accountFilters = useMemo(
    () => ({
      page: accountPage,
      pageSize: 10,
      keyword: keyword.trim() || undefined,
      status,
      cityCode: cityCode || undefined,
    }),
    [accountPage, cityCode, keyword, status],
  );

  const loadAccounts = useCallback(async () => {
    setAccountLoading(true);
    try {
      const res = await adminSupervisorApi.list(accountFilters);
      if (res.code !== 0) {
        message.error(res.message || '加载监理列表失败');
        return;
      }
      setAccounts(res.data?.list || []);
      setAccountTotal(res.data?.total || 0);
    } catch {
      message.error('加载监理列表失败');
    } finally {
      setAccountLoading(false);
    }
  }, [accountFilters]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  const loadWhitelist = useCallback(async () => {
    setWlLoading(true);
    try {
      const res = await adminSupervisorWhitelistApi.list({
        page: wlPage,
        pageSize: 10,
        keyword: wlKeyword || undefined,
        status: wlStatus || undefined,
      });
      if (res.code !== 0) {
        message.error(res.message || '加载白名单失败');
        return;
      }
      setWlItems(res.data?.list || []);
      setWlTotal(res.data?.total || 0);
    } catch {
      message.error('加载白名单失败');
    } finally {
      setWlLoading(false);
    }
  }, [wlKeyword, wlPage, wlStatus]);

  useEffect(() => {
    void loadWhitelist();
  }, [loadWhitelist]);

  const openInviteModal = () => {
    inviteForm.resetFields();
    inviteForm.setFieldsValue({
      // 默认1天，即当天有效（当天的 23:59:59 失效）
      expiresAt: dayjs(),
    });
    setInviteModalVisible(true);
  };

  const requestInvite = async () => {
    try {
      const values = await inviteForm.validateFields();
      setPendingReauth({
        type: 'invite',
        values: {
          phone: values.phone,
          // 用户只选日期，我们统一按选中日期的 23:59:59.999 结算作为失效时间
          expiresAt: values.expiresAt ? (values.expiresAt as dayjs.Dayjs).endOf('day').toISOString() : undefined,
          note: values.note || undefined,
        },
      });
      setReauthOpen(true);
    } catch (err: unknown) {
      if ((err as { errorFields?: unknown[] })?.errorFields) return;
      message.error('表单校验失败');
    }
  };

  const requestWhitelistToggle = (record: AdminSupervisorWhitelistItem) => {
    setPendingReauth({
      type: 'whitelistStatus',
      record,
      status: record.status === 1 ? 0 : 1,
    });
    setReauthOpen(true);
  };

  const openEditModal = (item: AdminSupervisorListItem) => {
    setEditingItem(item);
    editForm.setFieldsValue({
      realName: item.realName,
      cityCode: item.cityCode,
      serviceArea: item.serviceArea,
      certifications: item.certifications,
    });
    setEditModalVisible(true);
  };

  const requestProfileUpdate = async () => {
    if (!editingItem) return;
    try {
      const values = await editForm.validateFields();
      setPendingReauth({
        type: 'profileUpdate',
        record: editingItem,
        values: {
          realName: values.realName,
          cityCode: values.cityCode,
          serviceArea: values.serviceArea,
          certifications: values.certifications,
        },
      });
      setReauthOpen(true);
    } catch {
      // validation handled by antd
    }
  };

  const requestAccountStatusChange = (record: AdminSupervisorListItem, checked: boolean) => {
    if (!record.supervisorAccountId) {
      message.warning('该监理尚未绑定监理账号，不能直接启停登录');
      return;
    }
    setPendingReauth({ type: 'accountStatus', record, status: checked ? 1 : 0 });
    setReauthOpen(true);
  };

  const handleReauthConfirmed = async (payload: ReauthPayload) => {
    if (!pendingReauth) return;

    if (pendingReauth.type === 'invite') {
      const res = await adminSupervisorWhitelistApi.create({
        ...pendingReauth.values,
        reason: payload.reason,
        recentReauthProof: payload.recentReauthProof,
      });
      if (res.code !== 0) {
        throw new Error(res.message || '新增白名单失败');
      }
      message.success('已发送邀请');
      setInviteModalVisible(false);
      if (activeTab === 'whitelist') await loadWhitelist();
    }

    if (pendingReauth.type === 'accountStatus') {
      const accountId = pendingReauth.record.supervisorAccountId;
      if (!accountId) return;
      const res = await adminSupervisorAccountApi.updateStatus(
        accountId,
        pendingReauth.status,
        payload.reason,
        payload.recentReauthProof,
      );
      if (res.code !== 0) {
        throw new Error(res.message || '状态更新失败');
      }
      message.success(pendingReauth.status === 1 ? '已启用登录' : '已禁用登录');
      await loadAccounts();
    }

    if (pendingReauth.type === 'profileUpdate') {
      const res = await adminSupervisorApi.update(pendingReauth.record.id, {
        ...pendingReauth.values,
        reason: payload.reason,
        recentReauthProof: payload.recentReauthProof,
      });
      if (res.code !== 0) {
        throw new Error(res.message || '更新失败');
      }
      message.success('更新成功');
      setEditModalVisible(false);
      await loadAccounts();
    }

    if (pendingReauth.type === 'whitelistStatus') {
      const res = await adminSupervisorWhitelistApi.updateStatus(
        pendingReauth.record.id,
        pendingReauth.status,
        payload.reason,
        payload.recentReauthProof,
      );
      if (res.code !== 0) {
        throw new Error(res.message || '状态更新失败');
      }
      message.success(pendingReauth.status === 1 ? '已启用白名单' : '已禁用白名单');
      await loadWhitelist();
    }

    setPendingReauth(null);
  };

  const accountColumns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '姓名', dataIndex: 'realName', width: 100 },
    { title: '手机号', dataIndex: 'phone', width: 130 },
    {
      title: '账号状态',
      dataIndex: 'accountStatus',
      width: 100,
      render: (_: string, record: AdminSupervisorListItem) => (
        <Tag color={accountEnabled(record) ? 'green' : record.supervisorAccountId ? 'default' : 'orange'}>
          {record.supervisorAccountId ? (accountEnabled(record) ? '启用' : '禁用') : '未绑定'}
        </Tag>
      ),
    },
    { title: '服务城市', dataIndex: 'cityCode', width: 100, render: (code: string) => cityOptions.find((city) => city.value === code)?.label || code || '-' },
    { title: '资质', dataIndex: 'certifications', ellipsis: true, width: 120, render: (value: string) => value || '-' },
    {
      title: '登录控制',
      dataIndex: 'status',
      width: 120,
      render: (_: number, record: AdminSupervisorListItem) => (
        <Switch
          checked={accountEnabled(record)}
          disabled={!record.supervisorAccountId}
          onChange={(checked) => requestAccountStatusChange(record, checked)}
          checkedChildren="启用"
          unCheckedChildren="禁用"
        />
      ),
    },
    { title: '在线会话', dataIndex: 'activeSessionCount', width: 90, render: (value: number) => value || 0 },
    { title: '已分配', dataIndex: 'assignmentCount', width: 80, render: (value: number) => <Tag icon={<TeamOutlined />}>{value || 0}</Tag> },
    { title: '最近登录', dataIndex: 'lastLoginAt', width: 160, render: (value?: string) => (value ? formatServerDateTime(value) : '-') },
    { title: '创建时间', dataIndex: 'createdAt', width: 160, render: (value: string) => formatServerDateTime(value) },
    {
      title: '操作',
      key: 'action',
      width: 190,
      render: (_: unknown, record: AdminSupervisorListItem) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEditModal(record)}>编辑</Button>
          <Button type="link" size="small" onClick={() => navigate(`/supervisors/assignments?supervisorId=${record.id}`)}>分配</Button>
        </Space>
      ),
    },
  ];

  const wlColumns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '手机号', dataIndex: 'phone', width: 130 },
    { title: '状态', dataIndex: 'status', width: 80, render: (value: number) => (value === 1 ? <Tag color="green">启用</Tag> : <Tag color="default">禁用</Tag>) },
    { title: '有效期', dataIndex: 'expiresAt', width: 150, render: (value?: string) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '永久') },
    { title: '备注', dataIndex: 'note', ellipsis: true },
    { title: '创建时间', dataIndex: 'createdAt', width: 150, render: (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm') },
    {
      title: '操作',
      key: 'wl_action',
      width: 80,
      render: (_: unknown, record: AdminSupervisorWhitelistItem) => (
        <Button size="small" danger={record.status === 1} onClick={() => requestWhitelistToggle(record)}>
          {record.status === 1 ? '禁用' : '启用'}
        </Button>
      ),
    },
  ];

  return (
    <div className={styles.page}>
      <Card
        title="监理管理"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => (activeTab === 'accounts' ? void loadAccounts() : void loadWhitelist())}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openInviteModal}>邀请监理</Button>
          </Space>
        }
      >
        <Tabs activeKey={activeTab} onChange={(key) => setActiveTab(key as 'accounts' | 'whitelist')} items={[
          {
            key: 'accounts',
            label: `已开通账号 (${accountTotal})`,
            children: (
              <>
                <Space className={styles.toolbar} wrap>
                  <Input placeholder="搜索姓名/手机号" value={keyword} onChange={(event) => setKeyword(event.target.value)} onPressEnter={() => { setAccountPage(1); void loadAccounts(); }} className={styles.searchInput} prefix={<SearchOutlined />} />
                  <Select placeholder="状态" allowClear className={styles.statusSelect} value={status} onChange={setStatus} options={ACCOUNT_STATUS_OPTIONS} />
                  <Select placeholder="城市" allowClear className={styles.statusSelect} value={cityCode} onChange={setCityCode} options={cityOptions} />
                  <Button type="primary" icon={<SearchOutlined />} onClick={() => { setAccountPage(1); void loadAccounts(); }}>搜索</Button>
                  <Button onClick={() => { setKeyword(''); setStatus(undefined); setCityCode(''); setAccountPage(1); }}>重置</Button>
                </Space>
                <Table rowKey="id" columns={accountColumns} dataSource={accounts} loading={accountLoading}
                  pagination={{ current: accountPage, pageSize: 10, total: accountTotal, onChange: setAccountPage, showSizeChanger: false, showTotal: (totalCount) => `共 ${totalCount} 条` }}
                  scroll={{ x: 1250 }} />
              </>
            ),
          },
          {
            key: 'whitelist',
            label: `白名单 (${wlTotal})`,
            children: (
              <>
                <Space className={styles.toolbar} wrap>
                  <Input.Search placeholder="搜索手机号" allowClear className={styles.searchInput} onSearch={(value) => { setWlPage(1); setWlKeyword(value); }} />
                  <Select placeholder="状态" allowClear className={styles.compactSelect} value={wlStatus || undefined} onChange={(value) => { setWlPage(1); setWlStatus(value || ''); }} options={WHITELIST_STATUS_OPTIONS} />
                </Space>
                <Table rowKey="id" columns={wlColumns} dataSource={wlItems} loading={wlLoading}
                  pagination={{ current: wlPage, pageSize: 10, total: wlTotal, onChange: setWlPage, showSizeChanger: false, showTotal: (totalCount) => `共 ${totalCount} 条` }}
                  scroll={{ x: 800 }} />
              </>
            ),
          },
        ]} />
      </Card>

      <Modal title="邀请监理" open={inviteModalVisible} onOk={() => void requestInvite()} onCancel={() => setInviteModalVisible(false)} okText="下一步" cancelText="取消">
        <Form form={inviteForm} layout="vertical">
          <Form.Item name="phone" label="手机号" rules={[{ required: true, message: '请输入手机号' }, { pattern: /^1[3-9]\d{9}$/, message: '请输入正确手机号' }]}>
            <Input placeholder="请输入11位手机号" maxLength={11} />
          </Form.Item>
          <Form.Item name="expiresAt" label="有效期（选填）">
            <DatePicker
              className={styles.fullWidth}
              placeholder="永久有效"
              presets={[
                { label: '1天', value: dayjs() },
                { label: '7天', value: dayjs().add(6, 'day') },
                { label: '15天', value: dayjs().add(14, 'day') },
                { label: '30天', value: dayjs().add(29, 'day') },
              ]}
            />
          </Form.Item>
          <Form.Item name="note" label="备注（选填）">
            <Input.TextArea rows={2} placeholder="如：张三-XX装修公司推荐" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="编辑监理" open={editModalVisible} onOk={() => void requestProfileUpdate()} onCancel={() => setEditModalVisible(false)} okText="下一步" cancelText="取消" width={500}>
        <Form form={editForm} layout="vertical">
          <Form.Item name="realName" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
            <Input placeholder="请输入姓名" />
          </Form.Item>
          <Form.Item name="cityCode" label="服务城市">
            <Select placeholder="请选择服务城市" allowClear options={cityOptions.filter((city) => city.value)} />
          </Form.Item>
          <Form.Item name="serviceArea" label="服务范围">
            <Input placeholder="如：朝阳区、海淀区" />
          </Form.Item>
          <Form.Item name="certifications" label="资质">
            <Input.TextArea placeholder="请输入资质信息" rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <AdminReauthModal
        open={reauthOpen}
        title={
          pendingReauth?.type === 'invite'
            ? '新增监理白名单'
            : pendingReauth?.type === 'profileUpdate'
              ? '更新监理资料'
            : pendingReauth?.type === 'accountStatus'
              ? '变更监理登录状态'
              : '变更监理白名单状态'
        }
        description="监理账号发放、启停和白名单变更会影响登录资格，提交前必须再次认证并填写原因。"
        confirmText="确认执行"
        onCancel={() => { setReauthOpen(false); setPendingReauth(null); }}
        onConfirmed={handleReauthConfirmed}
      />
    </div>
  );
};

export default SupervisorList;
