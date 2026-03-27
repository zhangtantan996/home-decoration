import fs from 'node:fs';
import path from 'node:path';

function ensureParent(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function readJsonYaml(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8').trim();
  if (!raw) {
    throw new Error(`Empty control-plane file: ${filePath}`);
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `Failed to parse ${filePath}. ops/*.yaml currently uses JSON-subset YAML for zero-dependency parsing. ${error.message}`,
    );
  }
}

function writeJsonYaml(filePath, value) {
  ensureParent(filePath);
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function readNdjson(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  return fs
    .readFileSync(filePath, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`Invalid NDJSON at ${filePath}:${index + 1}: ${error.message}`);
      }
    });
}

function appendNdjson(filePath, record) {
  ensureParent(filePath);
  fs.appendFileSync(filePath, `${JSON.stringify(record)}\n`, 'utf8');
}

function appendMarkdownSection(filePath, title, body) {
  ensureParent(filePath);
  const prefix = fs.existsSync(filePath) ? '\n' : '';
  fs.appendFileSync(filePath, `${prefix}## ${title}\n\n${body.trim()}\n`, 'utf8');
}

function readText(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

export {
  appendMarkdownSection,
  appendNdjson,
  readJsonYaml,
  readNdjson,
  readText,
  writeJsonYaml,
};
