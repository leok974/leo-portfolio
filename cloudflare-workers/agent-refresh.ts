/**
 * Cloudflare Worker - Agent Refresh Trigger
 *
 * Dispatches GitHub Actions workflow to refresh content (projects, skills, OG images)
 * when triggered by the AI agent or authenticated requests.
 *
 * Environment Variables (set in Cloudflare Dashboard → Workers → Settings → Variables):
 * - GH_PAT: GitHub Personal Access Token with workflow dispatch permission
 * - REPO: Repository in format "owner/repo" (e.g., "leok974/leo-portfolio")
 * - ALLOW_KEY: Shared secret key for authentication
 *
 * Deploy:
 * wrangler deploy agent-refresh.ts
 *
 * Usage:
 * POST https://agent-refresh.<subdomain>.workers.dev/
 * Headers: { "x-agent-key": "<ALLOW_KEY>", "content-type": "application/json" }
 * Body: { "reason": "agent-request", "ref": "main" }
 */

export interface Env {
  GH_PAT: string;        // GitHub PAT with workflow dispatch permission
  REPO: string;          // Repository (e.g., "leok974/leo-portfolio")
  ALLOW_KEY: string;     // Shared secret key for authentication
}

// Simple in-memory rate limiter per worker instance (not perfect across instances)
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 6; // allow 6 requests per minute per instance
const _reqTimestamps: number[] = [];

// Allow-list of reasons
const ALLOWED_REASONS = new Set(['sync-projects', 'update-skills', 'refresh-portfolio', 'agent-request', 'manual-test']);

async function ghLatest(env: Env) {
  const res = await fetch(
    `https://api.github.com/repos/${env.REPO}/actions/runs?per_page=1`,
    { headers: { Authorization: `Bearer ${env.GH_PAT}`, Accept: 'application/vnd.github+json' } }
  );
  const j = await res.json();
  const run = j.workflow_runs?.[0];
  if (!run) return { state: 'unknown' };
  return {
    id: run.id, status: run.status, conclusion: run.conclusion,
    html_url: run.html_url, name: run.name, created_at: run.created_at
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, x-agent-key',
          'Access-Control-Max-Age': '86400',
        }
      });
    }

    // Status endpoint (GET)
    if (request.method === 'GET' && url.pathname.endsWith('/agent/refresh/status')) {
      const auth = request.headers.get('x-agent-key') || '';
      if (auth !== env.ALLOW_KEY) return new Response('Unauthorized', { status: 401 });
      const latest = await ghLatest(env);
      return new Response(JSON.stringify(latest), { status: 200, headers: { 'content-type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    }

    // Only allow POST for dispatch
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    // Authenticate request
    const auth = request.headers.get('x-agent-key') || '';
    if (auth !== env.ALLOW_KEY) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'content-type': 'application/json' }
      });
    }

    // Simple rate limiting
    const now = Date.now();
    // purge old
    while (_reqTimestamps.length && _reqTimestamps[0] < now - RATE_LIMIT_WINDOW_MS) {
      _reqTimestamps.shift();
    }
    if (_reqTimestamps.length >= MAX_REQUESTS_PER_WINDOW) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429, headers: { 'content-type': 'application/json' } });
    }
    _reqTimestamps.push(now);

    // Parse request body
    let body: any = {};
    try {
      body = await request.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { 'content-type': 'application/json' }
      });
    }

    const reason = body?.reason || 'agent-request';
    const ref = body?.ref || 'main';

    // Branch guard
    if (ref !== 'main') {
      return new Response(JSON.stringify({ error: 'Only ref "main" is allowed' }), { status: 400, headers: { 'content-type': 'application/json' } });
    }

    // Allow-list reasons
    if (!ALLOWED_REASONS.has(reason)) {
      return new Response(JSON.stringify({ error: 'Reason not allowed' }), { status: 400, headers: { 'content-type': 'application/json' } });
    }

    // Dispatch GitHub Actions workflow
    const ghUrl = `https://api.github.com/repos/${env.REPO}/actions/workflows/refresh-content.yml/dispatches`;

    const res = await fetch(ghUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${env.GH_PAT}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Cloudflare-Worker-Agent-Refresh'
      },
      body: JSON.stringify({ ref, inputs: { reason } })
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error(`GitHub dispatch failed: ${res.status} ${txt}`);
      return new Response(JSON.stringify({
        error: 'GitHub dispatch failed',
        status: res.status,
        details: txt
      }), {
        status: 502,
        headers: { 'content-type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      dispatched: true,
      reason,
      ref,
      workflow: 'refresh-content.yml',
      timestamp: new Date().toISOString()
    }), {
      status: 202,
      headers: {
        'content-type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
};
