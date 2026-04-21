import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { Button, Card, Descriptions, Empty, Space, Spin, Tag, Typography, message } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';

import PageHeader from '../../components/PageHeader';
import {
  adminQuoteInquiryApi,
  type AdminQuoteInquiryDetail,
} from '../../services/api';
import {
  ADMIN_QUOTE_INQUIRY_CONVERSION_STATUS_META,
} from '../../constants/statuses';
import { formatServerDateTime } from '../../utils/serverTime';

const QuoteInquiryDetail: React.FC = () => {
  const navigate = useNavigate();
  const params = useParams();
  const inquiryId = Number(params.id || 0);

  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<AdminQuoteInquiryDetail | null>(null);

  const loadData = async () => {
    if (!Number.isFinite(inquiryId) || inquiryId <= 0) {
      message.error('无效报价ID');
      return;
    }

    try {
      setLoading(true);
      const res = await adminQuoteInquiryApi.detail(inquiryId);
      if (res.code !== 0) {
        message.error(res.message || '加载详情失败');
        setDetail(null);
        return;
      }
      setDetail(res.data || null);
    } catch (error) {
      console.error(error);
      message.error('加载详情失败');
      setDetail(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [inquiryId]);

  const statusTag = useMemo(() => {
    if (!detail) {
      return null;
    }
    const meta = ADMIN_QUOTE_INQUIRY_CONVERSION_STATUS_META[detail.conversionStatus];
    return meta ? <Tag color={meta.color}>{meta.text}</Tag> : <Tag>{detail.conversionStatus || '-'}</Tag>;
  }, [detail]);

  return (
    <div className="hz-page-stack">
      <PageHeader
        title={`报价询价详情 #${inquiryId || '-'}`}
        description="查看用户留资信息、报价拆分和转化状态。"
        extra={(
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/quote-inquiries/list')}>
              返回列表
            </Button>
          </Space>
        )}
      />

      <Card className="hz-table-card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <Spin />
          </div>
        ) : !detail ? (
          <Empty description="未找到报价详情" />
        ) : (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Descriptions bordered column={2}>
              <Descriptions.Item label="询价ID">{detail.id}</Descriptions.Item>
              <Descriptions.Item label="转化状态">{statusTag}</Descriptions.Item>
              <Descriptions.Item label="用户ID">{detail.userId || '-'}</Descriptions.Item>
              <Descriptions.Item label="来源">{detail.source || '-'}</Descriptions.Item>
              <Descriptions.Item label="手机号">{detail.phone || detail.phoneMasked || '-'}</Descriptions.Item>
              <Descriptions.Item label="OpenID">{detail.openId || '-'}</Descriptions.Item>
              <Descriptions.Item label="城市">{detail.cityName || detail.cityCode || '-'}</Descriptions.Item>
              <Descriptions.Item label="面积">{detail.area ? `${detail.area}㎡` : '-'}</Descriptions.Item>
              <Descriptions.Item label="户型">{detail.houseLayout || '-'}</Descriptions.Item>
              <Descriptions.Item label="装修类型">{detail.renovationType || '-'}</Descriptions.Item>
              <Descriptions.Item label="风格">{detail.style || '-'}</Descriptions.Item>
              <Descriptions.Item label="预算范围">{detail.budgetRange || '-'}</Descriptions.Item>
              <Descriptions.Item label="地址" span={2}>{detail.address || detail.addressMasked || '-'}</Descriptions.Item>
              <Descriptions.Item label="创建时间">{formatServerDateTime(detail.createdAt)}</Descriptions.Item>
              <Descriptions.Item label="更新时间">{formatServerDateTime(detail.updatedAt)}</Descriptions.Item>
            </Descriptions>

            <Card size="small" title="报价结果">
              <Descriptions bordered size="small" column={2}>
                <Descriptions.Item label="总报价区间">
                  ¥{Number(detail.totalMin || 0).toLocaleString()} - ¥{Number(detail.totalMax || 0).toLocaleString()}
                </Descriptions.Item>
                <Descriptions.Item label="预计工期">
                  {detail.estimatedDurationDays || detail.result?.estimatedDuration || 0} 天
                </Descriptions.Item>
                <Descriptions.Item label="设计费">
                  ¥{Number(detail.result?.designFee?.min || 0).toLocaleString()} - ¥{Number(detail.result?.designFee?.max || 0).toLocaleString()}
                </Descriptions.Item>
                <Descriptions.Item label="施工费">
                  ¥{Number(detail.result?.constructionFee?.min || 0).toLocaleString()} - ¥{Number(detail.result?.constructionFee?.max || 0).toLocaleString()}
                </Descriptions.Item>
                <Descriptions.Item label="主材费" span={2}>
                  ¥{Number(detail.result?.materialFee?.min || 0).toLocaleString()} - ¥{Number(detail.result?.materialFee?.max || 0).toLocaleString()}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Card size="small" title="报价拆分">
              {detail.result?.breakdown?.length ? (
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  {detail.result.breakdown.map((item) => (
                    <Card key={item.category} size="small">
                      <Space direction="vertical" size={4} style={{ width: '100%' }}>
                        <Typography.Text strong>{item.category}</Typography.Text>
                        <Typography.Text type="secondary">{item.description || '-'}</Typography.Text>
                        <Typography.Text>
                          ¥{Number(item.min || 0).toLocaleString()} - ¥{Number(item.max || 0).toLocaleString()}
                        </Typography.Text>
                      </Space>
                    </Card>
                  ))}
                </Space>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无报价拆分" />
              )}
            </Card>

            <Card size="small" title="温馨提示">
              {detail.result?.tips?.length ? (
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  {detail.result.tips.map((item, index) => (
                    <Typography.Text key={`${index}-${item}`}>• {item}</Typography.Text>
                  ))}
                </Space>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无提示" />
              )}
            </Card>
          </Space>
        )}
      </Card>
    </div>
  );
};

export default QuoteInquiryDetail;
