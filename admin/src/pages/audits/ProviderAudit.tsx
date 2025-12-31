import React, { useEffect, useState } from 'react';
import { Table, Card, Select, Tag, Button, Space, message, Modal, Form, Input, Image, Descriptions } from 'antd';
import { ReloadOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { adminAuditApi } from '../../services/api';

interface AuditItem {
    id: number;
    providerId: number;
    providerType: number;
    companyName: string;
    contactPerson: string;
    contactPhone: string;
    businessLicense: string;
    certificates: string[];
    status: number;
    submitTime: string;
    auditTime?: string;
    rejectReason?: string;
}

const statusMap: Record<number, { text: string; color: string }> = {
    0: { text: '待审核', color: 'orange' },
    1: { text: '已通过', color: 'green' },
    2: { text: '已拒绝', color: 'red' },
};

const providerTypeMap: Record<number, { text: string; color: string }> = {
    1: { text: '设计师', color: 'blue' },
    2: { text: '装修公司', color: 'green' },
    3: { text: '工长', color: 'orange' },
};

const ProviderAudit: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState<AuditItem[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);
    const [statusFilter, setStatusFilter] = useState<number>(0);
    const [detailVisible, setDetailVisible] = useState(false);
    const [currentItem, setCurrentItem] = useState<AuditItem | null>(null);
    const [rejectVisible, setRejectVisible] = useState(false);
    const [form] = Form.useForm();

    useEffect(() => {
        loadData();
    }, [page, statusFilter]);

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await adminAuditApi.providers({ page, pageSize, status: statusFilter }) as any;
            if (res.code === 0) {
                setItems(res.data.list || []);
                setTotal(res.data.total || 0);
            }
        } catch (error) {
            console.error(error);
            message.error('加载失败');
        } finally {
            setLoading(false);
        }
    };

    const showDetail = (record: AuditItem) => {
        setCurrentItem(record);
        setDetailVisible(true);
    };

    const handleApprove = async (record: AuditItem) => {
        Modal.confirm({
            title: '确认审核通过',
            content: `确定通过 ${record.companyName} 的资质审核吗？`,
            onOk: async () => {
                try {
                    await adminAuditApi.approve('providers', record.id, {});
                    message.success('审核通过');
                    loadData();
                } catch (error) {
                    message.error('操作失败');
                }
            },
        });
    };

    const showRejectModal = (record: AuditItem) => {
        setCurrentItem(record);
        form.resetFields();
        setRejectVisible(true);
    };

    const handleReject = async () => {
        try {
            const values = await form.validateFields();
            if (currentItem) {
                await adminAuditApi.reject('providers', currentItem.id, values);
                message.success('已拒绝');
                setRejectVisible(false);
                loadData();
            }
        } catch (error) {
            message.error('操作失败');
        }
    };

    const columns = [
        {
            title: 'ID',
            dataIndex: 'id',
            width: 80,
        },
        {
            title: '类型',
            dataIndex: 'providerType',
            render: (val: number) => {
                const config = providerTypeMap[val];
                return config ? <Tag color={config.color}>{config.text}</Tag> : '-';
            },
        },
        {
            title: '公司名称',
            dataIndex: 'companyName',
        },
        {
            title: '联系人',
            dataIndex: 'contactPerson',
        },
        {
            title: '联系电话',
            dataIndex: 'contactPhone',
        },
        {
            title: '状态',
            dataIndex: 'status',
            render: (val: number) => {
                const config = statusMap[val];
                return config ? <Tag color={config.color}>{config.text}</Tag> : '-';
            },
        },
        {
            title: '提交时间',
            dataIndex: 'submitTime',
            render: (val: string) => new Date(val).toLocaleString(),
        },
        {
            title: '操作',
            key: 'action',
            render: (_: any, record: AuditItem) => (
                <Space>
                    <Button type="link" size="small" onClick={() => showDetail(record)}>详情</Button>
                    {record.status === 0 && (
                        <>
                            <Button
                                type="link"
                                size="small"
                                icon={<CheckCircleOutlined />}
                                onClick={() => handleApprove(record)}
                            >
                                通过
                            </Button>
                            <Button
                                type="link"
                                size="small"
                                danger
                                icon={<CloseCircleOutlined />}
                                onClick={() => showRejectModal(record)}
                            >
                                拒绝
                            </Button>
                        </>
                    )}
                </Space>
            ),
        },
    ];

    return (
        <Card>
            <Space style={{ marginBottom: 16 }}>
                <Select
                    placeholder="审核状态"
                    value={statusFilter}
                    onChange={setStatusFilter}
                    style={{ width: 150 }}
                    options={[
                        { label: '待审核', value: 0 },
                        { label: '已通过', value: 1 },
                        { label: '已拒绝', value: 2 },
                    ]}
                />
                <Button icon={<ReloadOutlined />} onClick={loadData}>刷新</Button>
            </Space>

            <Table
                loading={loading}
                dataSource={items}
                columns={columns}
                rowKey="id"
                pagination={{
                    current: page,
                    pageSize,
                    total,
                    onChange: setPage,
                    showTotal: (total) => `共 ${total} 条`,
                }}
            />

            <Modal
                title="审核详情"
                open={detailVisible}
                onCancel={() => setDetailVisible(false)}
                footer={null}
                width={800}
            >
                {currentItem && (
                    <Descriptions bordered column={2}>
                        <Descriptions.Item label="类型" span={2}>
                            <Tag color={providerTypeMap[currentItem.providerType]?.color}>
                                {providerTypeMap[currentItem.providerType]?.text}
                            </Tag>
                        </Descriptions.Item>
                        <Descriptions.Item label="公司名称" span={2}>
                            {currentItem.companyName}
                        </Descriptions.Item>
                        <Descriptions.Item label="联系人">
                            {currentItem.contactPerson}
                        </Descriptions.Item>
                        <Descriptions.Item label="联系电话">
                            {currentItem.contactPhone}
                        </Descriptions.Item>
                        <Descriptions.Item label="营业执照" span={2}>
                            <Image src={currentItem.businessLicense} width={200} />
                        </Descriptions.Item>
                        <Descriptions.Item label="资质证书" span={2}>
                            <Image.PreviewGroup>
                                {(() => {
                                    let certList: string[] = [];
                                    if (typeof currentItem.certificates === 'string') {
                                        try {
                                            certList = JSON.parse(currentItem.certificates);
                                        } catch {
                                            certList = currentItem.certificates ? [currentItem.certificates] : [];
                                        }
                                    } else if (Array.isArray(currentItem.certificates)) {
                                        certList = currentItem.certificates;
                                    }
                                    return certList.map((cert, index) => (
                                        <Image key={index} src={cert} width={150} style={{ marginRight: 8 }} />
                                    ));
                                })()}
                            </Image.PreviewGroup>
                        </Descriptions.Item>
                        <Descriptions.Item label="提交时间" span={2}>
                            {new Date(currentItem.submitTime).toLocaleString()}
                        </Descriptions.Item>
                        {currentItem.status === 2 && (
                            <Descriptions.Item label="拒绝原因" span={2}>
                                {currentItem.rejectReason}
                            </Descriptions.Item>
                        )}
                    </Descriptions>
                )}
            </Modal>

            <Modal
                title="拒绝审核"
                open={rejectVisible}
                onOk={handleReject}
                onCancel={() => setRejectVisible(false)}
            >
                <Form form={form} layout="vertical">
                    <Form.Item label="拒绝原因" name="reason" rules={[{ required: true }]}>
                        <Input.TextArea rows={4} placeholder="请输入拒绝原因" />
                    </Form.Item>
                </Form>
            </Modal>
        </Card>
    );
};

export default ProviderAudit;
