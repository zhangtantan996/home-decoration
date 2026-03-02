import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const srcDir = path.join(root, 'src');
const emojiRegex = /[\u{1F300}-\u{1FAFF}]/gu;
const textFileRegex = /\.(ts|tsx|js|jsx|scss|css|json|md)$/;

const violations = [];

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }

    if (!textFileRegex.test(entry.name)) {
      continue;
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (emojiRegex.test(line)) {
        violations.push({
          file: path.relative(root, fullPath),
          line: index + 1,
          content: line.trim(),
        });
      }
      emojiRegex.lastIndex = 0;
    }
  }
}

if (!fs.existsSync(srcDir)) {
  console.error('src directory not found:', srcDir);
  process.exit(1);
}

walk(srcDir);

if (violations.length > 0) {
  console.error('Emoji characters are not allowed in mini/src:');
  for (const item of violations) {
    console.error(`- ${item.file}:${item.line}  ${item.content}`);
  }
  process.exit(1);
}

console.log('Emoji check passed: no emoji found in mini/src');
