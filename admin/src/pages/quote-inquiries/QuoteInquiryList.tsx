import React, { useEffect, useState } from 'react';
import { Button, Card, DatePicker, Input, Select, Space, Table, Tag, message } from 'antd';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import type { RangePickerProps } from 'antd/es/date-picker';

import PageHeader from '../../components/PageHeader';
import ToolbarCard from '../../components/ToolbarCard';
import {
  adminQuoteInquiryApi,
  type AdminQuoteInquiryListItem,
} from '../../services/api';
import {
  ADMIN_QUOTE_INQUIRY_CONVERSION_STATUS_META,
  ADMIN_QUOTE_INQUIRY_CONVERSION_STATUS_OPTIONS,
} from '../../constants/statuses';
import { formatServerDateTime } from '../../utils/serverTime';

const { RangePicker } = DatePicker;

const QuoteInquiryList: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [inquiries, setInquiries] = useState<AdminQuoteInquiryListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [conversionStatus, setConversionStatus] = useState<string | undefined>();
  const [city, setCity] = useState<string | undefined>();
  const [hasPhone, setHasPhone] = useState<boolean | undefined>();
  const [dateRange, setDateRange] = useState<[string, string] | undefined>();
  const [keyword, setKeyword] = useState('');

  const loadData = async (nextPage = page) => {
    setLoading(true);
    try {
      const res = await adminQuoteInquiryApi.list({
        page: nextPage,
        pageSize,
        conversionStatus,
        city,
        hasPhone,
        startDate: dateRange?.[0],
        endDate: dateRange?.[1],
        keyword: keyword || undefined,
      });
      if (res.code !== 0) {
        message.error(res.message || '加载失败');
        return;
      }
      setInquiries(res.data?.list || []);
      setTotal(res.data?.total || 0);
    } catch (error) {
      console.error(error);
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData(1);
    setPage(1);
  }, [conversionStatus, city, hasPhone, dateRange]);

  const handleSearch = () => {
    setPage(1);
    void loadData(1);
  };

  const handleDateRangeChange: RangePickerProps['onChange'] = (dates) => {
    if (dates?.[0] && dates?.[1]) {
      setDateRange([
        dates[0].format('YYYY-MM-DD'),
        dates[1].format('YYYY-MM-DD'),
      ]);
      return;
    }
    setDateRange(undefined);
  };

  const columns: ColumnsType<AdminQuoteInquiryListItem> = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 80,
    },
    {
      title: '用户ID',
      dataIndex: 'userId',
      width: 100,
      render: (value) => value || '-',
    },
    {
      title: '联系方式',
      dataIndex: 'phoneMasked',
      width: 140,
      render: (value) => value || '-',
    },
    {
      title: '地址',
      dataIndex: 'addressMasked',
      ellipsis: true,
      render: (_value, record) => {
        const parts = [record.cityName, record.addressMasked].filter(Boolean);
        return parts.length > 0 ? parts.join(' / ') : '-';
      },
    },
    {
      title: '面积',
      dataIndex: 'area',
      width: 100,
      render: (value) => value ? `${value}㎡` : '-',
    },
    {
      title: '户型',
      dataIndex: 'houseLayout',
      width: 110,
      render: (value) => value || '-',
    },
    {
      title: '装修类型',
      dataIndex: 'renovationType',
      width: 110,
      render: (value) => value || '-',
    },
    {
      title: '风格',
      dataIndex: 'style',
      width: 110,
      render: (value) => value || '-',
    },
    {
      title: '预算范围',
      dataIndex: 'budgetRange',
      width: 120,
      render: (value) => value || '-',
    },
    {
      title: '报价区间',
      dataIndex: 'totalMin',
      width: 180,
      render: (_value, record) => {
        if (!record.totalMin && !record.totalMax) {
          return '-';
        }
        return `¥${Number(record.totalMin || 0).toLocaleString()} - ¥${Number(record.totalMax || 0).toLocaleString()}`;
      },
    },
    {
      title: '转化状态',
      dataIndex: 'conversionStatus',
      width: 110,
      render: (value) => {
        const meta = ADMIN_QUOTE_INQUIRY_CONVERSION_STATUS_META[value];
        return meta ? <Tag color={meta.color}>{meta.text}</Tag> : <Tag>{value || '-'}</Tag>;
      },
    },
    {
      title: '来源',
      dataIndex: 'source',
      width: 110,
      render: (value) => value || '-',
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 180,
      render: (value) => formatServerDateTime(value),
    },
    {
      title: '操作',
      key: 'actions',
      width: 90,
      fixed: 'right',
      render: (_value, record) => (
        <Button
          type="link"
          size="small"
          onClick={() => navigate(`/quote-inquiries/${record.id}`)}
        >
          详情
        </Button>
      ),
    },
  ];

  return (
    <div className="hz-page-stack">
      <PageHeader
        title="智能报价询价管理"
        description="查看用户智能报价询价记录、联系方式留资情况与报价结果。"
      />

      <ToolbarCard>
        <div className="hz-toolbar">
          <Space wrap>
            <Select
              placeholder="转化状态"
              allowClear
              style={{ width: 140 }}
              value={conversionStatus}
              onChange={setConversionStatus}
              options={ADMIN_QUOTE_INQUIRY_CONVERSION_STATUS_OPTIONS}
            />
            <Input
              placeholder="城市"
              allowClear
              style={{ width: 140 }}
              value={city}
              onChange={(event) => setCity(event.target.value || undefined)}
            />
            <Select
              placeholder="联系方式"
              allowClear
              style={{ width: 150 }}
              value={hasPhone}
              onChange={setHasPhone}
              options={[
                { value: true, label: '已留手机号' },
                { value: false, label: '未留手机号' },
              ]}
            />
            <RangePicker
              value={dateRange ? [dayjs(dateRange[0]), dayjs(dateRange[1])] : null}
              onChange={handleDateRangeChange}
            />
            <Input
              placeholder="关键词搜索"
              allowClear
              style={{ width: 220 }}
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              onPressEnter={handleSearch}
            />
            <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
              搜索
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => void loadData()}>
              刷新
            </Button>
          </Space>
        </div>
      </ToolbarCard>

      <Card className="hz-table-card">
        <Table
          rowKey="id"
          columns={columns}
          dataSource={inquiries}
          loading={loading}
          scroll={{ x: 1500 }}
          pagination={{
            current: page,
            pageSize,
            total,
            showTotal: (value) => `共 ${value} 条`,
            onChange: (nextPage) => {
              setPage(nextPage);
              void loadData(nextPage);
            },
          }}
        />
      </Card>
    </div>
  );
};

export default QuoteInquiryList;
