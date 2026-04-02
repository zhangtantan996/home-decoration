import crypto from 'node:crypto';
import { loadControlPlane } from './schema.mjs';
import { addTask } from './state-store.mjs';

function normalize(text) {
  return text.trim().toLowerCase();
}

function slugify(text) {
  const slug = text
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
  if (slug) {
    return slug;
  }
  return crypto.createHash('sha1').update(text).digest('hex').slice(0, 8);
}

function timestampIdPart(now = new Date()) {
  return now.toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
}

function matchSignals(description, signals) {
  const normalized = normalize(description);
  return signals.filter((signal) => normalized.includes(normalize(signal)));
}

function collectModuleSignals(module, role) {
  const signals = new Set();
  signals.add(module.id);
  module.paths.forEach((modulePath) => {
    signals.add(modulePath);
    signals.add(modulePath.replace(/\/+$/, ''));
    const firstSegment = modulePath.split('/').filter(Boolean)[0];
    if (firstSegment) {
      signals.add(firstSegment);
    }
  });
  (role.route_keywords ?? []).forEach((keyword) => signals.add(keyword));
  (role.legacy_aliases ?? []).forEach((alias) => signals.add(alias));
  if (role.display_name) {
    signals.add(role.display_name);
  }
  return [...signals].filter(Boolean);
}

function classifyRequestedModules(controlPlane, description) {
  const roleMap = new Map(controlPlane.agents.roles.map((role) => [role.id, role]));
  return controlPlane.project.modules
    .map((module) => {
      const role = roleMap.get(module.owner_role);
      const hits = matchSignals(description, collectModuleSignals(module, role));
      return { hits, module, score: hits.length };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score);
}

function detectRisk(controlPlane, description, matchedModules) {
  const normalized = normalize(description);
  const riskSignals = {
    auth: ['auth', 'login', 'jwt', 'token', '认证', '登录', '权限'],
    'escrow/payment': ['payment', 'escrow', 'quote', 'wallet', '支付', '托管', '报价', '结算'],
    identity: ['identity', '实名', 'verification', '身份', '认证流程'],
    deploy: ['deploy', 'docker', 'nginx', 'release', 'gateway', '部署', '上线', '发布', '网关'],
    im: ['chat', 'im', 'tinode', 'message', '消息', '聊天'],
    'public-web': ['web', 'public', 'homepage', 'landing', '页面', '官网', '用户端'],
  };

  for (const [risk, signals] of Object.entries(riskSignals)) {
    if (signals.some((signal) => normalized.includes(normalize(signal)))) {
      return { explicit: true, risk };
    }
  }

  if (matchedModules.length === 1) {
    return {
      explicit: false,
      risk: matchedModules[0].module.default_risk ?? controlPlane.project.risk_domains[0],
    };
  }
  return {
    explicit: false,
    risk: controlPlane.project.risk_domains[0],
  };
}

function createTaskDraft(controlPlane, { actor, description, source = 'telegram' }) {
  const matchedModules = classifyRequestedModules(controlPlane, description);
  const approvalRisks = new Set(controlPlane.project.remote.webui.approval_required_risks);

  let ownerRole = 'coordinator';
  let ownedPaths = ['ops/'];
  let verifyProfile = 'ops-validate';
  let status = 'pending_approval';
  let routingReason = 'No clear module match. Coordinator must triage and split if needed.';

  if (matchedModules.length === 1) {
    const [{ module, hits }] = matchedModules;
    ownerRole = module.owner_role;
    ownedPaths = module.paths;
    verifyProfile = module.verify_profiles[0] ?? 'ops-validate';
    routingReason = `Matched module ${module.id} via signals: ${hits.join(', ')}`;
  } else if (matchedModules.length > 1) {
    routingReason = `Matched multiple modules (${matchedModules.map((item) => item.module.id).join(', ')}). Coordinator must split into bounded subtasks.`;
  }

  const riskDecision = detectRisk(controlPlane, description, matchedModules);
  if (matchedModules.length === 1 && !(riskDecision.explicit && approvalRisks.has(riskDecision.risk))) {
    status = 'queued';
  }

  return {
    approval: {
      required: status === 'pending_approval',
      status: status === 'pending_approval' ? 'pending' : 'not_required',
    },
    artifacts: [],
    assignee_session: null,
    attempt: 0,
    children: [],
    created_at: new Date().toISOString(),
    deps: [],
    done_when:
      matchedModules.length === 1
        ? `Complete the ${matchedModules[0].module.id} slice of the task within: ${matchedModules[0].module.paths.join(', ')}`
        : 'Split the task into bounded subtasks and route each subtask to exactly one module owner.',
    finished_at: null,
    goal: description,
    id: `${source}-${ownerRole}-${timestampIdPart()}-${slugify(description)}`,
    intake: {
      requested_by: actor,
      requested_modules: matchedModules.map((item) => item.module.id),
      requested_via: source,
      routing_reason: routingReason,
    },
    outputs: [],
    owned_paths: ownedPaths,
    owner_role: ownerRole,
    parent_task_id: null,
    phase: matchedModules.length > 1 ? 'planning' : 'ready',
    priority: matchedModules.length > 1 ? 2 : 1,
    risk: riskDecision.risk,
    started_at: null,
    status,
    summary: '',
    verify_profile: verifyProfile,
    verification: {
      profile: verifyProfile,
      status: 'pending',
    },
  };
}

function createTaskFromDescription(repoRoot, { actor, description, source = 'telegram' }) {
  const controlPlane = loadControlPlane(repoRoot);
  const task = createTaskDraft(controlPlane, { actor, description, source });
  return addTask(repoRoot, task, actor);
}

export {
  classifyRequestedModules,
  createTaskDraft,
  createTaskFromDescription,
  detectRisk,
};
