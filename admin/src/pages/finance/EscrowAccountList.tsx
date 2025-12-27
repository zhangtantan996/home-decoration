import React, { useEffect, useState } from 'react';
import { Table, Card, Tag, Button, Space, message, Statistic, Row, Col, Modal, Form, InputNumber } from 'antd';
import { ReloadOutlined, WalletOutlined } from '@ant-design/icons';
import { adminFinanceApi } from '../../services/api';

interface EscrowAccount {
    id: number;
    projectId: number;
    projectName: string;
    userId: number;
    userName: string;
    totalAmount: number;
    frozenAmount: number;
    availableAmount: number;
    status: number;
    createdAt: string;
}

const statusMap: Record<number, { text: string; color: string }> = {
    0: { text: '待激活', color: 'default' },
    1: { text: '正常', color: 'green' },
    2: { text: '冻结', color: 'red' },
    3: { text: '已清算', color: 'blue' },
};

const EscrowAccountList: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [accounts, setAccounts] = useState<EscrowAccount[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);
    const [stats, setStats] = useState({
        totalAccounts: 0,
        totalAmount: 0,
        frozenAmount: 0,
        availableAmount: 0,
    });
    const [withdrawVisible, setWithdrawVisible] = useState(false);
    const [currentAccount, setCurrentAccount] = useState<EscrowAccount | null>(null);
    const [form] = Form.useForm();

    useEffect(() => {
        loadData();
        loadStats();
    }, [page]);

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await adminFinanceApi.escrowAccounts({ page, pageSize }) as any;
            if (res.code === 0) {
                setAccounts(res.data.list || []);
                setTotal(res.data.total || 0);
            }
        } catch (error) {
            console.error(error);
            message.error('加载失败');
        } finally {
            setLoading(false);
        }
    };

    const loadStats = async () => {
        // 模拟统计数据加载
        setStats({
            totalAccounts: 156,
            totalAmount: 12580000,
            frozenAmount: 3420000,
            availableAmount: 9160000,
        });
    };

    const showWithdrawModal = (record: EscrowAccount) => {
        setCurrentAccount(record);
        form.resetFields();
        setWithdrawVisible(true);
    };

    const handleWithdraw = async () => {
        try {
            const values = await form.validateFields();
            if (currentAccount) {
                await adminFinanceApi.withdraw(currentAccount.id, values);
                message.success('提现申请已提交');
                setWithdrawVisible(false);
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
            title: '项目ID',
            dataIndex: 'projectId',
            width: 100,
        },
        {
            title: '项目名称',
            dataIndex: 'projectName',
            ellipsis: true,
        },
        {
            title: '用户',
            dataIndex: 'userName',
        },
        {
            title: '总金额',
            dataIndex: 'totalAmount',
            render: (val: number) => `¥${val.toLocaleString()}`,
        },
        {
            title: '冻结金额',
            dataIndex: 'frozenAmount',
            render: (val: number) => `¥${val.toLocaleString()}`,
        },
        {
            title: '可用金额',
            dataIndex: 'availableAmount',
            render: (val: number) => `¥${val.toLocaleString()}`,
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
            title: '创建时间',
            dataIndex: 'createdAt',
            render: (val: string) => new Date(val).toLocaleString(),
        },
        {
            title: '操作',
            key: 'action',
            render: (_: any, record: EscrowAccount) => (
                <Space>
                    <Button type="link" size="small">详情</Button>
                    {record.status === 1 && record.availableAmount > 0 && (
                        <Button type="link" size="small" onClick={() => showWithdrawModal(record)}>
                            提现
                        </Button>
                    )}
                </Space>
            ),
        },
    ];

    return (
        <div>
            <Row gutter={16} style={{ marginBottom: 16 }}>
                <Col span={6}>
                    <Card>
                        <Statistic
                            title="托管账户总数"
                            value={stats.totalAccounts}
                            prefix={<WalletOutlined />}
                        />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card>
                        <Statistic
                            title="托管总金额"
                            value={stats.totalAmount}
                            precision={2}
                            prefix="¥"
                        />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card>
                        <Statistic
                            title="冻结金额"
                            value={stats.frozenAmount}
                            precision={2}
                            prefix="¥"
                            valueStyle={{ color: '#cf1322' }}
                        />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card>
                        <Statistic
                            title="可用金额"
                            value={stats.availableAmount}
                            precision={2}
                            prefix="¥"
                            valueStyle={{ color: '#3f8600' }}
                        />
                    </Card>
                </Col>
            </Row>

            <Card>
                <Space style={{ marginBottom: 16 }}>
                    <Button icon={<ReloadOutlined />} onClick={loadData}>刷新</Button>
                </Space>

                <Table
                    loading={loading}
                    dataSource={accounts}
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
            </Card>

            <Modal
                title="申请提现"
                open={withdrawVisible}
                onOk={handleWithdraw}
                onCancel={() => setWithdrawVisible(false)}
            >
                <Form form={form} layout="vertical">
                    <Form.Item label="可用金额">
                        <div>¥{currentAccount?.availableAmount.toLocaleString()}</div>
                    </Form.Item>
                    <Form.Item
                        label="提现金额"
                        name="amount"
                        rules={[
                            { required: true, message: '请输入提现金额' },
                            {
                                validator: (_, value) => {
                                    if (value > (currentAccount?.availableAmount || 0)) {
                                        return Promise.reject('提现金额不能超过可用金额');
                                    }
                                    return Promise.resolve();
                                },
                            },
                        ]}
                    >
                        <InputNumber
                            style={{ width: '100%' }}
                            min={0}
                            precision={2}
                            placeholder="请输入提现金额"
                        />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default EscrowAccountList;
