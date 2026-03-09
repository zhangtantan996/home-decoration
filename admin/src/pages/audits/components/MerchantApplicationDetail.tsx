import React from 'react';
import { Card, Descriptions, Image, Tag, Tabs, Space } from 'antd';
import type { AdminMerchantApplicationDetail, MerchantApplicationDetails } from '../../../services/api';

interface MerchantApplicationDetailProps {
    details: MerchantApplicationDetails & Partial<AdminMerchantApplicationDetail>;
}

const roleMap: Record<string, string> = {
    designer: '设计师',
    company: '装修公司',
    foreman: '工长',
};

const entityTypeMap: Record<string, string> = {
    personal: '个人',
    company: '公司',
    studio: '工作室',
};

const applicantTypeMap: Record<string, string> = {
    personal: '个人入驻',
    studio: '工作室入驻',
    company: '企业入驻',
    foreman: '工长入驻',
};

const merchantKindMap: Record<string, string> = {
    provider: '服务商',
    material_shop: '主材商',
};

const pricingLabelMap: Record<string, string> = {
    flat: '平层报价',
    duplex: '复式报价',
    other: '其他报价',
    perSqm: '施工报价',
    fullPackage: '全包报价',
    halfPackage: '半包报价',
};

const pricingOrder = ['flat', 'duplex', 'other', 'perSqm', 'fullPackage', 'halfPackage'] as const;

const formatText = (value?: string | number | null) => {
    if (value == null) return '-';
    const normalized = String(value).trim();
    return normalized || '-';
};

const renderTags = (values: string[] | undefined, color: string) => {
    if (!values?.length) {
        return '-';
    }

    return values.map((value) => (
        <Tag key={value} color={color}>{value}</Tag>
    ));
};

const renderPricing = (pricing?: Record<string, number>) => {
    if (!pricing || Object.keys(pricing).length === 0) {
        return '-';
    }

    const orderedEntries = pricingOrder
        .filter((key) => pricing[key] != null)
        .map((key) => [key, pricing[key]] as const);
    const extraEntries = Object.entries(pricing).filter(([key]) => !pricingOrder.includes(key as typeof pricingOrder[number]));
    const entries = [...orderedEntries, ...extraEntries];

    return (
        <Space direction="vertical" size={4} style={{ width: '100%' }}>
            {entries.map(([key, value]) => (
                <div key={key}>{`${pricingLabelMap[key] || key}: ¥${value}`}</div>
            ))}
        </Space>
    );
};

const MerchantApplicationDetail: React.FC<MerchantApplicationDetailProps> = ({ details }) => {
    const showMerchantKind = Boolean(details.merchantKind);
    const showSourceApplicationId = Boolean(
        details.sourceApplicationId && details.sourceApplicationId !== details.id,
    );

    const tabItems = [
        {
            key: 'basic',
            label: '基础信息',
            children: (
                <Descriptions bordered column={2} size="small">
                    <Descriptions.Item label="手机号">{formatText(details.phone)}</Descriptions.Item>
                    <Descriptions.Item label="角色类型">
                        <Tag color="blue">{roleMap[details.role] || formatText(details.role)}</Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="主体类型">
                        {entityTypeMap[details.entityType] || formatText(details.entityType)}
                    </Descriptions.Item>
                    <Descriptions.Item label="申请人类型">
                        {applicantTypeMap[details.applicantType] || formatText(details.applicantType)}
                    </Descriptions.Item>
                    {showMerchantKind && (
                        <Descriptions.Item label="商家体系">
                            {merchantKindMap[details.merchantKind as string] || formatText(details.merchantKind)}
                        </Descriptions.Item>
                    )}
                    {showSourceApplicationId && (
                        <Descriptions.Item label="来源申请单">
                            {details.sourceApplicationId}
                        </Descriptions.Item>
                    )}
                </Descriptions>
            ),
        },
        {
            key: 'identity',
            label: '身份信息',
            children: (
                <Space direction="vertical" style={{ width: '100%' }} size="large">
                    <Descriptions bordered column={1} size="small">
                        <Descriptions.Item label={details.entityType === 'company' ? '法人/经营者姓名' : '真实姓名'}>
                            {formatText(details.realName)}
                        </Descriptions.Item>
                        <Descriptions.Item label={details.entityType === 'company' ? '法人/经营者身份证号' : '身份证号'}>
                            {formatText(details.idCardNo)}
                        </Descriptions.Item>
                    </Descriptions>

                    <Card title="身份证照片" size="small">
                        <Space size="large">
                            <div>
                                <div style={{ marginBottom: 8, fontWeight: 500 }}>身份证正面</div>
                                <Image
                                    width={200}
                                    src={details.idCardFront}
                                    placeholder={<div style={{ width: 200, height: 126, background: '#f0f0f0' }} />}
                                />
                            </div>
                            <div>
                                <div style={{ marginBottom: 8, fontWeight: 500 }}>身份证反面</div>
                                <Image
                                    width={200}
                                    src={details.idCardBack}
                                    placeholder={<div style={{ width: 200, height: 126, background: '#f0f0f0' }} />}
                                />
                            </div>
                        </Space>
                    </Card>
                </Space>
            ),
        },
    ];

    if (details.entityType === 'company' && details.companyName) {
        tabItems.push({
            key: 'company',
            label: '公司信息',
            children: (
                <Space direction="vertical" style={{ width: '100%' }} size="large">
                    <Descriptions bordered column={2} size="small">
                        <Descriptions.Item label="公司名称" span={2}>{formatText(details.companyName)}</Descriptions.Item>
                        <Descriptions.Item label="营业执照号">{formatText(details.licenseNo)}</Descriptions.Item>
                        <Descriptions.Item label="团队规模">{details.teamSize ? `${details.teamSize} 人` : '-'}</Descriptions.Item>
                        <Descriptions.Item label="办公地址" span={2}>{formatText(details.officeAddress)}</Descriptions.Item>
                    </Descriptions>

                    {details.licenseImage && (
                        <Card title="营业执照" size="small">
                            <Image
                                width={300}
                                src={details.licenseImage}
                                placeholder={<div style={{ width: 300, height: 200, background: '#f0f0f0' }} />}
                            />
                        </Card>
                    )}
                </Space>
            ),
        });
    }

    if (details.role === 'foreman') {
        tabItems.push({
            key: 'foreman',
            label: '工长信息',
            children: (
                <Descriptions bordered column={2} size="small">
                    <Descriptions.Item label="从业年限">{details.yearsExperience ? `${details.yearsExperience} 年` : '-'}</Descriptions.Item>
                    <Descriptions.Item label="工种类型">
                        {renderTags(details.workTypes, 'orange')}
                    </Descriptions.Item>
                </Descriptions>
            ),
        });
    }

    const serviceItems = [
        <Descriptions.Item key="serviceArea" label="服务区域">
            {renderTags(details.serviceArea, 'green')}
        </Descriptions.Item>,
        <Descriptions.Item key="styles" label="擅长风格">
            {renderTags(details.styles, 'purple')}
        </Descriptions.Item>,
        <Descriptions.Item key="highlightTags" label="亮点标签">
            {renderTags(details.highlightTags, 'cyan')}
        </Descriptions.Item>,
        <Descriptions.Item key="pricing" label="报价信息">
            {renderPricing(details.pricing)}
        </Descriptions.Item>,
    ];

    if (details.introduction && details.introduction.trim()) {
        serviceItems.push(
            <Descriptions.Item key="introduction" label="个人/公司简介">
                <div style={{ whiteSpace: 'pre-wrap' }}>{details.introduction.trim()}</div>
            </Descriptions.Item>,
        );
    }

    if (details.graduateSchool && details.graduateSchool.trim()) {
        serviceItems.push(
            <Descriptions.Item key="graduateSchool" label="毕业院校">
                {details.graduateSchool.trim()}
            </Descriptions.Item>,
        );
    }

    if (details.designPhilosophy && details.designPhilosophy.trim()) {
        serviceItems.push(
            <Descriptions.Item key="designPhilosophy" label="设计理念">
                <div style={{ whiteSpace: 'pre-wrap' }}>{details.designPhilosophy.trim()}</div>
            </Descriptions.Item>,
        );
    }

    tabItems.push({
        key: 'service',
        label: '服务信息',
        children: (
            <Descriptions bordered column={1} size="small">
                {serviceItems}
            </Descriptions>
        ),
    });

    if (details.portfolioCases && details.portfolioCases.length > 0) {
        tabItems.push({
            key: 'portfolio',
            label: `作品案例 (${details.portfolioCases.length})`,
            children: (
                <Space direction="vertical" style={{ width: '100%' }} size="large">
                    {details.portfolioCases.map((caseItem, index) => (
                        <Card key={index} title={`案例 ${index + 1}`} size="small">
                            <Descriptions bordered column={2} size="small" style={{ marginBottom: 16 }}>
                                <Descriptions.Item label="标题" span={2}>{formatText(caseItem.title)}</Descriptions.Item>
                                <Descriptions.Item label="风格">{formatText(caseItem.style)}</Descriptions.Item>
                                <Descriptions.Item label="面积">
                                    {caseItem.area ? `${caseItem.area} m²` : '-'}
                                </Descriptions.Item>
                                <Descriptions.Item label="案例说明" span={2}>
                                    <div style={{ whiteSpace: 'pre-wrap' }}>
                                        {caseItem.description && caseItem.description.trim() ? caseItem.description.trim() : '-'}
                                    </div>
                                </Descriptions.Item>
                            </Descriptions>

                            <div style={{ marginTop: 16 }}>
                                <div style={{ marginBottom: 8, fontWeight: 500 }}>案例图片</div>
                                <Image.PreviewGroup>
                                    <Space wrap>
                                        {caseItem.images.map((img, imgIndex) => (
                                            <Image
                                                key={imgIndex}
                                                width={150}
                                                height={150}
                                                src={img}
                                                style={{ objectFit: 'cover' }}
                                                placeholder={<div style={{ width: 150, height: 150, background: '#f0f0f0' }} />}
                                            />
                                        ))}
                                    </Space>
                                </Image.PreviewGroup>
                            </div>
                        </Card>
                    ))}
                </Space>
            ),
        });
    }

    return <Tabs items={tabItems} />;
};

export default MerchantApplicationDetail;
