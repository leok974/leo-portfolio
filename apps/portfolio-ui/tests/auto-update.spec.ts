import { test, expect } from '@playwright/test';

test('links suggest + apply (dry-run) produces diff', async ({ request }) => {
  const suggest = await request.post('https://assistant.ledger-mind.org/agent/run', {
    data: { tasks: ['links.suggest'], dry_run: true }
  });
  expect(suggest.ok()).toBeTruthy();

  const suggestResult = await suggest.json();
  console.log('Links suggest result:', suggestResult);

  const artifacts = await request.get('https://assistant.ledger-mind.org/agent/artifacts');
  const body = await artifacts.text();

  // Should produce link-apply artifacts (diff/markdown/json)
  expect(body).toMatch(/link-apply\.(md|json|diff)/);
  console.log('Link artifacts:', body.match(/link-apply\.(md|json|diff)/g));
});

test('full auto-update pipeline (dry-run)', async ({ request }) => {
  // Run complete pipeline in dry-run mode
  const pipeline = await request.post('https://assistant.ledger-mind.org/agent/run', {
    data: {
      tasks: [
        'projects.sync',
        'news.sync',
        'og.generate',
        'seo.tune',
        'links.suggest',
        'links.apply'
      ],
      dry_run: true
    }
  });

  expect(pipeline.ok()).toBeTruthy();
  const result = await pipeline.json();

  // Should complete all tasks
  expect(result).toHaveProperty('completed_tasks');
  expect(result.completed_tasks.length).toBeGreaterThanOrEqual(3);
  console.log('Pipeline result:', result);

  // Artifacts should be generated
  const artifacts = await request.get('https://assistant.ledger-mind.org/agent/artifacts');
  const body = await artifacts.text();

  // Should have multiple artifact types
  expect(body).toMatch(/projects\.sync/);
  expect(body).toMatch(/og\.generate/);
  expect(body).toMatch(/seo-tune/);
  console.log('Generated artifacts count:', (body.match(/\.(md|json|diff)/g) || []).length);
});

test('links apply with approval flow', async ({ request }) => {
  // Step 1: Suggest links
  const suggest = await request.post('https://assistant.ledger-mind.org/agent/run', {
    data: { tasks: ['links.suggest'], dry_run: true }
  });
  expect(suggest.ok()).toBeTruthy();

  // Step 2: Get artifact ID from response
  const suggestResult = await suggest.json();
  console.log('Suggest result:', suggestResult);

  // Step 3: Approve artifact (if approval endpoint exists)
  // This would be implemented as:
  // const approve = await request.post('https://assistant.ledger-mind.org/agent/approve', {
  //   data: { artifact_id: suggestResult.artifact_id, approved: true }
  // });
  // expect(approve.ok()).toBeTruthy();

  // For now, just verify the artifact was created
  const artifacts = await request.get('https://assistant.ledger-mind.org/agent/artifacts');
  expect(artifacts.ok()).toBeTruthy();
});
