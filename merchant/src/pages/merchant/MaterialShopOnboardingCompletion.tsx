import { Alert, Button, Result, Spin, message } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MaterialShopRegister from './MaterialShopRegister';
import { materialShopCompletionApi, type MaterialShopCompletionStatusResponse } from '../../services/merchantApi';
import { useMerchantAuthStore } from '../../stores/merchantAuthStore';
import MerchantOnboardingShell from './components/MerchantOnboardingShell';

const MaterialShopOnboardingCompletion: React.FC = () => {
    const navigate = useNavigate();
    const logout = useMerchantAuthStore((state) => state.logout);
    const setOnboardingState = useMerchantAuthStore((state) => state.setOnboardingState);
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<MaterialShopCompletionStatusResponse | null>(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const result = await materialShopCompletionApi.status();
            setData(result);
            setOnboardingState({
                completionRequired: result.completionRequired,
                onboardingStatus: result.onboardingStatus,
                completionApplicationId: result.applicationId ?? null,
            });
            if (!result.completionRequired || result.onboardingStatus === 'approved') {
                navigate('/material-shop/products', { replace: true });
                return;
            }
        } catch (error) {
            message.error(error instanceof Error ? error.message : '获取主材商补全状态失败');
        } finally {
            setLoading(false);
        }
    }, [navigate, setOnboardingState]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f5f7fb' }}>
                <Spin size="large" tip="正在加载主材商补全资料..." />
            </div>
        );
    }

    if (!data) {
        return (
            <MerchantOnboardingShell
                pageTitle="主材商补全状态加载失败"
                pageSubtitle="当前无法拉取你的补全状态，请稍后重试。"
                heroTitle="主材商补全状态加载失败"
                heroSubtitle="暂时无法读取当前门店账号的补全状态，请稍后刷新或联系平台运营处理。"
                currentStep={0}
                steps={[{ title: '状态检查' }]}
                onBack={() => navigate('/login', { replace: true })}
            >
                <Result
                    status="error"
                    title="无法获取补全状态"
                    subTitle="请刷新页面重试；若仍失败，请联系平台运营确认账号状态。"
                    extra={[
                        <Button key="retry" type="primary" onClick={() => void loadData()}>
                            重新加载
                        </Button>,
                        <Button key="logout" onClick={() => { logout(); navigate('/login', { replace: true }); }}>
                            退出登录
                        </Button>,
                    ]}
                />
            </MerchantOnboardingShell>
        );
    }

    if (data.onboardingStatus === 'pending_review') {
        return (
            <MerchantOnboardingShell
                pageTitle="主材商补全审核中"
                pageSubtitle="门店正式入驻资料已提交，审核通过前暂不可进行商品维护、资料编辑等经营操作。"
                heroTitle="主材商补全审核中"
                heroSubtitle="平台审核通过前，你可以继续登录查看消息和状态，但门店经营能力仍保持受限。"
                currentStep={0}
                steps={[{ title: '等待审核' }]}
                onBack={() => navigate('/login', { replace: true })}
            >
                <Alert
                    type="info"
                    showIcon
                    style={{ marginBottom: 24, borderRadius: 12 }}
                    message="审核中"
                    description="审核通过后，门店商品管理、资料编辑等经营权限会自动恢复。"
                />
                <Result
                    status="info"
                    title="资料已提交，等待后台审核"
                    subTitle={data.applicationId ? `申请单号：${data.applicationId}` : '请耐心等待审核结果'}
                    extra={[
                        <Button key="refresh" type="primary" onClick={() => void loadData()}>
                            刷新状态
                        </Button>,
                        <Button key="logout" onClick={() => { logout(); navigate('/login', { replace: true }); }}>
                            退出登录
                        </Button>,
                    ]}
                />
            </MerchantOnboardingShell>
        );
    }

    return (
        <MaterialShopRegister
            mode="completion"
            completionData={data}
            onCompletionSubmitted={async () => {
                await loadData();
            }}
        />
    );
};

export default MaterialShopOnboardingCompletion;
