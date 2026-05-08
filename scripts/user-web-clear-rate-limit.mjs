#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const REDIS_KEY_PATTERNS = ['rate_limit:*', 'admin_login_fail:*'];
const isWindows = process.platform === 'win32';

const envHas = (key) => Object.prototype.hasOwnProperty.call(process.env, key);

const containerExplicit = envHas('USER_WEB_FIXTURE_REDIS_CONTAINER');
const redisContainer = containerExplicit ? (process.env.USER_WEB_FIXTURE_REDIS_CONTAINER || '') : 'home_decor_redis_local';

const endpointExplicit = envHas('USER_WEB_FIXTURE_REDIS_HOST')
  || envHas('USER_WEB_FIXTURE_REDIS_PORT')
  || envHas('REDIS_HOST')
  || envHas('REDIS_PORT');

const redisHost = process.env.USER_WEB_FIXTURE_REDIS_HOST || process.env.REDIS_HOST || '127.0.0.1';
const redisPort = process.env.USER_WEB_FIXTURE_REDIS_PORT || process.env.REDIS_PORT || '6380';

const passwordExplicit = envHas('USER_WEB_FIXTURE_REDIS_PASSWORD') || envHas('REDIS_PASSWORD');
let redisPassword = '';
if (envHas('USER_WEB_FIXTURE_REDIS_PASSWORD')) {
  redisPassword = process.env.USER_WEB_FIXTURE_REDIS_PASSWORD || '';
} else if (envHas('REDIS_PASSWORD')) {
  redisPassword = process.env.REDIS_PASSWORD || '';
} else if (endpointExplicit) {
  redisPassword = '';
} else {
  redisPassword = 'local_dev_redis_password_change_me';
}

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: 'utf8',
    ...options,
  });
}

function hasCommand(command) {
  const probe = isWindows
    ? run('where', [command], { stdio: 'ignore' })
    : run('which', [command], { stdio: 'ignore' });
  return probe.status === 0;
}

function combinedOutput(result) {
  return `${result.stdout || ''}${result.stderr || ''}`.trim();
}

function isAuthFailure(payload) {
  return payload.includes('NOAUTH')
    || payload.includes('WRONGPASS')
    || payload.includes('AUTH failed');
}

function resolveDockerRedisPassword() {
  if (passwordExplicit || !redisContainer) {
    return;
  }
  if (!hasCommand('docker')) {
    return;
  }

  const inspect = run('docker', [
    'inspect',
    redisContainer,
    '--format',
    '{{range .Config.Cmd}}{{println .}}{{end}}',
  ]);
  const payload = combinedOutput(inspect);
  if (!payload) {
    return;
  }

  const parts = payload.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    if (part === '--requirepass' && index + 1 < parts.length) {
      redisPassword = parts[index + 1];
      return;
    }
    if (part.startsWith('--requirepass=')) {
      redisPassword = part.slice('--requirepass='.length);
      return;
    }
  }
}

function redisCliHost(args) {
  const env = { ...process.env };
  if (redisPassword) {
    env.REDISCLI_AUTH = redisPassword;
  }
  return run('redis-cli', ['-h', redisHost, '-p', String(redisPort), ...args], { env });
}

function redisCliDocker(args) {
  const dockerArgs = ['exec'];
  if (redisPassword) {
    dockerArgs.push('-e', `REDISCLI_AUTH=${redisPassword}`);
  }
  dockerArgs.push(redisContainer, 'redis-cli', ...args);
  return run('docker', dockerArgs);
}

function clearKeysByPattern(mode, pattern) {
  const listResult = mode === 'docker'
    ? redisCliDocker(['--raw', 'KEYS', pattern])
    : redisCliHost(['--raw', 'KEYS', pattern]);

  const payload = combinedOutput(listResult);
  if (isAuthFailure(payload)) {
    if (mode === 'docker') {
      console.error(`Unable to clear redis keys pattern '${pattern}' in docker container ${redisContainer}: redis auth failed`);
    } else {
      console.error(`Unable to clear redis keys pattern '${pattern}' via redis-cli: redis auth failed`);
    }
    return false;
  }

  if (listResult.status !== 0) {
    if (mode === 'docker') {
      console.error(`Unable to list redis keys pattern '${pattern}' in docker container ${redisContainer}: ${payload || 'redis-cli failed'}`);
    } else {
      console.error(`Unable to list redis keys pattern '${pattern}' via redis-cli: ${payload || 'redis-cli failed'}`);
    }
    return false;
  }

  const keys = payload
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter((item) => item && !item.startsWith('('));

  if (keys.length === 0) {
    if (mode === 'docker') {
      console.log(`No redis keys found for pattern '${pattern}' in docker container: ${redisContainer}`);
    } else {
      console.log(`No redis keys found for pattern '${pattern}' via redis-cli`);
    }
    return true;
  }

  let cleared = 0;
  for (const key of keys) {
    const delResult = mode === 'docker'
      ? redisCliDocker(['DEL', key])
      : redisCliHost(['DEL', key]);
    if (delResult.status !== 0) {
      const delPayload = combinedOutput(delResult);
      if (mode === 'docker') {
        console.error(`Unable to delete redis key '${key}' in docker container ${redisContainer}: ${delPayload || 'redis-cli failed'}`);
      } else {
        console.error(`Unable to delete redis key '${key}' via redis-cli: ${delPayload || 'redis-cli failed'}`);
      }
      return false;
    }
    cleared += 1;
  }

  if (mode === 'docker') {
    console.log(`Cleared ${cleared} keys for pattern '${pattern}' via docker container: ${redisContainer}`);
  } else {
    console.log(`Cleared ${cleared} keys for pattern '${pattern}' via redis-cli`);
  }
  return true;
}

function clearWithRedisCli() {
  let ok = true;
  for (const pattern of REDIS_KEY_PATTERNS) {
    ok = clearKeysByPattern('host', pattern) && ok;
  }
  return ok;
}

function isContainerRunning(containerName) {
  if (!containerName) {
    return false;
  }
  const ps = run('docker', ['ps', '--format', '{{.Names}}']);
  if (ps.status !== 0) {
    return false;
  }
  return ps.stdout.split(/\r?\n/).map((item) => item.trim()).includes(containerName);
}

function clearWithDocker() {
  resolveDockerRedisPassword();
  let ok = true;
  for (const pattern of REDIS_KEY_PATTERNS) {
    ok = clearKeysByPattern('docker', pattern) && ok;
  }
  return ok;
}

function main() {
  const hasRedisCli = hasCommand('redis-cli');
  const hasDocker = hasCommand('docker');

  if (endpointExplicit && hasRedisCli) {
    if (!clearWithRedisCli()) {
      process.exitCode = 1;
    }
    return;
  }

  if (
    redisContainer
    && (!endpointExplicit || containerExplicit)
    && hasDocker
    && isContainerRunning(redisContainer)
  ) {
    if (!clearWithDocker()) {
      process.exitCode = 1;
    }
    return;
  }

  if (hasRedisCli) {
    if (!clearWithRedisCli()) {
      process.exitCode = 1;
    }
    return;
  }

  console.error('redis-cli not found and redis container unavailable; skip redis login limiter cleanup');
  process.exitCode = 1;
}

main();
