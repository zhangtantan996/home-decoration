import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  message,
} from 'antd';
import {
  DeleteOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';

import AdminReauthModal from '../../components/AdminReauthModal';
import {
  adminSupervisorAssignmentApi,
  type AdminSupervisorAssignment,
  type AdminSupervisorListItem,
} from '../../services/api';
import { formatServerDateTime } from '../../utils/serverTime';
import styles from './SupervisorPages.module.css';

type ReauthPayload = { reason?: string; recentReauthProof: string };
type PendingAction =
  | { type: 'assign'; values: { projectId: number; supervisorId: number } }
  | { type: 'remove'; assignment: AdminSupervisorAssignment };

const SupervisorAssignment: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialSupervisorId = searchParams.get('supervisorId');

  const [loading, setLoading] = useState(false);
  const [assignments, setAssignments] = useState<AdminSupervisorAssignment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [supervisorId, setSupervisorId] = useState<number | undefined>(
    initialSupervisorId ? Number(initialSupervisorId) : undefined,
  );
  const [projectId, setProjectId] = useState<number | undefined>(undefined);
  const [modalVisible, setModalVisible] = useState(false);
  const [reauthOpen, setReauthOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [form] = Form.useForm();
  const [availableSupervisors, setAvailableSupervisors] = useState<AdminSupervisorListItem[]>([]);
  const [loadingSupervisors, setLoadingSupervisors] = useState(false);

  const filters = useMemo(
    () => ({
      page,
      pageSize: 10,
      supervisorId: supervisorId || undefined,
      projectId: projectId || undefined,
    }),
    [page, projectId, supervisorId],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminSupervisorAssignmentApi.list(filters);
      if (res.code !== 0) {
        message.error(res.message || '加载分配列表失败');
        return;
      }
      setAssignments(res.data?.list || []);
      setTotal(res.data?.total || 0);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载分配列表失败');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const loadAvailableSupervisors = async (targetProjectId: number) => {
    setLoadingSupervisors(true);
    try {
      const res = await adminSupervisorAssignmentApi.availableSupervisors({
        projectId: targetProjectId,
      });
      if (res.code !== 0) {
        message.error(res.message || '加载可用监理失败');
        return;
      }
      setAvailableSupervisors(res.data?.list || []);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载可用监理失败');
    } finally {
      setLoadingSupervisors(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
  };

  const handleReset = () => {
    setSupervisorId(undefined);
    setProjectId(undefined);
    setPage(1);
  };

  const openAssignModal = () => {
    form.resetFields();
    setAvailableSupervisors([]);
    setModalVisible(true);
  };

  const handleProjectChange = (value: number) => {
    if (value) {
      void loadAvailableSupervisors(value);
    } else {
      setAvailableSupervisors([]);
    }
  };

  const requestAssign = async () => {
    try {
      const values = await form.validateFields();
      setPendingAction({
        type: 'assign',
        values: {
          projectId: Number(values.projectId),
          supervisorId: Number(values.supervisorId),
        },
      });
      setReauthOpen(true);
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in error) return;
      message.error(error instanceof Error ? error.message : '分配失败');
    }
  };

  const requestRemove = (assignment: AdminSupervisorAssignment) => {
    setPendingAction({ type: 'remove', assignment });
    setReauthOpen(true);
  };

  const handleReauthConfirmed = async (payload: ReauthPayload) => {
    if (!pendingAction) return;
    if (pendingAction.type === 'assign') {
      const res = await adminSupervisorAssignmentApi.assign({
        ...pendingAction.values,
        reason: payload.reason,
        recentReauthProof: payload.recentReauthProof,
      });
      if (res.code !== 0) {
        throw new Error(res.message || '分配失败');
      }
      message.success('分配成功');
      setModalVisible(false);
    } else {
      const res = await adminSupervisorAssignmentApi.remove(pendingAction.assignment.id, {
        reason: payload.reason,
        recentReauthProof: payload.recentReauthProof,
      });
      if (res.code !== 0) {
        throw new Error(res.message || '移除失败');
      }
      message.success('移除成功');
    }
    setPendingAction(null);
    await loadData();
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
    { title: '项目ID', dataIndex: 'projectId', key: 'projectId', width: 100 },
    { title: '项目名称', dataIndex: 'projectName', key: 'projectName', width: 200, render: (text: string) => text || '-' },
    {
      title: '监理姓名',
      dataIndex: 'supervisorName',
      key: 'supervisorName',
      width: 120,
      render: (text: string) => (
        <Space>
          <UserOutlined />
          {text || '-'}
        </Space>
      ),
    },
    { title: '监理手机号', dataIndex: 'supervisorPhone', key: 'supervisorPhone', width: 140, render: (text: string) => text || '-' },
    { title: '分配时间', dataIndex: 'assignedAt', key: 'assignedAt', width: 180, render: (text: string) => formatServerDateTime(text) },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: number) => (
        <Tag color={status === 1 ? 'success' : 'default'}>
          {status === 1 ? '生效中' : '已移除'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: unknown, record: AdminSupervisorAssignment) =>
        record.status === 1 ? (
          <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => requestRemove(record)}>
            移除
          </Button>
        ) : null,
    },
  ];

  return (
    <div className={styles.page}>
      <Card
        title="监理分配管理"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => void loadData()}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openAssignModal}>分配监理</Button>
          </Space>
        }
      >
        <Space className={styles.toolbar} wrap>
          <Input
            placeholder="项目ID"
            value={projectId?.toString() || ''}
            onChange={(event) => {
              const value = event.target.value;
              setProjectId(value ? Number(value) : undefined);
            }}
            onPressEnter={handleSearch}
            className={styles.numberInput}
            prefix={<SearchOutlined />}
          />
          <Input
            placeholder="监理ID"
            value={supervisorId?.toString() || ''}
            onChange={(event) => {
              const value = event.target.value;
              setSupervisorId(value ? Number(value) : undefined);
            }}
            onPressEnter={handleSearch}
            className={styles.numberInput}
            prefix={<TeamOutlined />}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>搜索</Button>
          <Button onClick={handleReset}>重置</Button>
        </Space>

        <Table
          columns={columns}
          dataSource={assignments}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize: 10,
            total,
            onChange: setPage,
            showSizeChanger: false,
            showTotal: (totalCount) => `共 ${totalCount} 条`,
          }}
          scroll={{ x: 1000 }}
        />
      </Card>

      <Modal
        title="分配监理到项目"
        open={modalVisible}
        onOk={() => void requestAssign()}
        onCancel={() => setModalVisible(false)}
        okText="下一步"
        cancelText="取消"
        width={500}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="projectId"
            label="项目ID"
            rules={[{ required: true, message: '请输入项目ID' }]}
            extra="请输入要分配监理的项目数字ID，可从项目列表页获取"
          >
            <Input
              placeholder="请输入项目ID"
              type="number"
              onChange={(event) => {
                const value = Number(event.target.value);
                if (value > 0) {
                  handleProjectChange(value);
                }
              }}
            />
          </Form.Item>
          <Form.Item name="supervisorId" label="选择监理" rules={[{ required: true, message: '请选择监理' }]}>
            <Select
              placeholder="请先输入项目ID"
              loading={loadingSupervisors}
              notFoundContent={loadingSupervisors ? '加载中...' : '暂无可用监理'}
              options={availableSupervisors.map((supervisor) => ({
                value: supervisor.id,
                label: `${supervisor.realName} (${supervisor.phone})`,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      <AdminReauthModal
        open={reauthOpen}
        title={pendingAction?.type === 'assign' ? '分配项目监理' : '移除项目监理'}
        description="监理分配会影响项目执行权限，提交前必须再次认证并填写原因。"
        confirmText="确认执行"
        onCancel={() => { setReauthOpen(false); setPendingAction(null); }}
        onConfirmed={handleReauthConfirmed}
      />
    </div>
  );
};

export default SupervisorAssignment;
