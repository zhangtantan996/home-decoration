import fs from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();
const summaryJsonPath = path.resolve(rootDir, 'test-results/identity-acceptance-summary.json');
const summaryMarkdownPath = path.resolve(rootDir, 'test-results/identity-acceptance-summary.md');

function renderSummaryMarkdown(summary) {
  const lines = [
    '# Identity Phase1 自动化验收摘要',
    '',
    `- 执行时间: ${summary.startedAt || '-'} ~ ${summary.finishedAt || '-'}`,
    `- runId: ${summary.runId || '-'}`,
    `- API 基址: ${summary.env?.apiBaseUrl || '-'}`,
    `- Admin 地址: ${summary.env?.adminOrigin || '-'}`,
    `- 门禁策略: ${summary.gate?.policy || '-'}`,
    `- 总结论: **${String(summary.finalStatus || 'unknown').toUpperCase()}**`,
    '',
  ];

  if (Array.isArray(summary.projects) && summary.projects.length > 0) {
    lines.push('## 项目结果');
    lines.push('');
    lines.push('| Project | Status | ExitCode | Duration(s) |');
    lines.push('|---|---:|---:|---:|');

    for (const project of summary.projects) {
      lines.push(
        `| ${project.name} | ${project.status} | ${project.exitCode} | ${((project.durationMs || 0) / 1000).toFixed(2)} |`,
      );
    }

    lines.push('');
  }

  if (summary.cleanup) {
    lines.push('## 清理结果');
    lines.push('');
    lines.push(`- 模式: ${summary.cleanup.mode || '-'}`);
    lines.push(`- 状态: ${summary.cleanup.status || '-'}`);
    if (summary.cleanup.message) {
      lines.push(`- 说明: ${summary.cleanup.message}`);
    }
    lines.push('');
  }

  lines.push('## 产物路径');
  lines.push('');
  lines.push(`- JSON: \`${summaryJsonPath}\``);
  lines.push(`- Markdown: \`${summaryMarkdownPath}\``);

  return `${lines.join('\n')}\n`;
}

async function main() {
  let summary;
  try {
    const raw = await fs.readFile(summaryJsonPath, 'utf8');
    summary = JSON.parse(raw);
  } catch (error) {
    console.error('[identity-acceptance-report] 未找到摘要 JSON，请先执行 test:identity:acceptance');
    process.exit(1);
  }

  const markdown = renderSummaryMarkdown(summary);
  await fs.mkdir(path.dirname(summaryMarkdownPath), { recursive: true });
  await fs.writeFile(summaryMarkdownPath, markdown, 'utf8');

  console.log(`[identity-acceptance-report] summary markdown updated: ${summaryMarkdownPath}`);
  console.log(markdown);
}

main().catch((error) => {
  console.error('[identity-acceptance-report] failed:', error);
  process.exit(1);
});
