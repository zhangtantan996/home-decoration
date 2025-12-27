import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Table, Card, Select, Tag, Button, Space, message, Switch, Descriptions, Modal, Form, Input, InputNumber } from 'antd';
import { ReloadOutlined, CheckCircleOutlined, CloseCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { adminProviderApi } from '../../services/api';

interface Provider {
    id: number;
    userId: number;
    providerType: number;
    subType: string;
    companyName: string;
    rating: number;
    verified: boolean;
    status: number;
    specialty: string;
    yearsExperience: number;
    createdAt: string;
}

const providerTypeMap: Record<number, { text: string; color: string }> = {
    1: { text: '设计师', color: 'blue' },
    2: { text: '装修公司', color: 'green' },
    3: { text: '工长', color: 'orange' },
};

const subTypeMap: Record<string, string> = {
    personal: '个人',
    studio: '工作室',
    company: '公司',
};

const ProviderList: React.FC = () => {
    const location = useLocation();
    const [loading, setLoading] = useState(false);
    const [providers, setProviders] = useState<Provider[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);
    const [providerType, setProviderType] = useState<number | undefined>();
    const [verifiedFilter, setVerifiedFilter] = useState<string | undefined>();
    const [detailVisible, setDetailVisible] = useState(false);
    const [currentProvider, setCurrentProvider] = useState<Provider | null>(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
    const [form] = Form.useForm();

    // 根据URL路径设置服务商类型
    useEffect(() => {
        if (location.pathname.includes('designers')) {
            setProviderType(1);
        } else if (location.pathname.includes('companies')) {
            setProviderType(2);
        } else if (location.pathname.includes('foremen')) {
            setProviderType(3);
        } else {
            setProviderType(undefined);
        }
        setPage(1); // 切换类型时重置页码
    }, [location.pathname]);

    useEffect(() => {
        if (providerType !== undefined || !location.pathname.match(/(designers|companies|foremen)/)) {
            loadData();
        }
    }, [page, providerType, verifiedFilter]);

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await adminProviderApi.list({
                page,
                pageSize,
                type: providerType,
                verified: verifiedFilter === 'true' ? true : verifiedFilter === 'false' ? false : undefined,
            }) as any;
            if (res.code === 0) {
                setProviders(res.data.list || []);
                setTotal(res.data.total || 0);
            }
        } catch (error) {
            console.error(error);
            message.error('加载失败');
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = async (id: number, verified: boolean) => {
        try {
            await adminProviderApi.verify(id, verified);
            message.success(verified ? '已认证' : '已取消认证');
            loadData();
        } catch (error) {
            message.error('操作失败');
        }
    };

    const handleStatusChange = async (id: number, status: number) => {
        try {
            await adminProviderApi.updateStatus(id, status);
            message.success(status === 1 ? '已启用' : '已封禁');
            loadData();
        } catch (error) {
            message.error('操作失败');
        }
    };

    const showDetail = (record: Provider) => {
        setCurrentProvider(record);
        setDetailVisible(true);
    };

    const openModal = (provider?: Provider) => {
        setEditingProvider(provider || null);
        if (provider) {
            form.setFieldsValue(provider);
        } else {
            form.resetFields();
            form.setFieldsValue({
                providerType: providerType || 1,
                subType: 'personal',
                status: 1,
            });
        }
        setModalVisible(true);
    };

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();
            if (editingProvider) {
                await adminProviderApi.update(editingProvider.id, values);
                message.success('更新成功');
            } else {
                await adminProviderApi.create(values);
                message.success('创建成功');
            }
            setModalVisible(false);
            loadData();
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
            title: '名称',
            dataIndex: 'companyName',
            render: (val: string) => val || '-',
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
            title: '子类型',
            dataIndex: 'subType',
            render: (val: string) => subTypeMap[val] || val || '-',
        },
        {
            title: '评分',
            dataIndex: 'rating',
            render: (val: number) => val?.toFixed(1) || '-',
        },
        {
            title: '经验',
            dataIndex: 'yearsExperience',
            render: (val: number) => val ? `${val}年` : '-',
        },
        {
            title: '认证状态',
            dataIndex: 'verified',
            render: (val: boolean, record: Provider) => (
                <Switch
                    checked={val}
                    checkedChildren={<CheckCircleOutlined />}
                    unCheckedChildren={<CloseCircleOutlined />}
                    onChange={(checked) => handleVerify(record.id, checked)}
                />
            ),
        },
        {
            title: '封禁状态',
            dataIndex: 'status',
            render: (val: number, record: Provider) => (
                <Switch
                    checked={val === 1}
                    checkedChildren="正常"
                    unCheckedChildren="封禁"
                    onChange={(checked) => handleStatusChange(record.id, checked ? 1 : 0)}
                />
            ),
        },
        {
            title: '操作',
            key: 'action',
            render: (_: any, record: Provider) => (
                <Space>
                    <Button type="link" size="small" onClick={() => openModal(record)}>编辑</Button>
                    <Button type="link" size="small" onClick={() => showDetail(record)}>详情</Button>
                </Space>
            ),
        },
    ];

    return (
        <Card>
            <Space style={{ marginBottom: 16 }}>
                {!location.pathname.match(/(designers|companies|foremen)/) && (
                    <Select
                        placeholder="服务商类型"
                        allowClear
                        style={{ width: 120 }}
                        value={providerType}
                        onChange={setProviderType}
                        options={[
                            { value: 1, label: '设计师' },
                            { value: 2, label: '装修公司' },
                            { value: 3, label: '工长' },
                        ]}
                    />
                )}
                <Select
                    placeholder="认证状态"
                    allowClear
                    style={{ width: 120 }}
                    value={verifiedFilter}
                    onChange={setVerifiedFilter}
                    options={[
                        { value: 'true', label: '已认证' },
                        { value: 'false', label: '未认证' },
                    ]}
                />
                <Button icon={<ReloadOutlined />} onClick={loadData}>
                    刷新
                </Button>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
                    新增服务商
                </Button>
            </Space>

            <Table
                columns={columns}
                dataSource={providers}
                rowKey="id"
                loading={loading}
                pagination={{
                    current: page,
                    pageSize,
                    total,
                    onChange: setPage,
                    showTotal: (t) => `共 ${t} 条`,
                }}
            />

            <Modal
                title="服务商详情"
                open={detailVisible}
                onCancel={() => setDetailVisible(false)}
                footer={null}
                width={600}
            >
                {currentProvider && (
                    <Descriptions column={2} bordered size="small">
                        <Descriptions.Item label="ID">{currentProvider.id}</Descriptions.Item>
                        <Descriptions.Item label="名称">{currentProvider.companyName || '-'}</Descriptions.Item>
                        <Descriptions.Item label="类型">
                            {providerTypeMap[currentProvider.providerType]?.text || '-'}
                        </Descriptions.Item>
                        <Descriptions.Item label="子类型">{subTypeMap[currentProvider.subType] || currentProvider.subType || '-'}</Descriptions.Item>
                        <Descriptions.Item label="评分">{currentProvider.rating?.toFixed(1)}</Descriptions.Item>
                        <Descriptions.Item label="经验">{currentProvider.yearsExperience}年</Descriptions.Item>
                        <Descriptions.Item label="专长" span={2}>{currentProvider.specialty || '-'}</Descriptions.Item>
                        <Descriptions.Item label="认证">
                            {currentProvider.verified ? <Tag color="green">已认证</Tag> : <Tag color="red">未认证</Tag>}
                        </Descriptions.Item>
                        <Descriptions.Item label="状态">
                            {currentProvider.status === 1 ? <Tag color="green">正常</Tag> : <Tag color="red">封禁</Tag>}
                        </Descriptions.Item>
                    </Descriptions>
                )}
            </Modal>

            <Modal
                title={editingProvider ? '编辑服务商' : '新增服务商'}
                open={modalVisible}
                onCancel={() => setModalVisible(false)}
                onOk={handleSubmit}
                width={600}
            >
                <Form form={form} layout="vertical">
                    <Form.Item name="companyName" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
                        <Input placeholder="请输入服务商名称" />
                    </Form.Item>
                    <Form.Item name="providerType" label="类型" rules={[{ required: true }]}>
                        <Select
                            disabled={!!editingProvider}
                            options={[
                                { value: 1, label: '设计师' },
                                { value: 2, label: '装修公司' },
                                { value: 3, label: '工长' },
                            ]}
                        />
                    </Form.Item>
                    <Form.Item name="subType" label="子类型">
                        <Select options={[
                            { value: 'personal', label: '个人' },
                            { value: 'studio', label: '工作室' },
                            { value: 'company', label: '公司' },
                        ]} />
                    </Form.Item>
                    <Form.Item name="specialty" label="专长">
                        <Input placeholder="如：现代简约、北欧风格" />
                    </Form.Item>
                    <Form.Item name="yearsExperience" label="从业年限">
                        <InputNumber min={0} max={50} style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item name="status" label="状态">
                        <Select options={[
                            { value: 1, label: '正常' },
                            { value: 0, label: '封禁' },
                        ]} />
                    </Form.Item>
                </Form>
            </Modal>
        </Card>
    );
};

export default ProviderList;
