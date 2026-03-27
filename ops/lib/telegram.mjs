import { loadControlPlane } from './schema.mjs';
import { approveTask, handoffTask, runVerifyProfile } from './state-store.mjs';
import { createTaskFromDescription } from './task-intake.mjs';

function buildSummary(controlPlane) {
  const counts = controlPlane.state.tasks.reduce((acc, task) => {
    acc[task.status] = (acc[task.status] ?? 0) + 1;
    return acc;
  }, {});
  const blockers = controlPlane.state.blockers.filter((blocker) => blocker.status === 'open');
  const parts = [
    `Project: ${controlPlane.project.project.name}`,
    `Active session: ${controlPlane.state.active_session.id} (${controlPlane.state.active_session.role})`,
    `Tasks: queued=${counts.queued ?? 0}, in_progress=${counts.in_progress ?? 0}, blocked=${counts.blocked ?? 0}, pending_approval=${counts.pending_approval ?? 0}, done=${counts.done ?? 0}`,
    `Open blockers: ${blockers.length}`,
    `Next: ${controlPlane.state.next_actions[0] ?? 'none'}`,
  ];
  return parts.join('\n');
}

function listBlockers(controlPlane) {
  const blockers = controlPlane.state.blockers.filter((blocker) => blocker.status === 'open');
  if (blockers.length === 0) {
    return 'No open blockers.';
  }
  return blockers.map((blocker) => `- ${blocker.id} [${blocker.task_id}]: ${blocker.reason}`).join('\n');
}

function parseTelegramCommand(text) {
  const normalized = text.trim().replace(/^\//, '');
  const [command, ...rest] = normalized.split(/\s+/);
  return {
    action: command?.toLowerCase() ?? '',
    args: rest,
    raw: normalized,
  };
}

async function executeTelegramCommand({ actor = 'telegram', repoRoot, text }) {
  const controlPlane = loadControlPlane(repoRoot);
  const command = parseTelegramCommand(text);
  const allowedActions = new Set(controlPlane.project.remote.telegram.allowed_actions);

  if (!allowedActions.has(command.action)) {
    return {
      ok: false,
      text: `Denied. Allowed actions: ${[...allowedActions].join(', ')}`,
    };
  }

  switch (command.action) {
    case 'status':
    case 'summary':
      return { ok: true, text: buildSummary(controlPlane) };
    case 'blockers':
      return { ok: true, text: listBlockers(controlPlane) };
    case 'approve': {
      const [taskId] = command.args;
      if (!taskId) {
        return { ok: false, text: 'Usage: approve <task-id>' };
      }
      const task = approveTask(repoRoot, { actor, taskId });
      return { ok: true, text: `Approved ${task.id}.` };
    }
    case 'run': {
      const [profileId] = command.args;
      if (!profileId) {
        return { ok: false, text: 'Usage: run <named-profile>' };
      }
      const profile = controlPlane.project.verify_profiles.find((candidate) => candidate.id === profileId);
      if (!profile) {
        return { ok: false, text: `Unknown profile: ${profileId}` };
      }
      if (!profile.remote_allowed) {
        return { ok: false, text: `Profile ${profileId} is not remote-runnable.` };
      }
      const result = await runVerifyProfile(repoRoot, { actor, profileId });
      return {
        ok: result.code === 0,
        text: [`Profile ${profileId}: ${result.outcome}`, result.stdout, result.stderr].filter(Boolean).join('\n\n'),
      };
    }
    case 'handoff': {
      const [taskId, toRole, ...rest] = command.args;
      if (!taskId || !toRole) {
        return { ok: false, text: 'Usage: handoff <task-id> <role> [reason]' };
      }
      const task = handoffTask(repoRoot, { actor, reason: rest.join(' '), taskId, toRole });
      return { ok: true, text: `Handed off ${task.id} to ${task.owner_role}.` };
    }
    case 'task': {
      const description = command.args.join(' ').trim();
      if (!description) {
        return { ok: false, text: 'Usage: task <任务描述>' };
      }
      const task = createTaskFromDescription(repoRoot, {
        actor,
        description,
        source: 'telegram',
      });
      const followUp = task.status === 'pending_approval' ? '\n下一步：使用 /approve <task-id> 放行。' : '';
      return {
        ok: true,
        text:
          [
            `已创建任务：${task.id}`,
            `负责人：${task.owner_role}`,
            `状态：${task.status}`,
            `风险：${task.risk}`,
            `验证项：${task.verify_profile}`,
            task.intake?.routing_reason ? `路由说明：${task.intake.routing_reason}` : '',
          ]
            .filter(Boolean)
            .join('\n') + followUp,
      };
    }
    default:
      return { ok: false, text: `Unsupported action: ${command.action}` };
  }
}

export {
  buildSummary,
  executeTelegramCommand,
  listBlockers,
  parseTelegramCommand,
};
