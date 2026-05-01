import React from 'react';
import { Card, Descriptions, Image, Space, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { AdminMaterialShopApplicationDetail } from '../../../services/api';
import { APPLICATION_SCENE_META, ENTITY_TYPE_LABELS, MERCHANT_KIND_LABELS } from '../../../constants/statuses';

interface MaterialShopApplicationDetailProps {
    details: AdminMaterialShopApplicationDetail;
}

const dayLabels: Record<number, string> = {
    1: '周一',
    2: '周二',
    3: '周三',
    4: '周四',
    5: '周五',
    6: '周六',
    7: '周日',
};

const imagePlaceholderStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f5f5f5',
    color: '#8c8c8c',
    borderRadius: 8,
};

const formatText = (value?: string | number | null) => {
    if (value == null) return '-';
    const normalized = String(value).trim();
    return normalized || '-';
};

const renderImageCard = (label: string, src?: string, width = 220, height = 139) => (
    <div>
        <div style={{ marginBottom: 8, fontWeight: 500 }}>{label}</div>
        {src ? (
            <Image
                width={width}
                src={src}
                placeholder={<div style={{ ...imagePlaceholderStyle, width, height }} />}
            />
        ) : (
            <div style={{ ...imagePlaceholderStyle, width, height }}>未上传</div>
        )}
    </div>
);

const productColumns: ColumnsType<AdminMaterialShopApplicationDetail['products'][number]> = [
    {
        title: '名称',
        dataIndex: 'name',
        key: 'name',
        width: 180,
    },
    {
        title: '单位',
        dataIndex: 'unit',
        key: 'unit',
        width: 100,
        render: (value?: string) => formatText(value),
    },
    {
        title: '价格',
        dataIndex: 'price',
        key: 'price',
        width: 120,
        render: (value: number) => `¥${value}`,
    },
    {
        title: '商品描述',
        dataIndex: 'description',
        key: 'description',
        render: (value?: string) => (
            <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                {formatText(value)}
            </div>
        ),
    },
    {
        title: '图片',
        dataIndex: 'images',
        key: 'images',
        width: 260,
        render: (images: string[]) => {
            if (!images?.length) {
                return '-';
            }
            return (
                <Image.PreviewGroup>
                    <Space wrap>
                        {images.map((image, index) => (
                            <Image
                                key={`${image}-${index}`}
                                width={72}
                                height={72}
                                src={image}
                                style={{ objectFit: 'cover' }}
                                placeholder={<div style={{ ...imagePlaceholderStyle, width: 72, height: 72 }} />}
                            />
                        ))}
                    </Space>
                </Image.PreviewGroup>
            );
        },
    },
];

const MaterialShopApplicationDetail: React.FC<MaterialShopApplicationDetailProps> = ({ details }) => {
    const showMerchantKind = Boolean(details.merchantKind);
    const showSourceApplicationId = Boolean(details.sourceApplicationId && details.sourceApplicationId !== details.id);

    return (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Descriptions bordered column={2} size="small">
                <Descriptions.Item label="手机号">{formatText(details.phone)}</Descriptions.Item>
                <Descriptions.Item label="主体类型">
                    {ENTITY_TYPE_LABELS[details.entityType] || formatText(details.entityType)}
                </Descriptions.Item>
                <Descriptions.Item label="门店名称">{formatText(details.shopName)}</Descriptions.Item>
                <Descriptions.Item label="公司名称">{formatText(details.companyName)}</Descriptions.Item>
                <Descriptions.Item label="申请场景">
                    <Tag color={APPLICATION_SCENE_META[details.applicationScene || '']?.color || 'default'}>
                        {APPLICATION_SCENE_META[details.applicationScene || '']?.text || formatText(details.applicationScene)}
                    </Tag>
                </Descriptions.Item>
                {showMerchantKind && (
                    <Descriptions.Item label="商家体系">
                        {MERCHANT_KIND_LABELS[details.merchantKind as string] || formatText(details.merchantKind)}
                    </Descriptions.Item>
                )}
                {showSourceApplicationId && (
                    <Descriptions.Item label="来源申请单">{details.sourceApplicationId}</Descriptions.Item>
                )}
                <Descriptions.Item label="联系人">{formatText(details.contactName)}</Descriptions.Item>
                <Descriptions.Item label="联系电话">{formatText(details.contactPhone)}</Descriptions.Item>
                <Descriptions.Item label="营业时间">{formatText(details.businessHours)}</Descriptions.Item>
                <Descriptions.Item label="地址">{formatText(details.address)}</Descriptions.Item>
                {details.businessHoursRanges && details.businessHoursRanges.length > 0 && (
                    <Descriptions.Item label="营业时间段" span={2}>
                        <Space wrap>
                            {details.businessHoursRanges.map((range, index) => (
                                <Tag key={`${range.day}-${range.start}-${range.end}-${index}`} color="blue">
                                    {(dayLabels[range.day] || `第${range.day}天`) + ` ${range.start}-${range.end}`}
                                </Tag>
                            ))}
                        </Space>
                    </Descriptions.Item>
                )}
                <Descriptions.Item label="门店简介" span={2}>
                    <div style={{ overflowWrap: 'anywhere', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                        {formatText(details.shopDescription)}
                    </div>
                </Descriptions.Item>
                <Descriptions.Item label="营业执照号">{formatText(details.businessLicenseNo)}</Descriptions.Item>
                <Descriptions.Item label="法人/经营者姓名">{formatText(details.legalPersonName)}</Descriptions.Item>
                <Descriptions.Item label="法人/经营者身份证号" span={2}>
                    {formatText(details.legalPersonIdCardNo)}
                </Descriptions.Item>
            </Descriptions>

            <Card title="营业执照" size="small">
                <Space wrap>
                    {renderImageCard('营业执照', details.businessLicense, 320, 213)}
                </Space>
            </Card>

            <Card title="法人证件" size="small">
                <Space size="large" wrap>
                    {renderImageCard('身份证正面', details.legalPersonIdCardFront)}
                    {renderImageCard('身份证反面', details.legalPersonIdCardBack)}
                </Space>
            </Card>

            <Card title={`商品列表 (${details.products.length})`} size="small">
                <Table
                    rowKey="id"
                    columns={productColumns}
                    dataSource={details.products}
                    pagination={false}
                    size="small"
                    scroll={{ x: 1100 }}
                    sticky
                />
            </Card>
        </Space>
    );
};

export default MaterialShopApplicationDetail;
