#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), '..');
const baselinePath = path.join(repoRoot, 'scripts', 'frontend-style-baseline.json');

const SCOPES = {
  admin: ['admin/src'],
  merchant: ['merchant/src'],
  web: ['web/src'],
  website: ['website/index.html', 'website/scripts', 'website/styles'],
  mini: ['mini/src'],
  mobile: ['mobile/src'],
};

const STYLELINT_GLOBS = {
  admin: ['admin/src/**/*.{css,scss}'],
  merchant: ['merchant/src/**/*.{css,scss}'],
  web: ['web/src/**/*.{css,scss}'],
  website: ['website/styles/**/*.css'],
  mini: ['mini/src/**/*.scss'],
  mobile: [],
};

const SCAN_EXTENSIONS = new Set(['.css', '.scss', '.ts', '.tsx', '.js', '.jsx', '.html']);
const IGNORE_DIRS = new Set(['node_modules', 'dist', 'output', 'playwright-report', 'test-results']);
const GENERATED_OR_SOURCE_TOKEN_FILES = new Set([
  'admin/src/styles/theme.ts',
  'merchant/src/styles/theme.ts',
  'merchant/src/constants/merchantTheme.ts',
  'mini/src/theme/tokens.ts',
  'mini/src/theme/tokens.scss',
  'mobile/src/theme/tokens.ts',
  'mobile/src/theme/tokens.raw.ts',
  'web/src/app/tokens.css',
  'website/styles/tokens.css',
  'shared/design-tokens/tokens.json',
]);

const APPROVED_RAW_CONTROL_PATHS = [
  'mini/src/components/Button.tsx',
  'mini/src/components/Input.tsx',
  'mobile/src/components/primitives/',
];

const args = process.argv.slice(2);
const scope = readArg('--scope') || 'all';
const updateBaseline = args.includes('--update-baseline');
const skipStylelint = args.includes('--skip-stylelint');

if (scope !== 'all' && !SCOPES[scope]) {
  fail(`Unknown scope "${scope}". Expected one of: ${Object.keys(SCOPES).join(', ')}`);
}

const activeScopes = scope === 'all' ? Object.keys(SCOPES) : [scope];

if (!updateBaseline && !skipStylelint) {
  runStylelint(activeScopes);
}

const current = scanScopes(activeScopes);

if (updateBaseline) {
  const allCounts = scanScopes(Object.keys(SCOPES)).counts;
  writeFileSync(
    baselinePath,
    `${JSON.stringify({ version: 1, counts: sortObject(allCounts) }, null, 2)}\n`,
    'utf8',
  );
  console.log(`updated ${path.relative(repoRoot, baselinePath)} (${Object.keys(allCounts).length} violation keys)`);
  process.exit(0);
}

if (!existsSync(baselinePath)) {
  fail(`Missing ${path.relative(repoRoot, baselinePath)}. Run: node scripts/frontend-style-guard.mjs --update-baseline`);
}

const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
const baselineCounts = baseline.counts || {};
const regressions = [];

for (const [key, count] of Object.entries(current.counts)) {
  const baselineCount = baselineCounts[key] || 0;
  if (count > baselineCount) {
    regressions.push({
      key,
      added: count - baselineCount,
      sample: current.samples[key],
    });
  }
}

if (regressions.length > 0) {
  console.error('Frontend style guard found new violations:');
  for (const regression of regressions.slice(0, 30)) {
    console.error(`- +${regression.added} ${regression.sample}`);
  }
  if (regressions.length > 30) {
    console.error(`...and ${regressions.length - 30} more`);
  }
  console.error('Use design tokens or approved primitive components. Only update the baseline for intentional legacy debt.');
  process.exit(1);
}

console.log(`frontend style guard passed (${activeScopes.join(', ')})`);

function readArg(name) {
  const index = args.indexOf(name);
  if (index >= 0) {
    return args[index + 1];
  }
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  return inline ? inline.slice(name.length + 1) : undefined;
}

function runStylelint(scopes) {
  const globs = scopes.flatMap((item) => STYLELINT_GLOBS[item] || []);
  if (globs.length === 0) {
    return;
  }

  const result = spawnSync('npx', ['stylelint', ...globs, '--allow-empty-input'], {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: false,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function scanScopes(scopes) {
  const counts = {};
  const samples = {};

  for (const item of scopes) {
    for (const entry of SCOPES[item]) {
      for (const filePath of collectFiles(path.join(repoRoot, entry))) {
        scanFile(item, filePath, counts, samples);
      }
    }
  }

  return { counts, samples };
}

function collectFiles(targetPath) {
  if (!existsSync(targetPath)) {
    return [];
  }

  const stat = statSync(targetPath);
  if (stat.isFile()) {
    return SCAN_EXTENSIONS.has(path.extname(targetPath)) ? [targetPath] : [];
  }

  const files = [];
  for (const name of readdirSync(targetPath)) {
    if (IGNORE_DIRS.has(name)) {
      continue;
    }
    const childPath = path.join(targetPath, name);
    const childStat = statSync(childPath);
    if (childStat.isDirectory()) {
      files.push(...collectFiles(childPath));
    } else if (SCAN_EXTENSIONS.has(path.extname(childPath))) {
      files.push(childPath);
    }
  }
  return files;
}

function scanFile(scopeName, filePath, counts, samples) {
  const relativePath = toRelative(filePath);
  if (GENERATED_OR_SOURCE_TOKEN_FILES.has(relativePath)) {
    return;
  }

  const content = readFileSync(filePath, 'utf8');
  const extension = path.extname(filePath);

  if (extension === '.css' || extension === '.scss') {
    addMatches(relativePath, 'hardcoded-style-color', content, /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/g, counts, samples);
  }

  if (['.ts', '.tsx', '.js', '.jsx', '.html'].includes(extension)) {
    addMatches(relativePath, 'hardcoded-code-color', content, /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/g, counts, samples);
  }

  if (['.tsx', '.jsx'].includes(extension)) {
    addMatches(relativePath, 'inline-style-object', content, /style=\{\{[^]*?\}\}/g, counts, samples);
    addMatches(relativePath, 'raw-web-button', content, /<button\b/g, counts, samples);
  }

  if (extension === '.html') {
    addMatches(relativePath, 'inline-style-attribute', content, /style="[^"]+"/g, counts, samples);
    addMatches(relativePath, 'raw-web-button', content, /<button\b/g, counts, samples);
  }

  if (scopeName === 'mini' && !isApprovedRawControlPath(relativePath)) {
    addMatches(
      relativePath,
      'raw-taro-control-import',
      content,
      /import\s+\{[^}]*\b(Button|Input|Switch|Checkbox)\b[^}]*\}\s+from\s+['"]@tarojs\/components['"]/g,
      counts,
      samples,
    );
  }

  if (scopeName === 'mobile' && !isApprovedRawControlPath(relativePath)) {
    addMatches(
      relativePath,
      'raw-react-native-control-import',
      content,
      /import\s+\{[^}]*\b(Pressable|TouchableOpacity|TouchableHighlight|TouchableWithoutFeedback|TextInput)\b[^}]*\}\s+from\s+['"]react-native['"]/g,
      counts,
      samples,
    );
  }
}

function addMatches(relativePath, rule, content, regex, counts, samples) {
  for (const match of content.matchAll(regex)) {
    const snippet = normalizeSnippet(match[0]);
    const key = `${rule}\t${relativePath}\t${snippet}`;
    counts[key] = (counts[key] || 0) + 1;
    samples[key] ||= `${rule} in ${relativePath}: ${snippet}`;
  }
}

function normalizeSnippet(value) {
  return value.replace(/\s+/g, ' ').trim().slice(0, 180);
}

function toRelative(filePath) {
  return path.relative(repoRoot, filePath).split(path.sep).join('/');
}

function isApprovedRawControlPath(relativePath) {
  return APPROVED_RAW_CONTROL_PATHS.some((approvedPath) => (
    approvedPath.endsWith('/') ? relativePath.startsWith(approvedPath) : relativePath === approvedPath
  ));
}

function sortObject(object) {
  return Object.fromEntries(Object.entries(object).sort(([left], [right]) => left.localeCompare(right)));
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
