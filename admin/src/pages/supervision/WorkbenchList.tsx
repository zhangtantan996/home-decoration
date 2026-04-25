import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Input, Select, Space, Table, Tag, Typography, message } from 'antd';
import { EyeOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

import { adminSupervisionApi, type AdminSupervisionProjectItem } from '../../services/api';
import { formatServerDateTime } from '../../utils/serverTime';

const { Text } = Typography;

const PHASE_STATUS_OPTIONS = [
  { label: '全部状态', value: '' },
  { label: '待开始', value: 'pending' },
  { label: '进行中', value: 'in_progress' },
  { label: '已完成', value: 'completed' },
];

const BUSINESS_STAGE_OPTIONS = [
  { label: '全部项目', value: '' },
  { label: '待进场协调', value: 'ready_to_start' },
];

const phaseStatusMeta: Record<string, { color: string; text: string }> = {
  pending: { color: 'default', text: '待开始' },
  in_progress: { color: 'processing', text: '进行中' },
  completed: { color: 'success', text: '已完成' },
};

const WorkbenchList: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<AdminSupervisionProjectItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [phaseStatus, setPhaseStatus] = useState<string>('');
  const [businessStage, setBusinessStage] = useState<string>('');
  const [hasPendingRisk, setHasPendingRisk] = useState<string>('');

  const filters = useMemo(() => ({
    page,
    pageSize: 10,
    keyword: keyword.trim() || undefined,
    phaseStatus: phaseStatus || undefined,
    businessStage: businessStage || undefined,
    hasPendingRisk: hasPendingRisk === '' ? undefined : hasPendingRisk === 'true',
  }), [businessStage, hasPendingRisk, keyword, page, phaseStatus]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await adminSupervisionApi.listProjects(filters);
      if (res.code !== 0) {
        message.error(res.message || '加载监理项目失败');
        return;
      }
      setItems(res.data?.list || []);
      setTotal(res.data?.total || 0);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载监理项目失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [filters]);

  return (
    <div className="hz-page-stack">
      <Card className="hz-panel-card" bordered={false}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
          <div>
            <div className="hz-page-title__heading">监理工作台</div>
            <Text type="secondary">待进场协调、项目巡检、施工日志与风险上报</Text>
          </div>
          <Space wrap>
            <Input
              allowClear
              value={keyword}
              placeholder="项目 / 业主 / 服务商"
              prefix={<SearchOutlined />}
              style={{ width: 240 }}
              onChange={(event) => {
                setPage(1);
                setKeyword(event.target.value);
              }}
            />
            <Select
              value={phaseStatus}
              options={PHASE_STATUS_OPTIONS}
              style={{ width: 140 }}
              onChange={(value) => {
                setPage(1);
                setPhaseStatus(value);
              }}
            />
            <Select
              value={businessStage}
              options={BUSINESS_STAGE_OPTIONS}
              style={{ width: 140 }}
              onChange={(value) => {
                setPage(1);
                setBusinessStage(value);
              }}
            />
            <Select
              value={hasPendingRisk}
              style={{ width: 140 }}
              options={[
                { label: '全部风险', value: '' },
                { label: '有未处理风险', value: 'true' },
                { label: '无未处理风险', value: 'false' },
              ]}
              onChange={(value) => {
                setPage(1);
                setHasPendingRisk(value);
              }}
            />
            <Button icon={<ReloadOutlined />} onClick={() => void loadData()}>
              刷新
            </Button>
          </Space>
        </div>

        <Table
          rowKey="id"
          loading={loading}
          dataSource={items}
          pagination={{
            current: page,
            total,
            pageSize: 10,
            onChange: (nextPage) => setPage(nextPage),
          }}
          columns={[
            {
              title: '项目',
              dataIndex: 'name',
              render: (_value, record) => (
                <Space direction="vertical" size={0}>
                  <span style={{ fontWeight: 600 }}>{record.name}</span>
                  <Text type="secondary">{record.address || '地址待同步'}</Text>
                </Space>
              ),
            },
            {
              title: '业主',
              dataIndex: 'ownerName',
              render: (value) => value || '-',
            },
            {
              title: '服务商',
              dataIndex: 'providerName',
              render: (value) => value || '-',
            },
            {
              title: '当前阶段',
              key: 'currentPhase',
              render: (_value, record) => {
                const meta = phaseStatusMeta[record.currentPhaseStatus || 'pending'] || phaseStatusMeta.pending;
                return (
                  <Space direction="vertical" size={2}>
                    <span>{record.currentPhase || '阶段待同步'}</span>
                    <Tag color={meta.color}>{meta.text}</Tag>
                  </Space>
                );
              },
            },
            {
              title: '待开工协同',
              key: 'kickoff',
              render: (_value, record) => (
                <Space direction="vertical" size={2}>
                  <span>{record.plannedStartDate ? formatServerDateTime(record.plannedStartDate) : '待登记进场时间'}</span>
                  <Tag color={record.kickoffStatus === 'scheduled' ? 'success' : 'default'}>
                    {record.kickoffStatus === 'scheduled' ? '已排期' : '待协调'}
                  </Tag>
                </Space>
              ),
            },
            {
              title: '最近巡检',
              key: 'lastLogAt',
              render: (_value, record) => (
                <Space direction="vertical" size={2}>
                  <span>{record.lastLogAt ? formatServerDateTime(record.lastLogAt) : '暂无'}</span>
                  <Text type="secondary">{record.latestLogTitle || '无日志标题'}</Text>
                </Space>
              ),
            },
            {
              title: '当前责任人',
              dataIndex: 'currentResponsible',
              render: (value?: string) => value || '-',
            },
            {
              title: '未处理风险',
              dataIndex: 'unhandledRiskCount',
              render: (value: number) => (
                <Tag color={value > 0 ? 'error' : 'default'}>
                  {value > 0 ? `${value} 条` : '无'}
                </Tag>
              ),
            },
            {
              title: '操作',
              key: 'action',
              width: 150,
              render: (_value, record) => (
                <Button
                  type="link"
                  icon={<EyeOutlined />}
                  onClick={() => navigate(`/supervision/projects/${record.id}`)}
                >
                  进入工作台
                </Button>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
};

export default WorkbenchList;
