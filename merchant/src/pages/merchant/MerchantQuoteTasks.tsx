import React, { useEffect, useState } from 'react';
import { Button, Card, Empty, Form, Input, InputNumber, message, Modal, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ReloadOutlined } from '@ant-design/icons';
import { merchantQuotePKApi, type QuoteTask } from '../../services/quotePKApi';
import MerchantPageShell from '../../components/MerchantPageShell';
import MerchantPageHeader from '../../components/MerchantPageHeader';
import MerchantSectionCard from '../../components/MerchantSectionCard';
import MerchantContentPanel from '../../components/MerchantContentPanel';

const { Text } = Typography;
const { TextArea } = Input;

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
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<QuoteTask[]>([]);
  const [submitModalVisible, setSubmitModalVisible] = useState(false);
  const [selectedTask, setSelectedTask] = useState<QuoteTask | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

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

  const handleSubmitQuote = (task: QuoteTask) => {
    setSelectedTask(task);
    setSubmitModalVisible(true);
    form.resetFields();
  };

  const handleSubmit = async () => {
    if (!selectedTask) return;

    try {
      const values = await form.validateFields();
      setSubmitting(true);
      await merchantQuotePKApi.submitQuote(selectedTask.id, values);
      message.success('报价提交成功');
      setSubmitModalVisible(false);
      loadTasks();
    } catch (err: any) {
      message.error(err?.message || '提交失败');
    } finally {
      setSubmitting(false);
    }
  };

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
      render: (_, record) => {
        if (record.status === 'in_progress') {
          return (
            <Button type="primary" size="small" onClick={() => handleSubmitQuote(record)}>
              提交报价
            </Button>
          );
        }
        return '-';
      },
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
          <Table
            columns={columns}
            dataSource={tasks}
            rowKey="id"
            loading={loading}
            locale={{
              emptyText: <Empty description="暂无报价任务" />,
            }}
          />
        </MerchantSectionCard>
      </MerchantContentPanel>

      <Modal
        title="提交报价"
        open={submitModalVisible}
        onOk={handleSubmit}
        onCancel={() => setSubmitModalVisible(false)}
        confirmLoading={submitting}
        width={600}
      >
        {selectedTask && (
          <Card size="small" style={{ marginBottom: 16 }}>
            <Space direction="vertical" size={4}>
              <Text>面积：{selectedTask.area}㎡</Text>
              <Text>风格：{selectedTask.style}</Text>
              <Text>区域：{selectedTask.region}</Text>
              <Text>预算：¥{selectedTask.budget.toLocaleString()}</Text>
              {selectedTask.description && <Text>需求：{selectedTask.description}</Text>}
            </Space>
          </Card>
        )}

        <Form form={form} layout="vertical">
          <Form.Item
            name="totalPrice"
            label="总价（元）"
            rules={[
              { required: true, message: '请输入总价' },
              { type: 'number', min: 0, message: '总价必须大于0' },
            ]}
          >
            <InputNumber style={{ width: '100%' }} placeholder="请输入总价" />
          </Form.Item>

          <Form.Item
            name="duration"
            label="工期（天）"
            rules={[
              { required: true, message: '请输入工期' },
              { type: 'number', min: 1, message: '工期必须大于0' },
            ]}
          >
            <InputNumber style={{ width: '100%' }} placeholder="请输入工期" />
          </Form.Item>

          <Form.Item name="materials" label="材料清单">
            <TextArea rows={4} placeholder="请输入材料清单" maxLength={500} />
          </Form.Item>

          <Form.Item name="description" label="报价说明">
            <TextArea rows={4} placeholder="请输入报价说明" maxLength={500} />
          </Form.Item>
        </Form>
      </Modal>
    </MerchantPageShell>
  );
};

export default MerchantQuoteTasks;

