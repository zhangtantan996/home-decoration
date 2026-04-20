import React, { useEffect, useMemo, useState } from 'react';
import { Button, Form, Input, Modal, Space, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ArrowRightOutlined, CheckOutlined, CloseOutlined, EyeOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import MerchantContentPanel from '../../components/MerchantContentPanel';
import MerchantPageHeader from '../../components/MerchantPageHeader';
import MerchantPageShell from '../../components/MerchantPageShell';
import MerchantSectionCard from '../../components/MerchantSectionCard';
import MerchantStatGrid from '../../components/MerchantStatGrid';
import { merchantBookingApi, type MerchantBookingEntry } from '../../services/merchantApi';

const { TextArea } = Input;

type TaskType = 'pending_crew_confirm' | 'in_construction' | 'pending_acceptance';

type CrewTaskRow = {
  key: string;
  id: number;
  taskType: TaskType;
  taskTypeText: string;
  title: string;
  location: string;
  owner: string;
  createdAt: string;
  statusText: string;
  statusColor: string;
  booking: MerchantBookingEntry;
};

const TASK_TYPE_META: Record<TaskType, { label: string; color: string }> = {
  pending_crew_confirm: { label: '待确认工长选择', color: 'gold' },
  in_construction: { label: '施工中', color: 'blue' },
  pending_acceptance: { label: '待验收', color: 'orange' },
};

const MerchantCrewTasks: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [bookings, setBookings] = useState<MerchantBookingEntry[]>([]);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [rejectVisible, setRejectVisible] = useState(false);
  const [currentBooking, setCurrentBooking] = useState<MerchantBookingEntry | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [rejectForm] = Form.useForm();

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await merchantBookingApi.list();
      setBookings(res.list || []);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载工长任务失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const classifyCrewTask = (booking: MerchantBookingEntry): TaskType | null => {
    if (booking.currentStage === 'construction_party_pending') {
      return 'pending_crew_confirm';
    }
    if (booking.currentStage === 'in_construction' || booking.businessStage === 'in_construction') {
      return 'in_construction';
    }
    if (booking.currentStage === 'node_acceptance_in_progress' || booking.businessStage === 'node_acceptance_in_progress') {
      return 'pending_acceptance';
    }
    return null;
  };

  const rows = useMemo<CrewTaskRow[]>(() => {
    return bookings
      .map((booking) => {
        const taskType = classifyCrewTask(booking);
        if (!taskType) return null;

        const meta = TASK_TYPE_META[taskType];
        return {
          key: `booking-${booking.id}`,
          id: booking.id,
          taskType,
          taskTypeText: meta.label,
          title: booking.address || `预约 #${booking.id}`,
          location: `${booking.area || 0}㎡ · ${booking.houseLayout || '户型待补充'}`,
          owner: booking.userNickname || `用户${booking.userId}`,
          createdAt: booking.createdAt || '-',
          statusText: booking.statusText || meta.label,
          statusColor: meta.color,
          booking,
        };
      })
      .filter((item): item is CrewTaskRow => item !== null);
  }, [bookings]);

  const stats = useMemo(() => {
    const countByType = (type: TaskType) => rows.filter((item) => item.taskType === type).length;
    return {
      total: rows.length,
      pendingCrewConfirm: countByType('pending_crew_confirm'),
      inConstruction: countByType('in_construction'),
      pendingAcceptance: countByType('pending_acceptance'),
    };
  }, [rows]);

  const handleConfirmCrew = async (bookingId: number) => {
    try {
      setSubmitting(true);
      await merchantBookingApi.confirmCrew(bookingId, { accept: true });
      message.success('已确认接受施工邀请');
      setConfirmVisible(false);
      setCurrentBooking(null);
      await loadData();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '确认失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectCrew = async () => {
    if (!currentBooking) return;

    try {
      const values = await rejectForm.validateFields();
      setSubmitting(true);
      await merchantBookingApi.confirmCrew(currentBooking.id, {
        accept: false,
        reason: values.reason,
      });
      message.success('已拒绝施工邀请');
      setRejectVisible(false);
      setCurrentBooking(null);
      rejectForm.resetFields();
      await loadData();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '拒绝失败');
    } finally {
      setSubmitting(false);
    }
  };

  const columns: ColumnsType<CrewTaskRow> = [
    {
      title: '任务类型',
      dataIndex: 'taskTypeText',
      width: 160,
      render: (text: string, record) => <Tag color={TASK_TYPE_META[record.taskType].color}>{text}</Tag>,
    },
    {
      title: '项目信息',
      dataIndex: 'title',
      render: (_: string, record) => (
        <Space direction="vertical" size={2}>
          <span>{record.title}</span>
          <span style={{ fontSize: 12, color: '#64748b' }}>{record.location}</span>
        </Space>
      ),
    },
    {
      title: '客户',
      dataIndex: 'owner',
      width: 140,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 180,
    },
    {
      title: '状态',
      dataIndex: 'statusText',
      width: 140,
      render: (text: string, record) => <Tag color={record.statusColor}>{text}</Tag>,
    },
    {
      title: '操作',
      width: 280,
      render: (_: unknown, record) => (
        <Space>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => navigate(`/projects/${record.id}`)}>
            详情
          </Button>
          {record.taskType === 'pending_crew_confirm' && (
            <>
              <Button
                type="primary"
                size="small"
                icon={<CheckOutlined />}
                onClick={() => {
                  setCurrentBooking(record.booking);
                  setConfirmVisible(true);
                }}
              >
                确认
              </Button>
              <Button
                danger
                size="small"
                icon={<CloseOutlined />}
                onClick={() => {
                  setCurrentBooking(record.booking);
                  setRejectVisible(true);
                  rejectForm.resetFields();
                }}
              >
                拒绝
              </Button>
            </>
          )}
          {record.taskType === 'in_construction' && (
            <Button type="primary" size="small" icon={<ArrowRightOutlined />} onClick={() => navigate(`/projects/${record.id}`)}>
              进入执行
            </Button>
          )}
          {record.taskType === 'pending_acceptance' && (
            <Button type="primary" size="small" onClick={() => navigate(`/projects/${record.id}`)}>
              查看验收
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <MerchantPageShell>
        <MerchantPageHeader
          title="工长任务"
          description="这里展示工长相关的待办任务：工长确认、项目执行、阶段验收等。"
          extra={(
            <Button icon={<ReloadOutlined />} onClick={() => void loadData()} loading={loading}>
              刷新
            </Button>
          )}
        />

        <MerchantStatGrid
          items={[
            {
              label: '待办任务总数',
              value: stats.total,
              meta: '工长相关任务',
              percent: 100,
              tone: 'blue',
            },
            {
              label: '待确认工长选择',
              value: stats.pendingCrewConfirm,
              meta: '需要确认是否接受',
              percent: stats.total > 0 ? (stats.pendingCrewConfirm / stats.total) * 100 : 0,
              tone: 'amber',
            },
            {
              label: '施工中',
              value: stats.inConstruction,
              meta: '正在施工的项目',
              percent: stats.total > 0 ? (stats.inConstruction / stats.total) * 100 : 0,
              tone: 'blue',
            },
            {
              label: '待验收',
              value: stats.pendingAcceptance,
              meta: '等待阶段验收',
              percent: stats.total > 0 ? (stats.pendingAcceptance / stats.total) * 100 : 0,
              tone: 'amber',
            },
          ]}
        />

        <MerchantContentPanel>
          <MerchantSectionCard>
            <Table
              loading={loading}
              dataSource={rows}
              columns={columns}
              rowKey="key"
              pagination={{ pageSize: 10 }}
            />
          </MerchantSectionCard>
        </MerchantContentPanel>
      </MerchantPageShell>

      <Modal
        title="确认接受施工邀请"
        open={confirmVisible}
        onCancel={() => {
          setConfirmVisible(false);
          setCurrentBooking(null);
        }}
        onOk={() => currentBooking && void handleConfirmCrew(currentBooking.id)}
        confirmLoading={submitting}
      >
        <p>确定要接受这个施工邀请吗？</p>
        {currentBooking && (
          <div style={{ marginTop: 16, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
            <p><strong>项目地址：</strong>{currentBooking.address}</p>
            <p><strong>客户：</strong>{currentBooking.userNickname || `用户${currentBooking.userId}`}</p>
            <p><strong>面积：</strong>{currentBooking.area}㎡</p>
          </div>
        )}
      </Modal>

      <Modal
        title="拒绝施工邀请"
        open={rejectVisible}
        onCancel={() => {
          setRejectVisible(false);
          setCurrentBooking(null);
          rejectForm.resetFields();
        }}
        onOk={() => void handleRejectCrew()}
        confirmLoading={submitting}
      >
        <Form form={rejectForm} layout="vertical">
          <Form.Item
            label="拒绝原因"
            name="reason"
            rules={[{ required: true, message: '请填写拒绝原因' }]}
          >
            <TextArea rows={4} placeholder="例如：档期已满，无法在要求时间内完成施工。" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default MerchantCrewTasks;
