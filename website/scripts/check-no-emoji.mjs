import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const websiteRoot = path.resolve(__dirname, '..');

const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu;
const targets = [
    path.join(websiteRoot, 'index.html'),
];

async function walk(dir, exts) {
    const entries = await readdir(dir, { withFileTypes: true });
    const files = await Promise.all(entries.map(async (entry) => {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            return walk(fullPath, exts);
        }
        if (exts.has(path.extname(entry.name))) {
            return [fullPath];
        }
        return [];
    }));
    return files.flat();
}

async function collectTargets() {
    const styleFiles = await walk(path.join(websiteRoot, 'styles'), new Set(['.css']));
    const scriptFiles = await walk(path.join(websiteRoot, 'scripts'), new Set(['.js', '.mjs']));
    const langFiles = await walk(path.join(websiteRoot, 'scripts', 'lang'), new Set(['.json']));
    return [...targets, ...styleFiles, ...scriptFiles, ...langFiles];
}

function getLineNumber(source, index) {
    return source.slice(0, index).split('\n').length;
}

async function run() {
    const files = await collectTargets();
    let hasEmoji = false;

    for (const filePath of files) {
        const content = await readFile(filePath, 'utf8');
        const matches = [...content.matchAll(emojiRegex)];
        if (matches.length === 0) {
            continue;
        }
        hasEmoji = true;
        const relativePath = path.relative(websiteRoot, filePath);
        console.error(`Emoji detected in ${relativePath}:`);
        for (const match of matches) {
            const index = match.index ?? 0;
            const line = getLineNumber(content, index);
            const emoji = match[0];
            console.error(`  line ${line}: ${emoji}`);
        }
    }

    if (hasEmoji) {
        process.exit(1);
    }

    console.log('No emoji characters found in website icon/text assets.');
}

run().catch((error) => {
    console.error('Failed to run emoji scan:', error);
    process.exit(1);
});
