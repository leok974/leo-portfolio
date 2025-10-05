import { Page, Route } from '@playwright/test';

export interface Beacon {
  type: string;            // "page_view" | "dwell" | "scroll_depth" | "link_click" | "session_start"
  ts: number | string;
  path?: string;
  ref_host?: string;       // referrer hostname
  device?: string;         // "mobile" | "tablet" | "desktop"
  theme?: string;          // "dark" | "light"
  meta?: Record<string, any>;
}

export async function captureBeacons(page: Page, urlGlob = '**/analytics/collect') {
  const beacons: Beacon[] = [];
  let routeCount = 0;
  await page.route(urlGlob, async (route: Route) => {
    routeCount++;
    const req = route.request();
    const ct = req.headers()['content-type'] || '';
    // navigator.sendBeacon often uses 'text/plain' with a JSON string body
    let payload: any;
    try {
      const raw = (await req.postData()) || '';
      payload = ct.includes('application/json') ? JSON.parse(raw) : JSON.parse(raw || '{}');
    } catch {
      payload = {};
    }
    if (Array.isArray(payload)) {
      payload.forEach((p) => beacons.push(p));
    } else {
      beacons.push(payload);
    }
    await route.fulfill({ status: 204, body: '' });
  });
  // Debug helper
  (beacons as any)._routeCount = () => routeCount;
  return beacons;
}
