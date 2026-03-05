#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 路径配置
const TOKENS_JSON = path.join(__dirname, '../tokens.json');
const OUTPUT_DIR = path.join(__dirname, '../../../mobile/src/theme');
const TOKENS_TS = path.join(OUTPUT_DIR, 'tokens.ts');
const TOKENS_RAW_TS = path.join(OUTPUT_DIR, 'tokens.raw.ts');

// 读取 tokens.json
const tokens = JSON.parse(fs.readFileSync(TOKENS_JSON, 'utf-8'));

// 生成 tokens.ts（对象格式）
function generateTokensTS() {
  const { colors, spacing, radii, typography } = tokens;

  // 字体大小转换：rpx / 2 = px
  const typographyPx = {};
  for (const [key, value] of Object.entries(typography)) {
    typographyPx[key] = value / 2;
  }

  const colorsStr = Object.entries(colors)
    .map(([key, value]) => `  ${key}: '${value}',`)
    .join('\n');

  const spacingStr = Object.entries(spacing)
    .map(([key, value]) => `  ${key}: ${value},`)
    .join('\n');

  const radiiStr = Object.entries(radii)
    .map(([key, value]) => `  ${key}: ${value},`)
    .join('\n');

  const typographyStr = Object.entries(typographyPx)
    .map(([key, value]) => `  ${key}: ${value},`)
    .join('\n');

  return `/**
 * Design Tokens for React Native
 * Auto-generated from shared/design-tokens/tokens.json
 * DO NOT EDIT MANUALLY
 */

export const colors = {
${colorsStr}
};

export const spacing = {
${spacingStr}
};

export const radii = {
${radiiStr}
};

export const typography = {
${typographyStr}
};

export type DesignTokens = {
  colors: typeof colors;
  spacing: typeof spacing;
  radii: typeof radii;
  typography: typeof typography;
};
`;
}

// 生成 tokens.raw.ts（字符串格式，用于动画）
function generateTokensRawTS() {
  const { colors } = tokens;

  const colorsRawStr = Object.entries(colors)
    .map(([key, value]) => `  ${key}: '${value}',`)
    .join('\n');

  return `/**
 * Design Tokens (Raw String Format) for React Native
 * Auto-generated from shared/design-tokens/tokens.json
 * Used for animations and other scenarios requiring string values
 * DO NOT EDIT MANUALLY
 */

export const colorsRaw = {
${colorsRawStr}
};
`;
}

// 确保输出目录存在
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// 写入文件
fs.writeFileSync(TOKENS_TS, generateTokensTS(), 'utf-8');
fs.writeFileSync(TOKENS_RAW_TS, generateTokensRawTS(), 'utf-8');

console.log('✅ Generated Mobile tokens:');
console.log(`   - ${TOKENS_TS}`);
console.log(`   - ${TOKENS_RAW_TS}`);
