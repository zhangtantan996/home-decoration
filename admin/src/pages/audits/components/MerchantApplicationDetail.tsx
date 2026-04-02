import React from 'react';
import { Card, Descriptions, Image, Space, Tag, Tabs, Tooltip } from 'antd';
import type { AdminMerchantApplicationDetail, MerchantApplicationDetails } from '../../../services/api';
import {
    APPLICATION_SCENE_META,
    APPLICANT_TYPE_LABELS,
    ENTITY_TYPE_LABELS,
    MERCHANT_KIND_LABELS,
    PRICING_LABELS,
    PROVIDER_ROLE_META,
} from '../../../constants/statuses';

interface MerchantApplicationDetailProps {
    details: MerchantApplicationDetails & Partial<AdminMerchantApplicationDetail>;
}

const pricingOrder = ['flat', 'duplex', 'other', 'perSqm', 'fullPackage', 'halfPackage'] as const;

const imagePlaceholderStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 200,
    height: 126,
    background: '#f5f5f5',
    color: '#8c8c8c',
    borderRadius: 8,
};

const formatText = (value?: string | number | null) => {
    if (value == null) return '-';
    const normalized = String(value).trim();
    return normalized || '-';
};

const renderArea = (value?: string | number | null) => {
    const normalized = formatText(value);
    if (normalized === '-') {
        return normalized;
    }

    if (/[㎡]|m²|M²|平方米|平米/.test(normalized)) {
        return normalized;
    }

    return `${normalized}㎡`;
};

const renderTags = (values: string[] | undefined, color: string) => {
    if (!values?.length) {
        return '-';
    }

    return values.map((value) => (
        <Tooltip key={value} title={value}>
            <Tag
                color={color}
                style={{
                    maxWidth: 180,
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                    verticalAlign: 'bottom',
                }}
            >
                {value}
            </Tag>
        </Tooltip>
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
                <div key={key}>{`${PRICING_LABELS[key] || key}: ¥${value}`}</div>
            ))}
        </Space>
    );
};

const renderPreviewImage = (label: string, src?: string, width = 200, height = 126) => (
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

const MerchantApplicationDetail: React.FC<MerchantApplicationDetailProps> = ({ details }) => {
    const subjectName = details.entityType === 'personal'
        ? formatText(details.realName)
        : formatText(details.companyName || details.realName);
    const principalLabel = details.entityType === 'company' ? '申请人/经办人' : '负责人';

    const showMerchantKind = Boolean(details.merchantKind);
    const showSourceApplicationId = Boolean(details.sourceApplicationId && details.sourceApplicationId !== details.id);
    const hasLegalPersonIdentity = Boolean(
        details.legalPersonName
        || details.legalPersonIdCardNo
        || details.legalPersonIdCardFront
        || details.legalPersonIdCardBack,
    );
    const hasCompanyAlbum = Boolean(details.companyAlbum?.length);

    const tabItems = [
        {
            key: 'basic',
            label: '基础信息',
            children: (
                <Space direction="vertical" style={{ width: '100%' }} size="large">
                    <Descriptions bordered column={2} size="small">
                        <Descriptions.Item label="主体名称">{subjectName}</Descriptions.Item>
                        <Descriptions.Item label={principalLabel}>{formatText(details.realName)}</Descriptions.Item>
                        <Descriptions.Item label="手机号">{formatText(details.phone)}</Descriptions.Item>
                        <Descriptions.Item label="商家角色">
                            <Tag color={PROVIDER_ROLE_META[details.role]?.color || 'blue'}>
                                {PROVIDER_ROLE_META[details.role]?.text || formatText(details.role)}
                            </Tag>
                        </Descriptions.Item>
                        <Descriptions.Item label="主体类型">
                            {ENTITY_TYPE_LABELS[details.entityType] || formatText(details.entityType)}
                        </Descriptions.Item>
                        <Descriptions.Item label="申请人类型">
                            {APPLICANT_TYPE_LABELS[details.applicantType] || formatText(details.applicantType)}
                        </Descriptions.Item>
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
                    </Descriptions>

                    <Card title="申请人头像" size="small">
                        <Space wrap>
                            {renderPreviewImage('头像', details.avatar, 140, 140)}
                        </Space>
                    </Card>
                </Space>
            ),
        },
        {
            key: 'identity',
            label: '身份信息',
            children: (
                <Space direction="vertical" style={{ width: '100%' }} size="large">
                    <Descriptions bordered column={2} size="small">
                        <Descriptions.Item label="申请人/经办人姓名">{formatText(details.realName)}</Descriptions.Item>
                        <Descriptions.Item label="申请人/经办人身份证号">{formatText(details.idCardNo)}</Descriptions.Item>
                    </Descriptions>

                    <Card title="申请人/经办人证件" size="small">
                        <Space size="large" wrap>
                            {renderPreviewImage('身份证正面', details.idCardFront)}
                            {renderPreviewImage('身份证反面', details.idCardBack)}
                        </Space>
                    </Card>

                    {hasLegalPersonIdentity && (
                        <>
                            <Descriptions bordered column={2} size="small">
                                <Descriptions.Item label="法人/经营者姓名">{formatText(details.legalPersonName)}</Descriptions.Item>
                                <Descriptions.Item label="法人/经营者身份证号">{formatText(details.legalPersonIdCardNo)}</Descriptions.Item>
                            </Descriptions>

                            <Card title="法人/经营者证件" size="small">
                                <Space size="large" wrap>
                                    {renderPreviewImage('身份证正面', details.legalPersonIdCardFront)}
                                    {renderPreviewImage('身份证反面', details.legalPersonIdCardBack)}
                                </Space>
                            </Card>
                        </>
                    )}
                </Space>
            ),
        },
    ];

    if (details.entityType === 'company' || details.companyName || details.licenseNo || details.licenseImage || hasCompanyAlbum) {
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

                    <Card title="营业执照" size="small">
                        <Space wrap>
                            {renderPreviewImage('营业执照', details.licenseImage, 320, 200)}
                        </Space>
                    </Card>

                    {hasCompanyAlbum && (
                        <Card title={`企业相册 (${details.companyAlbum?.length || 0})`} size="small">
                            <Image.PreviewGroup>
                                <Space wrap size="middle">
                                    {details.companyAlbum?.map((image, index) => (
                                        <Image
                                            key={`${image}-${index}`}
                                            width={150}
                                            height={150}
                                            src={image}
                                            style={{ objectFit: 'cover' }}
                                            placeholder={<div style={{ ...imagePlaceholderStyle, width: 150, height: 150 }} />}
                                        />
                                    ))}
                                </Space>
                            </Image.PreviewGroup>
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
                </Descriptions>
            ),
        });
    }

    const serviceItems = [
        <Descriptions.Item key="serviceArea" label="服务城市">
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
                                    {renderArea(caseItem.area)}
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
                                        {caseItem.images.map((image, imageIndex) => (
                                            <Image
                                                key={`${image}-${imageIndex}`}
                                                width={150}
                                                height={150}
                                                src={image}
                                                style={{ objectFit: 'cover' }}
                                                placeholder={<div style={{ ...imagePlaceholderStyle, width: 150, height: 150 }} />}
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
