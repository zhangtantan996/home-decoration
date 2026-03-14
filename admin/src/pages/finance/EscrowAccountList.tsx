import React, { useEffect, useState } from 'react';
import { Table, Card, Button, Space, message, Modal, Form, InputNumber } from 'antd';
import { ReloadOutlined, WalletOutlined } from '@ant-design/icons';
import { adminFinanceApi } from '../../services/api';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import ToolbarCard from '../../components/ToolbarCard';
import StatusTag from '../../components/StatusTag';

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
    }, [page]);

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await adminFinanceApi.escrowAccounts({ page, pageSize }) as any;
            if (res.code === 0) {
                const list = res.data.list || [];
                const summary = res.data.summary || {};
                setAccounts(list);
                setTotal(res.data.total || 0);
                setStats({
                    totalAccounts: res.data.total || list.length,
                    totalAmount: summary.totalAmount ?? list.reduce((sum: number, item: EscrowAccount) => sum + Number(item.totalAmount || 0), 0),
                    frozenAmount: summary.frozenAmount ?? list.reduce((sum: number, item: EscrowAccount) => sum + Number(item.frozenAmount || 0), 0),
                    availableAmount: summary.availableAmount ?? list.reduce((sum: number, item: EscrowAccount) => sum + Number(item.availableAmount || 0), 0),
                });
            }
        } catch (error) {
            console.error(error);
            message.error('加载失败');
        } finally {
            setLoading(false);
        }
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
                return config
                    ? <StatusTag status={val === 1 ? 'approved' : val === 2 ? 'rejected' : val === 3 ? 'info' : 'warning'} text={config.text} />
                    : '-';
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
        <div className="hz-page-stack">
            <PageHeader
                title="托管账户"
                description="查看项目托管账户余额、冻结资金与提现处理入口。"
            />

            <div className="hz-stat-grid">
                <StatCard title="托管账户总数" value={stats.totalAccounts} icon={<WalletOutlined />} tone="accent" />
                <StatCard title="托管总金额" value={`¥${stats.totalAmount.toLocaleString()}`} tone="success" />
                <StatCard title="冻结金额" value={`¥${stats.frozenAmount.toLocaleString()}`} tone="warning" />
                <StatCard title="可用金额" value={`¥${stats.availableAmount.toLocaleString()}`} tone="danger" />
            </div>

            <ToolbarCard>
                <div className="hz-toolbar">
                    <Button icon={<ReloadOutlined />} onClick={loadData}>刷新</Button>
                </div>
            </ToolbarCard>

            <Card className="hz-table-card">
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
