import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Table, Card, Select, Tag, Button, Space, message, Switch, Descriptions, Modal, Form, Input, InputNumber } from 'antd';
import { ReloadOutlined, CheckCircleOutlined, CloseCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { adminProviderApi } from '../../services/api';
import { PermissionWrapper } from '../../components/PermissionWrapper';

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
    restoreRate?: number;
    budgetControl?: number;
    // 移动端详情页字段
    priceMin: number;
    priceMax: number;
    priceUnit: string;
    coverImage: string;
    serviceIntro: string;
    teamSize: number;
    establishedYear: number;
    certifications: string;
    serviceArea: string;
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
    const [currentFormType, setCurrentFormType] = useState<number>(1); // 当前表单的服务商类型

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
            setCurrentFormType(provider.providerType);
        } else {
            form.resetFields();
            const newType = providerType || 1;
            form.setFieldsValue({
                providerType: newType,
                subType: 'personal',
                status: 1,
            });
            setCurrentFormType(newType);
        }
        setModalVisible(true);
    };

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();

            // 根据服务商类型清理不相关的字段
            const cleanedValues = { ...values };
            if (currentFormType === 1 || currentFormType === 3) {
                delete cleanedValues.teamSize;
                delete cleanedValues.establishedYear;
            }

            if (editingProvider) {
                await adminProviderApi.update(editingProvider.id, cleanedValues);
                message.success('更新成功');
            } else {
                await adminProviderApi.create(cleanedValues);
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
            title: '还原度',
            dataIndex: 'restoreRate',
            render: (val: number) => val ? `${val}%` : '-',
        },
        {
            title: '预算',
            dataIndex: 'budgetControl',
            render: (val: number) => val ? `${val}%` : '-',
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
                <PermissionWrapper permission={[
                    'provider:designer:verify',
                    'provider:company:verify',
                    'provider:foreman:verify'
                ]}>
                    <Switch
                        checked={val}
                        checkedChildren={<CheckCircleOutlined />}
                        unCheckedChildren={<CloseCircleOutlined />}
                        onChange={(checked) => handleVerify(record.id, checked)}
                    />
                </PermissionWrapper>
            ),
        },
        {
            title: '封禁状态',
            dataIndex: 'status',
            render: (val: number, record: Provider) => (
                <PermissionWrapper permission={[
                    'provider:designer:status',
                    'provider:company:status',
                    'provider:foreman:status'
                ]}>
                    <Switch
                        checked={val === 1}
                        checkedChildren="正常"
                        unCheckedChildren="封禁"
                        onChange={(checked) => handleStatusChange(record.id, checked ? 1 : 0)}
                    />
                </PermissionWrapper>
            ),
        },
        {
            title: '操作',
            key: 'action',
            render: (_: any, record: Provider) => (
                <Space>
                    <PermissionWrapper permission={[
                        'provider:designer:edit',
                        'provider:company:edit',
                        'provider:foreman:edit'
                    ]}>
                        <Button type="link" size="small" onClick={() => openModal(record)}>编辑</Button>
                    </PermissionWrapper>
                    <PermissionWrapper permission={[
                        'provider:designer:view',
                        'provider:company:view',
                        'provider:foreman:view'
                    ]}>
                        <Button type="link" size="small" onClick={() => showDetail(record)}>详情</Button>
                    </PermissionWrapper>
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
                <PermissionWrapper permission={[
                    'provider:designer:create',
                    'provider:company:create',
                    'provider:foreman:create'
                ]}>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
                        新增服务商
                    </Button>
                </PermissionWrapper>
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
                width={800}
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

                        {/* 移动端详情页字段 */}
                        <Descriptions.Item label="价格范围" span={2}>
                            {currentProvider.priceMin && currentProvider.priceMax
                                ? `¥${currentProvider.priceMin}-${currentProvider.priceMax}${currentProvider.priceUnit || ''}`
                                : '-'}
                        </Descriptions.Item>
                        <Descriptions.Item label="服务介绍" span={2}>{currentProvider.serviceIntro || '-'}</Descriptions.Item>
                        <Descriptions.Item label="服务区域" span={2}>{currentProvider.serviceArea || '-'}</Descriptions.Item>
                        <Descriptions.Item label="团队规模">{currentProvider.teamSize || '-'}</Descriptions.Item>
                        <Descriptions.Item label="成立年份">{currentProvider.establishedYear || '-'}</Descriptions.Item>
                        <Descriptions.Item label="资质认证" span={2}>{currentProvider.certifications || '-'}</Descriptions.Item>
                        <Descriptions.Item label="封面图" span={2}>
                            {currentProvider.coverImage ? (
                                <img src={currentProvider.coverImage} alt="封面" style={{ maxWidth: '100%', maxHeight: 200 }} />
                            ) : '-'}
                        </Descriptions.Item>

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
                title={editingProvider ? '编辑服务商详情' : '新增服务商'}
                open={modalVisible}
                onCancel={() => setModalVisible(false)}
                onOk={handleSubmit}
                width={800}
            >
                <Form form={form} layout="vertical">
                    <Form.Item name="companyName" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
                        <Input placeholder="请输入服务商名称" />
                    </Form.Item>
                    <Form.Item name="providerType" label="类型" rules={[{ required: true }]}>
                        <Select
                            disabled={!!editingProvider}
                            onChange={(val) => setCurrentFormType(val)}
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
                    <Form.Item name="specialty" label="专长/标签">
                        <Select
                            mode="tags"
                            placeholder="输入标签后回车，如：现代简约"
                            options={[
                                { value: '现代简约', label: '现代简约' },
                                { value: '法式复古', label: '法式复古' },
                                { value: '其他', label: '其他' },
                            ]}
                        />
                    </Form.Item>
                    <Form.Item name="yearsExperience" label="从业年限">
                        <InputNumber min={0} max={50} style={{ width: '100%' }} />
                    </Form.Item>

                    {/* 移动端详情页字段 */}
                    <Form.Item name="coverImage" label="封面背景图">
                        <Input placeholder="请输入图片URL，如：https://..." />
                    </Form.Item>
                    <Form.Item name="serviceIntro" label="服务介绍">
                        <Input.TextArea rows={4} placeholder="请输入服务介绍、设计理念或公司简介" />
                    </Form.Item>


                    <div style={{ display: 'flex', gap: 16 }}>
                        <Form.Item name="priceMin" label="最低价格" style={{ flex: 1 }}>
                            <InputNumber min={0} style={{ width: '100%' }} placeholder="如：300" />
                        </Form.Item>
                        <Form.Item name="priceMax" label="最高价格" style={{ flex: 1 }}>
                            <InputNumber min={0} style={{ width: '100%' }} placeholder="如：500" />
                        </Form.Item>
                        <Form.Item name="priceUnit" label="价格单位" style={{ flex: 1 }}>
                            <Select
                                placeholder="选择单位"
                                options={
                                    currentFormType === 1
                                        ? [{ value: '元/㎡', label: '元/㎡' }, { value: '元/套', label: '元/套' }]
                                        : currentFormType === 2
                                            ? [{ value: '元/㎡', label: '元/㎡' }, { value: '元/套', label: '元/套' }]
                                            : [{ value: '元/天', label: '元/天' }, { value: '元/㎡', label: '元/㎡' }]
                                }
                            />
                        </Form.Item>
                    </div>

                    {/* 装修公司专属字段：团队规模和成立年份 */}
                    {currentFormType === 2 && (
                        <>
                            <Form.Item
                                name="teamSize"
                                label="团队规模"
                                rules={[{ required: true, message: '装修公司必须填写团队规模' }]}
                            >
                                <InputNumber min={1} style={{ width: '100%' }} placeholder="如：20人" />
                            </Form.Item>
                            <Form.Item
                                name="establishedYear"
                                label="成立年份"
                                rules={[{ required: true, message: '装修公司必须填写成立年份' }]}
                            >
                                <InputNumber min={1980} max={new Date().getFullYear()} style={{ width: '100%' }} placeholder="如：2015" />
                            </Form.Item>
                        </>
                    )}

                    <Form.Item name="certifications" label="资质认证（JSON数组）">
                        <Input.TextArea
                            rows={2}
                            placeholder={
                                currentFormType === 1
                                    ? '如：["国家注册室内设计师","红点设计奖"]'
                                    : currentFormType === 2
                                        ? '如：["建筑装饰装修工程专业承包壹级","设计甲级资质"]'
                                        : '如：["电工上岗证","高级技工证书"]'
                            }
                        />
                    </Form.Item>
                    <Form.Item name="serviceArea" label="服务区域（JSON数组）">
                        <Input.TextArea rows={2} placeholder='如：["雁塔区","曲江新区","高新区"]' />
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
