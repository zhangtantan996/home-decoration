import React, { useEffect } from 'react';
import { ArrowLeftOutlined, CalendarOutlined, FileTextOutlined, TagOutlined } from '@ant-design/icons';
import { Button, Layout, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';

const { Content } = Layout;
const { Title, Paragraph, Text } = Typography;

export interface LegalSection {
    title: string;
    paragraphs: string[];
}

interface LegalDocumentLayoutProps {
    title: string;
    version: string;
    effectiveDate: string;
    sections: LegalSection[];
}

const LegalDocumentLayout: React.FC<LegalDocumentLayoutProps> = ({
    title,
    version,
    effectiveDate,
    sections,
}) => {
    const navigate = useNavigate();

    useEffect(() => {
        const style = document.createElement('style');
        style.id = 'legal-doc-styles';
        style.innerHTML = `
            .legal-page-bg {
                background: linear-gradient(160deg, #f0f4ff 0%, #f8f9fb 50%, #eef2f9 100%);
                min-height: 100vh;
                position: relative;
            }
            .legal-page-bg::before {
                content: '';
                position: fixed;
                top: -20%;
                right: -10%;
                width: 55%;
                height: 65%;
                border-radius: 50%;
                background: radial-gradient(circle, rgba(24, 144, 255, 0.06) 0%, transparent 70%);
                pointer-events: none;
                z-index: 0;
            }
            .legal-header-card {
                background: linear-gradient(135deg, #1890ff 0%, #096dd9 100%);
                border-radius: 20px;
                padding: 36px 40px;
                margin-bottom: 28px;
                position: relative;
                overflow: hidden;
                box-shadow: 0 12px 40px rgba(24, 144, 255, 0.25);
            }
            .legal-header-card::before {
                content: '';
                position: absolute;
                top: -30%;
                right: -5%;
                width: 50%;
                height: 200%;
                background: radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 65%);
                border-radius: 50%;
                pointer-events: none;
            }
            .legal-header-card::after {
                content: '';
                position: absolute;
                bottom: -50%;
                left: 10%;
                width: 40%;
                height: 150%;
                background: radial-gradient(circle, rgba(255,255,255,0.07) 0%, transparent 65%);
                border-radius: 50%;
                pointer-events: none;
            }
            .legal-section-card {
                background: #fff;
                border-radius: 16px;
                padding: 28px 32px;
                margin-bottom: 16px;
                border: 1px solid #f0f2f7;
                box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
                transition: box-shadow 0.25s ease, transform 0.25s ease;
                position: relative;
                overflow: hidden;
            }
            .legal-section-card::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                width: 4px;
                height: 100%;
                background: linear-gradient(180deg, #1890ff 0%, #69b1ff 100%);
                border-radius: 4px 0 0 4px;
            }
            .legal-section-card:hover {
                box-shadow: 0 6px 24px rgba(0, 0, 0, 0.08);
                transform: translateY(-2px);
            }
            .legal-section-title {
                font-size: 16px !important;
                font-weight: 600 !important;
                color: #1a1a2e !important;
                margin-bottom: 16px !important;
                margin-top: 0 !important;
                display: flex;
                align-items: center;
                gap: 10px;
            }
            .legal-section-title .section-num {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 26px;
                height: 26px;
                border-radius: 8px;
                background: linear-gradient(135deg, #e6f4ff, #bae0ff);
                color: #1890ff;
                font-size: 13px;
                font-weight: 700;
                flex-shrink: 0;
            }
            .legal-paragraph {
                color: #4a5568;
                font-size: 14.5px;
                line-height: 1.85;
                margin-bottom: 10px !important;
                padding-left: 8px;
            }
            .legal-paragraph:last-child {
                margin-bottom: 0 !important;
            }
            .legal-toc-card {
                background: rgba(240, 245, 255, 0.8);
                backdrop-filter: blur(12px);
                border: 1px solid rgba(24, 144, 255, 0.15);
                border-radius: 16px;
                padding: 24px 28px;
                margin-bottom: 24px;
            }
            .legal-toc-item {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 6px 0;
                color: #475569;
                font-size: 14px;
                cursor: pointer;
                border-radius: 6px;
                transition: color 0.2s;
            }
            .legal-toc-item:hover {
                color: #1890ff;
            }
            .legal-toc-dot {
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background: #1890ff;
                flex-shrink: 0;
                opacity: 0.5;
            }
            .back-btn-hover {
                transition: all 0.2s ease;
            }
            .back-btn-hover:hover {
                transform: translateX(-3px);
            }
        `;
        document.head.appendChild(style);
        return () => {
            const el = document.getElementById('legal-doc-styles');
            if (el) el.remove();
        };
    }, []);

    const scrollToSection = (idx: number) => {
        const el = document.getElementById(`section-${idx}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    return (
        <Layout className="legal-page-bg">
            <Content
                style={{
                    maxWidth: 860,
                    margin: '0 auto',
                    width: '100%',
                    padding: '32px 20px 64px',
                    position: 'relative',
                    zIndex: 1,
                }}
            >
                {/* Back Button */}
                <Button
                    type="link"
                    icon={<ArrowLeftOutlined />}
                    onClick={() => navigate(-1)}
                    className="back-btn-hover"
                    style={{
                        padding: '0 0 20px 0',
                        color: '#64748b',
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                    }}
                >
                    返回上一页
                </Button>

                {/* Header Card */}
                <div className="legal-header-card">
                    <div style={{ position: 'relative', zIndex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                            <div style={{
                                width: 48, height: 48, borderRadius: 14,
                                background: 'rgba(255,255,255,0.2)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 22, color: '#fff',
                                backdropFilter: 'blur(8px)',
                            }}>
                                <FileTextOutlined />
                            </div>
                            <div>
                                <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, letterSpacing: 1, marginBottom: 4 }}>
                                    禾泽云家装平台 · 法律文件
                                </div>
                                <Title level={2} style={{ color: '#fff', margin: 0, fontSize: 26, fontWeight: 700 }}>
                                    {title}
                                </Title>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>
                                <TagOutlined />
                                <span>版本：{version}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>
                                <CalendarOutlined />
                                <span>生效日期：{effectiveDate}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>
                                <span>共 {sections.length} 个章节</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Table of Contents */}
                {sections.length > 3 && (
                    <div className="legal-toc-card">
                        <Text strong style={{ fontSize: 13, color: '#1890ff', display: 'block', marginBottom: 12, letterSpacing: 0.5 }}>
                            📋 目录
                        </Text>
                        {sections.map((section, idx) => (
                            <div
                                key={idx}
                                className="legal-toc-item"
                                onClick={() => scrollToSection(idx)}
                            >
                                <div className="legal-toc-dot" />
                                {section.title}
                            </div>
                        ))}
                    </div>
                )}

                {/* Sections */}
                {sections.map((section, idx) => (
                    <div id={`section-${idx}`} key={section.title} className="legal-section-card">
                        <div className="legal-section-title">
                            <span className="section-num">{idx + 1}</span>
                            {section.title}
                        </div>
                        {section.paragraphs.map((paragraph, pIdx) => (
                            <Paragraph
                                key={`${section.title}-${pIdx}`}
                                className="legal-paragraph"
                            >
                                {paragraph}
                            </Paragraph>
                        ))}
                    </div>
                ))}

                {/* Footer */}
                <div style={{
                    marginTop: 32,
                    padding: '20px 28px',
                    background: 'rgba(255,255,255,0.6)',
                    borderRadius: 12,
                    border: '1px solid #e8edf5',
                    textAlign: 'center',
                }}>
                    <Text style={{ color: '#94a3b8', fontSize: 13 }}>
                        © {new Date().getFullYear()} 禾泽云信息技术有限公司 · 保留一切权利
                    </Text>
                </div>
            </Content>
        </Layout>
    );
};

export default LegalDocumentLayout;
