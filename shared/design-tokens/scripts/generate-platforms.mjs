#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const tokensPath = path.join(repoRoot, 'shared', 'design-tokens', 'tokens.json');
const tokens = JSON.parse(readFileSync(tokensPath, 'utf8'));

function parseScope(args) {
  const scopeIndex = args.indexOf('--scope');
  if (scopeIndex >= 0) {
    return args[scopeIndex + 1] || 'all';
  }

  const inline = args.find((arg) => arg.startsWith('--scope='));
  if (inline) {
    return inline.slice('--scope='.length) || 'all';
  }

  return 'all';
}

function writeFile(filePath, content) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, 'utf8');
  console.log(`generated ${path.relative(repoRoot, filePath)}`);
}

function cssVars(vars) {
  return `:root {\n${Object.entries(vars).map(([name, value]) => `  --${name}: ${value};`).join('\n')}\n}\n`;
}

function tsScalar(value) {
  if (typeof value === 'string') {
    return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  }
  return String(value);
}

function tsObject(object, indent = 2) {
  const spaces = ' '.repeat(indent);
  const childSpaces = ' '.repeat(indent + 2);

  return `{\n${Object.entries(object)
    .map(([key, value]) => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        return `${childSpaces}${key}: ${tsObject(value, indent + 2)},`;
      }
      return `${childSpaces}${key}: ${tsScalar(value)},`;
    })
    .join('\n')}\n${spaces}}`;
}

function scssVariableName(key) {
  if (/^h\d+$/.test(key)) {
    return key;
  }

  return key
    .replace(/([a-z])([0-9])/g, '$1-$2')
    .replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
}

function generatedHeader(target) {
  return `/**\n * ${target}\n * Auto-generated from shared/design-tokens/tokens.json.\n * Do not edit manually.\n */\n\n`;
}

function getAppTokens(scope) {
  return tokens.apps?.[scope] || tokens.core;
}

const generators = {
  web() {
    const content = `${generatedHeader('Web CSS design tokens')}${cssVars(getAppTokens('web').cssVars)}`;
    writeFile(path.join(repoRoot, 'web', 'src', 'app', 'tokens.css'), content);
  },

  website() {
    const content = `${generatedHeader('Website CSS design tokens')}${cssVars(getAppTokens('website').cssVars)}`;
    writeFile(path.join(repoRoot, 'website', 'styles', 'tokens.css'), content);
  },

  mini() {
    const app = getAppTokens('mini');
    const tsContent = `${generatedHeader('Mini program design tokens')}export const colors = ${tsObject(app.colors)} as const;\n\nexport const radii = ${tsObject(app.radii)} as const;\n\nexport const spacing = ${tsObject(app.spacing)} as const;\n\nexport const font = ${tsObject(app.typography)} as const;\n\nexport const shadows = ${tsObject(app.shadows)} as const;\n\nexport type MiniDesignTokens = {\n  colors: typeof colors;\n  radii: typeof radii;\n  spacing: typeof spacing;\n  font: typeof font;\n  shadows: typeof shadows;\n};\n`;

    const scssContent = `${generatedHeader('Mini program SCSS design tokens')}${Object.entries(app.colors)
      .map(([key, value]) => `$color-${scssVariableName(key)}: ${value};`)
      .join('\n')}\n\n${Object.entries(app.typography)
      .map(([key, value]) => `$font-${scssVariableName(key)}: ${value}rpx;`)
      .join('\n')}\n\n${Object.entries(app.spacing)
      .map(([key, value]) => `$spacing-${scssVariableName(key)}: ${value}rpx;`)
      .join('\n')}\n\n${Object.entries(app.radii)
      .map(([key, value]) => `$radius-${scssVariableName(key)}: ${value}rpx;`)
      .join('\n')}\n\n${Object.entries(app.shadows)
      .map(([key, value]) => `$shadow-${scssVariableName(key)}: ${value};`)
      .join('\n')}\n`;

    writeFile(path.join(repoRoot, 'mini', 'src', 'theme', 'tokens.ts'), tsContent);
    writeFile(path.join(repoRoot, 'mini', 'src', 'theme', 'tokens.scss'), scssContent);
  },

  mobile() {
    const app = getAppTokens('mobile');
    const tokenContent = `${generatedHeader('React Native design tokens')}export const colors = ${tsObject(app.colors)} as const;\n\nexport const spacing = ${tsObject(app.spacing)} as const;\n\nexport const radii = ${tsObject(app.radii)} as const;\n\nexport const typography = ${tsObject(app.typography)} as const;\n\nexport const shadows = ${tsObject(app.shadows)} as const;\n\nexport type DesignTokens = {\n  colors: typeof colors;\n  spacing: typeof spacing;\n  radii: typeof radii;\n  typography: typeof typography;\n  shadows: typeof shadows;\n};\n`;

    const rawContent = `${generatedHeader('React Native raw string design tokens')}export const colorsRaw = ${tsObject(app.colors)} as const;\n\nexport const shadowsRaw = ${tsObject(app.shadows)} as const;\n`;

    writeFile(path.join(repoRoot, 'mobile', 'src', 'theme', 'tokens.ts'), tokenContent);
    writeFile(path.join(repoRoot, 'mobile', 'src', 'theme', 'tokens.raw.ts'), rawContent);
  },

  admin() {
    const app = getAppTokens('admin');
    const designTokens = app.designTokens;
    const theme = app.theme;
    const content = `import type { ThemeConfig } from 'antd';\n\n${generatedHeader('Admin Ant Design theme tokens')}export const designTokens = ${tsObject(designTokens)} as const;\n\nexport const adminTheme: ThemeConfig = {\n  token: {\n    colorPrimary: designTokens.accent,\n    colorBgContainer: designTokens.surface,\n    colorBgLayout: designTokens.page,\n    colorText: ${tsScalar(theme.colorText)},\n    colorTextSecondary: designTokens.muted,\n    colorBorder: designTokens.border,\n    borderRadius: designTokens.radiusSm,\n    fontFamily: ${tsScalar(theme.fontFamily)},\n  },\n  components: {\n    Card: {\n      borderRadiusLG: designTokens.radiusMd,\n      boxShadowTertiary: designTokens.shadowCard,\n    },\n    Table: {\n      borderRadiusLG: designTokens.radiusMd,\n      headerBg: ${tsScalar(theme.tableHeaderBg)},\n      headerColor: designTokens.muted,\n      headerSplitColor: 'transparent',\n      rowHoverBg: ${tsScalar(theme.tableRowHoverBg)},\n    },\n    Button: {\n      borderRadius: designTokens.radiusSm,\n      controlHeight: 40,\n      primaryShadow: 'none',\n    },\n    Input: {\n      borderRadius: designTokens.radiusSm,\n      controlHeight: 40,\n    },\n    Select: {\n      borderRadius: designTokens.radiusSm,\n      controlHeight: 40,\n    },\n    Tag: {\n      borderRadiusSM: 6,\n    },\n    Modal: {\n      borderRadiusLG: designTokens.radiusLg,\n    },\n    Drawer: {\n      borderRadiusLG: 0,\n    },\n  },\n};\n`;

    writeFile(path.join(repoRoot, 'admin', 'src', 'styles', 'theme.ts'), content);
  },

  merchant() {
    const app = getAppTokens('merchant');
    const dt = app.designTokens;
    const constants = app.constants;
    const stylesContent = `import type { ThemeConfig } from 'antd';\n\n${generatedHeader('Merchant Ant Design theme tokens')}export const merchantDesignTokens = ${tsObject(dt)} as const;\n\nexport const merchantTheme: ThemeConfig = {\n  token: {\n    colorPrimary: merchantDesignTokens.primaryColor,\n    colorBgContainer: merchantDesignTokens.surface,\n    colorBgLayout: merchantDesignTokens.pageBg,\n    colorText: merchantDesignTokens.textPrimary,\n    colorTextSecondary: merchantDesignTokens.textSecondary,\n    colorBorder: merchantDesignTokens.borderColor,\n    borderRadius: merchantDesignTokens.controlRadius,\n    controlHeight: merchantDesignTokens.controlHeight,\n    fontFamily: \"-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif\",\n  },\n  components: {\n    Card: {\n      borderRadiusLG: merchantDesignTokens.cardRadius,\n      boxShadowTertiary: merchantDesignTokens.softShadow,\n    },\n    Table: {\n      borderRadiusLG: merchantDesignTokens.sectionRadius,\n      headerBg: '#f8fafc',\n      headerColor: merchantDesignTokens.textSecondary,\n      headerSplitColor: 'transparent',\n    },\n    Button: {\n      borderRadius: merchantDesignTokens.controlRadius,\n      controlHeight: 40,\n      primaryShadow: 'none',\n    },\n    Input: {\n      borderRadius: merchantDesignTokens.controlRadius,\n      controlHeight: 40,\n    },\n    Select: {\n      borderRadius: merchantDesignTokens.controlRadius,\n      controlHeight: 40,\n    },\n    Modal: {\n      borderRadiusLG: merchantDesignTokens.sectionRadius,\n    },\n  },\n};\n`;

    const merchantThemeConstants = {
      primaryGradient: constants.primaryGradient,
      primaryColor: dt.primaryColor,
      primaryColorDark: dt.primaryColorDark,
      primaryColorLight: dt.primaryColorLight,
      pageBgGradient: constants.pageBgGradient,
      accentGlowStart: constants.accentGlowStart,
      accentGlowEnd: constants.accentGlowEnd,
      textPrimary: dt.textPrimary,
      textSecondary: dt.textSecondary,
      textMuted: dt.textMuted,
      borderColor: dt.borderColor,
      borderColorStrong: dt.borderColorStrong,
      surfaceBg: dt.surfaceBg,
      surfaceBorder: dt.surfaceBorder,
      surfaceShadow: dt.surfaceShadow,
      softShadow: dt.softShadow,
      hoverShadow: dt.hoverShadow,
      controlHeight: dt.controlHeight,
      controlRadius: dt.controlRadius,
      cardRadius: dt.cardRadius,
      sectionRadius: dt.sectionRadius,
      onboarding: constants.onboarding,
    };

    const constantsContent = `${generatedHeader('Merchant Center theme constants')}export const MERCHANT_THEME = ${tsObject(merchantThemeConstants)} as const;\n\nexport type MerchantTheme = typeof MERCHANT_THEME;\n`;

    writeFile(path.join(repoRoot, 'merchant', 'src', 'styles', 'theme.ts'), stylesContent);
    writeFile(path.join(repoRoot, 'merchant', 'src', 'constants', 'merchantTheme.ts'), constantsContent);
  },
};

const requestedScope = parseScope(process.argv.slice(2));
const scopes = requestedScope === 'all' ? ['web', 'website', 'mini', 'mobile', 'admin', 'merchant'] : [requestedScope];

for (const scope of scopes) {
  const generator = generators[scope];
  if (!generator) {
    throw new Error(`Unknown token scope: ${scope}`);
  }
  generator();
}
