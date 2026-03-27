import { executeTelegramCommand } from './lib/telegram.mjs';
import { loadControlPlane } from './lib/schema.mjs';

const TELEGRAM_BASE = 'https://api.telegram.org';

async function telegramApi(token, method, payload) {
  const response = await fetch(`${TELEGRAM_BASE}/bot${token}/${method}`, {
    body: JSON.stringify(payload),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  });
  const json = await response.json();
  if (!response.ok || !json.ok) {
    throw new Error(`Telegram API ${method} failed: ${JSON.stringify(json)}`);
  }
  return json.result;
}

async function pollLoop({ chatId, repoRoot, token }) {
  let offset = 0;
  while (true) {
    const updates = await telegramApi(token, 'getUpdates', { offset, timeout: 25 });
    for (const update of updates) {
      offset = update.update_id + 1;
      const message = update.message;
      if (!message?.text) {
        continue;
      }
      if (chatId && `${message.chat.id}` !== `${chatId}`) {
        continue;
      }
      const result = await executeTelegramCommand({
        actor: `telegram:${message.from?.username ?? message.chat.id}`,
        repoRoot,
        text: message.text,
      });
      await telegramApi(token, 'sendMessage', {
        chat_id: message.chat.id,
        text: result.text,
      });
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const snapshot = loadControlPlane(process.cwd());
  const token = process.env[snapshot.project.remote.telegram.bot_token_env];
  const chatId = process.env[snapshot.project.remote.telegram.chat_id_env];
  if (!token) {
    console.error(`Missing ${snapshot.project.remote.telegram.bot_token_env}`);
    process.exit(1);
  }
  pollLoop({ chatId, repoRoot: snapshot.repoRoot, token }).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

export { pollLoop, telegramApi };
