import { CalendarOutlined, CheckCircleOutlined, ClockCircleOutlined, PhoneOutlined, ReloadOutlined } from '@ant-design/icons';
import { Button, Card, Descriptions, Drawer, Empty, Form, Input, Pagination, Select, Space, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBooking, listBookings, showApiError, updateBookingStatus, type BookingItem } from '../services/api';
import { useAuthStore } from '../stores/authStore';

const statusText = (status?: number) => {
  switch (status) {
    case 2:
      return '已联系';
    case 3:
      return '已完成';
    case 4:
      return '已关闭';
    default:
      return '待联系';
  }
};

const statusClass = (status?: number) => {
  if (status === 2) return 'ops-booking-status--processing';
  if (status === 3) return 'ops-booking-status--done';
  if (status === 4) return 'ops-booking-status--closed';
  return 'ops-booking-status--pending';
};

const providerTypeText = (value?: string) => {
  if (value === 'designer') return '设计师';
  if (value === 'company') return '装修公司';
  if (value === 'foreman' || value === 'worker') return '工长';
  return value || '服务商';
};

const formatTime = (value?: string) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day} ${hour}:${minute}`;
};

const isToday = (value?: string) => {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  return date.toDateString() === today.toDateString();
};

const bookingNo = (id: number) => `A${String(id).padStart(9, '0')}`;
const PAGE_SIZE = 8;
const MAX_NOTE_LENGTH = 500;

const BookingsPage = () => {
  const navigate = useNavigate();
  const canCreateProject = useAuthStore((state) => state.hasPermission('project:edit'));
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<BookingItem[]>([]);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<number | undefined>();
  const [page, setPage] = useState(1);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<BookingItem | null>(null);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      setItems((await listBookings()).list);
    } catch (error) {
      showApiError(error, '预约加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const updateStatus = async (id: number, status: number, notes?: string) => {
    try {
      await updateBookingStatus(id, status, notes);
      await load();
      if (detail?.id === id) {
        const nextDetail = await getBooking(id);
        setDetail(nextDetail);
        form.setFieldsValue({ status: nextDetail.status || 1, notes: nextDetail.notes });
      }
    } catch (error) {
      showApiError(error, '状态更新失败');
    }
  };

  const openDetail = async (row: BookingItem) => {
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const data = await getBooking(row.id);
      setDetail(data);
      form.setFieldsValue({ status: data.status || 1, notes: data.notes });
    } catch (error) {
      showApiError(error, '预约详情加载失败');
      setDetail(row);
      form.setFieldsValue({ status: row.status || 1, notes: row.notes });
    } finally {
      setDetailLoading(false);
    }
  };

  const saveDetail = async () => {
    if (!detail) return;
    const values = await form.validateFields();
    await updateStatus(detail.id, values.status, values.notes);
  };

  const filteredItems = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    const byStatus = statusFilter ? items.filter((item) => (item.status || 1) === statusFilter) : items;
    if (!q) return byStatus;
    return byStatus.filter((item) => [
      item.id,
      bookingNo(item.id),
      item.phone,
      item.address,
      item.notes,
      providerTypeText(item.providerType),
    ].some((value) => String(value || '').toLowerCase().includes(q)));
  }, [items, keyword, statusFilter]);

  useEffect(() => { setPage(1); }, [keyword, statusFilter]);

  const pagedItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredItems.slice(start, start + PAGE_SIZE);
  }, [filteredItems, page]);

  const stats = [
    { label: '今日新增', value: items.filter((item) => isToday(item.createdAt)).length, icon: <CalendarOutlined />, tone: 'purple' },
    { label: '待联系', value: items.filter((item) => !item.status || item.status === 1).length, icon: <ClockCircleOutlined />, tone: 'red' },
    { label: '处理中(已联系)', value: items.filter((item) => item.status === 2).length, icon: <PhoneOutlined />, tone: 'blue' },
    { label: '已完成', value: items.filter((item) => item.status === 3).length, icon: <CheckCircleOutlined />, tone: 'green' },
  ];

  return (
    <div className="ops-page ops-page--list">
      <div className="ops-booking-stats">
        {stats.map((item) => (
          <Card key={item.label} loading={loading} className={`ops-booking-stat ops-booking-stat--${item.tone}`}>
            <div>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
            <i>{item.icon}</i>
          </Card>
        ))}
      </div>

      <Card className="ops-workbench">
        <div className="ops-toolbar ops-toolbar--filters-row">
          <div className="ops-toolbar__right">
            <Input.Search allowClear placeholder="搜索预约ID、手机号、地址" value={keyword} onChange={(event) => setKeyword(event.target.value)} />
            <Select
              allowClear
              placeholder="全部状态"
              value={statusFilter}
              onChange={(value) => setStatusFilter(value)}
              className="ops-filter-select ops-booking-status-filter"
              options={[
                { value: 1, label: '待联系' },
                { value: 2, label: '已联系' },
                { value: 3, label: '已完成' },
                { value: 4, label: '已关闭' },
              ]}
            />
            <Button icon={<ReloadOutlined />} onClick={() => void load()}>刷新</Button>
          </div>
        </div>

        <div className="ops-booking-list">
          {filteredItems.length ? pagedItems.map((row) => (
            <article key={row.id} className="ops-booking-card">
              <div className="ops-booking-card__head">
                <Space size={10} split={<span className="ops-booking-separator" />}>
                  <Typography.Text className="ops-booking-code">ID：{bookingNo(row.id)}</Typography.Text>
                  <Typography.Text type="secondary">{formatTime(row.createdAt)}</Typography.Text>
                  <span className={`ops-booking-status ${statusClass(row.status)}`}>{statusText(row.status)}</span>
                </Space>
                <Space size={0}>
                  <Button type="link" onClick={() => void openDetail(row)}>查看详情 / 写备注</Button>
                  {canCreateProject ? <Button type="link" onClick={() => navigate(`/projects?mode=create&bookingId=${row.id}`)}>转为项目</Button> : null}
                </Space>
              </div>
              <div className="ops-booking-card__body">
                <div>
                  <span>联系人</span>
                  <strong>{row.phone || '未填写'}</strong>
                </div>
                <div>
                  <span>预约对象</span>
                  <strong><em>{providerTypeText(row.providerType)}</em>{row.providerId ? ` #${row.providerId}` : ''}</strong>
                </div>
                <div>
                  <span>跟进记录最末条</span>
                  <strong>{row.notes || row.address || '暂无跟进记录'}</strong>
                </div>
              </div>
              {(!row.status || row.status === 1) ? (
                <Button type="primary" className="ops-booking-primary-action" onClick={() => void updateStatus(row.id, 2)}>
                  标记为已联系
                </Button>
              ) : null}
            </article>
          )) : (
            <div className="ops-empty-note"><Empty description="暂无预约线索" /></div>
          )}
        </div>
        <Pagination
          className="ops-booking-pagination"
          current={page}
          pageSize={PAGE_SIZE}
          total={filteredItems.length}
          showSizeChanger={false}
          onChange={setPage}
        />
      </Card>

      <Drawer
        title={detail ? `预约 #${detail.id}` : '预约详情'}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width={560}
        loading={detailLoading}
        extra={(
          <Space>
            {detail && canCreateProject ? <Button onClick={() => navigate(`/projects?mode=create&bookingId=${detail.id}`)}>转为项目</Button> : null}
            <Button type="primary" onClick={() => void saveDetail()}>保存跟进</Button>
          </Space>
        )}
      >
        {detail ? (
          <>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="预约对象">{providerTypeText(detail.providerType)} #{detail.providerId || '-'}</Descriptions.Item>
              <Descriptions.Item label="用户">{detail.userId || '-'}</Descriptions.Item>
              <Descriptions.Item label="联系电话">{detail.phone || '未填写'}</Descriptions.Item>
              <Descriptions.Item label="地址">{detail.address || '未填写'}</Descriptions.Item>
              <Descriptions.Item label="提交时间">{detail.createdAt || '-'}</Descriptions.Item>
            </Descriptions>
            <Form form={form} layout="vertical" className="ops-detail-form">
              <Form.Item name="status" label="跟进状态" rules={[{ required: true, message: '请选择状态' }]}>
                <Select options={[
                  { value: 1, label: '待联系' },
                  { value: 2, label: '已联系' },
                  { value: 3, label: '已完成' },
                  { value: 4, label: '已关闭' },
                ]} />
              </Form.Item>
              <Form.Item name="notes" label="预约备注 / 跟进记录" rules={[{ max: MAX_NOTE_LENGTH, message: `跟进记录最多 ${MAX_NOTE_LENGTH} 个字` }]}>
                <Input.TextArea rows={6} maxLength={MAX_NOTE_LENGTH} showCount placeholder="记录联系结果、线下转交对象、下次跟进时间等" />
              </Form.Item>
            </Form>
          </>
        ) : <Empty description="未选择预约" />}
      </Drawer>
    </div>
  );
};

export default BookingsPage;
