import {
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  PhoneOutlined,
  ReloadOutlined,
  RiseOutlined,
} from '@ant-design/icons';
import { Button, Card, Descriptions, Drawer, Empty, Form, Input, InputNumber, Pagination, Select, Space, Tabs, Tag, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getBooking,
  convertQuoteInquiryToBooking,
  listBookings,
  listQuoteInquiries,
  showApiError,
  updateBookingStatus,
  updateQuoteInquiryFollowUp,
  type BookingItem,
  type LeadFollowStatus,
  type LeadQuality,
  type QuoteInquiryItem,
} from '../services/api';
import { useAuthStore } from '../stores/authStore';

type LeadTab = 'bookings' | 'quotes';

const PAGE_SIZE = 8;
const MAX_NOTE_LENGTH = 500;

const bookingFollowOptions: Array<{ value: LeadFollowStatus; label: string }> = [
  { value: 'pending_contact', label: '待联系' },
  { value: 'contacted', label: '已联系' },
  { value: 'interested', label: '有意向' },
  { value: 'invalid', label: '无效线索' },
  { value: 'converted_project', label: '已转项目' },
  { value: 'closed', label: '已关闭' },
];

const quoteFollowOptions: Array<{ value: LeadFollowStatus; label: string }> = [
  { value: 'pending_booking', label: '待转预约' },
  { value: 'contacted', label: '已联系' },
  { value: 'interested', label: '有意向' },
  { value: 'converted_booking', label: '已转预约' },
  { value: 'invalid', label: '无效线索' },
  { value: 'closed', label: '已关闭' },
];

const qualityOptions: Array<{ value: LeadQuality; label: string }> = [
  { value: 'unknown', label: '未判断' },
  { value: 'low_intent', label: '低意向' },
  { value: 'valid', label: '有效' },
  { value: 'high_intent', label: '高意向' },
  { value: 'invalid', label: '无效' },
];

const followStatusText = (status?: string, tab: LeadTab = 'bookings') => {
  const options = tab === 'quotes' ? quoteFollowOptions : bookingFollowOptions;
  return options.find((item) => item.value === status)?.label || (tab === 'quotes' ? '待转预约' : '待联系');
};

const followStatusClass = (status?: string) => {
  if (status === 'contacted') return 'ops-booking-status--processing';
  if (status === 'interested') return 'ops-booking-status--processing';
  if (status === 'converted_project' || status === 'converted_booking') return 'ops-booking-status--done';
  if (status === 'invalid' || status === 'closed') return 'ops-booking-status--closed';
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

const isOverdue = (value?: string) => {
  if (!value) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.getTime() < Date.now();
};

const bookingNo = (id: number) => `A${String(id).padStart(9, '0')}`;
const quoteNo = (id: number) => `Q${String(id).padStart(9, '0')}`;

const BookingsPage = () => {
  const navigate = useNavigate();
  const canCreateProject = useAuthStore((state) => state.hasPermission('project:edit'));
  const [activeTab, setActiveTab] = useState<LeadTab>('bookings');
  const [loading, setLoading] = useState(false);
  const [bookingItems, setBookingItems] = useState<BookingItem[]>([]);
  const [quoteItems, setQuoteItems] = useState<QuoteInquiryItem[]>([]);
  const [keyword, setKeyword] = useState('');
  const [followStatusFilter, setFollowStatusFilter] = useState<LeadFollowStatus | undefined>();
  const [page, setPage] = useState(1);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<BookingItem | null>(null);
  const [quoteDetailOpen, setQuoteDetailOpen] = useState(false);
  const [quoteDetail, setQuoteDetail] = useState<QuoteInquiryItem | null>(null);
  const [form] = Form.useForm();
  const [quoteForm] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const [bookings, quotes] = await Promise.all([
        listBookings({ page: 1, pageSize: 200, keyword: keyword.trim() || undefined, followStatus: activeTab === 'bookings' ? followStatusFilter : undefined }),
        listQuoteInquiries({ page: 1, pageSize: 200, keyword: keyword.trim() || undefined, followStatus: activeTab === 'quotes' ? followStatusFilter : undefined }),
      ]);
      setBookingItems(bookings.list);
      setQuoteItems(quotes.list);
    } catch (error) {
      showApiError(error, '线索加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [activeTab, followStatusFilter]);

  const updateBookingFollow = async (id: number, payload: Parameters<typeof updateBookingStatus>[1]) => {
    try {
      await updateBookingStatus(id, payload);
      await load();
      if (detail?.id === id) {
        const nextDetail = await getBooking(id);
        setDetail(nextDetail);
        form.setFieldsValue({
          followStatus: nextDetail.followStatus || 'pending_contact',
          leadQuality: nextDetail.leadQuality || 'unknown',
          assignedAdminId: nextDetail.assignedAdminId || undefined,
          nextFollowAt: nextDetail.nextFollowAt || undefined,
          invalidReason: nextDetail.invalidReason,
          notes: nextDetail.notes,
        });
      }
    } catch (error) {
      showApiError(error, '跟进更新失败');
    }
  };

  const openDetail = async (row: BookingItem) => {
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const data = await getBooking(row.id);
      setDetail(data);
      form.setFieldsValue({
        followStatus: data.followStatus || 'pending_contact',
        leadQuality: data.leadQuality || 'unknown',
        assignedAdminId: data.assignedAdminId || undefined,
        nextFollowAt: data.nextFollowAt || undefined,
        invalidReason: data.invalidReason,
        notes: data.notes,
      });
    } catch (error) {
      showApiError(error, '预约详情加载失败');
      setDetail(row);
    } finally {
      setDetailLoading(false);
    }
  };

  const saveDetail = async () => {
    if (!detail) return;
    const values = await form.validateFields();
    await updateBookingFollow(detail.id, {
      followStatus: values.followStatus,
      leadQuality: values.leadQuality,
      assignedAdminId: values.assignedAdminId ? Number(values.assignedAdminId) : undefined,
      nextFollowAt: values.nextFollowAt,
      invalidReason: values.invalidReason,
      notes: values.notes,
    });
  };

  const openQuoteDetail = (row: QuoteInquiryItem) => {
    setQuoteDetail(row);
    setQuoteDetailOpen(true);
    quoteForm.setFieldsValue({
      followStatus: row.followStatus || 'pending_booking',
      assignedAdminId: row.assignedAdminId || undefined,
      ownerId: row.userId || undefined,
      providerType: 'designer',
      providerId: undefined,
      preferredDate: undefined,
      nextFollowAt: row.nextFollowAt || undefined,
      invalidReason: row.invalidReason,
      notes: undefined,
    });
  };

  const saveQuoteDetail = async () => {
    if (!quoteDetail) return;
    const values = await quoteForm.validateFields(['followStatus', 'assignedAdminId', 'nextFollowAt', 'invalidReason', 'notes']);
    try {
      await updateQuoteInquiryFollowUp(quoteDetail.id, {
        followStatus: values.followStatus,
        assignedAdminId: values.assignedAdminId ? Number(values.assignedAdminId) : undefined,
        nextFollowAt: values.nextFollowAt,
        invalidReason: values.invalidReason,
        notes: values.notes,
      });
      setQuoteDetailOpen(false);
      await load();
    } catch (error) {
      showApiError(error, '报价线索更新失败');
    }
  };

  const convertQuoteToBooking = async () => {
    if (!quoteDetail) return;
    const values = await quoteForm.validateFields([
      'ownerId',
      'providerId',
      'providerType',
      'preferredDate',
      'notes',
    ]);
    if (!values.providerId || !values.providerType || !String(values.preferredDate || '').trim()) {
      showApiError(new Error('请填写预约服务商、服务类型和预约时间'), '报价线索转预约失败');
      return;
    }
    if (!quoteDetail.userId && !values.ownerId) {
      showApiError(new Error('匿名报价线索转预约必须填写业主ID'), '报价线索转预约失败');
      return;
    }
    try {
      await convertQuoteInquiryToBooking(quoteDetail.id, {
        ownerId: values.ownerId ? Number(values.ownerId) : undefined,
        providerId: Number(values.providerId),
        providerType: values.providerType,
        preferredDate: String(values.preferredDate || '').trim(),
        notes: values.notes,
        reason: 'Ops 报价线索转预约',
      });
      setQuoteDetailOpen(false);
      await load();
    } catch (error) {
      showApiError(error, '报价线索转预约失败');
    }
  };

  const currentItems = activeTab === 'bookings' ? bookingItems : quoteItems;
  const filteredItems = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return currentItems;
    return currentItems.filter((item) => JSON.stringify(item).toLowerCase().includes(q));
  }, [currentItems, keyword]);

  useEffect(() => { setPage(1); }, [keyword, followStatusFilter, activeTab]);

  const pagedItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredItems.slice(start, start + PAGE_SIZE);
  }, [filteredItems, page]);

  const allLeads = [...bookingItems, ...quoteItems];
  const pendingCount = allLeads.filter((item) => ['pending_contact', 'pending_booking', undefined, ''].includes(String(item.followStatus || ''))).length;
  const interestedCount = allLeads.filter((item) => item.followStatus === 'interested').length;
  const convertedCount = allLeads.filter((item) => item.followStatus === 'converted_project' || item.followStatus === 'converted_booking').length;
  const overdueCount = allLeads.filter((item) => isOverdue(item.nextFollowAt)).length;

  const stats = [
    { label: '今日新增', value: allLeads.filter((item) => isToday(item.createdAt)).length, icon: <CalendarOutlined />, tone: 'purple' },
    { label: '待处理', value: pendingCount, icon: <ClockCircleOutlined />, tone: 'red' },
    { label: '有意向', value: interestedCount, icon: <RiseOutlined />, tone: 'blue' },
    { label: '已转化', value: convertedCount, icon: <CheckCircleOutlined />, tone: 'green' },
    { label: '超时未跟进', value: overdueCount, icon: <PhoneOutlined />, tone: 'amber' },
  ];

  const renderBookingCard = (row: BookingItem) => (
    <article key={row.id} className="ops-booking-card">
      <div className="ops-booking-card__head">
        <Space size={10} split={<span className="ops-booking-separator" />}>
          <Typography.Text className="ops-booking-code">ID：{bookingNo(row.id)}</Typography.Text>
          <Typography.Text type="secondary">{formatTime(row.createdAt)}</Typography.Text>
          <span className={`ops-booking-status ${followStatusClass(row.followStatus)}`}>{followStatusText(row.followStatus)}</span>
          {row.leadQuality ? <Tag>{qualityOptions.find((item) => item.value === row.leadQuality)?.label || row.leadQuality}</Tag> : null}
        </Space>
        <Space size={0}>
          <Button type="link" onClick={() => void openDetail(row)}>详情 / 跟进</Button>
          {canCreateProject && row.followStatus !== 'converted_project'
            ? <Button type="link" onClick={() => navigate(`/projects?mode=create&bookingId=${row.id}`)}>转项目</Button>
            : null}
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
          <span>负责人 / 下次跟进</span>
          <strong>{row.assignedAdminName || (row.assignedAdminId ? `#${row.assignedAdminId}` : '未分配')} · {formatTime(row.nextFollowAt)}</strong>
        </div>
        <div>
          <span>最近备注</span>
          <strong>{row.notes || row.invalidReason || row.address || '暂无跟进记录'}</strong>
        </div>
      </div>
      {(!row.followStatus || row.followStatus === 'pending_contact') ? (
        <Button type="primary" className="ops-booking-primary-action" onClick={() => void updateBookingFollow(row.id, { followStatus: 'contacted' })}>
          标记为已联系
        </Button>
      ) : null}
    </article>
  );

  const renderQuoteCard = (row: QuoteInquiryItem) => (
    <article key={row.id} className="ops-booking-card">
      <div className="ops-booking-card__head">
        <Space size={10} split={<span className="ops-booking-separator" />}>
          <Typography.Text className="ops-booking-code">ID：{quoteNo(row.id)}</Typography.Text>
          <Typography.Text type="secondary">{formatTime(row.createdAt)}</Typography.Text>
          <span className={`ops-booking-status ${followStatusClass(row.followStatus)}`}>{followStatusText(row.followStatus, 'quotes')}</span>
        </Space>
        <Button type="link" onClick={() => openQuoteDetail(row)}>详情 / 跟进</Button>
      </div>
      <div className="ops-booking-card__body">
        <div>
          <span>联系方式</span>
          <strong>{row.phoneMasked || (row.hasPhone ? '已留手机号' : '未留手机号')}</strong>
        </div>
        <div>
          <span>房屋信息</span>
          <strong>{row.cityName || row.cityCode || '-'} · {row.area || '-'}㎡ · {row.houseLayout || '-'}</strong>
        </div>
        <div>
          <span>估算区间</span>
          <strong>{row.totalMin && row.totalMax ? `¥${Math.round(row.totalMin).toLocaleString()} - ¥${Math.round(row.totalMax).toLocaleString()}` : '未生成'}</strong>
        </div>
        <div>
          <span>负责人 / 下次跟进</span>
          <strong>{row.assignedAdminId ? `#${row.assignedAdminId}` : '未分配'} · {formatTime(row.nextFollowAt)}</strong>
        </div>
      </div>
    </article>
  );

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
        <Tabs
          activeKey={activeTab}
          onChange={(key) => { setActiveTab(key as LeadTab); setFollowStatusFilter(undefined); }}
          items={[
            { key: 'bookings', label: '预约线索' },
            { key: 'quotes', label: '智能报价线索' },
          ]}
        />
        <div className="ops-toolbar ops-toolbar--filters-row">
          <div className="ops-toolbar__right">
            <Input.Search allowClear placeholder="搜索ID、手机号、地址、备注" value={keyword} onChange={(event) => setKeyword(event.target.value)} onSearch={() => void load()} />
            <Select
              allowClear
              placeholder="全部跟进状态"
              value={followStatusFilter}
              onChange={(value) => setFollowStatusFilter(value)}
              className="ops-filter-select ops-booking-status-filter"
              options={activeTab === 'quotes' ? quoteFollowOptions : bookingFollowOptions}
            />
            <Button icon={<ReloadOutlined />} onClick={() => void load()}>刷新</Button>
          </div>
        </div>

        <div className="ops-booking-list">
          {filteredItems.length ? pagedItems.map((row) => (
            activeTab === 'bookings' ? renderBookingCard(row as BookingItem) : renderQuoteCard(row as QuoteInquiryItem)
          )) : (
            <div className="ops-empty-note"><Empty description="暂无线索" /></div>
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
            {detail && canCreateProject && detail.followStatus !== 'converted_project' ? <Button onClick={() => navigate(`/projects?mode=create&bookingId=${detail.id}`)}>转项目</Button> : null}
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
              <Descriptions.Item label="提交时间">{formatTime(detail.createdAt)}</Descriptions.Item>
            </Descriptions>
            <Form form={form} layout="vertical" className="ops-detail-form">
              <Form.Item name="followStatus" label="跟进状态" rules={[{ required: true, message: '请选择状态' }]}>
                <Select options={bookingFollowOptions} />
              </Form.Item>
              <Form.Item name="leadQuality" label="线索质量">
                <Select options={qualityOptions} />
              </Form.Item>
              <Form.Item name="assignedAdminId" label="负责人ID">
                <InputNumber min={1} precision={0} className="ops-form-full" placeholder="填写管理员ID，留空表示未分配" />
              </Form.Item>
              <Form.Item name="nextFollowAt" label="下次跟进时间">
                <Input placeholder="如：2026-06-08 14:30" />
              </Form.Item>
              <Form.Item noStyle shouldUpdate={(prev, next) => prev.followStatus !== next.followStatus}>
                {({ getFieldValue }) => getFieldValue('followStatus') === 'invalid' ? (
                  <Form.Item name="invalidReason" label="无效原因" rules={[{ required: true, message: '请填写无效原因' }, { max: 300, message: '最多 300 个字' }]}>
                    <Input.TextArea rows={3} maxLength={300} showCount />
                  </Form.Item>
                ) : null}
              </Form.Item>
              <Form.Item name="notes" label="预约备注 / 跟进记录" rules={[{ max: MAX_NOTE_LENGTH, message: `跟进记录最多 ${MAX_NOTE_LENGTH} 个字` }]}>
                <Input.TextArea rows={6} maxLength={MAX_NOTE_LENGTH} showCount placeholder="记录联系结果、线下转交对象、下次跟进时间等" />
              </Form.Item>
            </Form>
          </>
        ) : <Empty description="未选择预约" />}
      </Drawer>

      <Drawer
        title={quoteDetail ? `报价线索 #${quoteDetail.id}` : '报价线索详情'}
        open={quoteDetailOpen}
        onClose={() => setQuoteDetailOpen(false)}
        width={560}
        extra={(
          <Space>
            {quoteDetail?.followStatus !== 'converted_booking' ? <Button onClick={() => void convertQuoteToBooking()}>转预约</Button> : null}
            <Button type="primary" onClick={() => void saveQuoteDetail()}>保存跟进</Button>
          </Space>
        )}
      >
        {quoteDetail ? (
          <>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="联系方式">{quoteDetail.phoneMasked || (quoteDetail.hasPhone ? '已留手机号' : '未留手机号')}</Descriptions.Item>
              <Descriptions.Item label="房屋信息">{quoteDetail.cityName || quoteDetail.cityCode || '-'} · {quoteDetail.area || '-'}㎡ · {quoteDetail.houseLayout || '-'}</Descriptions.Item>
              <Descriptions.Item label="需求">{quoteDetail.renovationType || '-'} · {quoteDetail.style || '-'} · {quoteDetail.budgetRange || '-'}</Descriptions.Item>
              <Descriptions.Item label="估算区间">{quoteDetail.totalMin && quoteDetail.totalMax ? `¥${Math.round(quoteDetail.totalMin).toLocaleString()} - ¥${Math.round(quoteDetail.totalMax).toLocaleString()}` : '-'}</Descriptions.Item>
            </Descriptions>
            <Form form={quoteForm} layout="vertical" className="ops-detail-form">
              <Form.Item name="followStatus" label="跟进状态" rules={[{ required: true, message: '请选择状态' }]}>
                <Select options={quoteFollowOptions} />
              </Form.Item>
              <Form.Item name="assignedAdminId" label="负责人ID">
                <InputNumber min={1} precision={0} className="ops-form-full" placeholder="填写管理员ID，留空表示未分配" />
              </Form.Item>
              <Form.Item name="ownerId" label="业主ID">
                <InputNumber min={1} precision={0} className="ops-form-full" placeholder="匿名报价线索转预约时必填" />
              </Form.Item>
              <Form.Item name="providerType" label="预约服务类型" initialValue="designer">
                <Select options={[
                  { value: 'designer', label: '设计师' },
                  { value: 'company', label: '装修公司' },
                ]} />
              </Form.Item>
              <Form.Item name="providerId" label="预约服务商ID">
                <InputNumber min={1} precision={0} className="ops-form-full" placeholder="填写设计师或装修公司ID" />
              </Form.Item>
              <Form.Item name="preferredDate" label="预约时间">
                <Input placeholder="如：本周六上午 / 2026-06-08 14:30" />
              </Form.Item>
              <Form.Item name="nextFollowAt" label="下次跟进时间">
                <Input placeholder="如：2026-06-08 14:30" />
              </Form.Item>
              <Form.Item noStyle shouldUpdate={(prev, next) => prev.followStatus !== next.followStatus}>
                {({ getFieldValue }) => getFieldValue('followStatus') === 'invalid' ? (
                  <Form.Item name="invalidReason" label="无效原因" rules={[{ required: true, message: '请填写无效原因' }, { max: 300, message: '最多 300 个字' }]}>
                    <Input.TextArea rows={3} maxLength={300} showCount />
                  </Form.Item>
                ) : null}
              </Form.Item>
              <Form.Item name="notes" label="跟进备注" rules={[{ max: MAX_NOTE_LENGTH, message: `跟进记录最多 ${MAX_NOTE_LENGTH} 个字` }]}>
                <Input.TextArea rows={6} maxLength={MAX_NOTE_LENGTH} showCount />
              </Form.Item>
            </Form>
          </>
        ) : <Empty description="未选择报价线索" />}
      </Drawer>
    </div>
  );
};

export default BookingsPage;
