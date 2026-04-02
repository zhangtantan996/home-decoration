import React, { useEffect, useState } from 'react';
import type { UploadFile } from 'antd';
import { Button, Card, Descriptions, Form, Input, InputNumber, Modal, Space, Table, Tag, Typography, Upload, message } from 'antd';
import { CheckCircleOutlined, EyeOutlined, FileAddOutlined, ReloadOutlined, UploadOutlined } from '@ant-design/icons';

import { merchantLeadApi, merchantProposalApi, merchantUploadApi, type MerchantLeadItem, type MerchantUploadResult } from '../../services/merchantApi';
import MerchantPageShell from '../../components/MerchantPageShell';
import MerchantPageHeader from '../../components/MerchantPageHeader';
import MerchantSectionCard from '../../components/MerchantSectionCard';
import MerchantContentPanel from '../../components/MerchantContentPanel';
import sharedStyles from '../../components/MerchantPage.module.css';
import { getStoredPathsFromUploadFiles } from '../../utils/uploadAsset';

const { TextArea } = Input;

const leadStatusMap: Record<string, { text: string; color: string }> = {
    pending: { text: '待响应', color: 'gold' },
    accepted: { text: '已接受', color: 'blue' },
    declined: { text: '已拒绝', color: 'default' },
    quoted: { text: '已提交方案', color: 'green' },
};

const formatBudget = (lead: MerchantLeadItem) => `¥${Math.round(lead.demand.budgetMin)} - ¥${Math.round(lead.demand.budgetMax)}`;

const MerchantLeads: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [leads, setLeads] = useState<MerchantLeadItem[]>([]);
    const [detailLead, setDetailLead] = useState<MerchantLeadItem | null>(null);
    const [detailVisible, setDetailVisible] = useState(false);
    const [proposalVisible, setProposalVisible] = useState(false);
    const [proposalLead, setProposalLead] = useState<MerchantLeadItem | null>(null);
    const [declineVisible, setDeclineVisible] = useState(false);
    const [declineLead, setDeclineLead] = useState<MerchantLeadItem | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [fileList, setFileList] = useState<Array<UploadFile<MerchantUploadResult>>>([]);
    const [proposalForm] = Form.useForm();
    const [declineForm] = Form.useForm();

    const loadLeads = async () => {
        try {
            const data = await merchantLeadApi.list({ page: 1, pageSize: 20 });
            setLeads(data.list || []);
        } catch (error) {
            message.error(error instanceof Error ? error.message : '加载线索失败');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadLeads();
    }, []);

    const openProposalModal = (lead: MerchantLeadItem) => {
        setProposalLead(lead);
        setProposalVisible(true);
        setFileList([]);
        proposalForm.resetFields();
        proposalForm.setFieldsValue({
            summary: `${lead.demand.title} · 初步方案`,
            designFee: 0,
            constructionFee: lead.demand.budgetMin || 0,
            materialFee: 0,
            estimatedDays: 60,
        });
    };

    const submitProposal = async () => {
        if (!proposalLead) {
            return;
        }
        try {
            const values = await proposalForm.validateFields();
            setSubmitting(true);
            const attachments = getStoredPathsFromUploadFiles(fileList);

            await merchantProposalApi.submit({
                sourceType: 'demand',
                demandMatchId: proposalLead.id,
                summary: values.summary,
                designFee: values.designFee,
                constructionFee: values.constructionFee,
                materialFee: values.materialFee,
                estimatedDays: values.estimatedDays,
                attachments: JSON.stringify(attachments),
            });
            message.success('方案已提交');
            setProposalVisible(false);
            setProposalLead(null);
            await loadLeads();
        } catch (error) {
            message.error(error instanceof Error ? error.message : '提交方案失败');
        } finally {
            setSubmitting(false);
        }
    };

    const acceptLead = async (lead: MerchantLeadItem) => {
        try {
            await merchantLeadApi.accept(lead.id);
            message.success('已接受线索');
            await loadLeads();
        } catch (error) {
            message.error(error instanceof Error ? error.message : '接受线索失败');
        }
    };

    const submitDecline = async () => {
        if (!declineLead) {
            return;
        }
        try {
            const values = await declineForm.validateFields();
            setSubmitting(true);
            await merchantLeadApi.decline(declineLead.id, values.reason);
            message.success('已拒绝线索');
            setDeclineVisible(false);
            setDeclineLead(null);
            declineForm.resetFields();
            await loadLeads();
        } catch (error) {
            message.error(error instanceof Error ? error.message : '拒绝线索失败');
        } finally {
            setSubmitting(false);
        }
    };

    const columns = [
        { title: '线索ID', dataIndex: 'id', width: 90 },
        { title: '需求标题', dataIndex: ['demand', 'title'], ellipsis: true },
        { title: '区域', render: (_: unknown, record: MerchantLeadItem) => `${record.demand.city}${record.demand.district ? ` / ${record.demand.district}` : ''}` },
        { title: '面积', render: (_: unknown, record: MerchantLeadItem) => `${record.demand.area || 0}㎡` },
        { title: '预算', render: (_: unknown, record: MerchantLeadItem) => formatBudget(record) },
        { title: '截止时间', dataIndex: 'responseDeadline', width: 180 },
        {
            title: '状态',
            dataIndex: 'status',
            render: (status: string) => {
                const config = leadStatusMap[status] || { text: status, color: 'default' };
                return <Tag color={config.color}>{config.text}</Tag>;
            },
        },
        {
            title: '操作',
            width: 280,
            render: (_: unknown, record: MerchantLeadItem) => (
                <Space>
                    <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => {
                        setDetailLead(record);
                        setDetailVisible(true);
                    }}>
                        详情
                    </Button>
                    {record.status === 'pending' ? (
                        <>
                            <Button type="primary" size="small" onClick={() => void acceptLead(record)}>
                                接受
                            </Button>
                            <Button size="small" danger onClick={() => {
                                setDeclineLead(record);
                                setDeclineVisible(true);
                                declineForm.resetFields();
                            }}>
                                拒绝
                            </Button>
                        </>
                    ) : null}
                    {record.status === 'accepted' ? (
                        <Button type="primary" ghost size="small" icon={<FileAddOutlined />} onClick={() => openProposalModal(record)}>
                            提交方案
                        </Button>
                    ) : null}
                    {record.status === 'quoted' ? (
                        <Button type="primary" size="small" icon={<CheckCircleOutlined />}>
                            已报价
                        </Button>
                    ) : null}
                </Space>
            ),
        },
    ];

    return (
        <>
            <MerchantPageShell>
                <MerchantPageHeader
                    title="线索管理"
                    description="查看平台分发给你的装修需求，及时响应并按需提交方案。"
                    extra={(
                        <Button icon={<ReloadOutlined />} onClick={() => void loadLeads()}>
                            刷新
                        </Button>
                    )}
                />

                <MerchantContentPanel>
                    <MerchantSectionCard>
                        <Table
                            loading={loading}
                            rowKey="id"
                            columns={columns}
                            dataSource={leads}
                            pagination={false}
                            className={sharedStyles.tableCard}
                        />
                    </MerchantSectionCard>
                </MerchantContentPanel>
            </MerchantPageShell>

            <Modal
                open={detailVisible}
                title="线索详情"
                footer={null}
                onCancel={() => setDetailVisible(false)}
                width={760}
            >
                {detailLead ? (
                    <Space direction="vertical" size="large" style={{ width: '100%' }}>
                        <Descriptions bordered column={2}>
                            <Descriptions.Item label="需求标题" span={2}>{detailLead.demand.title}</Descriptions.Item>
                            <Descriptions.Item label="需求类型">{detailLead.demand.demandType}</Descriptions.Item>
                            <Descriptions.Item label="状态">{leadStatusMap[detailLead.status]?.text || detailLead.status}</Descriptions.Item>
                            <Descriptions.Item label="区域">{detailLead.demand.city} / {detailLead.demand.district}</Descriptions.Item>
                            <Descriptions.Item label="面积">{detailLead.demand.area}㎡</Descriptions.Item>
                            <Descriptions.Item label="预算" span={2}>{formatBudget(detailLead)}</Descriptions.Item>
                            <Descriptions.Item label="响应截止" span={2}>{detailLead.responseDeadline || '-'}</Descriptions.Item>
                            <Descriptions.Item label="审核备注" span={2}>{detailLead.demand.reviewNote || '暂无'}</Descriptions.Item>
                        </Descriptions>
                        <Card size="small" title="需求附件">
                            {detailLead.attachments.length === 0 ? (
                                <Typography.Text type="secondary">暂无附件</Typography.Text>
                            ) : (
                                <Space direction="vertical">
                                    {detailLead.attachments.map((item) => (
                                        <Typography.Link href={item.url} key={item.url} target="_blank" rel="noreferrer">
                                            {item.name} ({Math.max(1, Math.round(item.size / 1024))} KB)
                                        </Typography.Link>
                                    ))}
                                </Space>
                            )}
                        </Card>
                    </Space>
                ) : null}
            </Modal>

            <Modal
                open={proposalVisible}
                title={proposalLead ? `提交方案 · ${proposalLead.demand.title}` : '提交方案'}
                onCancel={() => setProposalVisible(false)}
                onOk={() => void submitProposal()}
                confirmLoading={submitting}
                width={760}
            >
                <Form form={proposalForm} layout="vertical">
                    <Form.Item label="方案摘要" name="summary" rules={[{ required: true, message: '请输入方案摘要' }]}>
                        <TextArea rows={4} placeholder="概述你的方案思路、边界和主要判断。" />
                    </Form.Item>
                    <Space size="middle" style={{ width: '100%' }} align="start">
                        <Form.Item label="设计费" name="designFee" rules={[{ required: true, message: '请输入设计费' }]} style={{ flex: 1 }}>
                            <InputNumber min={0} precision={2} style={{ width: '100%' }} />
                        </Form.Item>
                        <Form.Item label="施工费" name="constructionFee" rules={[{ required: true, message: '请输入施工费' }]} style={{ flex: 1 }}>
                            <InputNumber min={0} precision={2} style={{ width: '100%' }} />
                        </Form.Item>
                        <Form.Item label="主材费" name="materialFee" rules={[{ required: true, message: '请输入主材费' }]} style={{ flex: 1 }}>
                            <InputNumber min={0} precision={2} style={{ width: '100%' }} />
                        </Form.Item>
                    </Space>
                    <Form.Item label="预计工期（天）" name="estimatedDays" rules={[{ required: true, message: '请输入预计工期' }]}>
                        <InputNumber min={1} precision={0} style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item label="方案附件">
                        <Upload
                            fileList={fileList}
                            customRequest={async (options) => {
                                try {
                                    const uploaded = await merchantUploadApi.uploadImageData(options.file as File);
                                    options.onSuccess?.(uploaded);
                                } catch (error) {
                                    options.onError?.(error as Error);
                                }
                            }}
                            onChange={({ fileList: next }) => setFileList(next)}
                        >
                            <Button icon={<UploadOutlined />}>上传附件</Button>
                        </Upload>
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                open={declineVisible}
                title="拒绝线索"
                onCancel={() => setDeclineVisible(false)}
                onOk={() => void submitDecline()}
                confirmLoading={submitting}
            >
                <Form form={declineForm} layout="vertical">
                    <Form.Item label="拒绝原因" name="reason" rules={[{ required: true, message: '请填写拒绝原因' }]}>
                        <TextArea rows={4} placeholder="例如：当前排期已满，无法在要求时间内响应。" />
                    </Form.Item>
                </Form>
            </Modal>
        </>
    );
};

export default MerchantLeads;
