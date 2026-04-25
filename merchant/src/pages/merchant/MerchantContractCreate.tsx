import React, { useMemo, useState } from 'react';
import { Alert, Button, Card, Form, Input, InputNumber, Space, message } from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { merchantContractApi } from '../../services/merchantApi';
import { readSafeErrorMessage } from '../../utils/userFacingText';

const MerchantContractCreate: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [submitting, setSubmitting] = useState(false);
    const [createdContractNo, setCreatedContractNo] = useState('');
    const [form] = Form.useForm();

    const projectId = Number(searchParams.get('projectId') || 0);
    const demandId = Number(searchParams.get('demandId') || 0);
    const projectHint = useMemo(() => {
        if (projectId > 0) {
            return `当前将为项目 #${projectId} 发起合同。`;
        }
        if (demandId > 0) {
            return `当前将为需求 #${demandId} 发起合同。`;
        }
        return '未传入项目或需求上下文，请手动填写。';
    }, [projectId, demandId]);

    const submit = async () => {
        try {
            const values = await form.validateFields();
            setSubmitting(true);
            const payload = {
                projectId: projectId || undefined,
                demandId: demandId || undefined,
                title: values.title,
                totalAmount: values.totalAmount,
                attachmentUrls: values.attachmentUrls
                    ? String(values.attachmentUrls).split(/\n|,|，/).map((item) => item.trim()).filter(Boolean)
                    : [],
                paymentPlan: [
                    { phase: 1, name: '签约定金', amount: values.depositAmount, percentage: values.depositPercent, trigger_event: 'contract_confirmed' },
                    { phase: 2, name: '中期款', amount: values.midAmount, percentage: values.midPercent, trigger_event: 'midterm_acceptance' },
                    { phase: 3, name: '尾款', amount: values.finalAmount, percentage: values.finalPercent, trigger_event: 'final_acceptance' },
                ],
                termsSnapshot: { source: 'merchant_ui_phase2', createdFrom: projectId > 0 ? 'project' : 'demand' },
            };
            const created = await merchantContractApi.create(payload);
            setCreatedContractNo(created.contractNo);
            message.success('合同已创建');
        } catch (error) {
            if (error instanceof Error) {
                message.error(readSafeErrorMessage(error, '合同创建失败'));
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Card
                title="发起合同"
                extra={<Button onClick={() => navigate('/orders')}>返回订单</Button>}
            >
                <Alert type="info" showIcon message={projectHint} style={{ marginBottom: 16 }} />
                {createdContractNo ? (
                    <Alert
                        type="success"
                        showIcon
                        message={`合同已创建，合同编号 ${createdContractNo}`}
                        style={{ marginBottom: 16 }}
                    />
                ) : null}
                <Form form={form} layout="vertical" initialValues={{
                    title: '装修施工合同',
                    depositPercent: 10,
                    midPercent: 60,
                    finalPercent: 30,
                }}>
                    <Form.Item label="合同标题" name="title" rules={[{ required: true, message: '请输入合同标题' }]}>
                        <Input placeholder="例如：三室两厅现代简约装修合同" />
                    </Form.Item>
                    <Form.Item label="合同总金额" name="totalAmount" rules={[{ required: true, message: '请输入合同总金额' }]}>
                        <InputNumber min={0} precision={2} style={{ width: '100%' }} />
                    </Form.Item>
                    <Space size="middle" style={{ width: '100%' }} align="start">
                        <Form.Item label="签约定金金额" name="depositAmount" rules={[{ required: true, message: '请输入定金金额' }]} style={{ flex: 1 }}>
                            <InputNumber min={0} precision={2} style={{ width: '100%' }} />
                        </Form.Item>
                        <Form.Item label="定金比例" name="depositPercent" rules={[{ required: true, message: '请输入定金比例' }]} style={{ flex: 1 }}>
                            <InputNumber min={0} max={100} precision={0} style={{ width: '100%' }} />
                        </Form.Item>
                    </Space>
                    <Space size="middle" style={{ width: '100%' }} align="start">
                        <Form.Item label="中期款金额" name="midAmount" rules={[{ required: true, message: '请输入中期款金额' }]} style={{ flex: 1 }}>
                            <InputNumber min={0} precision={2} style={{ width: '100%' }} />
                        </Form.Item>
                        <Form.Item label="中期款比例" name="midPercent" rules={[{ required: true, message: '请输入中期款比例' }]} style={{ flex: 1 }}>
                            <InputNumber min={0} max={100} precision={0} style={{ width: '100%' }} />
                        </Form.Item>
                    </Space>
                    <Space size="middle" style={{ width: '100%' }} align="start">
                        <Form.Item label="尾款金额" name="finalAmount" rules={[{ required: true, message: '请输入尾款金额' }]} style={{ flex: 1 }}>
                            <InputNumber min={0} precision={2} style={{ width: '100%' }} />
                        </Form.Item>
                        <Form.Item label="尾款比例" name="finalPercent" rules={[{ required: true, message: '请输入尾款比例' }]} style={{ flex: 1 }}>
                            <InputNumber min={0} max={100} precision={0} style={{ width: '100%' }} />
                        </Form.Item>
                    </Space>
                    <Form.Item label="合同附件 URL" name="attachmentUrls">
                        <Input.TextArea rows={4} placeholder="每行一个附件 URL，例如合同 PDF、补充条款附件。" />
                    </Form.Item>
                    <Space>
                        <Button type="primary" loading={submitting} onClick={() => void submit()}>
                            发起合同
                        </Button>
                        <Button onClick={() => form.resetFields()}>
                            重置
                        </Button>
                    </Space>
                </Form>
            </Card>
        </Space>
    );
};

export default MerchantContractCreate;
