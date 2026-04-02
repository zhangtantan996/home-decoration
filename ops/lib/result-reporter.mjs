import { appendEvent } from './state-store.mjs';
import { loadControlPlane } from './schema.mjs';

const TELEGRAM_BASE = 'https://api.telegram.org';

function buildResultMessage(task, execution, verification) {
  const lines = [
    `任务完成：${task.goal}`,
    '',
    `任务ID：${task.id}`,
    `负责人：${task.owner_role}`,
    `状态：${task.status}`,
    `风险：${task.risk}`,
    '',
    `摘要：${execution.summary}`,
  ];

  if ((execution.outputs ?? []).length > 0) {
    lines.push('', '输出文件：', ...execution.outputs.map((output) => `- ${output}`));
  }
  if (verification) {
    lines.push('', `验证：${verification.profile} -> ${verification.status}`);
    if (verification.stdout) {
      lines.push('', verification.stdout);
    }
    if (verification.stderr) {
      lines.push('', verification.stderr);
    }
  }
  if ((execution.blockers ?? []).length > 0) {
    lines.push('', '阻塞：', ...execution.blockers.map((blocker) => `- ${blocker}`));
  }
  return lines.join('\n');
}

async function sendTelegramMessage({ chatId, text, token }) {
  const response = await fetch(`${TELEGRAM_BASE}/bot${token}/sendMessage`, {
    body: JSON.stringify({
      chat_id: chatId,
      text,
    }),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  });
  const payload = await response.json();
  if (!response.ok || !payload.ok) {
    throw new Error(`Telegram sendMessage failed: ${JSON.stringify(payload)}`);
  }
  return payload.result;
}

async function reportTaskResult(repoRoot, { actor = 'engine', execution, task, verification = null }) {
  appendEvent(repoRoot, {
    actor,
    files: ['ops/state.yaml'],
    kind: 'result_reported',
    result: task.status,
    summary: `Reported result for task ${task.id}`,
    task_id: task.id,
  });

  const controlPlane = loadControlPlane(repoRoot);
  const source = task.intake?.requested_via;
  if (source !== 'telegram') {
    return;
  }

  const token = process.env[controlPlane.project.remote.telegram.bot_token_env];
  const chatId = process.env[controlPlane.project.remote.telegram.chat_id_env];
  if (!token || !chatId) {
    return;
  }

  const text = buildResultMessage(task, execution, verification);
  await sendTelegramMessage({ chatId, text, token });
}

export { buildResultMessage, reportTaskResult, sendTelegramMessage };
