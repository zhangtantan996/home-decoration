import React, { useEffect, useState } from 'react';
import { Table, Card, Select, Tag, Button, Space, message, Switch, Modal, Form, Input, InputNumber, Tooltip, Typography, Descriptions } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { adminMaterialShopApi, type AdminMaterialShopListItem } from '../../services/api';
import { PermissionWrapper } from '../../components/PermissionWrapper';
import PageHeader from '../../components/PageHeader';
import ToolbarCard from '../../components/ToolbarCard';
import AuditStatusSummary from '../audits/components/AuditStatusSummary';
import VisibilityStatusPanel from '../audits/components/VisibilityStatusPanel';
import {
    ACCOUNT_BOUND_STATUS_META,
    LEGACY_PATH_BADGE,
    LOGIN_ENABLED_STATUS_META,
    MATERIAL_SHOP_TYPE_META,
    MATERIAL_SHOP_TYPE_OPTIONS,
    MERCHANT_ONBOARDING_STATUS_META,
    PUBLIC_VISIBILITY_META,
    SETTLED_FILTER_OPTIONS,
    VERIFICATION_STATUS_META,
} from '../../constants/statuses';

interface MaterialShop extends AdminMaterialShopListItem {}

const { Text } = Typography;

const resolveVisibilityTag = (shop: MaterialShop) => {
    const isVisible = shop.visibility?.publicVisible;
    const config = PUBLIC_VISIBILITY_META[isVisible === true ? 'true' : isVisible === false ? 'false' : 'unknown'];
    return <Tag color={config.color}>{config.text}</Tag>;
};

const renderStatusTag = (shop: MaterialShop) => (
    <Tag color={(shop.status ?? 1) === 1 ? 'success' : 'error'}>
        {(shop.status ?? 1) === 1 ? '正常' : '封禁'}
    </Tag>
);

const resolveOnboardingStatusTag = (shop: MaterialShop) => {
    const accountBound = shop.accountBound ?? Boolean(shop.userId);
    if (!accountBound) {
        return <Text type="secondary">-</Text>;
    }

    const onboardingStatus = shop.completionRequired ? (shop.onboardingStatus || 'required') : 'approved';
    const meta = MERCHANT_ONBOARDING_STATUS_META[onboardingStatus] || MERCHANT_ONBOARDING_STATUS_META.unknown;
    return <Tag color={meta.color}>{meta.text}</Tag>;
};

const resolveOperatingStatusTag = (shop: MaterialShop) => {
    const accountBound = shop.accountBound ?? Boolean(shop.userId);
    if (!accountBound) {
        return <Tag color="default">未开通</Tag>;
    }

    return shop.operatingEnabled ? (
        <Tag color="green">已开放</Tag>
    ) : (
        <Tag color="orange">受限</Tag>
    );
};

const renderBlockerSummary = (shop: MaterialShop) => {
    const blockers = shop.visibility?.blockers || [];
    if (blockers.length === 0) {
        return <Text type="secondary">-</Text>;
    }

    const first = blockers[0]?.message || '-';
    const summary = blockers.length > 1 ? `${first} + ${blockers.length - 1} 条` : first;

    return (
        <Tooltip
            title={
                <div style={{ maxWidth: 360 }}>
                    {blockers.map((item) => (
                        <div key={item.code || item.message} style={{ marginBottom: 4, whiteSpace: 'normal' }}>
                            {item.message}
                        </div>
                    ))}
                </div>
            }
        >
            <Text ellipsis style={{ display: 'inline-block', maxWidth: 240 }}>
                {summary}
            </Text>
        </Tooltip>
    );
};

const MaterialShopList: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [shops, setShops] = useState<MaterialShop[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);
    const [typeFilter, setTypeFilter] = useState<string | undefined>();
    const [settledFilter, setSettledFilter] = useState<string | undefined>();
    const [modalVisible, setModalVisible] = useState(false);
    const [editingShop, setEditingShop] = useState<MaterialShop | null>(null);
    const [detailVisible, setDetailVisible] = useState(false);
    const [currentShop, setCurrentShop] = useState<MaterialShop | null>(null);
    const [form] = Form.useForm();
    const [accountModalVisible, setAccountModalVisible] = useState(false);
    const [accountSubmitting, setAccountSubmitting] = useState(false);
    const [accountTargetShop, setAccountTargetShop] = useState<MaterialShop | null>(null);
    const [accountForm] = Form.useForm();

    useEffect(() => {
        loadData();
    }, [page, typeFilter, settledFilter]);

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await adminMaterialShopApi.list({ page, pageSize, type: typeFilter, isSettled: settledFilter === 'true' ? true : settledFilter === 'false' ? false : undefined }) as any;
            if (res.code === 0) {
                setShops(res.data.list || []);
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
            await adminMaterialShopApi.verify(id, verified);
            message.success(verified ? '已认证' : '已取消认证');
            loadData();
        } catch (error) {
            message.error('操作失败');
        }
    };

    const handleStatusChange = async (id: number, status: number) => {
        try {
            await adminMaterialShopApi.updateStatus(id, status);
            message.success(status === 1 ? '已解封' : '已封禁');
            loadData();
        } catch (error) {
            message.error('操作失败');
        }
    };

    const handleToggleSettled = async (id: number, settled: boolean) => {
        try {
            await adminMaterialShopApi.update(id, { isSettled: settled });
            message.success(settled ? '已标记为入驻' : '已标记为未入驻');
            loadData();
        } catch (error) {
            message.error('操作失败');
        }
    };

    const handleDelete = async (id: number) => {
        Modal.confirm({
            title: '确认删除',
            content: '确定要删除这个门店吗？',
            onOk: async () => {
                try {
                    await adminMaterialShopApi.delete(id);
                    message.success('删除成功');
                    loadData();
                } catch (error) {
                    message.error('删除失败');
                }
            },
        });
    };

    const showDetail = (shop: MaterialShop) => {
        setCurrentShop(shop);
        setDetailVisible(true);
    };

    const openModal = (shop?: MaterialShop) => {
        setEditingShop(shop || null);
        if (shop) {
            form.setFieldsValue(shop);
        } else {
            form.resetFields();
        }
        setModalVisible(true);
    };

    const openAccountModal = (shop: MaterialShop) => {
        setAccountTargetShop(shop);
        accountForm.setFieldsValue({
            phone: shop.userPhone || '',
            contactName: shop.contactName || '',
            nickname: shop.userNickname || shop.contactName || shop.name || '',
        });
        setAccountModalVisible(true);
    };

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();
            if (editingShop) {
                await adminMaterialShopApi.update(editingShop.id, values);
                message.success('更新成功');
            } else {
                await adminMaterialShopApi.create({ ...values, isSettled: false });
                message.success('创建成功（未入驻状态）');
            }
            setModalVisible(false);
            loadData();
        } catch (error: any) {
            message.error(error?.message || '操作失败');
        }
    };

    const handleCompleteAccount = async () => {
        if (!accountTargetShop) return;
        try {
            const values = await accountForm.validateFields();
            setAccountSubmitting(true);
            const res = await adminMaterialShopApi.completeAccount(accountTargetShop.id, values) as any;
            if (res.code === 0) {
                message.success('账号已绑定，首次登录将补全正式入驻资料');
                setAccountModalVisible(false);
                setAccountTargetShop(null);
                accountForm.resetFields();
                loadData();
            } else {
                message.error(res.message || '补全账号失败');
            }
        } catch (error: any) {
            if (error?.errorFields) return;
            message.error(error?.message || '补全账号失败');
        } finally {
            setAccountSubmitting(false);
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
            dataIndex: 'name',
        },
        {
            title: '类型',
            dataIndex: 'type',
            render: (val: string) => <Tag color={MATERIAL_SHOP_TYPE_META[val]?.color || 'default'}>{MATERIAL_SHOP_TYPE_META[val]?.text || val}</Tag>,
        },
        {
            title: '入驻状态',
            dataIndex: 'isSettled',
            key: 'isSettled',
            width: 100,
            render: (val: boolean, record: MaterialShop) => (
                <Switch
                    checked={val ?? true}
                    checkedChildren="已入驻"
                    unCheckedChildren="未入驻"
                    onChange={(checked) => handleToggleSettled(record.id, checked)}
                />
            ),
        },
        {
            title: '账号状态',
            key: 'accountBound',
            render: (_: any, record: MaterialShop) => (
                <Tag color={ACCOUNT_BOUND_STATUS_META[String(Boolean(record.accountBound))].color}>
                    {ACCOUNT_BOUND_STATUS_META[String(Boolean(record.accountBound))].text}
                </Tag>
            ),
        },
        {
            title: '关联手机号',
            dataIndex: 'userPhone',
            render: (val: string) => val || '-',
        },
        {
            title: '登录后台',
            key: 'loginEnabled',
            render: (_: any, record: MaterialShop) => (
                <Tag color={LOGIN_ENABLED_STATUS_META[String(Boolean(record.loginEnabled))].color}>
                    {LOGIN_ENABLED_STATUS_META[String(Boolean(record.loginEnabled))].text}
                </Tag>
            ),
        },
        {
            title: '补全状态',
            key: 'onboardingStatus',
            render: (_: any, record: MaterialShop) => resolveOnboardingStatusTag(record),
        },
        {
            title: '经营权限',
            key: 'operatingEnabled',
            render: (_: any, record: MaterialShop) => resolveOperatingStatusTag(record),
        },
        {
            title: '来源',
            dataIndex: 'sourceLabel',
            render: (val: string) => val || '-',
        },
        {
            title: '评分',
            dataIndex: 'rating',
            render: (val: number) => val?.toFixed(1) || '-',
        },
        {
            title: '评价数',
            dataIndex: 'reviewCount',
        },
        {
            title: '主营产品',
            dataIndex: 'mainProducts',
            ellipsis: true,
            render: (val: string) => {
                try {
                    return val ? JSON.parse(val).join(', ') : '-';
                } catch {
                    return val || '-';
                }
            },
        },
        {
            title: '地址',
            dataIndex: 'address',
            ellipsis: true,
        },
        {
            title: '公开状态',
            key: 'publicVisible',
            width: 120,
            render: (_: any, record: MaterialShop) => (
                <Space size={4} wrap>
                    {resolveVisibilityTag(record)}
                    {record.legacyInfo?.isLegacyPath && <Tag color={LEGACY_PATH_BADGE.color}>{LEGACY_PATH_BADGE.text}</Tag>}
                </Space>
            ),
        },
        {
            title: '阻断摘要',
            key: 'blockerSummary',
            ellipsis: true,
            render: (_: any, record: MaterialShop) => renderBlockerSummary(record),
        },
        {
            title: '认证',
            dataIndex: 'isVerified',
            render: (val: boolean, record: MaterialShop) => (
                <Switch
                    checked={val}
                    onChange={(checked) => handleVerify(record.id, checked)}
                />
            ),
        },
        {
            title: '封禁状态',
            dataIndex: 'status',
            render: (_: number | null | undefined, record: MaterialShop) => (
                <PermissionWrapper permission="material:shop:edit">
                    <Switch
                        checked={(record.status ?? 1) === 1}
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
            render: (_: any, record: MaterialShop) => (
                <Space>
                    {!record.accountBound && (
                        <Button type="link" size="small" onClick={() => openAccountModal(record)}>
                            认领账号
                        </Button>
                    )}
                    <Button type="link" size="small" onClick={() => openModal(record)}>编辑</Button>
                    <Button type="link" size="small" onClick={() => showDetail(record)}>详情</Button>
                    <Button type="link" size="small" danger onClick={() => handleDelete(record.id)}>删除</Button>
                </Space>
            ),
        },
    ];

    return (
        <div className="hz-page-stack">
            <PageHeader
                title="主材门店管理"
                description="查看主材商账号绑定、补全状态、经营权限、公开状态和基础经营信息。"
            />

            <ToolbarCard>
                <div className="hz-toolbar">
                <Select
                    placeholder="门店类型"
                    allowClear
                    style={{ width: 120 }}
                    value={typeFilter}
                    onChange={setTypeFilter}
                    options={MATERIAL_SHOP_TYPE_OPTIONS}
                />
                <Select
                    allowClear
                    placeholder="入驻状态"
                    style={{ width: 120 }}
                    value={settledFilter}
                    onChange={(val) => { setSettledFilter(val); setPage(1); }}
                    options={SETTLED_FILTER_OPTIONS}
                />
                <Button icon={<ReloadOutlined />} onClick={loadData}>刷新</Button>
                <Button type="primary" onClick={() => openModal()}>新增门店</Button>
                </div>
            </ToolbarCard>

            <Card className="hz-table-card">
                <Table
                    columns={columns}
                    dataSource={shops}
                    rowKey="id"
                    loading={loading}
                    scroll={{ x: 'max-content' }}
                    pagination={{
                        current: page,
                        pageSize,
                        total,
                        onChange: setPage,
                        showTotal: (t) => `共 ${t} 条`,
                    }}
                />
            </Card>

            {/* 详情弹窗 */}
            <Modal
                title="门店详情"
                open={detailVisible}
                onCancel={() => setDetailVisible(false)}
                footer={null}
                width={800}
            >
                {currentShop && (
                    <Space direction="vertical" size={12} style={{ width: '100%' }}>
                        <AuditStatusSummary
                            visibility={currentShop.visibility}
                            rejectResubmittable={currentShop.actions?.rejectResubmittable}
                            legacyInfo={currentShop.legacyInfo}
                        />
                        <Descriptions column={2} bordered size="small">
                            <Descriptions.Item label="ID">{currentShop.id}</Descriptions.Item>
                            <Descriptions.Item label="名称">{currentShop.name}</Descriptions.Item>
                            <Descriptions.Item label="账号状态">
                                <Tag color={ACCOUNT_BOUND_STATUS_META[String(Boolean(currentShop.accountBound))].color}>
                                    {ACCOUNT_BOUND_STATUS_META[String(Boolean(currentShop.accountBound))].text}
                                </Tag>
                            </Descriptions.Item>
                            <Descriptions.Item label="关联手机号">{currentShop.userPhone || '-'}</Descriptions.Item>
                            <Descriptions.Item label="类型">
                                <Tag color={MATERIAL_SHOP_TYPE_META[currentShop.type]?.color || 'default'}>
                                    {MATERIAL_SHOP_TYPE_META[currentShop.type]?.text || currentShop.type}
                                </Tag>
                            </Descriptions.Item>
                            <Descriptions.Item label="登录后台">
                                <Tag color={LOGIN_ENABLED_STATUS_META[String(Boolean(currentShop.loginEnabled))].color}>
                                    {LOGIN_ENABLED_STATUS_META[String(Boolean(currentShop.loginEnabled))].text}
                                </Tag>
                            </Descriptions.Item>
                            <Descriptions.Item label="补全状态">
                                {resolveOnboardingStatusTag(currentShop)}
                            </Descriptions.Item>
                            <Descriptions.Item label="经营权限">
                                {resolveOperatingStatusTag(currentShop)}
                            </Descriptions.Item>
                            <Descriptions.Item label="来源">{currentShop.sourceLabel || '-'}</Descriptions.Item>
                            <Descriptions.Item label="认证状态">
                                <Tag color={VERIFICATION_STATUS_META[String(Boolean(currentShop.isVerified))].color}>
                                    {VERIFICATION_STATUS_META[String(Boolean(currentShop.isVerified))].text}
                                </Tag>
                            </Descriptions.Item>
                            <Descriptions.Item label="封禁状态">
                                {renderStatusTag(currentShop)}
                            </Descriptions.Item>
                            <Descriptions.Item label="评分">{currentShop.rating?.toFixed(1) || '-'}</Descriptions.Item>
                            <Descriptions.Item label="评价数">{currentShop.reviewCount || 0}</Descriptions.Item>

                            {currentShop.brandLogo && (
                                <Descriptions.Item label="品牌Logo" span={2}>
                                    <img src={currentShop.brandLogo} alt="Logo" style={{ maxWidth: 100, maxHeight: 50 }} />
                                </Descriptions.Item>
                            )}

                            <Descriptions.Item label="封面图" span={2}>
                                {currentShop.cover ? (
                                    <img src={currentShop.cover} alt="封面" style={{ maxWidth: '100%', maxHeight: 200 }} />
                                ) : '-'}
                            </Descriptions.Item>

                            <Descriptions.Item label="主营产品" span={2}>
                                <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                                    {(() => {
                                        try {
                                            return currentShop.mainProducts ? JSON.parse(currentShop.mainProducts).join('、') : '-';
                                        } catch {
                                            return currentShop.mainProducts || '-';
                                        }
                                    })()}
                                </div>
                            </Descriptions.Item>

                            <Descriptions.Item label="产品分类" span={2}>
                                <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                                    {currentShop.productCategories || '-'}
                                </div>
                            </Descriptions.Item>

                            <Descriptions.Item label="地址" span={2}>
                                <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                                    {currentShop.address || '-'}
                                </div>
                            </Descriptions.Item>

                            <Descriptions.Item label="经纬度" span={2}>
                                {currentShop.latitude && currentShop.longitude
                                    ? `${currentShop.latitude}, ${currentShop.longitude}`
                                    : '-'}
                            </Descriptions.Item>

                            <Descriptions.Item label="营业时间" span={2}>
                                <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                                    {currentShop.openTime || '-'}
                                </div>
                            </Descriptions.Item>

                            <Descriptions.Item label="门店标签" span={2}>
                                {(() => {
                                    try {
                                        const tags = currentShop.tags ? JSON.parse(currentShop.tags) : [];
                                        return tags.length > 0
                                            ? tags.map((tag: string, idx: number) => (
                                                <Tag key={idx} style={{ marginBottom: 4 }}>{tag}</Tag>
                                            ))
                                            : '-';
                                    } catch {
                                        return currentShop.tags || '-';
                                    }
                                })()}
                            </Descriptions.Item>
                        </Descriptions>
                        <VisibilityStatusPanel visibility={currentShop.visibility} legacyInfo={currentShop.legacyInfo} />
                    </Space>
                )}
            </Modal>

            {/* 编辑弹窗 */}
            <Modal
                title={editingShop ? '编辑门店' : '新增门店'}
                open={modalVisible}
                onCancel={() => setModalVisible(false)}
                onOk={handleSubmit}
                width={800}
            >
                <Form form={form} layout="vertical">
                    {!editingShop && (
                        <Card size="small" style={{ marginBottom: 16, background: '#e6f7ff', borderColor: '#91d5ff' }}>
                            新增门店将以「未入驻」状态创建，后续可通过补全账号完成入驻。
                        </Card>
                    )}
                    <Form.Item name="name" label="门店名称" rules={[{ required: true, message: '请输入门店名称' }]}>
                        <Input placeholder="如：顾家家居旗舰店" />
                    </Form.Item>

                    <Form.Item name="type" label="类型" rules={[{ required: true }]}>
                        <Select options={MATERIAL_SHOP_TYPE_OPTIONS} />
                    </Form.Item>

                    <Form.Item name="companyName" label="公司名称">
                        <Input placeholder="如：顾家家居股份有限公司" />
                    </Form.Item>

                    <Form.Item name="collectedSource" label="采集来源">
                        <Input placeholder="如：线下拜访、企查查、大众点评" />
                    </Form.Item>

                    <Form.Item name="cover" label="封面图URL" rules={[{ required: true, message: '请输入封面图' }]}>
                        <Input placeholder="https://..." />
                    </Form.Item>

                    <Form.Item
                        noStyle
                        shouldUpdate={(prevValues, currentValues) => prevValues.type !== currentValues.type}
                    >
                        {({ getFieldValue }) => {
                            const type = getFieldValue('type');
                            return type === 'brand' ? (
                                <Form.Item name="brandLogo" label="品牌Logo URL">
                                    <Input placeholder="https://... (品牌店专属)" />
                                </Form.Item>
                            ) : null;
                        }}
                    </Form.Item>

                    <Form.Item name="mainProducts" label="主营产品 (JSON数组)">
                        <Input.TextArea
                            rows={2}
                            placeholder='如：["全屋定制","整体橱柜","全铝家居"]'
                        />
                    </Form.Item>

                    <Form.Item name="productCategories" label="产品分类标签 (逗号分隔)">
                        <Input placeholder="如：沙发,床,衣柜,餐桌" />
                    </Form.Item>

                    <Form.Item name="address" label="地址" rules={[{ required: true, message: '请输入地址' }]}>
                        <Input placeholder="如：雁塔区科技路10号" />
                    </Form.Item>

                    <div style={{ display: 'flex', gap: 16 }}>
                        <Form.Item name="latitude" label="纬度" style={{ flex: 1 }}>
                            <InputNumber
                                min={-90}
                                max={90}
                                step={0.000001}
                                precision={6}
                                style={{ width: '100%' }}
                                placeholder="34.123456"
                            />
                        </Form.Item>
                        <Form.Item name="longitude" label="经度" style={{ flex: 1 }}>
                            <InputNumber
                                min={-180}
                                max={180}
                                step={0.000001}
                                precision={6}
                                style={{ width: '100%' }}
                                placeholder="108.123456"
                            />
                        </Form.Item>
                    </div>

                    <Form.Item name="openTime" label="营业时间">
                        <Input placeholder="如：09:00-21:00" />
                    </Form.Item>

                    <Form.Item name="tags" label="门店标签 (JSON数组)">
                        <Input.TextArea
                            rows={2}
                            placeholder='如：["免费停车","免费设计","送货上门"]'
                        />
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                title="认领主材商账号"
                open={accountModalVisible}
                onCancel={() => {
                    setAccountModalVisible(false);
                    setAccountTargetShop(null);
                    accountForm.resetFields();
                }}
                onOk={handleCompleteAccount}
                confirmLoading={accountSubmitting}
                destroyOnClose
            >
                <Form form={accountForm} layout="vertical">
                    <Card size="small" style={{ marginBottom: 16, background: '#fffbe6', borderColor: '#ffe58f' }}>
                        认领后将开通登录，并进入资料待补全状态；审核通过前，门店经营权限保持受限。
                    </Card>
                    <Form.Item label="门店名称">
                        <Input value={accountTargetShop?.name || ''} disabled />
                    </Form.Item>
                    <Form.Item
                        name="phone"
                        label="登录手机号"
                        rules={[
                            { required: true, message: '请输入手机号' },
                            { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的11位手机号' },
                        ]}
                    >
                        <Input placeholder="用于主材商后台登录" />
                    </Form.Item>
                    <Form.Item name="contactName" label="联系人姓名">
                        <Input placeholder="可选，用于补全门店联系人" />
                    </Form.Item>
                    <Form.Item name="nickname" label="账号昵称">
                        <Input placeholder="可选，不填则默认使用门店名称/联系人姓名" />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default MaterialShopList;
