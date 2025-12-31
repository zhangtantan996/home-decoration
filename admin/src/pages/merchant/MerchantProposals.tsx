import React, { useEffect, useState } from 'react';
import type { UploadFile } from 'antd';
import { Card, Table, Tag, Button, Typography, message, Modal, Space, Descriptions, Form, Input, InputNumber, Upload } from 'antd';
import { ArrowLeftOutlined, EyeOutlined, EditOutlined, DeleteOutlined, UploadOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { merchantProposalApi, merchantUploadApi } from '../../services/merchantApi';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface Proposal {
    id: number;
    bookingId: number;
    summary: string;
    designFee: number;
    constructionFee: number;
    materialFee: number;
    estimatedDays: number;
    attachments: string;
    status: number;
    createdAt: string;
    version?: number; // 版本号
    parentProposalId?: number; // 上一版本ID
    rejectionCount?: number; // 拒绝次数
    rejectionReason?: string; // 拒绝原因
    rejectedAt?: string; // 拒绝时间
}

interface Booking {
    id: number;
    address: string;
    area: number;
    houseLayout: string;
    renovationType: string;
    budgetRange: string;
    userNickname?: string;
    userPhone?: string;
}

const statusMap: Record<number, { text: string; color: string }> = {
    1: { text: '待确认', color: 'gold' },
    2: { text: '已确认', color: 'green' },
    3: { text: '已拒绝', color: 'red' },
    4: { text: '已被替代', color: 'default' },
};

const renovationTypeMap: Record<string, string> = {
    'new': '新房装修',
    'old': '老房翻新',
    'partial': '局部改造',
};

const budgetRangeMap: Record<string, string> = {
    '1': '5万以下',
    '2': '5-10万',
    '3': '10-20万',
    '4': '20-50万',
    '5': '50万以上',
};

const MerchantProposals: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [proposals, setProposals] = useState<Proposal[]>([]);
    const [detailVisible, setDetailVisible] = useState(false);
    const [editVisible, setEditVisible] = useState(false);
    const [resubmitVisible, setResubmitVisible] = useState(false); // 重新提交弹窗
    const [currentProposal, setCurrentProposal] = useState<Proposal | null>(null);
    const [currentBooking, setCurrentBooking] = useState<Booking | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [fileList, setFileList] = useState<UploadFile[]>([]);
    const [rejectionInfo, setRejectionInfo] = useState<any>(null); // 拒绝信息
    const [form] = Form.useForm();
    const [resubmitForm] = Form.useForm(); // 重新提交表单
    const navigate = useNavigate();

    useEffect(() => {
        loadProposals();
    }, []);

    const loadProposals = async () => {
        try {
            const res = await merchantProposalApi.list() as any;
            if (res.code === 0) {
                setProposals(res.data.list || []);
            }
        } catch (error) {
            message.error('加载失败');
        } finally {
            setLoading(false);
        }
    };

    const showDetail = async (record: Proposal) => {
        try {
            const res = await merchantProposalApi.detail(record.id) as any;
            if (res.code === 0) {
                setCurrentProposal(res.data.proposal);
                setCurrentBooking(res.data.booking);
                setDetailVisible(true);
            }
        } catch (error) {
            message.error('获取详情失败');
        }
    };

    const openEditModal = async (record: Proposal) => {
        try {
            const res = await merchantProposalApi.detail(record.id) as any;
            if (res.code === 0) {
                setCurrentProposal(res.data.proposal);
                setCurrentBooking(res.data.booking);
                form.setFieldsValue({
                    summary: res.data.proposal.summary,
                    designFee: res.data.proposal.designFee,
                    constructionFee: res.data.proposal.constructionFee,
                    materialFee: res.data.proposal.materialFee,
                    estimatedDays: res.data.proposal.estimatedDays,
                });
                // Parse existing attachments
                try {
                    const existingAttachments = JSON.parse(res.data.proposal.attachments || '[]');
                    setFileList(existingAttachments.map((url: string, index: number) => ({
                        uid: `-${index}`,
                        name: url.split('/').pop() || 'file',
                        status: 'done',
                        url: url,
                        response: { url },
                    })));
                } catch {
                    setFileList([]);
                }
                setEditVisible(true);
            }
        } catch (error) {
            message.error('获取详情失败');
        }
    };

    const handleUpdate = async () => {
        if (!currentProposal) return;
        try {
            const values = await form.validateFields();
            setSubmitting(true);

            const attachments = fileList
                .filter(file => file.status === 'done' && (file.response?.url || file.url))
                .map(file => file.response?.url || file.url);

            const res = await merchantProposalApi.update(currentProposal.id, {
                ...values,
                attachments: JSON.stringify(attachments),
            }) as any;

            if (res.code === 0) {
                message.success('更新成功');
                setEditVisible(false);
                loadProposals();
            } else {
                message.error(res.message || '更新失败');
            }
        } catch (error: any) {
            message.error(error.response?.data?.message || '更新失败');
        } finally {
            setSubmitting(false);
        }
    };

    const handleCancel = (record: Proposal) => {
        Modal.confirm({
            title: '确认取消方案',
            content: '确定要取消此方案吗？此操作不可撤销。',
            okText: '确定',
            cancelText: '取消',
            okButtonProps: { danger: true },
            onOk: async () => {
                try {
                    const res = await merchantProposalApi.cancel(record.id) as any;
                    if (res.code === 0) {
                        message.success('取消成功');
                        loadProposals();
                    } else {
                        message.error(res.message || '取消失败');
                    }
                } catch (error) {
                    message.error('取消失败');
                }
            },
        });
    };

    const handleReopen = (record: Proposal) => {
        Modal.confirm({
            title: '重新发起方案',
            content: '确定要重新发起此方案吗？用户将收到通知并可以重新确认支付。',
            okText: '确定',
            cancelText: '取消',
            onOk: async () => {
                try {
                    const res = await merchantProposalApi.reopen(record.id) as any;
                    if (res.code === 0) {
                        message.success('方案已重新发起，等待用户确认');
                        loadProposals();
                    } else {
                        message.error(res.message || '操作失败');
                    }
                } catch (error: any) {
                    message.error(error.response?.data?.error || '操作失败');
                }
            },
        });
    };

    // 打开重新提交弹窗
    const openResubmitModal = async (record: Proposal) => {
        try {
            // 获取方案详情和拒绝信息
            const [detailRes, rejectionRes] = await Promise.all([
                merchantProposalApi.detail(record.id) as any,
                merchantProposalApi.getRejectionInfo(record.id) as any,
            ]);

            if (detailRes.code === 0) {
                setCurrentProposal(detailRes.data.proposal);
                setCurrentBooking(detailRes.data.booking);
                setRejectionInfo(rejectionRes.data);

                // 填充表单（使用原方案数据作为默认值）
                resubmitForm.setFieldsValue({
                    summary: detailRes.data.proposal.summary,
                    designFee: detailRes.data.proposal.designFee,
                    constructionFee: detailRes.data.proposal.constructionFee,
                    materialFee: detailRes.data.proposal.materialFee,
                    estimatedDays: detailRes.data.proposal.estimatedDays,
                });

                // 解析现有附件
                try {
                    const existingAttachments = JSON.parse(detailRes.data.proposal.attachments || '[]');
                    setFileList(existingAttachments.map((url: string, index: number) => ({
                        uid: `-${index}`,
                        name: url.split('/').pop() || 'file',
                        status: 'done',
                        url: url,
                        response: { url },
                    })));
                } catch {
                    setFileList([]);
                }

                setResubmitVisible(true);
            }
        } catch (error) {
            message.error('获取方案信息失败');
        }
    };

    // 处理重新提交
    const handleResubmit = async () => {
        if (!currentProposal) return;

        try {
            const values = await resubmitForm.validateFields();
            setSubmitting(true);

            const attachments = fileList
                .filter(file => file.status === 'done' && (file.response?.url || file.url))
                .map(file => file.response?.url || file.url);

            const res = await merchantProposalApi.resubmit({
                proposalId: currentProposal.id,
                ...values,
                attachments: JSON.stringify(attachments),
            }) as any;

            if (res.code === 0) {
                const version = res.data?.proposal?.version || (currentProposal.version || 1) + 1;
                message.success(`方案 v${version} 已提交，等待用户确认`);
                setResubmitVisible(false);
                resubmitForm.resetFields();
                setFileList([]);
                loadProposals();
            } else {
                message.error(res.message || '提交失败');
            }
        } catch (error: any) {
            message.error(error.response?.data?.message || '提交失败');
        } finally {
            setSubmitting(false);
        }
    };

    const columns = [
        { title: 'ID', dataIndex: 'id', width: 60 },
        { title: '预约ID', dataIndex: 'bookingId', width: 80 },
        { title: '方案概述', dataIndex: 'summary', ellipsis: true },
        {
            title: '设计费',
            dataIndex: 'designFee',
            render: (v: number) => `¥${v?.toLocaleString() || 0}`,
        },
        {
            title: '施工费',
            dataIndex: 'constructionFee',
            render: (v: number) => `¥${v?.toLocaleString() || 0}`,
        },
        {
            title: '主材费',
            dataIndex: 'materialFee',
            render: (v: number) => `¥${v?.toLocaleString() || 0}`,
        },
        { title: '工期', dataIndex: 'estimatedDays', render: (v: number) => `${v}天` },
        {
            title: '状态',
            dataIndex: 'status',
            render: (status: number) => {
                const s = statusMap[status] || { text: '未知', color: 'default' };
                return <Tag color={s.color}>{s.text}</Tag>;
            },
        },
        {
            title: '创建时间',
            dataIndex: 'createdAt',
            width: 160,
            render: (v: string) => new Date(v).toLocaleString(),
        },
        {
            title: '操作',
            width: 180,
            render: (_: any, record: Proposal) => (
                <Space>
                    <Button
                        type="link"
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={() => showDetail(record)}
                    >
                        详情
                    </Button>
                    {(record.status === 1 || record.status === 3) && (
                        <Button
                            type="link"
                            size="small"
                            icon={<EditOutlined />}
                            onClick={() => record.status === 3 ? openResubmitModal(record) : openEditModal(record)}
                        >
                            {record.status === 3 ? '重新提交' : '编辑'}
                        </Button>
                    )}
                    {record.status === 1 && (
                        <Button
                            type="link"
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => handleCancel(record)}
                        >
                            取消
                        </Button>
                    )}
                    {record.status === 2 && (
                        <Button
                            type="link"
                            size="small"
                            icon={<ReloadOutlined />}
                            onClick={() => handleReopen(record)}
                        >
                            重新发起
                        </Button>
                    )}
                </Space>
            ),
        },
    ];

    return (
        <div style={{ padding: 24 }}>
            <div style={{ marginBottom: 16 }}>
                <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/dashboard')}>
                    返回首页
                </Button>
            </div>

            <Card title={<Title level={4} style={{ margin: 0 }}>我的方案</Title>}>
                <Table
                    loading={loading}
                    dataSource={proposals}
                    columns={columns}
                    rowKey="id"
                    pagination={{ pageSize: 10 }}
                />
            </Card>

            {/* 方案详情弹窗 */}
            <Modal
                title="方案详情"
                open={detailVisible}
                onCancel={() => setDetailVisible(false)}
                footer={<Button onClick={() => setDetailVisible(false)}>关闭</Button>}
                width={700}
            >
                {currentProposal && currentBooking && (
                    <>
                        <div style={{ marginBottom: 16, background: '#f5f5f5', padding: 12, borderRadius: 8 }}>
                            <Text strong>关联预约信息：</Text>
                            <br />
                            <Text>用户：{currentBooking.userNickname || '-'} | 电话：{currentBooking.userPhone || '-'}</Text>
                            <br />
                            <Text>地址：{currentBooking.address}</Text>
                            <br />
                            <Text>面积：{currentBooking.area}㎡ | 户型：{currentBooking.houseLayout}</Text>
                            <br />
                            <Text>装修类型：{renovationTypeMap[currentBooking.renovationType] || currentBooking.renovationType} | 预算：{budgetRangeMap[currentBooking.budgetRange] || currentBooking.budgetRange}</Text>
                        </div>
                        <Descriptions column={2} bordered size="small">
                            <Descriptions.Item label="方案ID">{currentProposal.id}</Descriptions.Item>
                            <Descriptions.Item label="状态">
                                <Tag color={statusMap[currentProposal.status]?.color}>
                                    {statusMap[currentProposal.status]?.text}
                                </Tag>
                            </Descriptions.Item>
                            <Descriptions.Item label="方案概述" span={2}>{currentProposal.summary}</Descriptions.Item>
                            <Descriptions.Item label="设计费">¥{currentProposal.designFee?.toLocaleString()}</Descriptions.Item>
                            <Descriptions.Item label="施工费">¥{currentProposal.constructionFee?.toLocaleString()}</Descriptions.Item>
                            <Descriptions.Item label="主材费">¥{currentProposal.materialFee?.toLocaleString()}</Descriptions.Item>
                            <Descriptions.Item label="预计工期">{currentProposal.estimatedDays}天</Descriptions.Item>
                            <Descriptions.Item label="创建时间" span={2}>{new Date(currentProposal.createdAt).toLocaleString()}</Descriptions.Item>
                        </Descriptions>
                    </>
                )}
            </Modal>

            {/* 编辑方案弹窗 */}
            <Modal
                title="编辑设计方案"
                open={editVisible}
                onCancel={() => setEditVisible(false)}
                onOk={handleUpdate}
                confirmLoading={submitting}
                width={600}
            >
                {currentBooking && (
                    <div style={{ marginBottom: 16, background: '#f5f5f5', padding: 12, borderRadius: 8 }}>
                        <Text strong>预约信息：</Text>
                        <br />
                        <Text>地址：{currentBooking.address}</Text>
                        <br />
                        <Text>面积：{currentBooking.area}㎡ | 户型：{currentBooking.houseLayout}</Text>
                    </div>
                )}

                <Form form={form} layout="vertical">
                    <Form.Item
                        name="summary"
                        label="方案概述"
                        rules={[{ required: true, message: '请输入方案概述' }]}
                    >
                        <TextArea rows={4} placeholder="描述设计理念、整体风格等" />
                    </Form.Item>

                    <Form.Item
                        name="designFee"
                        label="设计费 (元)"
                        rules={[{ required: true, message: '请输入设计费' }]}
                    >
                        <InputNumber min={0} style={{ width: '100%' }} />
                    </Form.Item>

                    <Form.Item
                        name="constructionFee"
                        label="施工费预估 (元)"
                        rules={[{ required: true, message: '请输入施工费' }]}
                    >
                        <InputNumber min={0} style={{ width: '100%' }} />
                    </Form.Item>

                    <Form.Item
                        name="materialFee"
                        label="主材费预估 (元)"
                        rules={[{ required: true, message: '请输入主材费' }]}
                    >
                        <InputNumber min={0} style={{ width: '100%' }} />
                    </Form.Item>

                    <Form.Item
                        name="estimatedDays"
                        label="预计工期 (天)"
                        rules={[{ required: true, message: '请输入工期' }]}
                    >
                        <InputNumber min={1} style={{ width: '100%' }} />
                    </Form.Item>

                    <Form.Item
                        label="附件上传"
                        extra="支持图片/PDF/Word/Zip，最大20MB，最多5个文件"
                    >
                        <Upload
                            fileList={fileList}
                            onChange={({ fileList }) => setFileList(fileList)}
                            customRequest={async (options) => {
                                const { file, onSuccess, onError } = options;
                                try {
                                    const res = await merchantUploadApi.uploadImage(file as File) as any;
                                    if (res.code === 0) {
                                        onSuccess?.(res.data);
                                    } else {
                                        onError?.(new Error(res.message));
                                        message.error(res.message);
                                    }
                                } catch (err) {
                                    onError?.(err as Error);
                                    message.error('上传失败');
                                }
                            }}
                            maxCount={5}
                            beforeUpload={(file) => {
                                const isLt20M = file.size / 1024 / 1024 < 20;
                                if (!isLt20M) {
                                    message.error('文件必须小于 20MB!');
                                    return Upload.LIST_IGNORE;
                                }
                                return true;
                            }}
                        >
                            <Button icon={<UploadOutlined />}>选择文件</Button>
                        </Upload>
                    </Form.Item>
                </Form>
            </Modal>

            {/* 重新提交方案弹窗 */}
            <Modal
                title={
                    <div>
                        <span>重新提交方案</span>
                        {currentProposal && currentProposal.version && (
                            <Tag color="blue" style={{ marginLeft: 8 }}>
                                v{currentProposal.version + 1}
                            </Tag>
                        )}
                    </div>
                }
                open={resubmitVisible}
                onOk={handleResubmit}
                onCancel={() => {
                    setResubmitVisible(false);
                    resubmitForm.resetFields();
                    setFileList([]);
                }}
                width={800}
                confirmLoading={submitting}
                okText="提交新版本"
                cancelText="取消"
            >
                {/* 拒绝信息提示 */}
                {rejectionInfo && (
                    <div style={{
                        marginBottom: 20,
                        padding: 12,
                        background: '#FFF7E6',
                        border: '1px solid #FFD591',
                        borderRadius: 4
                    }}>
                        <div style={{ marginBottom: 8 }}>
                            <Text strong>用户拒绝原因：</Text>
                            <Text type="secondary" style={{ marginLeft: 8 }}>
                                {rejectionInfo.rejectionReason || '无'}
                            </Text>
                        </div>
                        <div>
                            <Text type="warning">
                                已拒绝 {rejectionInfo.rejectionCount}/3 次
                                {rejectionInfo.rejectionCount >= 2 && '（最后一次机会）'}
                            </Text>
                        </div>
                    </div>
                )}

                <Form form={resubmitForm} layout="vertical">
                    <Form.Item
                        name="summary"
                        label="方案概述"
                        rules={[{ required: true, message: '请输入方案概述' }]}
                        extra="请根据用户反馈调整方案，说明改进之处"
                    >
                        <TextArea rows={4} placeholder="请描述此版本的调整内容..." />
                    </Form.Item>

                    <Form.Item
                        name="designFee"
                        label="设计费 (元)"
                        rules={[{ required: true, message: '请输入设计费' }]}
                    >
                        <InputNumber min={0} style={{ width: '100%' }} />
                    </Form.Item>

                    <Form.Item
                        name="constructionFee"
                        label="施工费 (元)"
                    >
                        <InputNumber min={0} style={{ width: '100%' }} />
                    </Form.Item>

                    <Form.Item
                        name="materialFee"
                        label="主材费 (元)"
                    >
                        <InputNumber min={0} style={{ width: '100%' }} />
                    </Form.Item>

                    <Form.Item
                        name="estimatedDays"
                        label="预计工期 (天)"
                        rules={[{ required: true, message: '请输入工期' }]}
                    >
                        <InputNumber min={1} style={{ width: '100%' }} />
                    </Form.Item>

                    <Form.Item
                        label="附件上传"
                        extra="支持图片/PDF/Word/Zip，最大20MB，最多5个文件"
                    >
                        <Upload
                            fileList={fileList}
                            onChange={({ fileList }) => setFileList(fileList)}
                            customRequest={async (options) => {
                                const { file, onSuccess, onError } = options;
                                try {
                                    const res = await merchantUploadApi.uploadImage(file as File) as any;
                                    if (res.code === 0) {
                                        onSuccess?.(res.data);
                                    } else {
                                        onError?.(new Error(res.message));
                                        message.error(res.message);
                                    }
                                } catch (err) {
                                    onError?.(err as Error);
                                    message.error('上传失败');
                                }
                            }}
                            maxCount={5}
                            beforeUpload={(file) => {
                                const isLt20M = file.size / 1024 / 1024 < 20;
                                if (!isLt20M) {
                                    message.error('文件必须小于 20MB!');
                                    return Upload.LIST_IGNORE;
                                }
                                return true;
                            }}
                        >
                            <Button icon={<UploadOutlined />}>选择文件</Button>
                        </Upload>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default MerchantProposals;
