import React, { useEffect, useState } from 'react';
import { merchantAuthApi, merchantBankAccountApi, type MerchantBankAccountInfo } from '../../services/merchantApi';
import {
    ArrowLeftOutlined,
    BankOutlined,
    DeleteOutlined,
    PlusOutlined,
    SafetyOutlined,
    StarFilled,
    StarOutlined,
} from '@ant-design/icons';
import {
    Button,
    Card,
    Empty,
    Form,
    Input,
    Modal,
    Popconfirm,
    Select,
    Space,
    Switch,
    Table,
    Tag,
    message,
} from 'antd';
import { useNavigate } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';

const BANK_OPTIONS = [
    '中国工商银行',
    '中国建设银行',
    '中国农业银行',
    '中国银行',
    '交通银行',
    '招商银行',
    '中国邮政储蓄银行',
    '兴业银行',
    '中信银行',
    '浦发银行',
    '民生银行',
    '光大银行',
    '平安银行',
    '华夏银行',
    '广发银行',
];

const getErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof Error && error.message) {
        return error.message;
    }

    const maybeAxiosError = error as {
        response?: {
            data?: {
                message?: string;
            };
        };
    };
    return maybeAxiosError.response?.data?.message || fallback;
};

const MerchantBankAccounts: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [accounts, setAccounts] = useState<MerchantBankAccountInfo[]>([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [sendingCode, setSendingCode] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const [form] = Form.useForm();

    useEffect(() => {
        void fetchAccounts();
    }, []);

    const fetchAccounts = async () => {
        setLoading(true);
        try {
            const result = await merchantBankAccountApi.list();
            setAccounts(result.list || []);
        } catch (error) {
            message.error(getErrorMessage(error, '获取银行账户失败'));
        } finally {
            setLoading(false);
        }
    };

    const handleSendCode = async () => {
        const storedProvider = JSON.parse(localStorage.getItem('merchant_provider') || '{}') as { phone?: string };
        const phone = storedProvider.phone;
        if (!phone) {
            message.error('当前账号缺少手机号，请重新登录后再试');
            return;
        }

        setSendingCode(true);
        try {
            const res = await merchantAuthApi.sendCode(phone);
            const debugSuffix = import.meta.env.DEV && res?.debugCode ? ` (测试码: ${res.debugCode})` : '';
            message.success(`验证码已发送${debugSuffix}`);
            setCountdown(60);
            const timer = window.setInterval(() => {
                setCountdown((prev) => {
                    if (prev <= 1) {
                        window.clearInterval(timer);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        } catch (error) {
            message.error(getErrorMessage(error, '发送验证码失败'));
        } finally {
            setSendingCode(false);
        }
    };

    const handleAdd = async (values: {
        accountName: string;
        accountNo: string;
        bankName: string;
        branchName?: string;
        isDefault?: boolean;
        verificationCode: string;
    }) => {
        setSubmitting(true);
        try {
            await merchantBankAccountApi.add(values);
            message.success('添加成功');
            setModalVisible(false);
            form.resetFields();
            setCountdown(0);
            await fetchAccounts();
        } catch (error) {
            message.error(getErrorMessage(error, '添加失败'));
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: number) => {
        try {
            await merchantBankAccountApi.delete(id);
            message.success('删除成功');
            await fetchAccounts();
        } catch (error) {
            message.error(getErrorMessage(error, '删除失败'));
        }
    };

    const handleSetDefault = async (id: number) => {
        try {
            await merchantBankAccountApi.setDefault(id);
            message.success('设置成功');
            await fetchAccounts();
        } catch (error) {
            message.error(getErrorMessage(error, '设置失败'));
        }
    };

    const columns: ColumnsType<MerchantBankAccountInfo> = [
        {
            title: '银行',
            dataIndex: 'bankName',
            key: 'bankName',
            render: (text: string, record) => (
                <Space>
                    <BankOutlined style={{ fontSize: 20, color: '#1890ff' }} />
                    <div>
                        <div style={{ fontWeight: 500 }}>{text}</div>
                        {record.branchName && <div style={{ color: '#999', fontSize: 12 }}>{record.branchName}</div>}
                    </div>
                </Space>
            ),
        },
        {
            title: '户名',
            dataIndex: 'accountName',
            key: 'accountName',
        },
        {
            title: '账号',
            dataIndex: 'accountNo',
            key: 'accountNo',
            render: (text: string) => <span style={{ fontFamily: 'monospace' }}>{text}</span>,
        },
        {
            title: '状态',
            key: 'isDefault',
            width: 100,
            render: (_, record) => (record.isDefault ? <Tag color="blue" icon={<StarFilled />}>默认</Tag> : null),
        },
        {
            title: '操作',
            key: 'action',
            width: 180,
            render: (_, record) => (
                <Space>
                    {!record.isDefault && (
                        <Button type="link" size="small" icon={<StarOutlined />} onClick={() => handleSetDefault(record.id)}>
                            设为默认
                        </Button>
                    )}
                    <Popconfirm
                        title="确定要删除这个银行账户吗？"
                        onConfirm={() => handleDelete(record.id)}
                        okText="确定"
                        cancelText="取消"
                    >
                        <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                            删除
                        </Button>
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
            <div style={{ marginBottom: 24 }}>
                <Button
                    type="link"
                    icon={<ArrowLeftOutlined />}
                    onClick={() => navigate('/income')}
                    style={{ padding: 0, marginBottom: 8 }}
                >
                    返回收入中心
                </Button>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ margin: 0 }}>银行账户管理</h2>
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => setModalVisible(true)}
                        disabled={accounts.length >= 5}
                    >
                        添加银行账户
                    </Button>
                </div>
            </div>

            <Card>
                <Table
                    columns={columns}
                    dataSource={accounts}
                    rowKey="id"
                    loading={loading}
                    pagination={false}
                    locale={{
                        emptyText: (
                            <Empty description="暂无银行账户" image={Empty.PRESENTED_IMAGE_SIMPLE}>
                                <Button type="primary" onClick={() => setModalVisible(true)}>
                                    添加银行账户
                                </Button>
                            </Empty>
                        ),
                    }}
                />
                {accounts.length > 0 && accounts.length < 5 && (
                    <div style={{ marginTop: 16, color: '#999', textAlign: 'center' }}>
                        最多可添加5个银行账户，当前已添加 {accounts.length} 个
                    </div>
                )}
            </Card>

            <Modal
                title="添加银行账户"
                open={modalVisible}
                onCancel={() => {
                    setModalVisible(false);
                    form.resetFields();
                }}
                footer={null}
                width={500}
            >
                <Form form={form} layout="vertical" onFinish={handleAdd} initialValues={{ isDefault: false }}>
                    <Form.Item name="bankName" label="开户银行" rules={[{ required: true, message: '请选择开户银行' }]}>
                        <Select size="large" placeholder="请选择开户银行" showSearch optionFilterProp="children">
                            {BANK_OPTIONS.map((bank) => (
                                <Select.Option key={bank} value={bank}>
                                    {bank}
                                </Select.Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <Form.Item name="branchName" label="开户支行">
                        <Input size="large" placeholder="例如：西安高新支行（选填）" />
                    </Form.Item>

                    <Form.Item name="accountName" label="户名" rules={[{ required: true, message: '请输入户名' }]}>
                        <Input size="large" placeholder="请输入银行账户户名" maxLength={100} />
                    </Form.Item>

                    <Form.Item
                        name="accountNo"
                        label="银行账号"
                        rules={[
                            { required: true, message: '请输入银行账号' },
                            { pattern: /^\d{16,19}$/, message: '请输入正确的16-19位银行账号' },
                        ]}
                    >
                        <Input size="large" placeholder="请输入16-19位银行账号" maxLength={19} />
                    </Form.Item>

                    <Form.Item
                        name="verificationCode"
                        label="短信验证码"
                        rules={[
                            { required: true, message: '请输入验证码' },
                            { pattern: /^\d{6}$/, message: '请输入6位数字验证码' },
                        ]}
                    >
                        <Input
                            size="large"
                            prefix={<SafetyOutlined />}
                            placeholder="请输入验证码"
                            maxLength={6}
                            suffix={(
                                <Button
                                    type="link"
                                    size="small"
                                    disabled={countdown > 0 || sendingCode}
                                    onClick={handleSendCode}
                                    loading={sendingCode}
                                >
                                    {countdown > 0 ? `${countdown}s` : '获取验证码'}
                                </Button>
                            )}
                        />
                    </Form.Item>

                    <Form.Item name="isDefault" label="默认账户" valuePropName="checked">
                        <Switch checkedChildren="默认" unCheckedChildren="普通" />
                    </Form.Item>

                    <div
                        style={{
                            padding: 12,
                            background: '#f5f5f5',
                            borderRadius: 4,
                            marginBottom: 24,
                            fontSize: 12,
                            color: '#666',
                        }}
                    >
                        <div>• 请确保银行账户信息准确无误</div>
                        <div>• 添加后可随时删除或修改默认账户</div>
                        <div>• 提现时将转账至所选银行账户</div>
                    </div>

                    <Form.Item style={{ marginBottom: 0 }}>
                        <Button type="primary" htmlType="submit" block size="large" loading={submitting}>
                            确认添加
                        </Button>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default MerchantBankAccounts;
