import { loadControlPlane } from './lib/schema.mjs';
import { runVerifyProfile, setActiveSession } from './lib/state-store.mjs';
import { planCoordinatorTasks } from './lib/planner.mjs';
import { blockTasksWithFailedDeps, loadRunnableTasks } from './lib/dispatcher.mjs';
import {
  getTaskById,
  markTaskBlocked,
  markTaskCompleted,
  markTaskFailed,
  markTaskStarted,
  markTaskVerifying,
  syncParentStatuses,
} from './lib/state-machine.mjs';
import { reportTaskResult } from './lib/result-reporter.mjs';
import { runCodexTask } from './lib/codex-executor.mjs';

async function defaultExecutor(repoRoot, controlPlane, task) {
  return runCodexTask(repoRoot, controlPlane, task);
}

async function executeTask(repoRoot, task, executor) {
  const sessionId = `engine-${task.owner_role}-${Date.now()}`;
  setActiveSession(repoRoot, {
    id: sessionId,
    role: 'coordinator',
    summary: `Engine dispatching ${task.id}`,
    task_id: task.id,
  });
  markTaskStarted(repoRoot, { actor: 'engine', sessionId, taskId: task.id });

  const controlPlane = loadControlPlane(repoRoot);
  const execution = await executor(repoRoot, controlPlane, task);
  if (execution.status === 'blocked') {
    markTaskBlocked(repoRoot, {
      actor: 'engine',
      blockers: execution.blockers,
      summary: execution.summary,
      taskId: task.id,
    });
    await reportTaskResult(repoRoot, {
      actor: 'engine',
      execution,
      task: getTaskById(loadControlPlane(repoRoot).state, task.id),
    });
    return;
  }
  if (execution.status === 'failed') {
    markTaskFailed(repoRoot, {
      actor: 'engine',
      blockers: execution.blockers,
      summary: execution.summary,
      taskId: task.id,
      verification: {
        notes: execution.verification_notes,
        status: 'failed',
      },
    });
    await reportTaskResult(repoRoot, {
      actor: 'engine',
      execution,
      task: getTaskById(loadControlPlane(repoRoot).state, task.id),
    });
    return;
  }

  markTaskVerifying(repoRoot, { actor: 'engine', profileId: task.verify_profile, taskId: task.id });
  const verification = await runVerifyProfile(repoRoot, { actor: 'engine', profileId: task.verify_profile });

  if (verification.outcome === 'passed') {
    markTaskCompleted(repoRoot, {
      actor: 'engine',
      outputs: execution.outputs,
      summary: execution.summary,
      taskId: task.id,
      verification: {
        notes: execution.verification_notes,
        profile: task.verify_profile,
        status: 'passed',
        stderr: verification.stderr,
        stdout: verification.stdout,
      },
    });
  } else {
    markTaskFailed(repoRoot, {
      actor: 'engine',
      blockers: execution.blockers,
      summary: `${execution.summary}\nVerification failed for ${task.verify_profile}.`,
      taskId: task.id,
      verification: {
        notes: execution.verification_notes,
        profile: task.verify_profile,
        status: 'failed',
        stderr: verification.stderr,
        stdout: verification.stdout,
      },
    });
  }

  await reportTaskResult(repoRoot, {
    actor: 'engine',
    execution,
    task: getTaskById(loadControlPlane(repoRoot).state, task.id),
    verification: {
      profile: task.verify_profile,
      status: verification.outcome,
      stderr: verification.stderr,
      stdout: verification.stdout,
    },
  });
}

async function runEngineCycle(repoRoot, { executor = defaultExecutor } = {}) {
  planCoordinatorTasks(repoRoot, { actor: 'engine' });
  blockTasksWithFailedDeps(repoRoot, { actor: 'engine' });
  const runnable = loadRunnableTasks(repoRoot);
  const processed = [];

  for (const task of runnable) {
    await executeTask(repoRoot, task, executor);
    syncParentStatuses(repoRoot, { actor: 'engine' });
    processed.push(task.id);
  }

  return { processed, workDone: processed.length > 0 };
}

async function runUntilIdle(repoRoot, options = {}) {
  const allProcessed = [];
  while (true) {
    const cycle = await runEngineCycle(repoRoot, options);
    if (!cycle.workDone) {
      return allProcessed;
    }
    allProcessed.push(...cycle.processed);
  }
}

async function startEngineLoop(repoRoot, { executor = defaultExecutor, intervalMs = 5000 } = {}) {
  while (true) {
    try {
      await runUntilIdle(repoRoot, { executor });
    } catch (error) {
      console.error('[ops-engine]', error);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const repoRoot = process.cwd();
  const once = process.argv.includes('--once');
  const intervalMs = Number.parseInt(process.env.OPS_ENGINE_INTERVAL_MS ?? '5000', 10);
  if (once) {
    runUntilIdle(repoRoot).then((processed) => {
      console.log(JSON.stringify({ processed }, null, 2));
    });
  } else {
    startEngineLoop(repoRoot, { intervalMs });
  }
}

export { defaultExecutor, runEngineCycle, runUntilIdle, startEngineLoop };
