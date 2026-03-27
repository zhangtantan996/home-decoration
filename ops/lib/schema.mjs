import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJsonYaml, readNdjson } from './file-format.mjs';

const EVENT_KINDS = new Set([
  'progress',
  'blocker',
  'decision',
  'handoff',
  'verify',
  'release',
  'task_split',
  'task_started',
  'verification_started',
  'verification_passed',
  'verification_failed',
  'result_reported',
]);
const TELEGRAM_ACTIONS = new Set(['status', 'summary', 'blockers', 'approve', 'run', 'handoff', 'task']);
const TASK_STATUSES = new Set([
  'queued',
  'planning',
  'ready',
  'in_progress',
  'verifying',
  'blocked',
  'pending_approval',
  'approved',
  'failed',
  'done',
  'cancelled',
]);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function asArray(value, label) {
  assert(Array.isArray(value), `${label} must be an array`);
  return value;
}

function asString(value, label) {
  assert(typeof value === 'string' && value.trim().length > 0, `${label} must be a non-empty string`);
  return value;
}

function asBoolean(value, label) {
  assert(typeof value === 'boolean', `${label} must be a boolean`);
  return value;
}

function asObject(value, label) {
  assert(value !== null && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
  return value;
}

function asOptionalString(value, label) {
  if (value === undefined) {
    return undefined;
  }
  return asString(value, label);
}

function asOptionalStringArray(value, label) {
  if (value === undefined) {
    return [];
  }
  return asArray(value, label).map((item, index) => asString(item, `${label}[${index}]`));
}

function resolveRepoRoot(explicitRoot) {
  if (explicitRoot) {
    return path.resolve(explicitRoot);
  }
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
}

function getControlPlanePaths(repoRoot) {
  const base = path.join(repoRoot, 'ops');
  return {
    base,
    agents: path.join(base, 'agents.yaml'),
    decisions: path.join(base, 'decisions.md'),
    events: path.join(base, 'events.ndjson'),
    project: path.join(base, 'project.yaml'),
    runbook: path.join(base, 'runbook.md'),
    state: path.join(base, 'state.yaml'),
    webui: path.join(base, 'webui', 'index.html'),
  };
}

function normalizePrefix(prefix) {
  return prefix.endsWith('/') ? prefix : `${prefix}/`;
}

function pathBelongsToPrefix(targetPath, prefix) {
  const normalizedTarget = targetPath.replaceAll('\\', '/');
  const normalizedPrefix = normalizePrefix(prefix.replaceAll('\\', '/'));
  return normalizedTarget === normalizedPrefix.slice(0, -1) || normalizedTarget.startsWith(normalizedPrefix);
}

function getRoleMap(agentsConfig) {
  return new Map(agentsConfig.roles.map((role) => [role.id, role]));
}

function getVerifyProfileMap(projectConfig) {
  return new Map(projectConfig.verify_profiles.map((profile) => [profile.id, profile]));
}

function getModuleMap(projectConfig) {
  return new Map(projectConfig.modules.map((module) => [module.id, module]));
}

function inferModulesForPaths(projectConfig, ownedPaths) {
  const modules = new Set();
  for (const ownedPath of ownedPaths) {
    for (const module of projectConfig.modules) {
      if (module.paths.some((prefix) => pathBelongsToPrefix(ownedPath, prefix))) {
        modules.add(module.id);
      }
    }
  }
  return [...modules];
}

function validateProjectConfig(projectConfig) {
  const config = asObject(projectConfig, 'project.yaml');
  const project = asObject(config.project, 'project');
  asString(project.name, 'project.name');
  asString(project.type, 'project.type');
  asString(project.primary_runtime, 'project.primary_runtime');
  asArray(project.docs_order, 'project.docs_order').forEach((item, index) => asString(item, `project.docs_order[${index}]`));

  const modules = asArray(config.modules, 'modules');
  assert(modules.length > 0, 'modules must not be empty');
  modules.forEach((module, index) => {
    const item = asObject(module, `modules[${index}]`);
    asString(item.id, `modules[${index}].id`);
    if (item.default_risk !== undefined) {
      asString(item.default_risk, `modules[${index}].default_risk`);
    }
    asArray(item.paths, `modules[${index}].paths`).forEach((modulePath, pathIndex) => asString(modulePath, `modules[${index}].paths[${pathIndex}]`));
    asString(item.owner_role, `modules[${index}].owner_role`);
    asArray(item.verify_profiles, `modules[${index}].verify_profiles`).forEach((profile, profileIndex) =>
      asString(profile, `modules[${index}].verify_profiles[${profileIndex}]`),
    );
  });

  asArray(config.risk_domains, 'risk_domains').forEach((risk, index) => asString(risk, `risk_domains[${index}]`));

  const verifyProfiles = asArray(config.verify_profiles, 'verify_profiles');
  assert(verifyProfiles.length > 0, 'verify_profiles must not be empty');
  verifyProfiles.forEach((profile, index) => {
    const item = asObject(profile, `verify_profiles[${index}]`);
    asString(item.id, `verify_profiles[${index}].id`);
    asString(item.description, `verify_profiles[${index}].description`);
    asString(item.cwd, `verify_profiles[${index}].cwd`);
    const command = asArray(item.command, `verify_profiles[${index}].command`);
    assert(command.length > 0, `verify_profiles[${index}].command must not be empty`);
    command.forEach((segment, segmentIndex) => asString(segment, `verify_profiles[${index}].command[${segmentIndex}]`));
    asBoolean(item.remote_allowed, `verify_profiles[${index}].remote_allowed`);
  });

  const remote = asObject(config.remote, 'remote');
  const webui = asObject(remote.webui, 'remote.webui');
  asBoolean(webui.enabled, 'remote.webui.enabled');
  asString(webui.listen_host, 'remote.webui.listen_host');
  assert(Number.isInteger(webui.listen_port) && webui.listen_port > 0, 'remote.webui.listen_port must be a positive integer');
  asArray(webui.approval_required_risks, 'remote.webui.approval_required_risks').forEach((risk, index) =>
    asString(risk, `remote.webui.approval_required_risks[${index}]`),
  );
  asArray(webui.features, 'remote.webui.features').forEach((feature, index) => asString(feature, `remote.webui.features[${index}]`));

  const telegram = asObject(remote.telegram, 'remote.telegram');
  asBoolean(telegram.enabled, 'remote.telegram.enabled');
  asArray(telegram.allowed_actions, 'remote.telegram.allowed_actions').forEach((action, index) => {
    const name = asString(action, `remote.telegram.allowed_actions[${index}]`);
    assert(TELEGRAM_ACTIONS.has(name), `Unsupported Telegram action: ${name}`);
  });
  asArray(telegram.denied_actions, 'remote.telegram.denied_actions').forEach((action, index) =>
    asString(action, `remote.telegram.denied_actions[${index}]`),
  );
  asString(telegram.bot_token_env, 'remote.telegram.bot_token_env');
  asString(telegram.chat_id_env, 'remote.telegram.chat_id_env');

  asArray(config.legacy_ignored, 'legacy_ignored').forEach((item, index) => asString(item, `legacy_ignored[${index}]`));
  return config;
}

function validateAgentsConfig(agentsConfig) {
  const config = asObject(agentsConfig, 'agents.yaml');
  const roles = asArray(config.roles, 'roles');
  assert(roles.length > 0, 'roles must not be empty');
  roles.forEach((role, index) => {
    const item = asObject(role, `roles[${index}]`);
    asString(item.id, `roles[${index}].id`);
    asOptionalString(item.display_name, `roles[${index}].display_name`);
    asString(item.purpose, `roles[${index}].purpose`);
    asArray(item.owned_paths, `roles[${index}].owned_paths`).forEach((ownedPath, ownedIndex) =>
      asString(ownedPath, `roles[${index}].owned_paths[${ownedIndex}]`),
    );
    asArray(item.forbidden_paths, `roles[${index}].forbidden_paths`).forEach((forbiddenPath, forbiddenIndex) =>
      asString(forbiddenPath, `roles[${index}].forbidden_paths[${forbiddenIndex}]`),
    );
    asArray(item.default_checks, `roles[${index}].default_checks`).forEach((check, checkIndex) =>
      asString(check, `roles[${index}].default_checks[${checkIndex}]`),
    );
    asOptionalStringArray(item.legacy_aliases, `roles[${index}].legacy_aliases`);
    asOptionalStringArray(item.route_keywords, `roles[${index}].route_keywords`);
    asArray(item.escalation_rules, `roles[${index}].escalation_rules`).forEach((rule, ruleIndex) =>
      asString(rule, `roles[${index}].escalation_rules[${ruleIndex}]`),
    );
  });
  return config;
}

function validateStateModel(stateModel) {
  const state = asObject(stateModel, 'state.yaml');
  asString(state.project, 'state.project');
  asString(state.updated_at, 'state.updated_at');
  const activeSession = asObject(state.active_session, 'state.active_session');
  asString(activeSession.id, 'state.active_session.id');
  asString(activeSession.role, 'state.active_session.role');
  asString(activeSession.started_at, 'state.active_session.started_at');
  asString(activeSession.summary, 'state.active_session.summary');

  asArray(state.tasks, 'tasks').forEach((task, index) => {
    const item = asObject(task, `tasks[${index}]`);
    asString(item.id, `tasks[${index}].id`);
    asString(item.goal, `tasks[${index}].goal`);
    const status = asString(item.status, `tasks[${index}].status`);
    assert(TASK_STATUSES.has(status), `Unsupported task status: ${status}`);
    asString(item.owner_role, `tasks[${index}].owner_role`);
    asArray(item.owned_paths, `tasks[${index}].owned_paths`).forEach((ownedPath, pathIndex) =>
      asString(ownedPath, `tasks[${index}].owned_paths[${pathIndex}]`),
    );
    asArray(item.deps, `tasks[${index}].deps`).forEach((dep, depIndex) => asString(dep, `tasks[${index}].deps[${depIndex}]`));
    asString(item.risk, `tasks[${index}].risk`);
    asString(item.verify_profile, `tasks[${index}].verify_profile`);
    asArray(item.outputs, `tasks[${index}].outputs`).forEach((output, outputIndex) =>
      asString(output, `tasks[${index}].outputs[${outputIndex}]`),
    );
  });

  asArray(state.blockers, 'blockers').forEach((blocker, index) => {
    const item = asObject(blocker, `blockers[${index}]`);
    asString(item.id, `blockers[${index}].id`);
    asString(item.task_id, `blockers[${index}].task_id`);
    asString(item.reason, `blockers[${index}].reason`);
    asString(item.status, `blockers[${index}].status`);
    asString(item.opened_at, `blockers[${index}].opened_at`);
    assert(item.resolved_at === null || typeof item.resolved_at === 'string', `blockers[${index}].resolved_at must be string or null`);
  });

  asArray(state.next_actions, 'next_actions').forEach((action, index) => asString(action, `next_actions[${index}]`));
  return state;
}

function validateEventRecord(record) {
  const event = asObject(record, 'event');
  asString(event.ts, 'event.ts');
  asString(event.actor, 'event.actor');
  asString(event.task_id, 'event.task_id');
  const kind = asString(event.kind, 'event.kind');
  assert(EVENT_KINDS.has(kind), `Unsupported event kind: ${kind}`);
  asString(event.summary, 'event.summary');
  asArray(event.files, 'event.files').forEach((file, index) => asString(file, `event.files[${index}]`));
  asArray(event.commands, 'event.commands').forEach((command, index) => asString(command, `event.commands[${index}]`));
  asString(event.result, 'event.result');
  assert(event.commit === null || typeof event.commit === 'string', 'event.commit must be string or null');
  return event;
}

function validateTaskRouting(task, projectConfig, agentsConfig) {
  const roleMap = getRoleMap(agentsConfig);
  const verifyProfileMap = getVerifyProfileMap(projectConfig);
  const role = roleMap.get(task.owner_role);
  assert(role, `Task ${task.id} references unknown role ${task.owner_role}`);
  assert(verifyProfileMap.has(task.verify_profile), `Task ${task.id} references unknown verify profile ${task.verify_profile}`);

  const taskModules = inferModulesForPaths(projectConfig, task.owned_paths);
  if (taskModules.length > 1) {
    assert(
      task.owner_role === 'coordinator',
      `Task ${task.id} spans multiple modules (${taskModules.join(', ')}) and must be split or owned by coordinator`,
    );
  }

  task.owned_paths.forEach((ownedPath) => {
    const allowed = role.owned_paths.some((prefix) => pathBelongsToPrefix(ownedPath, prefix));
    assert(allowed, `Task ${task.id} path ${ownedPath} is outside role ${role.id} ownership`);
    const forbidden = role.forbidden_paths.some((prefix) => pathBelongsToPrefix(ownedPath, prefix));
    assert(!forbidden, `Task ${task.id} path ${ownedPath} is forbidden for role ${role.id}`);
  });
}

function validateVerifierIsolation(stateModel) {
  const nonVerifierPaths = [];
  for (const task of stateModel.tasks) {
    if (task.owner_role === 'verifier') {
      for (const verifierPath of task.owned_paths) {
        const overlap = nonVerifierPaths.find((ownedPath) =>
          pathBelongsToPrefix(verifierPath, ownedPath) || pathBelongsToPrefix(ownedPath, verifierPath),
        );
        assert(!overlap, `Verifier path ${verifierPath} overlaps with non-verifier path ${overlap}`);
      }
      continue;
    }
    nonVerifierPaths.push(...task.owned_paths);
  }
}

function validateModuleOwnership(projectConfig, agentsConfig) {
  const roleMap = getRoleMap(agentsConfig);
  const verifyProfileMap = getVerifyProfileMap(projectConfig);
  for (const module of projectConfig.modules) {
    const role = roleMap.get(module.owner_role);
    assert(role, `Module ${module.id} references unknown role ${module.owner_role}`);
    module.paths.forEach((modulePath) => {
      const allowed = role.owned_paths.some((prefix) => pathBelongsToPrefix(modulePath, prefix));
      assert(allowed, `Module ${module.id} path ${modulePath} is outside role ${role.id} ownership`);
    });
    module.verify_profiles.forEach((profileId) => {
      assert(verifyProfileMap.has(profileId), `Module ${module.id} references unknown verify profile ${profileId}`);
    });
  }
}

function loadControlPlane(repoRoot) {
  const root = resolveRepoRoot(repoRoot);
  const paths = getControlPlanePaths(root);
  const project = validateProjectConfig(readJsonYaml(paths.project));
  const agents = validateAgentsConfig(readJsonYaml(paths.agents));
  const state = validateStateModel(readJsonYaml(paths.state));
  const events = readNdjson(paths.events).map((event) => validateEventRecord(event));

  validateModuleOwnership(project, agents);
  state.tasks.forEach((task) => validateTaskRouting(task, project, agents));
  validateVerifierIsolation(state);

  state.tasks.forEach((task) => {
    task.deps.forEach((dep) => assert(state.tasks.some((candidate) => candidate.id === dep), `Task ${task.id} dependency ${dep} does not exist`));
  });
  state.blockers.forEach((blocker) => {
    assert(state.tasks.some((task) => task.id === blocker.task_id), `Blocker ${blocker.id} references unknown task ${blocker.task_id}`);
  });

  return { agents, events, paths, project, repoRoot: root, state };
}

export {
  EVENT_KINDS,
  TASK_STATUSES,
  TELEGRAM_ACTIONS,
  getControlPlanePaths,
  inferModulesForPaths,
  loadControlPlane,
  pathBelongsToPrefix,
  resolveRepoRoot,
  validateAgentsConfig,
  validateEventRecord,
  validateModuleOwnership,
  validateProjectConfig,
  validateStateModel,
  validateTaskRouting,
  validateVerifierIsolation,
};
