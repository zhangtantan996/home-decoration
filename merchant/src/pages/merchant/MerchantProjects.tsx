import React, { useEffect, useMemo, useState } from 'react';
import { Button, Empty, Input, Select, Space, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ArrowRightOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import MerchantContentPanel from '../../components/MerchantContentPanel';
import MerchantPageHeader from '../../components/MerchantPageHeader';
import MerchantPageShell from '../../components/MerchantPageShell';
import MerchantSectionCard from '../../components/MerchantSectionCard';
import { BUSINESS_STAGE_META } from '../../constants/statuses';
import { merchantProjectApi, type MerchantProjectExecutionDetail } from '../../services/merchantApi';

type ProjectRow = {
  id: number;
  name: string;
  ownerName?: string;
  currentPhase?: string;
  businessStage?: string;
  flowSummary?: string;
  budget?: number;
};

const businessStageLabel = (stage?: string): { text: string; color: string } =>
  BUSINESS_STAGE_META[String(stage || '').toLowerCase()] || { text: stage || '-', color: 'default' };

const formatCurrency = (value?: number) => {
  if (!value || value <= 0) return '-';
  return `¥${value.toLocaleString()}`;
};

const MerchantProjects: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ProjectRow[]>([]);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [stageFilter, setStageFilter] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const load = async (options?: { keyword?: string; businessStage?: string }) => {
    try {
      setLoading(true);
      const nextKeyword = options?.keyword ?? keyword;
      const nextBusinessStage = options?.businessStage ?? stageFilter;
      const result = await merchantProjectApi.list({
        page: 1,
        pageSize: 200,
        keyword: nextKeyword.trim() || undefined,
        businessStage: nextBusinessStage || undefined,
      });
      const normalizedRows: ProjectRow[] = (result.list || [])
        .map((item: MerchantProjectExecutionDetail) => ({
          id: item.id,
          name: item.name,
          ownerName: item.ownerName,
          currentPhase: item.currentPhase,
          businessStage: item.businessStage,
          flowSummary: item.flowSummary,
          budget: item.budget,
        }))
        .sort((left, right) => right.id - left.id);
      setRows(normalizedRows);
      setTotal(Number(result.total || normalizedRows.length));
    } catch (error: any) {
      message.error(error?.message || '加载项目执行列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const stats = useMemo(() => {
    const stageCount = (stage: string) => rows.filter((item) => item.businessStage === stage).length;
    return {
      total: rows.length,
      readyToStart: stageCount('ready_to_start'),
      inConstruction: stageCount('in_construction'),
      pendingAcceptance: stageCount('node_acceptance_in_progress'),
      completed: stageCount('completed') + stageCount('archived'),
    };
  }, [rows]);

  const columns: ColumnsType<ProjectRow> = useMemo(() => [
    { title: '项目ID', dataIndex: 'id', key: 'id', width: 90 },
    {
      title: '项目名称',
      dataIndex: 'name',
      key: 'name',
      render: (value: string, record) => (
        <Space direction="vertical" size={2}>
          <span>{value || `项目 #${record.id}`}</span>
          {record.flowSummary ? <span style={{ fontSize: 12, color: '#64748b' }}>{record.flowSummary}</span> : null}
        </Space>
      ),
    },
    { title: '业主', dataIndex: 'ownerName', key: 'ownerName', width: 140, render: (value?: string) => value || '-' },
    { title: '当前阶段', dataIndex: 'currentPhase', key: 'currentPhase', width: 180, render: (value?: string) => value || '-' },
    {
      title: '闭环阶段',
      dataIndex: 'businessStage',
      key: 'businessStage',
      width: 140,
      render: (value?: string) => {
        const tag = businessStageLabel(value);
        return <Tag color={tag.color}>{tag.text}</Tag>;
      },
    },
    { title: '预算', dataIndex: 'budget', key: 'budget', width: 120, render: (value?: number) => formatCurrency(value) },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_: unknown, record) => (
        <Button type="link" icon={<ArrowRightOutlined />} onClick={() => navigate(`/projects/${record.id}`)}>
          进入执行
        </Button>
      ),
    },
  ], [navigate]);

  return (
    <MerchantPageShell>
      <MerchantPageHeader
        title="项目履约"
        description="这里只展示已经完成确认并真正转成项目的履约任务；成交确认前的商机不会提前进入这里。"
        extra={(
          <Button icon={<ReloadOutlined />} onClick={() => void load()} loading={loading}>
            刷新
          </Button>
        )}
      />

      <MerchantContentPanel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 14, marginBottom: 12 }}>
          {[
            { label: '项目总数', value: stats.total, tone: '#2563eb' },
            { label: '待监理协调开工', value: stats.readyToStart, tone: '#d97706' },
            { label: '施工中', value: stats.inConstruction, tone: '#2563eb' },
            { label: '待验收', value: stats.pendingAcceptance, tone: '#ea580c' },
            { label: '已完工/归档', value: stats.completed, tone: '#16a34a' },
          ].map((item) => (
            <MerchantSectionCard key={item.label}>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>{item.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: item.tone }}>{item.value}</div>
            </MerchantSectionCard>
          ))}
        </div>

        <MerchantSectionCard>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="搜索项目名称 / 业主 / 项目ID"
              style={{ width: 320 }}
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              onPressEnter={() => {
                setPage(1);
                void load({ keyword });
              }}
            />
            <Select
              allowClear
              placeholder="按闭环阶段筛选"
              style={{ width: 220 }}
              value={stageFilter}
              onChange={(value) => {
                setStageFilter(value);
                setPage(1);
                void load({ businessStage: value });
              }}
              options={[
                { value: 'ready_to_start', label: '待监理协调开工' },
                { value: 'in_construction', label: '施工中' },
                { value: 'node_acceptance_in_progress', label: '节点验收中' },
                { value: 'completed', label: '已完工' },
                { value: 'archived', label: '已归档' },
              ]}
            />
            <Button type="primary" onClick={() => {
              setPage(1);
              void load({ keyword, businessStage: stageFilter });
            }}>
              搜索
            </Button>
            <Button
              onClick={() => {
                setKeyword('');
                setStageFilter(undefined);
                setPage(1);
                void load({ keyword: '', businessStage: undefined });
              }}
            >
              重置
            </Button>
          </div>
        </MerchantSectionCard>

        <MerchantSectionCard>
          <Table
            rowKey="id"
            loading={loading}
            columns={columns}
            dataSource={rows}
            pagination={{
              current: page,
              total,
              pageSize,
              showSizeChanger: false,
              onChange: (nextPage) => {
                setPage(nextPage);
              },
            }}
            locale={{ emptyText: <Empty description="当前还没有进入履约域的项目" /> }}
          />
        </MerchantSectionCard>
      </MerchantContentPanel>
    </MerchantPageShell>
  );
};

export default MerchantProjects;
