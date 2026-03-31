import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Form, Input, Modal, Select, Space, Table, Tag, message } from 'antd';
import { CheckCircleOutlined, DownloadOutlined, ReloadOutlined, WarningOutlined } from '@ant-design/icons';

import {
  adminRiskApi,
  isAdminConflictError,
  type AdminRiskWarningItem,
  type AdminRiskWarningQuery,
} from '../../services/api';
import { usePermission } from '../../hooks/usePermission';
import { useAuthStore } from '../../stores/authStore';
import {
  isSecurityAuditorRole,
  RISK_LEVEL_META,
  RISK_LEVEL_OPTIONS,
  RISK_WARNING_FILTER_OPTIONS,
  RISK_WARNING_STATUS_META,
  RISK_WARNING_STATUS_OPTIONS,
} from '../../constants/statuses';
import { formatServerDateTime } from '../../utils/serverTime';

const downloadJson = (filename: string, payload: unknown) => {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const RiskWarningList: React.FC = () => {
  const admin = useAuthStore((state) => state.admin);
  const { hasPermission } = usePermission();
  const [loading, setLoading] = useState(false);
  const [warnings, setWarnings] = useState<AdminRiskWarningItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [levelFilter, setLevelFilter] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<number | undefined>();
  const [handleVisible, setHandleVisible] = useState(false);
  const [currentWarning, setCurrentWarning] = useState<AdminRiskWarningItem | null>(null);
  const [form] = Form.useForm();
  const isSecurityAuditor = isSecurityAuditorRole(admin?.roles);
  const canHandle = !isSecurityAuditor && hasPermission('risk:warning:handle');

  const query = useMemo<AdminRiskWarningQuery>(() => ({
    page,
    pageSize,
    level: levelFilter,
    status: statusFilter,
  }), [levelFilter, page, pageSize, statusFilter]);

  useEffect(() => {
    void loadData();
  }, [query]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await adminRiskApi.warnings(query);
      if (res.code !== 0) {
        message.error(res.message || '加载失败');
        setWarnings([]);
        setTotal(0);
        return;
      }
      setWarnings(res.data?.list || []);
      setTotal(res.data?.total || 0);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const showHandleModal = (record: AdminRiskWarningItem) => {
    if (!canHandle) {
      return;
    }
    setCurrentWarning(record);
    form.setFieldsValue({ status: 2, result: '' });
    setHandleVisible(true);
  };

  const closeHandleModal = () => {
    setHandleVisible(false);
    setCurrentWarning(null);
    form.resetFields();
  };

  const handleWarning = async () => {
    if (!canHandle) {
      return;
    }
    try {
      const values = await form.validateFields();
      if (!currentWarning) {
        return;
      }
      await adminRiskApi.handleWarning(currentWarning.id, values);
      message.success('处理成功');
      closeHandleModal();
      await loadData();
    } catch (error) {
      if (isAdminConflictError(error)) {
        closeHandleModal();
        await loadData();
        message.error('状态已变化，请刷新后重试');
        return;
      }
      message.error(error instanceof Error ? error.message : '操作失败');
    }
  };

  const handleExport = () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    downloadJson(`risk-warnings-${timestamp}.json`, {
      generatedAt: new Date().toISOString(),
      filters: query,
      total,
      list: warnings,
    });
    message.success('风险预警快照已导出');
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 80,
    },
    {
      title: '项目',
      dataIndex: 'projectName',
      ellipsis: true,
    },
    {
      title: '风险类型',
      dataIndex: 'type',
      width: 160,
    },
    {
      title: '风险等级',
      dataIndex: 'level',
      width: 120,
      render: (val: string) => {
        const config = RISK_LEVEL_META[val];
        return config ? <Tag color={config.color}>{config.text}</Tag> : val;
      },
    },
    {
      title: '描述',
      dataIndex: 'description',
      ellipsis: true,
    },
    {
      title: '处理说明',
      dataIndex: 'handleResult',
      ellipsis: true,
      render: (val?: string) => val || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (val: number) => {
        const config = RISK_WARNING_STATUS_META[val];
        return config ? <Tag color={config.color}>{config.text}</Tag> : '-';
      },
    },
    {
      title: '时间',
      key: 'time',
      width: 220,
      render: (_: unknown, record: AdminRiskWarningItem) => (
        <div>
          <div>{formatServerDateTime(record.createdAt)}</div>
          <div style={{ color: '#8c8c8c', fontSize: 12 }}>
            {record.handledAt ? `处理：${formatServerDateTime(record.handledAt)}` : '未处理'}
          </div>
        </div>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: unknown, record: AdminRiskWarningItem) => (
        <Space>
          {canHandle && (record.status === 0 || record.status === 1) && (
            <Button
              type="link"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => showHandleModal(record)}
            >
              处理
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const pendingCount = warnings.filter((item) => item.status === 0).length;

  return (
    <Card>
      {pendingCount > 0 && (
        <Alert
          message={`当前有 ${pendingCount} 条待处理的风险预警`}
          type="warning"
          icon={<WarningOutlined />}
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {isSecurityAuditor ? (
        <Alert
          message="当前账号为安全审计员视角"
          description="本页仅保留风险预警查看与快照导出能力，处理入口已隐藏。"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
      ) : null}

      <Space style={{ marginBottom: 16 }}>
        <Select
          placeholder="风险等级"
          value={levelFilter}
          onChange={setLevelFilter}
          allowClear
          style={{ width: 150 }}
          options={RISK_LEVEL_OPTIONS}
        />
        <Select
          placeholder="处理状态"
          value={statusFilter}
          onChange={setStatusFilter}
          allowClear
          style={{ width: 150 }}
          options={RISK_WARNING_FILTER_OPTIONS}
        />
        <Button icon={<ReloadOutlined />} onClick={() => void loadData()}>
          刷新
        </Button>
        <Button icon={<DownloadOutlined />} onClick={handleExport}>
          导出快照
        </Button>
      </Space>

      <Table
        loading={loading}
        dataSource={warnings}
        columns={columns}
        rowKey="id"
        pagination={{
          current: page,
          pageSize,
          total,
          onChange: setPage,
          showTotal: (count) => `共 ${count} 条`,
        }}
      />

      <Modal
        title="处理风险预警"
        open={canHandle && handleVisible}
        onOk={() => void handleWarning()}
        onCancel={closeHandleModal}
        width={600}
      >
        {currentWarning && (
          <>
            <Alert
              message={`风险等级: ${RISK_LEVEL_META[currentWarning.level]?.text || currentWarning.level}`}
              description={currentWarning.description}
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <Form form={form} layout="vertical">
              <Form.Item label="处理状态" name="status" rules={[{ required: true }]}>
                <Select options={RISK_WARNING_STATUS_OPTIONS} />
              </Form.Item>
              <Form.Item label="处理说明" name="result" rules={[{ required: true }]}>
                <Input.TextArea rows={4} placeholder="请输入处理结果说明" />
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>
    </Card>
  );
};

export default RiskWarningList;
