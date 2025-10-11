#!/usr/bin/env node
/**
 * orchestrator.nightly.mjs
 *
 * Nightly orchestrator for agent tasks:
 * 1. Runs a predefined plan of tasks (seo.validate, code.review, dx.integrate, infra.scale)
 * 2. Logs each task to the database via FastAPI
 * 3. Sends webhook notifications for tasks awaiting approval
 *
 * Usage:
 *   node scripts/orchestrator.nightly.mjs
 *
 * Environment variables:
 *   API_BASE - FastAPI base URL (default: https://api.assistant.ledger-mind.org)
 *   GITHUB_TOKEN - GitHub token for API access
 *   GH_OWNER - GitHub owner for infra.scale PRs
 *   GH_REPO - GitHub repo for infra.scale PRs
 *   SITE_BASE_URL - Base URL for site (default: https://assistant.ledger-mind.org)
 *   SLACK_WEBHOOK - Slack webhook URL for notifications
 *   EMAIL_WEBHOOK - Email webhook URL for notifications
 *   ENABLE_INFRA_SCALE - Set to "1" to enable infrastructure scaling task
 */

import { spawn } from 'node:child_process';
import { emitMetric } from './analytics.mjs';

const API_BASE = process.env.API_BASE || 'https://api.assistant.ledger-mind.org';
const RUN_ID = `nightly-${new Date().toISOString().split('T')[0]}`; // e.g., "nightly-2025-01-15"

// Orchestration plan
const PLAN = [
  {
    task: 'seo.validate',
    cmd: ['npm', ['run', '-s', 'seo:tune', '--', '--dry-run', '--strict']],
    env: {
      GITHUB_TOKEN: process.env.GITHUB_TOKEN || '',
      SITE_BASE_URL: process.env.SITE_BASE_URL || 'https://assistant.ledger-mind.org',
    }
  },
  {
    task: 'code.review',
    cmd: ['node', ['scripts/code-review.mjs', '--only-changed']],
    env: {
      GITHUB_TOKEN: process.env.GITHUB_TOKEN || '',
    }
  },
  {
    task: 'dx.integrate',
    cmd: ['node', ['scripts/dx-integrate.mjs', '--only-changed']],
    env: {}
  },
  {
    task: 'infra.scale',
    enabled: process.env.ENABLE_INFRA_SCALE === '1',
    cmd: ['node', [
      'scripts/infra.scale.mjs', '--apply',
      '--target=prod', '--namespace=assistant',
      '--workload=Deployment:web:6',
      '--workload=Deployment:api:4',
      '--hpa=min:4,max:12,cpu:65',
      '--req=web:cpu=500m,mem=1Gi', '--lim=web:cpu=1,mem=2Gi',
      '--req=api:cpu=400m,mem=1Gi', '--lim=api:cpu=1,mem=2Gi'
    ]],
    env: {} // uses GH_OWNER, GH_REPO, GITHUB_TOKEN from process.env
  }
];

/**
 * Create a new task record in the database
 */
async function apiCreate(taskData) {
  const url = `${API_BASE}/agents/tasks/`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(taskData),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API create failed: ${response.status} ${text}`);
  }

  return response.json();
}

/**
 * Update an existing task record in the database
 */
async function apiPatch(taskId, updateData) {
  const url = `${API_BASE}/agents/tasks/${taskId}`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updateData),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API patch failed: ${response.status} ${text}`);
  }

  return response.json();
}

/**
 * Send webhook notification for approval
 */
async function sendWebhook(task, taskRecord) {
  const slackWebhook = process.env.SLACK_WEBHOOK;
  const emailWebhook = process.env.EMAIL_WEBHOOK;

  const message = {
    run_id: RUN_ID,
    task: task.task,
    status: 'awaiting_approval',
    outputs_uri: taskRecord.outputs_uri,
    log_excerpt: taskRecord.log_excerpt,
  };

  const promises = [];

  if (slackWebhook) {
    promises.push(
      fetch(slackWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: `Task ${task.task} awaiting approval: ${message.outputs_uri}` }),
      })
    );
  }

  if (emailWebhook) {
    promises.push(
      fetch(emailWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      })
    );
  }

  await Promise.allSettled(promises);
}

/**
 * Run a command and capture output
 */
function runCommand(command, args, env) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    let stdout = '';
    let stderr = '';

    const proc = spawn(command, args, {
      env: { ...process.env, ...env },
      shell: true,
    });

    proc.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      const duration = Date.now() - startTime;
      resolve({
        exitCode: code || 0,
        stdout,
        stderr,
        duration_ms: duration,
      });
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Extract outputs_uri from command output (e.g., PR link)
 */
function extractOutputsUri(stdout, stderr) {
  const combined = stdout + stderr;

  // Look for outputs_uri= format (from infra.scale contract)
  const outputsUriMatch = combined.match(/outputs_uri=(.+?)(?:\r?\n|$)/);
  if (outputsUriMatch) {
    const uri = outputsUriMatch[1].trim();
    if (uri) return uri;
  }

  // Look for PR URLs
  const prMatch = combined.match(/https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+/);
  if (prMatch) return prMatch[0];

  // Look for artifact URLs
  const artifactMatch = combined.match(/https:\/\/[^\s]+\/artifacts\/[^\s]+/);
  if (artifactMatch) return artifactMatch[0];

  return null;
}

/**
 * Extract log excerpt (first/last 10 lines)
 */
function extractLogExcerpt(stdout, stderr) {
  const combined = stdout + stderr;
  const lines = combined.split('\n').filter(l => l.trim());

  if (lines.length <= 20) {
    return combined.slice(0, 2000); // Limit to 2KB
  }

  const first10 = lines.slice(0, 10).join('\n');
  const last10 = lines.slice(-10).join('\n');
  return `${first10}\n...\n${last10}`.slice(0, 2000);
}

/**
 * Main orchestration logic
 */
async function main() {
  console.log(`Starting nightly orchestration: ${RUN_ID}`);
  console.log(`API base: ${API_BASE}`);

  // Filter enabled tasks
  const enabledPlan = PLAN.filter(step => step.enabled !== false);
  console.log(`Plan: ${enabledPlan.map(s => s.task).join(', ')}`);

  for (const step of enabledPlan) {
    console.log(`\n=== Running task: ${step.task} ===`);

    const start = Date.now();

    try {
      // Emit: task started
      await emitMetric("agent.task_started", { task: step.task, run_id: RUN_ID });

      // Create task record (status: running)
      const taskRecord = await apiCreate({
        task: step.task,
        run_id: RUN_ID,
        status: 'running',
        started_at: new Date().toISOString(),
        inputs: {
          command: step.cmd[0],
          args: step.cmd[1],
        },
      });

      console.log(`Task created: ID=${taskRecord.id}`);

      // Run command
      const result = await runCommand(step.cmd[0], step.cmd[1], step.env);

      // Determine final status
      let status = 'succeeded';
      if (result.exitCode !== 0) {
        status = 'failed';
      }

      // Check if output indicates approval needed (e.g., PR created)
      const outputs_uri = extractOutputsUri(result.stdout, result.stderr);
      if (outputs_uri && outputs_uri.includes('/pull/')) {
        status = 'awaiting_approval';
      }

      // Update task record
      const updateData = {
        status,
        finished_at: new Date().toISOString(),
        duration_ms: result.duration_ms,
        outputs_uri,
        log_excerpt: extractLogExcerpt(result.stdout, result.stderr),
      };

      if (status === 'awaiting_approval') {
        updateData.approval_state = 'pending';
        updateData.webhook_notified_at = new Date().toISOString();
      }

      await apiPatch(taskRecord.id, updateData);

      console.log(`Task ${step.task}: ${status} (${result.duration_ms}ms)`);

      // Emit: task finished
      const duration_ms = Date.now() - start;
      await emitMetric("agent.task_finished", {
        task: step.task,
        run_id: RUN_ID,
        status,
        approval_state: updateData.approval_state || null,
        duration_ms,
        outputs_uri,
      });

      // Send webhooks if awaiting approval
      if (status === 'awaiting_approval') {
        console.log('Sending approval webhooks...');

        // Emit: awaiting approval
        await emitMetric("agent.awaiting_approval", {
          task: step.task,
          run_id: RUN_ID,
          outputs_uri,
        });

        await sendWebhook(step, { ...taskRecord, ...updateData });
      }

      // Emit: auto-approved (if succeeded with PR)
      if (status === 'succeeded' && updateData.approval_state === 'approved' && outputs_uri) {
        await emitMetric("agent.auto_approved", {
          task: step.task,
          run_id: RUN_ID,
          outputs_uri,
        });
      }

    } catch (error) {
      console.error(`Task ${step.task} failed:`, error);

      // Try to log failure to DB (best effort)
      try {
        await apiCreate({
          task: step.task,
          run_id: RUN_ID,
          status: 'failed',
          started_at: new Date().toISOString(),
          finished_at: new Date().toISOString(),
          log_excerpt: error.message || String(error),
        });
      } catch (dbError) {
        console.error('Failed to log error to DB:', dbError);
      }
    }
  }

  console.log(`\nOrchestration complete: ${RUN_ID}`);
}

main().catch(err => {
  console.error('Orchestration failed:', err);
  process.exit(1);
});
