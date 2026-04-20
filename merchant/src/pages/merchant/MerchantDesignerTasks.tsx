import React, { useEffect, useMemo, useState } from 'react';
import { Button, Space, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ArrowRightOutlined, EyeOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import MerchantContentPanel from '../../components/MerchantContentPanel';
import MerchantPageHeader from '../../components/MerchantPageHeader';
import MerchantPageShell from '../../components/MerchantPageShell';
import MerchantSectionCard from '../../components/MerchantSectionCard';
import MerchantStatGrid from '../../components/MerchantStatGrid';
import { merchantBookingApi, type MerchantBookingEntry } from '../../services/merchantApi';

type TaskType = 'pending_booking' | 'pending_proposal' | 'pending_design_confirm';

type DesignerTaskRow = {
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
  pending_booking: { label: '待响应预约', color: 'gold' },
  pending_proposal: { label: '待提交方案', color: 'blue' },
  pending_design_confirm: { label: '待确认设计', color: 'orange' },
};

const MerchantDesignerTasks: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [bookings, setBookings] = useState<MerchantBookingEntry[]>([]);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await merchantBookingApi.list();
      setBookings(res.list || []);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载设计师任务失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const classifyDesignerTask = (booking: MerchantBookingEntry): TaskType | null => {
    if (booking.statusGroup === 'pending_confirmation') {
      return 'pending_booking';
    }
    const availableActions = booking.availableActions || [];
    if (availableActions.includes('submit_site_survey') || availableActions.includes('submit_budget') || availableActions.includes('create_proposal')) {
      return 'pending_proposal';
    }
    if (booking.currentStage === 'design_confirmation_pending' || availableActions.includes('confirm_design')) {
      return 'pending_design_confirm';
    }
    return null;
  };

  const rows = useMemo<DesignerTaskRow[]>(() => {
    return bookings
      .map((booking) => {
        const taskType = classifyDesignerTask(booking);
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
      .filter((item): item is DesignerTaskRow => item !== null);
  }, [bookings]);

  const stats = useMemo(() => {
    const countByType = (type: TaskType) => rows.filter((item) => item.taskType === type).length;
    return {
      total: rows.length,
      pendingBooking: countByType('pending_booking'),
      pendingProposal: countByType('pending_proposal'),
      pendingDesignConfirm: countByType('pending_design_confirm'),
    };
  }, [rows]);

  const columns: ColumnsType<DesignerTaskRow> = [
    {
      title: '任务类型',
      dataIndex: 'taskTypeText',
      width: 140,
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
      width: 200,
      render: (_: unknown, record) => (
        <Space>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => navigate(`/bookings`)}>
            详情
          </Button>
          {record.taskType === 'pending_booking' && (
            <Button type="primary" size="small" onClick={() => navigate(`/bookings`)}>
              处理预约
            </Button>
          )}
          {record.taskType === 'pending_proposal' && (
            <Button type="primary" size="small" icon={<ArrowRightOutlined />} onClick={() => navigate(`/proposals/flow/${record.id}`)}>
              提交方案
            </Button>
          )}
          {record.taskType === 'pending_design_confirm' && (
            <Button type="primary" size="small" onClick={() => navigate(`/proposals/flow/${record.id}`)}>
              确认设计
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <MerchantPageShell>
      <MerchantPageHeader
        title="设计师任务"
        description="这里展示设计师相关的待办任务：预约响应、方案提交、设计确认等。"
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
            meta: '设计师相关任务',
            percent: 100,
            tone: 'blue',
          },
          {
            label: '待响应预约',
            value: stats.pendingBooking,
            meta: '需要确认是否接单',
            percent: stats.total > 0 ? (stats.pendingBooking / stats.total) * 100 : 0,
            tone: 'amber',
          },
          {
            label: '待提交方案',
            value: stats.pendingProposal,
            meta: '需要提交设计方案',
            percent: stats.total > 0 ? (stats.pendingProposal / stats.total) * 100 : 0,
            tone: 'blue',
          },
          {
            label: '待确认设计',
            value: stats.pendingDesignConfirm,
            meta: '等待客户确认设计',
            percent: stats.total > 0 ? (stats.pendingDesignConfirm / stats.total) * 100 : 0,
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
  );
};

export default MerchantDesignerTasks;
