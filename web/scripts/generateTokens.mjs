import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const sourcePath = path.join(repoRoot, 'shared', 'design-tokens', 'tokens.json');
const outputPath = path.join(repoRoot, 'web', 'src', 'app', 'tokens.css');

const tokens = JSON.parse(readFileSync(sourcePath, 'utf8'));

const appPalette = {
  brand: '#041627',
  brandDeep: '#11263C',
  brandSoft: 'rgba(4, 22, 39, 0.08)',
  brandSurface: '#EEF4FB',
  primary: '#111827',
  secondary: '#475569',
  muted: '#64748B',
  placeholder: '#94A3B8',
  disabled: '#CBD5E1',
  border: '#DDE3EA',
  borderSoft: '#EDF1F5',
  surface: '#FFFFFF',
  surfaceMuted: '#F8FAFC',
  page: '#F3F5F7',
  pageAccent: '#EEF2F6',
  pageElevated: '#FAFBFD',
  success: '#0F766E',
  warning: '#B45309',
  danger: '#B91C1C',
  info: '#1D4ED8',
  ink: '#020617',
};

const cssEntries = [
  ['--color-brand', appPalette.brand],
  ['--color-brand-strong', appPalette.brandDeep],
  ['--color-brand-soft', appPalette.brandSoft],
  ['--color-brand-surface', appPalette.brandSurface],
  ['--color-primary', appPalette.primary],
  ['--color-secondary', appPalette.secondary],
  ['--color-muted', appPalette.muted],
  ['--color-placeholder', appPalette.placeholder],
  ['--color-disabled', appPalette.disabled],
  ['--color-border', appPalette.border],
  ['--color-border-soft', appPalette.borderSoft],
  ['--color-surface', appPalette.surface],
  ['--color-surface-muted', appPalette.surfaceMuted],
  ['--color-page', appPalette.page],
  ['--color-page-accent', appPalette.pageAccent],
  ['--color-page-elevated', appPalette.pageElevated],
  ['--color-success', appPalette.success],
  ['--color-warning', appPalette.warning],
  ['--color-danger', appPalette.danger],
  ['--color-info', appPalette.info],
  ['--color-ink', appPalette.ink],
  ['--shadow-soft', '0 18px 40px rgba(15, 23, 42, 0.06)'],
  ['--shadow-medium', '0 24px 56px rgba(15, 23, 42, 0.08)'],
  ['--shadow-hero', '0 40px 100px rgba(15, 23, 42, 0.18)'],
  ['--radius-xs', `${tokens.radii.xs + 2}px`],
  ['--radius-sm', `${tokens.radii.sm + 2}px`],
  ['--radius-md', `${tokens.radii.md + 2}px`],
  ['--radius-lg', `${tokens.radii.lg + 2}px`],
  ['--radius-xl', '24px'],
  ['--radius-2xl', '32px'],
  ['--space-2', `${tokens.spacing.xs}px`],
  ['--space-3', `${tokens.spacing.sm}px`],
  ['--space-4', `${tokens.spacing.md}px`],
  ['--space-5', '20px'],
  ['--space-6', `${tokens.spacing.lg}px`],
  ['--space-8', `${tokens.spacing.xl}px`],
  ['--space-10', '40px'],
  ['--space-12', `${tokens.spacing.xxl}px`],
  ['--space-16', '64px'],
  ['--font-family-body', "'Inter', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif"],
  ['--font-family-heading', "'Manrope', 'Noto Sans SC', 'PingFang SC', sans-serif"],
  ['--font-size-caption', '13px'],
  ['--font-size-body', '16px'],
  ['--line-height-body', '1.65'],
  ['--line-height-tight', '1.15'],
  ['--container-width', '1240px'],
];

const content = `:root {\n${cssEntries.map(([name, value]) => `  ${name}: ${value};`).join('\n')}\n}\n`;
writeFileSync(outputPath, content, 'utf8');
console.log(`generated ${path.relative(repoRoot, outputPath)} from ${path.relative(repoRoot, sourcePath)}`);
