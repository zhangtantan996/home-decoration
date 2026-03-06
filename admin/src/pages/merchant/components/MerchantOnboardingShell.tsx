import React from 'react';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { Button, Grid, Layout, Steps, Typography } from 'antd';
import type { StepsProps } from 'antd';

import merchantAppIcon from '../../../assets/branding/company-logo.png';
import { MERCHANT_THEME } from '../../../constants/merchantTheme';

const { Content } = Layout;
const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

interface MerchantOnboardingShellProps {
    pageTitle: string;
    pageSubtitle?: string;
    heroTitle: string;
    heroSubtitle: string;
    currentStep: number;
    steps: StepsProps['items'];
    onBack: () => void;
    alertNode?: React.ReactNode;
    children: React.ReactNode;
    maxWidth?: number;
}

const MerchantOnboardingShell: React.FC<MerchantOnboardingShellProps> = ({
    pageTitle,
    pageSubtitle,
    heroTitle,
    heroSubtitle,
    currentStep,
    steps,
    onBack,
    alertNode,
    children,
    maxWidth,
}) => {
    const screens = useBreakpoint();
    const isDesktop = Boolean(screens.md);
    const sidebarWidth = MERCHANT_THEME.onboarding.sidebarWidth;
    const cardMaxWidth = maxWidth ?? MERCHANT_THEME.onboarding.contentMaxWidth;

    return (
        <Layout
            className="register-page-bg"
            style={{
                minHeight: '100vh',
                width: '100%',
                position: 'relative',
                overflowX: 'hidden',
            }}
        >
            {isDesktop && (
                <aside
                    style={{
                        position: 'fixed',
                        inset: '0 auto 0 0',
                        width: sidebarWidth,
                        height: '100vh',
                        background: MERCHANT_THEME.primaryGradient,
                        boxShadow: MERCHANT_THEME.onboarding.sidebarShadow,
                        overflow: 'hidden',
                        zIndex: 1,
                    }}
                >
                    <div
                        style={{
                            height: '100%',
                            padding: MERCHANT_THEME.onboarding.heroPadding,
                            boxSizing: 'border-box',
                            color: '#fff',
                            display: 'flex',
                            flexDirection: 'column',
                            position: 'relative',
                            zIndex: 1,
                        }}
                    >
                        <Button
                            type="text"
                            icon={<ArrowLeftOutlined aria-hidden="true" />}
                            onClick={onBack}
                            style={{ padding: 0, color: 'rgba(255,255,255,0.8)', marginBottom: 48, alignSelf: 'flex-start' }}
                            aria-label="返回商家入驻首页"
                        >
                            返回
                        </Button>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 40 }}>
                            <img
                                src={merchantAppIcon}
                                alt="禾泽云"
                                style={{
                                    width: 44,
                                    height: 44,
                                    borderRadius: 12,
                                    boxShadow: '0 10px 24px rgba(0,0,0,0.18)',
                                    background: 'rgba(255,255,255,0.96)',
                                }}
                            />
                            <div>
                                <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, letterSpacing: '0.08em', display: 'block' }}>
                                    HEZEYUN MERCHANT
                                </Text>
                                <Title level={5} style={{ margin: 0, color: '#fff' }}>
                                    禾泽云商家中心
                                </Title>
                            </div>
                        </div>

                        <Title style={{ color: '#fff', fontSize: '3rem', fontWeight: 700, marginBottom: 16, letterSpacing: '-1px', lineHeight: 1.18 }}>
                            {heroTitle}
                        </Title>
                        <Text style={{ color: 'rgba(255,255,255,0.88)', fontSize: 16, lineHeight: 1.8, display: 'block', marginBottom: 56 }}>
                            {heroSubtitle}
                        </Text>

                        <Steps
                            current={currentStep}
                            items={steps}
                            direction="vertical"
                            className="premium-steps-dark"
                            style={{ marginTop: 24 }}
                            aria-label="商家入驻申请流程步骤"
                        />
                    </div>

                    <div
                        style={{
                            position: 'absolute',
                            bottom: '-10%',
                            left: '-20%',
                            width: 320,
                            height: 320,
                            borderRadius: '50%',
                            background: 'rgba(255,255,255,0.12)',
                            filter: 'blur(42px)',
                            pointerEvents: 'none',
                        }}
                    />
                    <div
                        style={{
                            position: 'absolute',
                            top: '18%',
                            right: '-18%',
                            width: 220,
                            height: 220,
                            borderRadius: '50%',
                            background: 'rgba(255,255,255,0.16)',
                            filter: 'blur(32px)',
                            pointerEvents: 'none',
                        }}
                    />
                </aside>
            )}

            <Content
                style={{
                    width: isDesktop ? `calc(100% - ${sidebarWidth}px)` : '100%',
                    marginLeft: isDesktop ? sidebarWidth : 0,
                    minWidth: 0,
                    boxSizing: 'border-box',
                    padding: isDesktop ? MERCHANT_THEME.onboarding.contentPaddingDesktop : MERCHANT_THEME.onboarding.contentPaddingMobile,
                    position: 'relative',
                    zIndex: 2,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: isDesktop ? 'flex-start' : 'center',
                    overflow: 'visible',
                }}
            >
                <div
                    className="glassmorphism-card"
                    style={{
                        width: '100%',
                        maxWidth: cardMaxWidth,
                        padding: isDesktop ? MERCHANT_THEME.onboarding.cardPaddingDesktop : MERCHANT_THEME.onboarding.cardPaddingMobile,
                        marginTop: isDesktop ? 32 : 0,
                    }}
                >
                    {!isDesktop && (
                        <div style={{ marginBottom: 32 }}>
                            <Button
                                type="link"
                                icon={<ArrowLeftOutlined aria-hidden="true" />}
                                onClick={onBack}
                                style={{ padding: 0 }}
                                aria-label="返回商家入驻首页"
                            >
                                返回
                            </Button>
                            <Title level={3} style={{ marginTop: 8, marginBottom: 8 }}>
                                {pageTitle}
                            </Title>
                            {pageSubtitle ? (
                                <Text style={{ color: '#64748b', display: 'block', marginBottom: 20 }}>
                                    {pageSubtitle}
                                </Text>
                            ) : null}
                            <Steps
                                current={currentStep}
                                items={steps}
                                size="small"
                                style={{ marginTop: 24 }}
                                aria-label="商家入驻申请流程步骤"
                            />
                        </div>
                    )}

                    {alertNode}
                    {children}
                </div>
            </Content>
        </Layout>
    );
};

export default MerchantOnboardingShell;
