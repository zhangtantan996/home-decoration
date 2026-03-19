import React from 'react';
import { Card, Descriptions, Image, Space, Table, Tag, Tooltip } from 'antd';
import type { AdminMaterialShopApplicationDetail } from '../../../services/api';
import type { ColumnsType } from 'antd/es/table';
import { ENTITY_TYPE_LABELS, MATERIAL_PRODUCT_PARAM_LABELS, MERCHANT_KIND_LABELS } from '../../../constants/statuses';

interface MaterialShopApplicationDetailProps {
    details: AdminMaterialShopApplicationDetail;
}

const formatParamLabel = (key: string) => MATERIAL_PRODUCT_PARAM_LABELS[key] || key;

const formatText = (value?: string | number | null) => {
    if (value == null) return '-';
    const normalized = String(value).trim();
    return normalized || '-';
};

const productColumns: ColumnsType<AdminMaterialShopApplicationDetail['products'][number]> = [
    {
        title: '名称',
        dataIndex: 'name',
        key: 'name',
    },
    {
        title: '价格',
        dataIndex: 'price',
        key: 'price',
        width: 120,
        render: (value: number) => `¥${value}`,
    },
    {
        title: '参数',
        dataIndex: 'params',
        key: 'params',
        render: (params: Record<string, unknown>) => {
            const entries = Object.entries(params || {});
            if (!entries.length) {
                return '-';
            }
            return (
                <Space wrap>
                    {entries.map(([key, value]) => {
                        const label = `${formatParamLabel(key)}: ${String(value ?? '-')}`;
                        return (
                            <Tooltip key={key} title={label}>
                                <Tag
                                    style={{
                                        maxWidth: 220,
                                        overflow: 'hidden',
                                        whiteSpace: 'nowrap',
                                        textOverflow: 'ellipsis',
                                        verticalAlign: 'bottom',
                                    }}
                                >
                                    {label}
                                </Tag>
                            </Tooltip>
                        );
                    })}
                </Space>
            );
        },
    },
    {
        title: '图片',
        dataIndex: 'images',
        key: 'images',
        render: (images: string[]) => {
            if (!images?.length) {
                return '-';
            }
            return (
                <Image.PreviewGroup>
                    <Space wrap>
                        {images.map((image) => (
                            <Image
                                key={image}
                                width={72}
                                height={72}
                                src={image}
                                style={{ objectFit: 'cover' }}
                                placeholder={<div style={{ width: 72, height: 72, background: '#f0f0f0' }} />}
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
    const showSourceApplicationId = Boolean(
        details.sourceApplicationId && details.sourceApplicationId !== details.id,
    );

    return (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Descriptions bordered column={2} size="small">
                <Descriptions.Item label="手机号">{formatText(details.phone)}</Descriptions.Item>
                <Descriptions.Item label="主体类型">{ENTITY_TYPE_LABELS[details.entityType] || formatText(details.entityType)}</Descriptions.Item>
                <Descriptions.Item label="门店名称">{formatText(details.shopName)}</Descriptions.Item>
                <Descriptions.Item label="公司名称">{formatText(details.companyName)}</Descriptions.Item>
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
                <Descriptions.Item label="门店简介" span={2}>
                    <div style={{ overflowWrap: 'anywhere', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                        {formatText(details.shopDescription)}
                    </div>
                </Descriptions.Item>
                <Descriptions.Item label="营业执照号">{formatText(details.businessLicenseNo)}</Descriptions.Item>
                <Descriptions.Item label="法人/经营者姓名">{formatText(details.legalPersonName)}</Descriptions.Item>
                <Descriptions.Item label="法人/经营者身份证号" span={2}>{formatText(details.legalPersonIdCardNo)}</Descriptions.Item>
            </Descriptions>

            <Card title="营业执照" size="small">
                <Image
                    width={320}
                    src={details.businessLicense}
                    placeholder={<div style={{ width: 320, height: 213, background: '#f0f0f0' }} />}
                />
            </Card>

            <Card title="法人证件" size="small">
                <Space size="large" wrap>
                    <div>
                        <div style={{ marginBottom: 8, fontWeight: 500 }}>身份证正面</div>
                        <Image
                            width={220}
                            src={details.legalPersonIdCardFront}
                            placeholder={<div style={{ width: 220, height: 139, background: '#f0f0f0' }} />}
                        />
                    </div>
                    <div>
                        <div style={{ marginBottom: 8, fontWeight: 500 }}>身份证反面</div>
                        <Image
                            width={220}
                            src={details.legalPersonIdCardBack}
                            placeholder={<div style={{ width: 220, height: 139, background: '#f0f0f0' }} />}
                        />
                    </div>
                </Space>
            </Card>

            <Card title={`商品列表 (${details.products.length})`} size="small">
                <Table
                    rowKey="id"
                    columns={productColumns}
                    dataSource={details.products}
                    pagination={false}
                    size="small"
                    scroll={{ x: 900 }}
                />
            </Card>
        </Space>
    );
};

export default MaterialShopApplicationDetail;
