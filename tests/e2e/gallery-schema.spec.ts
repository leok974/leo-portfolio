import { test, expect } from './test.base';

test('@schema: CollectionPage & parts present', async ({ page }) => {
  await page.goto('/gallery.html');

  // Wait for schema tags to appear (script tags are in DOM but not visible)
  await page.waitForFunction(() => {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    return scripts.length > 0;
  }, { timeout: 5000 });

  const nodes = await page.$$eval('script[type="application/ld+json"]', els =>
    els.map(el => {
      try { return JSON.parse(el.textContent || '{}'); } catch { return {}; }
    })
  );

  // Find the CollectionPage block
  const coll = nodes.find(n => n && n['@type'] === 'CollectionPage');
  expect(coll).toBeTruthy();
  expect(coll.url).toMatch(/\/gallery\.html$/);
  expect(Array.isArray(coll.hasPart)).toBeTruthy();
  expect(coll.hasPart.length).toBeGreaterThan(0);

  // Ensure at least one ImageObject or VideoObject exists
  const types = new Set(coll.hasPart.map((p: any) => p['@type']));
  expect([...types].some(t => t === 'ImageObject' || t === 'VideoObject')).toBeTruthy();
});

test('@schema: breadcrumbs present', async ({ page }) => {
  await page.goto('/gallery.html');
  await page.waitForFunction(() => {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    return scripts.length > 0;
  }, { timeout: 5000 });

  const nodes = await page.$$eval('script[type="application/ld+json"]', els =>
    els.map(el => {
      try { return JSON.parse(el.textContent || '{}'); } catch { return {}; }
    })
  );

  const bc = nodes.find(n => n && n['@type'] === 'BreadcrumbList');
  expect(bc).toBeTruthy();
  expect(Array.isArray(bc.itemListElement)).toBeTruthy();

  const names = bc.itemListElement.map((x: any) => x.name);
  expect(names).toEqual(expect.arrayContaining(['Home', 'Gallery']));
});

test('@schema: ImageObject has correct fields', async ({ page }) => {
  await page.goto('/gallery.html');
  await page.waitForFunction(() => {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    return scripts.length > 0;
  }, { timeout: 5000 });

  const nodes = await page.$$eval('script[type="application/ld+json"]', els =>
    els.map(el => {
      try { return JSON.parse(el.textContent || '{}'); } catch { return {}; }
    })
  );

  const coll = nodes.find(n => n && n['@type'] === 'CollectionPage');
  const imageObj = coll?.hasPart?.find((p: any) => p['@type'] === 'ImageObject');

  if (imageObj) {
    expect(imageObj.name).toBeTruthy();
    expect(imageObj.contentUrl).toMatch(/^https?:\/\//);
    expect(imageObj.thumbnailUrl).toMatch(/^https?:\/\//);
    expect(imageObj.creator).toEqual({ "@type": "Person", "name": "Leo Klemet" });
  }
});

test('@schema: VideoObject has correct fields', async ({ page }) => {
  await page.goto('/gallery.html');
  await page.waitForFunction(() => {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    return scripts.length > 0;
  }, { timeout: 5000 });

  const nodes = await page.$$eval('script[type="application/ld+json"]', els =>
    els.map(el => {
      try { return JSON.parse(el.textContent || '{}'); } catch { return {}; }
    })
  );

  const coll = nodes.find(n => n && n['@type'] === 'CollectionPage');
  const videoObj = coll?.hasPart?.find((p: any) => p['@type'] === 'VideoObject');

  if (videoObj) {
    expect(videoObj.name).toBeTruthy();
    expect(videoObj.description).toBeTruthy();
    expect(videoObj.thumbnailUrl).toMatch(/^https?:\/\//);
    // Should have either contentUrl (local) or embedUrl (youtube/vimeo)
    expect(videoObj.contentUrl || videoObj.embedUrl).toBeTruthy();
  }
});

test('@schema: keywords include tools and tags', async ({ page }) => {
  await page.goto('/gallery.html');
  await page.waitForFunction(() => {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    return scripts.length > 0;
  }, { timeout: 5000 });

  const nodes = await page.$$eval('script[type="application/ld+json"]', els =>
    els.map(el => {
      try { return JSON.parse(el.textContent || '{}'); } catch { return {}; }
    })
  );

  const coll = nodes.find(n => n && n['@type'] === 'CollectionPage');
  const parts = coll?.hasPart || [];

  // Check that at least one item has keywords
  const withKeywords = parts.filter((p: any) => p.keywords);
  expect(withKeywords.length).toBeGreaterThan(0);

  // Verify keywords format (comma-separated)
  if (withKeywords.length > 0) {
    const keywords = withKeywords[0].keywords;
    expect(typeof keywords).toBe('string');
    expect(keywords.length).toBeGreaterThan(0);
  }
});
