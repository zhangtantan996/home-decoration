import React from 'react';
import { Card, Descriptions, Image, Space, Table, Tag } from 'antd';
import type { AdminMaterialShopApplicationDetail } from '../../../services/api';
import type { ColumnsType } from 'antd/es/table';

interface MaterialShopApplicationDetailProps {
    details: AdminMaterialShopApplicationDetail;
}

const entityTypeMap: Record<string, string> = {
    company: '公司',
    individual_business: '个体工商户',
};

const merchantKindMap: Record<string, string> = {
    material_shop: '主材商',
};


const productParamLabelMap: Record<string, string> = {
    brand: '品牌',
    spec: '规格',
    specification: '规格',
    model: '型号',
    series: '系列',
    material: '材质',
    color: '颜色',
    size: '尺寸',
    weight: '重量',
    unit: '单位',
    origin: '产地',
    sku: 'SKU',
};

const formatParamLabel = (key: string) => productParamLabelMap[key] || key;

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
                    {entries.map(([key, value]) => (
                        <Tag key={key}>{`${formatParamLabel(key)}: ${String(value ?? '-')}`}</Tag>
                    ))}
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
                            <Image key={image} width={72} height={72} src={image} style={{ objectFit: 'cover' }} />
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
                <Descriptions.Item label="主体类型">{entityTypeMap[details.entityType] || formatText(details.entityType)}</Descriptions.Item>
                <Descriptions.Item label="门店名称">{formatText(details.shopName)}</Descriptions.Item>
                <Descriptions.Item label="公司名称">{formatText(details.companyName)}</Descriptions.Item>
                {showMerchantKind && (
                    <Descriptions.Item label="商家体系">
                        {merchantKindMap[details.merchantKind as string] || formatText(details.merchantKind)}
                    </Descriptions.Item>
                )}
                {showSourceApplicationId && (
                    <Descriptions.Item label="来源申请单">{details.sourceApplicationId}</Descriptions.Item>
                )}
                <Descriptions.Item label="联系人">{formatText(details.contactName)}</Descriptions.Item>
                <Descriptions.Item label="联系电话">{formatText(details.contactPhone)}</Descriptions.Item>
                <Descriptions.Item label="营业时间">{formatText(details.businessHours)}</Descriptions.Item>
                <Descriptions.Item label="地址">{formatText(details.address)}</Descriptions.Item>
                <Descriptions.Item label="门店简介" span={2}>{formatText(details.shopDescription)}</Descriptions.Item>
                <Descriptions.Item label="营业执照号">{formatText(details.businessLicenseNo)}</Descriptions.Item>
                <Descriptions.Item label="法人/经营者姓名">{formatText(details.legalPersonName)}</Descriptions.Item>
                <Descriptions.Item label="法人/经营者身份证号" span={2}>{formatText(details.legalPersonIdCardNo)}</Descriptions.Item>
            </Descriptions>

            <Card title="营业执照" size="small">
                <Image width={320} src={details.businessLicense} />
            </Card>

            <Card title="法人证件" size="small">
                <Space size="large" wrap>
                    <div>
                        <div style={{ marginBottom: 8, fontWeight: 500 }}>身份证正面</div>
                        <Image width={220} src={details.legalPersonIdCardFront} />
                    </div>
                    <div>
                        <div style={{ marginBottom: 8, fontWeight: 500 }}>身份证反面</div>
                        <Image width={220} src={details.legalPersonIdCardBack} />
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
