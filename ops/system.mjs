import { loadControlPlane } from './lib/schema.mjs';
import { startServer } from './server.mjs';
import { startEngineLoop } from './engine.mjs';
import { pollLoop } from './telegram-bot.mjs';

async function startSystem(repoRoot) {
  const snapshot = loadControlPlane(repoRoot);
  const host = process.env.OPS_HOST ?? snapshot.project.remote.webui.listen_host;
  const port = Number.parseInt(process.env.OPS_PORT ?? `${snapshot.project.remote.webui.listen_port}`, 10);
  const intervalMs = Number.parseInt(process.env.OPS_ENGINE_INTERVAL_MS ?? '5000', 10);

  await startServer({ host, port, repoRoot });
  console.log(`ops webui listening on http://${host}:${port}`);

  startEngineLoop(repoRoot, { intervalMs }).catch((error) => {
    console.error('[ops-engine]', error);
    process.exit(1);
  });
  console.log(`ops engine loop started (${intervalMs}ms interval)`);

  const token = process.env[snapshot.project.remote.telegram.bot_token_env];
  const chatId = process.env[snapshot.project.remote.telegram.chat_id_env];
  if (token) {
    pollLoop({ chatId, repoRoot, token }).catch((error) => {
      console.error('[ops-telegram]', error);
      process.exit(1);
    });
    console.log('ops telegram loop started');
  } else {
    console.log(`ops telegram loop skipped (missing ${snapshot.project.remote.telegram.bot_token_env})`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startSystem(process.cwd()).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

export { startSystem };
