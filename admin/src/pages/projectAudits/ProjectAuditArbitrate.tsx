import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Form, Input, InputNumber, Select, Space, Spin, message } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';

import PageHeader from '../../components/PageHeader';
import { adminProjectAuditApi, type AdminProjectAuditItem } from '../../services/api';

const normalizeAuditDetail = (raw: any): AdminProjectAuditItem | null => {
    const data = raw?.data;
    if (!data) return null;
    if (data.audit) return data.audit as AdminProjectAuditItem;
    return data as AdminProjectAuditItem;
};

const conclusionOptions = [
    { label: '继续施工', value: 'continue' },
    { label: '全额退款', value: 'refund' },
    { label: '部分退款', value: 'partial_refund' },
    { label: '关闭项目', value: 'close' },
];

const ProjectAuditArbitrate: React.FC = () => {
    const navigate = useNavigate();
    const params = useParams();
    const auditId = Number(params.id || 0);
    const [form] = Form.useForm();

    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [detail, setDetail] = useState<AdminProjectAuditItem | null>(null);

    const loadDetail = async () => {
        if (!Number.isFinite(auditId) || auditId <= 0) {
            message.error('无效审计ID');
            return;
        }
        try {
            setLoading(true);
            const res = await adminProjectAuditApi.detail(auditId);
            if (res?.code !== 0) {
                message.error(res?.message || '加载审计详情失败');
                setDetail(null);
                return;
            }
            const audit = normalizeAuditDetail(res);
            setDetail(audit);
            if (audit) {
                form.setFieldsValue({
                    conclusion: audit.conclusion || undefined,
                    conclusionReason: audit.conclusionReason || '',
                    refundAmount: typeof audit.executionPlan?.refundAmount === 'number' ? audit.executionPlan.refundAmount : undefined,
                    continueConstruction: Boolean(audit.executionPlan?.continueConstruction),
                });
            }
        } catch {
            message.error('加载审计详情失败');
            setDetail(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadDetail();
    }, [auditId]);

    const conclusion = Form.useWatch('conclusion', form);

    const canSubmit = useMemo(() => detail?.status !== 'completed', [detail]);

    const handleSubmit = async () => {
        if (!canSubmit) {
            message.warning('该审计单已完成，无需重复仲裁');
            return;
        }
        try {
            const values = await form.validateFields();
            const executionPlan: Record<string, unknown> = {
                action: values.conclusion,
            };
            if (values.conclusion === 'partial_refund') {
                executionPlan.refundAmount = Number(values.refundAmount || 0);
                executionPlan.continueConstruction = Boolean(values.continueConstruction);
            }

            setSubmitting(true);
            const res = await adminProjectAuditApi.arbitrate(auditId, {
                conclusion: values.conclusion,
                conclusionReason: values.conclusionReason,
                executionPlan,
            });
            if (res?.code !== 0) {
                message.error(res?.message || '提交仲裁失败');
                return;
            }
            message.success('仲裁结论已提交');
            navigate(`/project-audits/${auditId}`);
        } catch {
            // 表单校验失败
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="hz-page-stack">
            <PageHeader
                title={`提交仲裁 #${auditId || '-'}`}
                description="提交仲裁结论并写入执行方案。"
                extra={(
                    <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`/project-audits/${auditId}`)}>
                        返回详情
                    </Button>
                )}
            />

            <Card className="hz-table-card">
                {loading ? (
                    <div style={{ textAlign: 'center', padding: 48 }}>
                        <Spin />
                    </div>
                ) : (
                    <Form form={form} layout="vertical">
                        <Form.Item
                            label="仲裁结论"
                            name="conclusion"
                            rules={[{ required: true, message: '请选择仲裁结论' }]}
                        >
                            <Select options={conclusionOptions} placeholder="请选择仲裁结论" />
                        </Form.Item>

                        <Form.Item
                            label="仲裁原因"
                            name="conclusionReason"
                            rules={[{ required: true, message: '请填写仲裁原因' }]}
                        >
                            <Input.TextArea rows={5} placeholder="请填写仲裁原因与执行依据" />
                        </Form.Item>

                        {conclusion === 'partial_refund' ? (
                            <>
                                <Form.Item
                                    label="部分退款金额"
                                    name="refundAmount"
                                    rules={[{ required: true, message: '请输入退款金额' }]}
                                >
                                    <InputNumber style={{ width: '100%' }} min={0} precision={2} placeholder="请输入金额" />
                                </Form.Item>
                                <Form.Item
                                    label="部分退款后是否继续施工"
                                    name="continueConstruction"
                                    initialValue={false}
                                >
                                    <Select
                                        options={[
                                            { label: '继续施工', value: true },
                                            { label: '不继续施工', value: false },
                                        ]}
                                    />
                                </Form.Item>
                            </>
                        ) : null}

                        <Space>
                            <Button type="primary" loading={submitting} onClick={() => void handleSubmit()}>
                                提交仲裁
                            </Button>
                            <Button onClick={() => navigate(`/project-audits/${auditId}`)}>取消</Button>
                        </Space>
                    </Form>
                )}
            </Card>
        </div>
    );
};

export default ProjectAuditArbitrate;
