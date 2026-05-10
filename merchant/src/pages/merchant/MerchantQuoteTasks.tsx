// Legacy compatibility only: quote-pk 主链已退役。
// 当前页面只用于旧深链兼容，不应再出现在主导航与现行报价作业路径中。
import React, { useEffect, useState } from 'react';
import { Alert, Button, Empty, message, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ReloadOutlined } from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import { merchantQuotePKApi, type QuoteTask } from '../../services/quotePKApi';
import MerchantPageShell from '../../components/MerchantPageShell';
import MerchantPageHeader from '../../components/MerchantPageHeader';
import MerchantSectionCard from '../../components/MerchantSectionCard';
import MerchantContentPanel from '../../components/MerchantContentPanel';

const { Text } = Typography;

const statusLabel = (status: string): { text: string; color: string } => {
  switch (status) {
    case 'pending':
      return { text: '待匹配', color: 'default' };
    case 'in_progress':
      return { text: '进行中', color: 'processing' };
    case 'completed':
      return { text: '已完成', color: 'success' };
    case 'expired':
      return { text: '已过期', color: 'error' };
    default:
      return { text: status, color: 'default' };
  }
};

const MerchantQuoteTasks: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<QuoteTask[]>([]);
  const focusTaskId = Number(searchParams.get('quoteTaskId') || 0);

  const loadTasks = async () => {
    try {
      setLoading(true);
      const data = await merchantQuotePKApi.getQuoteTasks();
      setTasks(data);
    } catch (err: any) {
      message.error(err?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const visibleTasks = focusTaskId > 0
    ? tasks.filter((task) => task.id === focusTaskId)
    : tasks;

  const columns: ColumnsType<QuoteTask> = [
    {
      title: '任务ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '需求信息',
      key: 'info',
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Text>面积：{record.area}㎡</Text>
          <Text>风格：{record.style}</Text>
          <Text>区域：{record.region}</Text>
          <Text>预算：¥{record.budget.toLocaleString()}</Text>
        </Space>
      ),
    },
    {
      title: '需求描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (text) => text || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const { text, color } = statusLabel(status);
        return <Tag color={color}>{text}</Tag>;
      },
    },
    {
      title: '过期时间',
      dataIndex: 'expiredAt',
      key: 'expiredAt',
      width: 180,
      render: (text) => text || '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: () => <Text type="secondary">仅可查看</Text>,
    },
  ];

  return (
    <MerchantPageShell>
      <MerchantPageHeader
        title="报价任务"
        extra={
          <Button icon={<ReloadOutlined />} onClick={loadTasks} loading={loading}>
            刷新
          </Button>
        }
      />
      <MerchantContentPanel>
        <MerchantSectionCard title="报价任务列表">
          {focusTaskId > 0 ? (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message={`当前展示通知关联的报价记录 #${focusTaskId}`}
              description="报价记录仅支持查看；如需继续处理，请前往施工报价相关页面。"
            />
          ) : null}
          <Table
            columns={columns}
            dataSource={visibleTasks}
            rowKey="id"
            loading={loading}
            rowClassName={(record) => (record.id === focusTaskId ? 'merchant-legacy-quote-task-row--focused' : '')}
            locale={{
              emptyText: <Empty description="暂无报价任务" />,
            }}
          />
        </MerchantSectionCard>
      </MerchantContentPanel>

    </MerchantPageShell>
  );
};

export default MerchantQuoteTasks;
