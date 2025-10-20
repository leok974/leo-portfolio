/**
 * Agent Commands - Content Refresh Integration
 *
 * Detects user intent for content refresh operations and dispatches
 * GitHub Actions workflow via Cloudflare Worker.
 *
 * Copilot: When user requests "sync projects", "update skills", or "refresh portfolio",
 * this module dispatches the refresh-content.yml workflow. Never expose ALLOW_KEY in
 * client code - use server-side proxy or Cloudflare Worker environment variables.
 *
 * Supported commands:
 * - "sync projects" → Fetches latest repos from GitHub
 * - "update skills" → Regenerates skills.json from projects
 * - "refresh portfolio" → Full rebuild + redeploy
 */

export type AgentCmd = 'sync-projects' | 'update-skills' | 'refresh-portfolio';

/**
 * Intent detection patterns for each command
 */
const patterns: Record<AgentCmd, RegExp[]> = {
  'sync-projects': [
    /sync\s+projects?/i,
    /pull\s+repos?/i,
    /refresh\s+projects?/i,
    /update\s+projects?/i,
    /fetch\s+(latest\s+)?repos?/i
  ],
  'update-skills': [
    /update\s+skills?/i,
    /refresh\s+skills?/i,
    /regenerate\s+skills?/i,
    /rebuild\s+skills?/i
  ],
  'refresh-portfolio': [
    /refresh\s+(site|portfolio|content)/i,
    /redeploy\s+(site|portfolio)?/i,
    /rebuild\s+(site|portfolio|everything)/i,
    /full\s+refresh/i
  ]
};

/**
 * Detect command from user input
 * @param input User message text
 * @returns Detected command or null if no match
 */
export function detectCommand(input: string): AgentCmd | null {
  for (const [cmd, regs] of Object.entries(patterns)) {
    if (regs.some(r => r.test(input))) {
      return cmd as AgentCmd;
    }
  }
  return null;
}

/**
 * Execute agent command by dispatching GitHub Actions workflow
 * @param cmd Command to execute
 * @returns Response from Cloudflare Worker
 */
export async function executeCommand(cmd: AgentCmd): Promise<{
  ok: boolean;
  dispatched: boolean;
  reason: string;
  workflow?: string;
  timestamp?: string;
}> {
  const reason = cmd;
  const workerUrl = import.meta.env.VITE_AGENT_REFRESH_URL || 'https://agent-refresh.leoklemet.workers.dev';
  const allowKey = import.meta.env.VITE_AGENT_ALLOW_KEY;

  if (!allowKey) {
    throw new Error('VITE_AGENT_ALLOW_KEY not configured');
  }

  const resp = await fetch(workerUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-agent-key': allowKey
    },
    body: JSON.stringify({ reason, ref: 'main' })
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Refresh dispatch failed: ${resp.status} ${text}`);
  }

  return resp.json();
}

export interface RefreshStatus {
  id?: number;
  status?: string;
  conclusion?: string | null;
  html_url?: string;
  name?: string;
  created_at?: string;
  state?: string;
};

/**
 * Fetch latest refresh run status from the Cloudflare Worker
 */
export async function getRefreshStatus(): Promise<RefreshStatus> {
  const workerUrl = import.meta.env.VITE_AGENT_REFRESH_URL || 'https://agent-refresh.leoklemet.workers.dev';
  const allowKey = import.meta.env.VITE_AGENT_ALLOW_KEY;

  if (!allowKey) throw new Error('VITE_AGENT_ALLOW_KEY not configured');

  const url = workerUrl.replace(/\/*$/, '') + '/agent/refresh/status';
  const resp = await fetch(url, {
    method: 'GET',
    headers: { 'x-agent-key': allowKey }
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Status request failed: ${resp.status} ${txt}`);
  }
  return resp.json();
}

/**
 * Get human-readable description for command
 */
export function getCommandDescription(cmd: AgentCmd): string {
  const descriptions: Record<AgentCmd, string> = {
    'sync-projects': 'Syncing projects from GitHub',
    'update-skills': 'Regenerating skills from projects',
    'refresh-portfolio': 'Refreshing entire portfolio (projects + skills + OG images + rebuild)'
  };
  return descriptions[cmd];
}
