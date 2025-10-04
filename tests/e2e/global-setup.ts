import { waitForPrimary } from './lib/wait-primary';
import { waitRagReady } from './lib/wait-rag';

export default async function globalSetup() {
  process.env.PLAYWRIGHT_GLOBAL_SETUP = '1';
  if (!process.env.WAIT_PRIMARY_LOG) process.env.WAIT_PRIMARY_LOG = '1';
  if (process.env.PLAYWRIGHT_GLOBAL_SETUP_SKIP === '1') {
    console.warn('[globalSetup] Skipped via PLAYWRIGHT_GLOBAL_SETUP_SKIP=1');
    return;
  }
  // Phase 0: RAG readiness (fast, soft)
  try {
    const base = process.env.BASE_URL || process.env.BASE || process.env.PROD_BASE || 'http://127.0.0.1:8080';
    const waitMs = Number(process.env.WAIT_RAG_MS ?? '30000');
    await waitRagReady(base, waitMs);
  } catch (e: any) {
    console.warn(`[globalSetup] RAG readiness failed: ${e?.message ?? e}`);
  }
  await waitForPrimary({ chatProbe: true });
}
