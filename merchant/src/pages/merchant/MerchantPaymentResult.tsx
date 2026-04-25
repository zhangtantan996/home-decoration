import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Descriptions, Result, Space, Spin, Typography, message } from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';

import MerchantPageShell from '../../components/MerchantPageShell';
import MerchantPageHeader from '../../components/MerchantPageHeader';
import { merchantPaymentApi, type MerchantPaymentStatusPayload } from '../../services/merchantApi';
import { readSafeErrorMessage } from '../../utils/userFacingText';

const { Text } = Typography;

const terminalStatuses = new Set(['paid', 'closed', 'failed']);

const readContextPath = (value: unknown) => (
    typeof value === 'string' && value.startsWith('/') ? value : ''
);

const getErrorMessage = (error: unknown, fallback: string) => readSafeErrorMessage(error, fallback);

const MerchantPaymentResult = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const paymentId = Number(searchParams.get('paymentId') || 0);
    const fallbackNext = searchParams.get('next') || '/bond';

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [data, setData] = useState<MerchantPaymentStatusPayload | null>(null);

    const loadStatus = async (silent = false) => {
        if (!paymentId) {
            return;
        }
        if (!silent) {
            setLoading(true);
        }
        try {
            const result = await merchantPaymentApi.status(paymentId);
            setData(result);
            setError('');
        } catch (requestError) {
            const nextError = getErrorMessage(requestError, '获取支付状态失败');
            setError(nextError);
            if (!silent) {
                message.error(nextError);
            }
        } finally {
            if (!silent) {
                setLoading(false);
            }
        }
    };

    useEffect(() => {
        void loadStatus();
    }, [paymentId]);

    useEffect(() => {
        if (!data || terminalStatuses.has(data.status)) {
            return undefined;
        }
        const timer = window.setTimeout(() => {
            void loadStatus(true);
        }, 2500);
        return () => window.clearTimeout(timer);
    }, [data]);

    const targetPath = useMemo(() => {
        if (!data?.returnContext) {
            return fallbackNext;
        }
        if (data.status === 'paid') {
            return readContextPath(data.returnContext.successPath) || fallbackNext;
        }
        return readContextPath(data.returnContext.cancelPath) || fallbackNext;
    }, [data, fallbackNext]);

    if (!paymentId) {
        return (
            <MerchantPageShell>
                <Result
                    status="error"
                    title="缺少支付单编号"
                    subTitle="请返回保证金账户页重新发起支付。"
                    extra={<Button type="primary" onClick={() => navigate('/bond')}>返回保证金账户</Button>}
                />
            </MerchantPageShell>
        );
    }

    const status = data?.status || 'pending';
    const resultStatus = status === 'paid' ? 'success' : (status === 'closed' || status === 'failed' ? 'warning' : 'info');
    const title = status === 'paid'
        ? '保证金支付成功'
        : status === 'closed' || status === 'failed'
            ? '保证金支付未完成'
            : '保证金支付确认中';
    const subtitle = status === 'paid'
        ? '平台已确认到账，保证金账户会同步更新。'
        : status === 'closed' || status === 'failed'
            ? '当前支付未成功或已关闭，可返回保证金账户重新发起。'
            : '支付渠道已返回，平台正在确认异步结果，请稍候。';

    return (
        <MerchantPageShell>
            <MerchantPageHeader title="支付结果" description="确认本次保证金支付状态" />
            <Card bordered={false}>
                {loading && !data ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
                        <Spin size="large" />
                    </div>
                ) : (
                    <Space direction="vertical" size={24} style={{ width: '100%' }}>
                        <Result status={resultStatus as 'success' | 'warning' | 'info'} title={title} subTitle={subtitle} />
                        <Descriptions bordered column={1} size="middle">
                            <Descriptions.Item label="支付单号">#{paymentId}</Descriptions.Item>
                            <Descriptions.Item label="支付状态">{status}</Descriptions.Item>
                            <Descriptions.Item label="支付金额">¥{Number(data?.amount || 0).toFixed(2)}</Descriptions.Item>
                            <Descriptions.Item label="支付主题">{data?.subject || '待确认'}</Descriptions.Item>
                            <Descriptions.Item label="终端">{data?.terminalType || 'pc_web'}</Descriptions.Item>
                            <Descriptions.Item label="已支付时间">{data?.paidAt || '--'}</Descriptions.Item>
                            <Descriptions.Item label="过期时间">{data?.expiresAt || '--'}</Descriptions.Item>
                        </Descriptions>
                        {error ? <Text type="secondary">最近一次查询提示：{error}</Text> : null}
                        <Space>
                            <Button type="primary" onClick={() => navigate(targetPath)}>
                                返回业务页面
                            </Button>
                            {!terminalStatuses.has(status) ? (
                                <Button onClick={() => void loadStatus()}>
                                    立即刷新
                                </Button>
                            ) : null}
                        </Space>
                    </Space>
                )}
            </Card>
        </MerchantPageShell>
    );
};

export default MerchantPaymentResult;
