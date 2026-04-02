import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Spin } from 'antd';
import { useEffect, useState } from 'react';
import { materialShopCompletionApi, merchantCompletionApi } from '../services/merchantApi';
import { useMerchantAuthStore } from '../stores/merchantAuthStore';

export default function MerchantCompletionGuard() {
    const location = useLocation();
    const provider = useMerchantAuthStore((state) => state.provider);
    const isAuthenticated = useMerchantAuthStore((state) => state.isAuthenticated);
    const completionRequired = useMerchantAuthStore((state) => state.completionRequired);
    const onboardingStatus = useMerchantAuthStore((state) => state.onboardingStatus);
    const setOnboardingState = useMerchantAuthStore((state) => state.setOnboardingState);
    const [checking, setChecking] = useState(true);

    const providerId = provider?.id;
    const providerMerchantKind = provider?.merchantKind;
    const providerRole = provider?.role;
    const isMaterialShop = providerMerchantKind === 'material_shop' || providerRole === 'material_shop';

    useEffect(() => {
        if (!isAuthenticated || !provider) {
            setChecking(false);
            return;
        }

        let disposed = false;
        setChecking(true);
        const request = isMaterialShop ? materialShopCompletionApi.status() : merchantCompletionApi.status();
        request
            .then((result) => {
                if (disposed) return;
                setOnboardingState({
                    completionRequired: result.completionRequired,
                    onboardingStatus: result.onboardingStatus,
                    completionApplicationId: result.applicationId ?? null,
                });
            })
            .catch(() => {
                if (disposed) return;
            })
            .finally(() => {
                if (!disposed) {
                    setChecking(false);
                }
            });

        return () => {
            disposed = true;
        };
    }, [isAuthenticated, isMaterialShop, providerId, setOnboardingState]);

    if (checking) {
        return (
            <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f5f7fb' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                    <Spin size="large" />
                    <div style={{ color: '#64748b', fontSize: 14 }}>正在校验商家补全状态...</div>
                </div>
            </div>
        );
    }

    if (!provider) {
        return <Outlet />;
    }

    if (completionRequired && onboardingStatus !== 'approved') {
        return (
            <Navigate
                to={isMaterialShop ? '/material-shop/onboarding/completion' : '/onboarding/completion'}
                replace
                state={{ from: location }}
            />
        );
    }

    return <Outlet />;
}
