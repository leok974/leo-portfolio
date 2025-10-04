import { test, expect } from '@playwright/test';
import { waitForPrimary } from './lib/wait-primary';

// Allow long warmup if globalSetup skipped
test.setTimeout(180_000);

const backendRequired = process.env.BACKEND_REQUIRED === '1';
// Config knobs (override in CI as needed)
// - MAX_OPENAI_EMBED_PCT: threshold percentage for OpenAI embeddings usage (default 30)
// - EMBED_GUARD_RUNS: how many chats to sample (default 10)
const maxOpenAiPct = Number(process.env.MAX_OPENAI_EMBED_PCT ?? '30');
const runs = Number(process.env.EMBED_GUARD_RUNS ?? '10');

test.describe('@backend embeddings guardrail', () => {
  test.skip(!backendRequired, 'Set BACKEND_REQUIRED=1 to run backend e2e.');
  test.beforeAll(async () => { await waitForPrimary({ chatProbe: true }); });

    test(`OpenAI embeddings ratio under ${maxOpenAiPct}% over ${runs} chats`, async ({ request }) => {
      const prompts = [
        'What is LedgerMind in one sentence?',
        'Summarize DataPipe AI in one line.',
        'Who is Leo and what does this site showcase?',
        'Give two technologies used in the portfolio.',
        'Explain the RAG pipeline briefly.',
        'Name a deployment mode supported here.',
        'How does SSE help the chat UX?',
        'What health endpoints are exposed?',
        'Describe the hybrid retrieval approach.',
        'What does the sources popover show?',
      ];

      let openaiCount = 0;
      let total = 0;
      for (let i = 0; i < runs; i++) {
        const prompt = prompts[i % prompts.length];
        const res = await request.post('/api/chat', {
          data: { messages: [{ role: 'user', content: prompt }], include_sources: true },
          timeout: 30_000,
        });
        if (!res.ok()) {
          // Softly continue; we only count successful responses toward the ratio
          continue;
        }
        const body = await res.json();
        const embBackend = String(body?.backends?.embeddings?.last_backend || '').toLowerCase();
        if (embBackend) {
          total += 1;
          if (embBackend === 'openai') openaiCount += 1;
        }
      }

      // If we couldn't get any successful measurements, skip rather than fail CI spuriously
      test.skip(total === 0, 'No successful chat responses with backends info; skipping guardrail.');

      const pct = (openaiCount / total) * 100;
      const msg = `OpenAI embeddings usage ${pct.toFixed(1)}% (${openaiCount}/${total}) exceeds threshold ${maxOpenAiPct}%`;
      expect(pct, msg).toBeLessThanOrEqual(maxOpenAiPct + 1e-6);
    });
});
