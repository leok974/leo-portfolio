import { test, expect } from './test.base';
import { BASE } from './helpers/env';

// Validates that projects.json is served (not HTML fallback), parses, and contains expected keys

test.describe('@content projects.json availability', () => {
  test('projects.json returns JSON object with required project slugs', async ({ request }) => {
    const res = await request.get(`${BASE}/projects.json`, { headers: { 'Accept': 'application/json' } });
    expect(res.status(), 'GET /projects.json should be 200').toBe(200);
    const ct = (res.headers()['content-type'] || '').toLowerCase();
    expect(ct.includes('application/json'), `Content-Type should be application/json, got ${ct}`).toBeTruthy();
    const text = await res.text();
    expect(text.trim().startsWith('{'), 'projects.json should start with {').toBeTruthy();
    expect(text.includes('<!DOCTYPE html>')).toBeFalsy();

    let data: any;
    expect(() => { data = JSON.parse(text); }).not.toThrow();
    expect(typeof data).toBe('object');

    for (const key of ['ledgermind','datapipe-ai','clarity']) {
      expect(Object.prototype.hasOwnProperty.call(data, key), `Missing key ${key} in projects.json`).toBeTruthy();
      const entry = data[key];
      for (const required of ['title','slug','tags','thumbnail']) {
        expect(entry && entry[required], `projects[${key}].${required} missing`).toBeTruthy();
      }
    }
  });
});
