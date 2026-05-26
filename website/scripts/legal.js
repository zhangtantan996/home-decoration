import fallbackSiteConfig from '../../shared/legal/site-config-fallback.json';

const publicLegalSlugSet = new Set(fallbackSiteConfig.publicLegalSlugs);
const legalLinkItems = [
  { slug: 'merchant-rules', title: '服务商展示规则', subtitle: '平台维护展示资料的基本要求' },
  { slug: 'user-agreement', title: '用户协议', subtitle: '平台使用与服务边界' },
  { slug: 'privacy-policy', title: '隐私政策', subtitle: '信息处理与权利说明' },
  { slug: 'personal-info-collection-list', title: '个人信息收集清单', subtitle: '字段级收集范围与用途说明' },
  { slug: 'transaction-rules', title: '轻预约服务规则', subtitle: '预约展示与线下跟进边界' },
  { slug: 'refund-rules', title: '预约反馈说明', subtitle: '预约调整、取消与反馈处理' },
  { slug: 'third-party-sharing', title: '第三方共享清单', subtitle: '已启用共享类型说明' },
];

function resolvePublicApiBase() {
  if (typeof window === 'undefined') {
    return '/api/v1';
  }
  const { protocol, hostname, port } = window.location;
  if ((hostname === 'localhost' || hostname === '127.0.0.1') && port && port !== '5175') {
    return `${protocol}//${hostname}:8080/api/v1`;
  }
  return '/api/v1';
}

function toPublicConfig(config) {
  return {
    ...config,
    legalDocuments: Array.isArray(config.legalDocuments)
      ? config.legalDocuments.filter((item) => publicLegalSlugSet.has(item.slug))
      : [],
  };
}

async function getSiteConfig() {
  const response = await fetch(`${resolvePublicApiBase()}/public/site-config`, {
    credentials: 'omit',
    headers: {
      Accept: 'application/json',
    },
  });
  if (!response.ok) {
    throw new Error(`site-config ${response.status}`);
  }
  const payload = await response.json();
  return toPublicConfig(payload?.data?.siteConfig || fallbackSiteConfig);
}

function findLegalDocument(config, slug) {
  return config.legalDocuments.find((item) => item.slug === slug)
    || fallbackSiteConfig.legalDocuments.find((item) => item.slug === slug)
    || fallbackSiteConfig.legalDocuments[0];
}

function createElement(tagName, className, textContent) {
  const element = document.createElement(tagName);
  if (className) {
    element.className = className;
  }
  if (typeof textContent === 'string') {
    element.textContent = textContent;
  }
  return element;
}

function renderContent(target, content) {
  target.innerHTML = '';
  const blocks = String(content || '')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  blocks.forEach((block) => {
    const lines = block
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length === 0) {
      return;
    }
    const firstLine = lines[0];
    const restLines = lines.slice(1);

    if (firstLine.startsWith('## ')) {
      target.appendChild(createElement('h2', '', firstLine.slice(3)));
      return;
    }

    if (firstLine.startsWith('### ')) {
      target.appendChild(createElement('h3', '', firstLine.slice(4)));
      if (restLines.length > 0) {
        const paragraph = createElement('p', '', restLines.join('\n'));
        target.appendChild(paragraph);
      }
      return;
    }

    if (lines.every((line) => line.startsWith('- '))) {
      const list = createElement('ul');
      lines.forEach((line) => {
        list.appendChild(createElement('li', '', line.slice(2)));
      });
      target.appendChild(list);
      return;
    }

    if (restLines.length > 0 && restLines.every((line) => line.startsWith('- '))) {
      target.appendChild(createElement('h3', '', firstLine));
      const list = createElement('ul');
      restLines.forEach((line) => {
        list.appendChild(createElement('li', '', line.slice(2)));
      });
      target.appendChild(list);
      return;
    }

    target.appendChild(createElement('p', '', lines.join('\n')));
  });
}

function renderLegalLinks(currentSlug) {
  const container = document.querySelector('[data-legal-links]');
  if (!container) {
    return;
  }
  container.innerHTML = '';
  legalLinkItems.forEach((item) => {
    const anchor = createElement('a', 'legal-link-card');
    anchor.href = `/legal/${item.slug}/`;
    if (item.slug === currentSlug) {
      anchor.setAttribute('aria-current', 'page');
    }
    anchor.textContent = item.title;
    const subtitle = createElement('span', '', item.subtitle);
    anchor.appendChild(subtitle);
    container.appendChild(anchor);
  });
}

const LEGAL_REFRESH_INTERVAL_MS = 60 * 1000;

async function bootstrap() {
  const slug = document.body.dataset.legalSlug || 'user-agreement';
  const fallbackConfig = toPublicConfig(fallbackSiteConfig);
  let config = fallbackConfig;

  const titleNode = document.querySelector('[data-legal-title]');
  const metaNode = document.querySelector('[data-legal-meta]');
  const contentNode = document.querySelector('[data-legal-content]');
  const noteNode = document.querySelector('[data-legal-note]');

  const applyConfig = (nextConfig, syncing) => {
    const documentMeta = findLegalDocument(nextConfig, slug);
    document.title = `${documentMeta.title} - 禾泽云`;

    if (titleNode) {
      titleNode.textContent = documentMeta.title;
    }
    if (metaNode) {
      metaNode.textContent = `版本：${documentMeta.version} · 生效日期：${documentMeta.effectiveDate}${syncing ? ' · 正在同步最新配置' : ''}`;
    }
    if (contentNode) {
      renderContent(contentNode, documentMeta.content);
    }
    if (noteNode) {
      const baseNote = `运营主体：${nextConfig.companyName}。客服电话：${nextConfig.customerPhone}。`;
      if (slug === 'third-party-sharing' && Array.isArray(nextConfig.thirdPartyServices) && nextConfig.thirdPartyServices.length > 0) {
        const details = nextConfig.thirdPartyServices
          .map((service) => `${service.category}：${service.provider}，用途：${service.purpose}`)
          .join('；');
        noteNode.textContent = `${baseNote} 当前实际启用的第三方服务：${details}。`;
      } else {
        noteNode.textContent = baseNote;
      }
    }
    renderLegalLinks(slug);
  };

  const refreshConfig = async (showSyncing) => {
    if (showSyncing) {
      applyConfig(config, true);
    }
    try {
      const nextConfig = await getSiteConfig();
      config = nextConfig;
    } catch {
      config = config || fallbackConfig;
    } finally {
      applyConfig(config, false);
    }
  };

  applyConfig(config, true);
  await refreshConfig(false);

  const onVisibilityChange = () => {
    if (document.visibilityState !== 'visible') {
      return;
    }
    void refreshConfig(false);
  };

  window.addEventListener('focus', onVisibilityChange);
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.setInterval(() => {
    if (document.visibilityState === 'visible') {
      void refreshConfig(false);
    }
  }, LEGAL_REFRESH_INTERVAL_MS);
}

void bootstrap();
