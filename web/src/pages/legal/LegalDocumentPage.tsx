import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import {
  fallbackPublicSiteConfig,
  findLegalDocument,
  getPublicSiteConfig,
  type PublicLegalDocument,
  type PublicSiteConfig,
} from '../../services/publicSiteConfig';

function renderLegalContent(content: string) {
  return content
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block, index) => {
      if (/^\d+[.、]\s*/.test(block)) {
        const [title, ...rest] = block.split(/\n/);
        return (
          <section key={`${index}-${title}`}>
            <h2>{title}</h2>
            {rest.length > 0 ? <p>{rest.join('\n')}</p> : null}
          </section>
        );
      }
      return <p key={`${index}-${block.slice(0, 24)}`}>{block}</p>;
    });
}

function documentFromSlug(config: PublicSiteConfig, slug?: string): PublicLegalDocument {
  return findLegalDocument(config, slug || 'user-agreement');
}

export function LegalDocumentPage({ slug: fixedSlug }: { slug?: string }) {
  const params = useParams();
  const slug = fixedSlug || params.slug || 'user-agreement';
  const [config, setConfig] = useState<PublicSiteConfig>(fallbackPublicSiteConfig);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getPublicSiteConfig()
      .then((nextConfig) => {
        if (active) {
          setConfig(nextConfig);
        }
      })
      .catch(() => {
        if (active) {
          setConfig(fallbackPublicSiteConfig);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const document = useMemo(() => documentFromSlug(config, slug), [config, slug]);

  return (
    <div className="container page-stack legal-page">
      <section className="card section-card legal-shell">
        <p className="kicker eyebrow-accent">LEGAL</p>
        <h1 className="page-title">{document.title}</h1>
        <div className="legal-prose">
          <p>
            版本：{document.version} · 生效日期：{document.effectiveDate}
            {loading ? ' · 正在同步最新配置' : ''}
          </p>
          {renderLegalContent(document.content)}
          {slug === 'third-party-sharing' && config.thirdPartyServices.length > 0 ? (
            <section>
              <h2>当前实际启用的第三方服务</h2>
              {config.thirdPartyServices.map((service) => (
                <p key={`${service.category}-${service.provider}`}>
                  {service.category}：{service.provider}。用途：{service.purpose}。
                </p>
              ))}
            </section>
          ) : null}
          <p>
            运营主体：{config.companyName}。客服电话：{config.customerPhone}。
            {config.customerEmail ? `客服邮箱：${config.customerEmail}。` : ''}
            {config.privacyEmail ? `隐私保护邮箱：${config.privacyEmail}。` : ''}
          </p>
          <p>
            <Link to="/legal/user-agreement">用户协议</Link> · <Link to="/legal/privacy-policy">隐私政策</Link> ·{' '}
            <Link to="/legal/transaction-rules">交易规则</Link> · <Link to="/legal/refund-rules">退款售后</Link> ·{' '}
            <Link to="/legal/merchant-rules">商家规则</Link> · <Link to="/legal/third-party-sharing">第三方共享清单</Link>
          </p>
        </div>
      </section>
    </div>
  );
}
