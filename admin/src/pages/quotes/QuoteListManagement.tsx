import React, { useEffect, useMemo, useState } from 'react';
import {
    Button,
    Card,
    DatePicker,
    Drawer,
    Form,
    Input,
    InputNumber,
    List,
    message,
    Modal,
    Select,
    Space,
    Table,
    Tag,
    Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { adminQuoteApi, type AdminQuoteListDetail, type QuoteLibraryItem, type QuoteListSummary } from '../../services/quoteApi';

const { Title, Text } = Typography;

type LibrarySelection = Record<number, number>;

const statusColorMap: Record<string, string> = {
    draft: 'default',
    quoting: 'processing',
    locked: 'warning',
    awarded: 'success',
    closed: 'default',
};

const QuoteListManagement: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [createVisible, setCreateVisible] = useState(false);
    const [drawerVisible, setDrawerVisible] = useState(false);
    const [libraryVisible, setLibraryVisible] = useState(false);
    const [rows, setRows] = useState<QuoteListSummary[]>([]);
    const [detail, setDetail] = useState<AdminQuoteListDetail | null>(null);
    const [libraryRows, setLibraryRows] = useState<QuoteLibraryItem[]>([]);
    const [providerOptions, setProviderOptions] = useState<Array<{ label: string; value: number }>>([]);
    const [selectedLibraryKeys, setSelectedLibraryKeys] = useState<React.Key[]>([]);
    const [librarySelection, setLibrarySelection] = useState<LibrarySelection>({});
    const [inviteProviderIds, setInviteProviderIds] = useState<number[]>([]);
    const [form] = Form.useForm();

    const loadQuoteLists = async () => {
        try {
            setLoading(true);
            const data = await adminQuoteApi.listQuoteLists({ page: 1, pageSize: 100 });
            setRows(data.list || []);
        } catch (error: any) {
            message.error(error?.message || '加载报价清单失败');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadQuoteLists();
    }, []);

    const loadLibraryRows = async () => {
        try {
            const data = await adminQuoteApi.listLibraryItems({ page: 1, pageSize: 200, status: 1 });
            setLibraryRows(data.list || []);
        } catch (error: any) {
            message.error(error?.message || '加载报价库失败');
        }
    };

    const loadProviders = async () => {
        try {
            const providers = await adminQuoteApi.listProviders();
            const options = providers.map((provider) => ({
                value: provider.id,
                label: `${provider.companyName || `服务商#${provider.id}`} · ${provider.providerType === 3 ? '工长' : '装修公司'}`,
            }));
            setProviderOptions(options);
        } catch (error: any) {
            message.error(error?.message || '加载服务商失败');
        }
    };

    const openDetail = async (id: number) => {
        try {
            setLoading(true);
            const [detailData] = await Promise.all([
                adminQuoteApi.getQuoteListDetail(id),
                loadProviders(),
            ]);
            setDetail(detailData);
            setDrawerVisible(true);
        } catch (error: any) {
            message.error(error?.message || '加载报价清单详情失败');
        } finally {
            setLoading(false);
        }
    };

    const columns: ColumnsType<QuoteListSummary> = useMemo(() => [
        { title: '清单标题', dataIndex: 'title', key: 'title' },
        { title: '方案', dataIndex: 'scenarioType', key: 'scenarioType', width: 120, render: (value?: string) => value || '-' },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            width: 100,
            render: (value: string) => <Tag color={statusColorMap[value] || 'default'}>{value}</Tag>,
        },
        { title: '条目数', dataIndex: 'itemCount', key: 'itemCount', width: 90 },
        { title: '邀请数', dataIndex: 'invitationCount', key: 'invitationCount', width: 90 },
        { title: '报价数', dataIndex: 'submissionCount', key: 'submissionCount', width: 90 },
        {
            title: '操作',
            key: 'actions',
            width: 260,
            render: (_value, record) => (
                <Space>
                    <Button onClick={() => void openDetail(record.id)}>管理</Button>
                    <Button onClick={() => navigate(`/projects/quotes/compare/${record.id}`)}>对比 / 定标</Button>
                </Space>
            ),
        },
    ], [navigate]);

    const handleCreate = async () => {
        try {
            const values = await form.validateFields();
            setSubmitting(true);
            const created = await adminQuoteApi.createQuoteList({
                projectId: values.projectId,
                customerId: values.customerId,
                houseId: values.houseId,
                ownerUserId: values.ownerUserId,
                scenarioType: values.scenarioType,
                title: values.title,
                currency: values.currency || 'CNY',
                deadlineAt: adminQuoteApi.normalizeDeadlineInput(values.deadlineAt),
            });
            message.success('报价清单已创建');
            setCreateVisible(false);
            form.resetFields();
            await loadQuoteLists();
            await openDetail(created.id);
        } catch (error: any) {
            if (error?.errorFields) return;
            message.error(error?.message || '创建报价清单失败');
        } finally {
            setSubmitting(false);
        }
    };

    const handleOpenLibrary = async () => {
        await loadLibraryRows();
        setSelectedLibraryKeys([]);
        setLibrarySelection({});
        setLibraryVisible(true);
    };

    const handleAppendItems = async () => {
        if (!detail) return;
        const selectedItems = libraryRows.filter((item) => selectedLibraryKeys.includes(item.id));
        if (!selectedItems.length) {
            message.warning('请先选择报价库条目');
            return;
        }
        try {
            setSubmitting(true);
            await adminQuoteApi.batchUpsertItems(
                detail.quoteList.id,
                selectedItems.map((item, index) => ({
                    standardItemId: item.id,
                    lineNo: detail.items.length + index + 1,
                    name: item.name,
                    unit: item.unit,
                    quantity: librarySelection[item.id] || 1,
                    pricingNote: item.pricingNote,
                    categoryL1: item.categoryL1,
                    categoryL2: item.categoryL2,
                    sortOrder: detail.items.length + index + 1,
                }))
            );
            message.success('清单条目已添加');
            setLibraryVisible(false);
            await openDetail(detail.quoteList.id);
            await loadQuoteLists();
        } catch (error: any) {
            message.error(error?.message || '添加清单条目失败');
        } finally {
            setSubmitting(false);
        }
    };

    const handleInviteProviders = async () => {
        if (!detail || !inviteProviderIds.length) {
            message.warning('请选择要邀请的服务商');
            return;
        }
        try {
            setSubmitting(true);
            await adminQuoteApi.inviteProviders(detail.quoteList.id, inviteProviderIds);
            message.success('邀请已发送');
            setInviteProviderIds([]);
            await openDetail(detail.quoteList.id);
            await loadQuoteLists();
        } catch (error: any) {
            message.error(error?.message || '邀请失败');
        } finally {
            setSubmitting(false);
        }
    };

    const handleStart = async () => {
        if (!detail) return;
        try {
            setSubmitting(true);
            await adminQuoteApi.startQuoteList(detail.quoteList.id);
            message.success('报价清单已进入报价中');
            await openDetail(detail.quoteList.id);
            await loadQuoteLists();
        } catch (error: any) {
            message.error(error?.message || '发起报价失败');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div>
            <Card style={{ marginBottom: 16 }}>
                <Space align="baseline" style={{ width: '100%', justifyContent: 'space-between' }}>
                    <div>
                        <Title level={4} style={{ margin: 0 }}>报价清单管理</Title>
                        <Text type="secondary">admin 负责创建清单、配置条目、邀请服务商并发起报价。</Text>
                    </div>
                    <Space>
                        <Button icon={<ReloadOutlined />} onClick={() => void loadQuoteLists()} loading={loading}>刷新</Button>
                        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateVisible(true)}>新建清单</Button>
                    </Space>
                </Space>
            </Card>

            <Card>
                <Table rowKey="id" loading={loading} columns={columns} dataSource={rows} pagination={{ pageSize: 10 }} />
            </Card>

            <Modal
                title="新建报价清单"
                open={createVisible}
                onCancel={() => setCreateVisible(false)}
                onOk={() => void handleCreate()}
                confirmLoading={submitting}
                destroyOnClose
            >
                <Form form={form} layout="vertical">
                    <Form.Item name="title" label="清单标题" rules={[{ required: true, message: '请填写清单标题' }]}>
                        <Input placeholder="例如：龙湖天街-方案A基础施工清单" />
                    </Form.Item>
                    <Space style={{ width: '100%' }} align="start">
                        <Form.Item name="scenarioType" label="方案标识" style={{ flex: 1 }}>
                            <Input placeholder="base / plan_a / plan_b" />
                        </Form.Item>
                        <Form.Item name="currency" label="币种" initialValue="CNY" style={{ width: 120 }}>
                            <Input />
                        </Form.Item>
                    </Space>
                    <Space style={{ width: '100%' }} align="start">
                        <Form.Item name="projectId" label="项目ID" style={{ flex: 1 }}>
                            <InputNumber min={0} style={{ width: '100%' }} />
                        </Form.Item>
                        <Form.Item name="customerId" label="客户ID" style={{ flex: 1 }}>
                            <InputNumber min={0} style={{ width: '100%' }} />
                        </Form.Item>
                    </Space>
                    <Space style={{ width: '100%' }} align="start">
                        <Form.Item name="houseId" label="房屋ID" style={{ flex: 1 }}>
                            <InputNumber min={0} style={{ width: '100%' }} />
                        </Form.Item>
                        <Form.Item name="ownerUserId" label="创建人用户ID" style={{ flex: 1 }}>
                            <InputNumber min={0} style={{ width: '100%' }} />
                        </Form.Item>
                    </Space>
                    <Form.Item name="deadlineAt" label="截止时间">
                        <DatePicker showTime style={{ width: '100%' }} />
                    </Form.Item>
                </Form>
            </Modal>

            <Drawer
                title={detail?.quoteList.title || '报价清单管理'}
                width={980}
                open={drawerVisible}
                onClose={() => setDrawerVisible(false)}
                destroyOnClose
            >
                {detail && (
                    <Space direction="vertical" size={16} style={{ width: '100%' }}>
                        <Card size="small">
                            <Space direction="vertical" size={8} style={{ width: '100%' }}>
                                <Text>状态：<Tag color={statusColorMap[detail.quoteList.status] || 'default'}>{detail.quoteList.status}</Tag></Text>
                                <Text>条目数：{detail.items.length}，邀请数：{detail.invitations.length}，报价数：{detail.submissionCount}</Text>
                                <Space>
                                    <Button onClick={() => void handleOpenLibrary()} disabled={detail.quoteList.status !== 'draft'}>从报价库添加条目</Button>
                                    <Button onClick={() => navigate(`/projects/quotes/compare/${detail.quoteList.id}`)}>进入对比页</Button>
                                    <Button type="primary" onClick={() => void handleStart()} disabled={detail.quoteList.status !== 'draft' || detail.items.length === 0}>
                                        发起报价
                                    </Button>
                                </Space>
                            </Space>
                        </Card>

                        <Card size="small" title="当前清单条目">
                            <List
                                dataSource={detail.items}
                                renderItem={(item) => (
                                    <List.Item>
                                        <Space direction="vertical" size={2}>
                                            <Text strong>{item.name}</Text>
                                            <Text type="secondary">{item.categoryL1 || '-'} / {item.unit} / 数量 {item.quantity}</Text>
                                        </Space>
                                    </List.Item>
                                )}
                            />
                        </Card>

                        <Card size="small" title="邀请服务商">
                            <Space direction="vertical" style={{ width: '100%' }}>
                                <Select
                                    mode="multiple"
                                    style={{ width: '100%' }}
                                    placeholder="选择要邀请的装修公司 / 工长"
                                    options={providerOptions}
                                    value={inviteProviderIds}
                                    onChange={(values) => setInviteProviderIds(values)}
                                    disabled={detail.quoteList.status !== 'draft'}
                                />
                                <Space>
                                    <Button type="primary" onClick={() => void handleInviteProviders()} loading={submitting} disabled={detail.quoteList.status !== 'draft'}>
                                        发送邀请
                                    </Button>
                                </Space>
                                <List
                                    size="small"
                                    dataSource={detail.invitations}
                                    locale={{ emptyText: '暂无邀请记录' }}
                                    renderItem={(item) => (
                                        <List.Item>
                                            <Text>Provider #{item.providerId} · {item.status}</Text>
                                        </List.Item>
                                    )}
                                />
                            </Space>
                        </Card>
                    </Space>
                )}
            </Drawer>

            <Modal
                title="从报价库添加条目"
                open={libraryVisible}
                width={1080}
                onCancel={() => setLibraryVisible(false)}
                onOk={() => void handleAppendItems()}
                confirmLoading={submitting}
                destroyOnClose
            >
                <Table
                    rowKey="id"
                    dataSource={libraryRows}
                    pagination={{ pageSize: 8 }}
                    rowSelection={{
                        selectedRowKeys: selectedLibraryKeys,
                        onChange: (keys) => setSelectedLibraryKeys(keys),
                    }}
                    columns={[
                        { title: '项目名称', dataIndex: 'name', key: 'name' },
                        { title: '单位', dataIndex: 'unit', key: 'unit', width: 90 },
                        { title: '分类', key: 'category', width: 160, render: (_value, record) => `${record.categoryL1 || '-'} / ${record.categoryL2 || '-'}` },
                        {
                            title: '数量',
                            key: 'quantity',
                            width: 120,
                            render: (_value, record) => (
                                <InputNumber
                                    min={0.01}
                                    step={1}
                                    style={{ width: '100%' }}
                                    value={librarySelection[record.id] || 1}
                                    onChange={(value) => setLibrarySelection((prev) => ({ ...prev, [record.id]: Number(value || 1) }))}
                                />
                            ),
                        },
                    ]}
                />
            </Modal>
        </div>
    );
};

export default QuoteListManagement;
