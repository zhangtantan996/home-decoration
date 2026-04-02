import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { loadControlPlane } from './lib/schema.mjs';
import { approveTask, handoffTask, loadDecisions, runVerifyProfile } from './lib/state-store.mjs';
import { createTaskFromDescription } from './lib/task-intake.mjs';
import { buildSummary } from './lib/telegram.mjs';

function json(res, statusCode, payload) {
  res.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
  res.end(`${JSON.stringify(payload, null, 2)}\n`);
}

function text(res, statusCode, payload, type = 'text/plain; charset=utf-8') {
  res.writeHead(statusCode, { 'content-type': type });
  res.end(payload);
}

function notFound(res) {
  json(res, 404, { error: 'not_found' });
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk.toString();
      if (raw.length > 1024 * 1024) {
        reject(new Error('Request body too large'));
      }
    });
    req.on('end', () => {
      if (!raw.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function createServer({ repoRoot }) {
  const webuiPath = path.join(repoRoot, 'ops', 'webui', 'index.html');

  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const snapshot = loadControlPlane(repoRoot);

      if (req.method === 'GET' && url.pathname === '/') {
        text(res, 200, fs.readFileSync(webuiPath, 'utf8'), 'text/html; charset=utf-8');
        return;
      }
      if (req.method === 'GET' && url.pathname === '/api/status') {
        json(res, 200, {
          active_session: snapshot.state.active_session,
          blockers: snapshot.state.blockers.filter((blocker) => blocker.status === 'open'),
          next_actions: snapshot.state.next_actions,
          summary: buildSummary(snapshot),
          updated_at: snapshot.state.updated_at,
        });
        return;
      }
      if (req.method === 'GET' && url.pathname === '/api/tasks') {
        json(res, 200, { tasks: snapshot.state.tasks });
        return;
      }
      if (req.method === 'POST' && url.pathname === '/api/tasks') {
        const body = await readJsonBody(req);
        const description = `${body.description ?? ''}`.trim();
        if (!description) {
          json(res, 400, { error: 'missing_description' });
          return;
        }
        const task = createTaskFromDescription(repoRoot, {
          actor: 'webui',
          description,
          source: 'webui',
        });
        json(res, 200, { task });
        return;
      }
      if (req.method === 'GET' && url.pathname === '/api/blockers') {
        json(res, 200, { blockers: snapshot.state.blockers });
        return;
      }
      if (req.method === 'GET' && url.pathname === '/api/events') {
        const limit = Number.parseInt(url.searchParams.get('limit') ?? '20', 10);
        json(res, 200, { events: snapshot.events.slice(-Math.max(1, limit)).reverse() });
        return;
      }
      if (req.method === 'GET' && url.pathname === '/api/decisions') {
        json(res, 200, { markdown: loadDecisions(repoRoot) });
        return;
      }
      if (req.method === 'GET' && url.pathname === '/api/profiles') {
        json(res, 200, {
          profiles: snapshot.project.verify_profiles.map((profile) => ({
            cwd: profile.cwd,
            description: profile.description,
            id: profile.id,
            remote_allowed: profile.remote_allowed,
          })),
        });
        return;
      }

      const approveMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)\/approve$/);
      if (req.method === 'POST' && approveMatch) {
        const task = approveTask(repoRoot, { actor: 'webui', taskId: decodeURIComponent(approveMatch[1]) });
        json(res, 200, { task });
        return;
      }

      const handoffMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)\/handoff$/);
      if (req.method === 'POST' && handoffMatch) {
        const body = await readJsonBody(req);
        const task = handoffTask(repoRoot, {
          actor: 'webui',
          reason: body.reason ?? '',
          taskId: decodeURIComponent(handoffMatch[1]),
          toRole: body.to_role,
        });
        json(res, 200, { task });
        return;
      }

      const runMatch = url.pathname.match(/^\/api\/profiles\/([^/]+)\/run$/);
      if (req.method === 'POST' && runMatch) {
        const profileId = decodeURIComponent(runMatch[1]);
        const profile = snapshot.project.verify_profiles.find((candidate) => candidate.id === profileId);
        if (!profile) {
          json(res, 404, { error: 'unknown_profile' });
          return;
        }
        if (!profile.remote_allowed) {
          json(res, 403, { error: 'profile_not_remote_allowed' });
          return;
        }
        const result = await runVerifyProfile(repoRoot, { actor: 'webui', profileId });
        json(res, 200, result);
        return;
      }

      notFound(res);
    } catch (error) {
      json(res, 500, { error: error.message });
    }
  });
}

function startServer({ host, port, repoRoot }) {
  const server = createServer({ repoRoot });
  return new Promise((resolve) => {
    server.listen(port, host, () => resolve(server));
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const snapshot = loadControlPlane(process.cwd());
  const host = process.env.OPS_HOST ?? snapshot.project.remote.webui.listen_host;
  const port = Number.parseInt(process.env.OPS_PORT ?? `${snapshot.project.remote.webui.listen_port}`, 10);
  startServer({ host, port, repoRoot: snapshot.repoRoot }).then(() => {
    console.log(`ops control plane listening on http://${host}:${port}`);
  });
}

export { createServer, startServer };
