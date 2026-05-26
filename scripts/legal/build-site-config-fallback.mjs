import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const legalDir = path.join(repoRoot, 'docs', 'legal');
const outputFiles = [
  path.join(repoRoot, 'shared', 'legal', 'site-config-fallback.json'),
  path.join(repoRoot, 'server', 'internal', 'service', 'legal_site_config_fallback.json'),
];

const defaultMeta = {
  brandName: '禾泽云',
  companyName: '陕西禾泽云创科技有限公司',
  companyCreditCode: '91610102MAK4U1K51H',
  companyRegisterAddress: '陕西省西安市新城区解放路166号1幢所住10401室',
  companyContactAddress: '陕西省西安市新城区解放路103号民生百货解放路店F7层7004',
  icp: '陕ICP备2026004441号',
  miniProgramRecordNumber: '',
  customerPhone: '17764774797',
  legalVersion: 'v1.3.0-20260520',
  legalEffectiveDate: '2026-05-20',
};

const docOrder = [
  '用户协议.md',
  '隐私政策.md',
  '个人信息收集清单.md',
  '平台交易规则.md',
  '退款与售后规则.md',
  '商家入驻规则.md',
  '平台入驻协议.md',
  '平台规则.md',
  '隐私与数据处理条款.md',
  '第三方信息共享清单.md',
];

function parseFrontMatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) {
    throw new Error('missing front matter');
  }
  const metaBlock = match[1];
  const meta = {};
  for (const line of metaBlock.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const idx = trimmed.indexOf(':');
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    meta[key] = value;
  }
  let body = raw.slice(match[0].length).trim();
  const titleHeading = `# ${meta.title}`;
  if (body.startsWith(titleHeading)) {
    body = body.slice(titleHeading.length).trimStart();
  }
  return { meta, body: body.trim() };
}

const docs = docOrder.map((name) => {
  const raw = fs.readFileSync(path.join(legalDir, name), 'utf8');
  const { meta, body } = parseFrontMatter(raw);
  return {
    slug: meta.slug,
    title: meta.title,
    audience: meta.audience,
    version: meta.version,
    effectiveDate: meta.effectiveDate,
    content: body,
  };
});

const bySlug = Object.fromEntries(docs.map((doc) => [doc.slug, doc.content]));

const payload = {
  ...defaultMeta,
  publicLegalSlugs: docs.filter((doc) => doc.audience === 'public').map((doc) => doc.slug),
  merchantLegalSlugs: docs.filter((doc) => doc.audience === 'merchant').map((doc) => doc.slug),
  transactionRules: bySlug['transaction-rules'],
  refundRules: bySlug['refund-rules'],
  merchantOnboardingRules: bySlug['merchant-rules'],
  legalDocuments: docs,
  thirdPartyServices: [],
};

for (const outputFile of outputFiles) {
  fs.writeFileSync(outputFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`wrote ${path.relative(repoRoot, outputFile)}`);
}
