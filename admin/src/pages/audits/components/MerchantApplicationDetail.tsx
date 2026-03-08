import React from 'react';
import { Card, Descriptions, Image, Tag, Tabs, Space } from 'antd';
import type { AdminMerchantApplicationDetail, MerchantApplicationDetails } from '../../../services/api';

interface MerchantApplicationDetailProps {
    details: MerchantApplicationDetails & Partial<AdminMerchantApplicationDetail>;
}

const MerchantApplicationDetail: React.FC<MerchantApplicationDetailProps> = ({ details }) => {
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

    const tabItems = [
        {
            key: 'basic',
            label: '基础信息',
            children: (
                <Descriptions bordered column={2} size="small">
                    <Descriptions.Item label="手机号">{details.phone}</Descriptions.Item>
                    <Descriptions.Item label="角色类型">
                        <Tag color="blue">{roleMap[details.role] || details.role}</Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="主体类型">
                        {entityTypeMap[details.entityType] || details.entityType}
                    </Descriptions.Item>
                    <Descriptions.Item label="申请人类型">
                        {details.applicantType}
                    </Descriptions.Item>
                    <Descriptions.Item label="商家体系">
                        {details.merchantKind || 'provider'}
                    </Descriptions.Item>
                    <Descriptions.Item label="来源申请单">
                        {details.sourceApplicationId || ('id' in details ? details.id : '-')}
                    </Descriptions.Item>
                </Descriptions>
            ),
        },
        {
            key: 'identity',
            label: '身份信息',
            children: (
                <Space direction="vertical" style={{ width: '100%' }} size="large">
                    <Descriptions bordered column={1} size="small">
                        <Descriptions.Item label={details.entityType === 'company' ? '法人/经营者姓名' : '真实姓名'}>{details.realName}</Descriptions.Item>
                        <Descriptions.Item label={details.entityType === 'company' ? '法人/经营者身份证号' : '身份证号'}>{details.idCardNo}</Descriptions.Item>
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

    // 公司信息 Tab（仅公司主体显示）
    if (details.entityType === 'company' && details.companyName) {
        tabItems.push({
            key: 'company',
            label: '公司信息',
            children: (
                <Space direction="vertical" style={{ width: '100%' }} size="large">
                    <Descriptions bordered column={2} size="small">
                        <Descriptions.Item label="公司名称" span={2}>{details.companyName}</Descriptions.Item>
                        <Descriptions.Item label="营业执照号">{details.licenseNo}</Descriptions.Item>
                        <Descriptions.Item label="团队规模">{details.teamSize} 人</Descriptions.Item>
                        <Descriptions.Item label="办公地址" span={2}>{details.officeAddress}</Descriptions.Item>
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

    // 工长信息 Tab（仅工长显示）
    if (details.role === 'foreman') {
        tabItems.push({
            key: 'foreman',
            label: '工长信息',
            children: (
                <Descriptions bordered column={2} size="small">
                    <Descriptions.Item label="从业年限">{details.yearsExperience} 年</Descriptions.Item>
                    <Descriptions.Item label="工种类型">
                        {details.workTypes?.map((type) => (
                            <Tag key={type} color="orange">{type}</Tag>
                        ))}
                    </Descriptions.Item>
                </Descriptions>
            ),
        });
    }

    // 服务信息 Tab
    tabItems.push({
        key: 'service',
        label: '服务信息',
        children: (
            <Descriptions bordered column={1} size="small">
                <Descriptions.Item label="服务区域">
                    {details.serviceArea?.map((area) => (
                        <Tag key={area} color="green">{area}</Tag>
                    ))}
                </Descriptions.Item>
                <Descriptions.Item label="擅长风格">
                    {details.styles?.map((style) => (
                        <Tag key={style} color="purple">{style}</Tag>
                    ))}
                </Descriptions.Item>
                <Descriptions.Item label="亮点标签">
                    {details.highlightTags?.map((tag) => (
                        <Tag key={tag} color="cyan">{tag}</Tag>
                    ))}
                </Descriptions.Item>
                {details.pricing && Object.keys(details.pricing).length > 0 && (
                    <Descriptions.Item label="报价信息">
                        {Object.entries(details.pricing).map(([key, value]) => (
                            <div key={key}>
                                {key}: ¥{value}
                            </div>
                        ))}
                    </Descriptions.Item>
                )}
                {details.introduction && (
                    <Descriptions.Item label="个人/公司简介">
                        <div style={{ whiteSpace: 'pre-wrap' }}>{details.introduction}</div>
                    </Descriptions.Item>
                )}
                {details.graduateSchool && (
                    <Descriptions.Item label="毕业院校">{details.graduateSchool}</Descriptions.Item>
                )}
                {details.designPhilosophy && (
                    <Descriptions.Item label="设计理念">
                        <div style={{ whiteSpace: 'pre-wrap' }}>{details.designPhilosophy}</div>
                    </Descriptions.Item>
                )}
            </Descriptions>
        ),
    });

    // 作品案例 Tab
    if (details.portfolioCases && details.portfolioCases.length > 0) {
        tabItems.push({
            key: 'portfolio',
            label: `作品案例 (${details.portfolioCases.length})`,
            children: (
                <Space direction="vertical" style={{ width: '100%' }} size="large">
                    {details.portfolioCases.map((caseItem, index) => (
                        <Card key={index} title={caseItem.title} size="small">
                            <Descriptions bordered column={2} size="small" style={{ marginBottom: 16 }}>
                                <Descriptions.Item label="风格">{caseItem.style}</Descriptions.Item>
                                <Descriptions.Item label="面积">{caseItem.area} m²</Descriptions.Item>
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
