import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import {
  fallbackPublicSiteConfig,
  findLegalDocument,
  getPublicSiteConfig,
  type PublicLegalDocument,
  type PublicSiteConfig,
} from '../../services/publicSiteConfig';

function renderBlock(block: string, index: number) {
  const lines = block
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return null;
  }

  const firstLine = lines[0];
  const restLines = lines.slice(1);

  if (firstLine.startsWith('## ')) {
    return <h2 key={`${index}-${firstLine}`}>{firstLine.slice(3)}</h2>;
  }

  if (firstLine.startsWith('### ')) {
    return <h3 key={`${index}-${firstLine}`}>{firstLine.slice(4)}</h3>;
  }

  if (lines.every((line) => line.startsWith('- '))) {
    return (
      <ul key={`${index}-${firstLine}`}>
        {lines.map((line) => (
          <li key={`${index}-${line}`}>{line.slice(2)}</li>
        ))}
      </ul>
    );
  }

  if (restLines.length > 0 && restLines.every((line) => line.startsWith('- '))) {
    return (
      <section key={`${index}-${firstLine}`}>
        <h3>{firstLine}</h3>
        <ul>
          {restLines.map((line) => (
            <li key={`${index}-${line}`}>{line.slice(2)}</li>
          ))}
        </ul>
      </section>
    );
  }

  return <p key={`${index}-${firstLine}`}>{lines.join('\n')}</p>;
}

function renderLegalContent(content: string) {
  return content
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block, index) => renderBlock(block, index));
}

function documentFromSlug(config: PublicSiteConfig, slug?: string): PublicLegalDocument {
  return findLegalDocument(config, slug || 'user-agreement');
}

const LEGAL_REFRESH_INTERVAL_MS = 60 * 1000;

export function LegalDocumentPage({ slug: fixedSlug }: { slug?: string }) {
  const params = useParams();
  const slug = fixedSlug || params.slug || 'user-agreement';
  const [config, setConfig] = useState<PublicSiteConfig>(fallbackPublicSiteConfig);
  const [loading, setLoading] = useState(true);

  const refreshConfig = useCallback(async (showLoading = false) => {
    if (showLoading) {
      setLoading(true);
    }
    try {
      const nextConfig = await getPublicSiteConfig();
      setConfig(nextConfig);
    } catch {
      setConfig((currentConfig) => currentConfig || fallbackPublicSiteConfig);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let active = true;
    void refreshConfig(true);

    const onVisibilityChange = () => {
      if (!active || document.visibilityState !== 'visible') {
        return;
      }
      void refreshConfig(false);
    };

    window.addEventListener('focus', onVisibilityChange);
    document.addEventListener('visibilitychange', onVisibilityChange);
    const timer = window.setInterval(() => {
      if (active && document.visibilityState === 'visible') {
        void refreshConfig(false);
      }
    }, LEGAL_REFRESH_INTERVAL_MS);

    return () => {
      active = false;
      window.removeEventListener('focus', onVisibilityChange);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.clearInterval(timer);
    };
  }, [refreshConfig]);

  const legalDocument = useMemo(() => documentFromSlug(config, slug), [config, slug]);

  return (
    <div className="container page-stack legal-page">
      <section className="card section-card legal-shell">
        <p className="kicker eyebrow-accent">LEGAL</p>
        <h1 className="page-title">{legalDocument.title}</h1>
        <div className="legal-prose">
          <p>
            版本：{legalDocument.version} · 生效日期：{legalDocument.effectiveDate}
            {loading ? ' · 正在同步最新配置' : ''}
          </p>
          {renderLegalContent(legalDocument.content)}
          {slug === 'third-party-sharing' && config.thirdPartyServices.length > 0 ? (
            <section>
              <h2>当前实际启用的第三方服务</h2>
              <ul>
                {config.thirdPartyServices.map((service) => (
                  <li key={`${service.category}-${service.provider}`}>
                    {service.category}：{service.provider}。用途：{service.purpose}。
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <p>
            运营主体：{config.companyName}。客服电话：{config.customerPhone}。
            {config.customerEmail ? `客服邮箱：${config.customerEmail}。` : ''}
            {config.privacyEmail ? `隐私保护邮箱：${config.privacyEmail}。` : ''}
          </p>
          <p>
            <Link to="/legal/user-agreement">用户协议</Link> · <Link to="/legal/privacy-policy">隐私政策</Link> ·{' '}
            <Link to="/legal/personal-info-collection-list">个人信息收集清单</Link> ·{' '}
            <Link to="/legal/transaction-rules">交易规则</Link> · <Link to="/legal/refund-rules">退款售后</Link> ·{' '}
            <Link to="/legal/merchant-rules">商家规则</Link> · <Link to="/legal/third-party-sharing">第三方共享清单</Link>
          </p>
        </div>
      </section>
    </div>
  );
}
