import { test, expect } from './test.base';
import { waitForPrimary } from './lib/wait-primary';

const SYSTEM_PRIMER =
  "You are a warm, concise portfolio assistant. Prefer natural phrasing and end with a short follow-up question.";

function hasFollowUp(text: string) {
  // allow locale variants and optional trailing punctuation/whitespace
  return /[?？]\s*$|[?？！]\s*$/m.test(text) || text.split('\n').some(l => /[?？]/.test(l));
}

test.describe('@backend chat follow-up', () => {
  test.beforeAll(async () => {
    await waitForPrimary({ chatProbe: true });
  });

  test('assistant answers include a follow-up question', async ({ request }) => {
    const res = await request.post('/api/chat', {
      headers: { 'content-type': 'application/json' },
      data: {
        messages: [
          { role: 'system', content: SYSTEM_PRIMER },
          { role: 'user', content: 'Recommend one of my projects for a hiring manager and explain briefly.' }
        ],
        temperature: 0.7,
        top_p: 0.95
      }
    });
    expect(res.ok(), `POST /api/chat failed: ${res.status()}`).toBeTruthy();
    const body = await res.json();

    // Support string or array-of-chunks content shapes
    const raw = body?.choices?.[0]?.message?.content;
    const text = Array.isArray(raw) ? raw.join('') : String(raw ?? '');

    expect(text && text.length > 0, 'empty assistant content').toBeTruthy();
    expect(
      hasFollowUp(text),
      `assistant reply missing follow-up question\n--- reply start ---\n${text}\n--- reply end ---`
    ).toBeTruthy();
  });
});
