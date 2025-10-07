import { test, expect } from '@playwright/test';

/**
 * Test fixture: Deterministic project data for stable     // Should show 1 completed project (DermaAI)
    const visibleCards = page.locator('article.card:visible');
    await expect(visibleCards).toHaveCount(1);

    // Check that completed project is visible
    await expect(page.locator('article.card[data-slug="dermaai"]')).toBeVisible();

    // In-progress projects should be hidden
    await expect(page.locator('article.card[data-slug="ledgermind"]')).not.toBeVisible();
 * Maps to the expected structure in projects.json (object with slug keys)
 *
 * Current project statuses (as of 2025-10-06):
 * - In Progress: ledgermind, datapipe-ai, clarity, pixo-banana-suite (4 projects)
 * - Completed: dermaai (1 project)
 * - Total: 5 projects
 */
const FIXTURE_OBJECT = {
  'ledgermind': {
    slug: 'ledgermind',
    title: 'LedgerMind',
    summary: 'AI-powered finance agent',
    description: 'AI-powered finance agent with grounded analytics',
    status: 'in-progress',
    tags: ['AI', 'Finance', 'ML'],
    thumbnail: 'assets/ledgermind-thumb.webp'
  },
  'datapipe-ai': {
    slug: 'datapipe-ai',
    title: 'DataPipe AI',
    summary: 'RAG + pipelines',
    description: 'AI-powered ops agent for GKE deployments',
    status: 'in-progress',
    tags: ['AI', 'DevOps', 'Kubernetes', 'ML'],
    thumbnail: 'assets/datapipe-ai-cover.webp'
  },
  'clarity': {
    slug: 'clarity',
    title: 'Clarity Companion',
    summary: 'Chrome AI extension',
    description: 'On-device writing clarity assistant',
    status: 'in-progress',
    tags: ['Dev', 'Extension', 'Productivity'],
    thumbnail: 'assets/clarity-thumb.webp'
  },
  'dermaai': {
    slug: 'dermaai',
    title: 'DermaAI (SkinSight)',
    summary: 'Skin-condition assistant',
    description: 'Skin-condition assistant UI for educational use',
    status: 'completed',
    date_completed: '2024-08-15',
    tags: ['Health', 'UI/UX'],
    thumbnail: 'assets/dermaai-thumb.webp'
  },
  'pixo-banana-suite': {
    slug: 'pixo-banana-suite',
    title: 'Pixo Banana Suite',
    summary: 'Pixel-art toolkit',
    description: 'Pixel-art pose/animate toolkit for game sprites',
    status: 'in-progress',
    tags: ['GenAI', 'Game Art', 'Animation'],
    thumbnail: 'assets/pixo-banana-thumb.webp'
  }
};

test.describe('Homepage Status Filter @frontend', () => {
  test.beforeEach(async ({ page }) => {
    // Stub projects.json so tests are stable regardless of prod content.
    await page.route(/projects\.json(\?.*)?$/, async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(FIXTURE_OBJECT),
      });
    });
  });

  test('defaults to In Progress and renders only in-progress cards', async ({ page }) => {
    await page.goto('/');

    // Wait for projects to load
    await page.waitForSelector('article.card', { timeout: 5000 });

    // Expect default filter button to be "In Progress" (aria-pressed="true")
    const inProgressBtn = page.locator('button.status-chip[data-status-filter="in-progress"]');
    await expect(inProgressBtn).toBeVisible();
    await expect(inProgressBtn).toHaveAttribute('aria-pressed', 'true');

    // Cards displayed should be only in-progress ones (4 projects)
    const cards = page.locator('article.card:visible');
    await expect(cards).toHaveCount(4);

    // Check that LedgerMind is visible (one of the in-progress projects)
    const ledgerCard = page.locator('article.card[data-slug="ledgermind"]');
    await expect(ledgerCard).toBeVisible();

    // Completed projects should be hidden (only DermaAI is completed)
    const dermaaiCard = page.locator('article.card[data-slug="dermaai"]');
    await expect(dermaaiCard).toBeHidden();
  });

  test('toggle to Completed shows only completed projects', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('article.card', { timeout: 5000 });

    // Click Completed button
    const completedBtn = page.locator('button.status-chip[data-status-filter="completed"]');
    await completedBtn.click();

    // Wait for filter to apply
    await page.waitForTimeout(200);

    // Should show 1 completed project (DermaAI)
    const visibleCards = page.locator('article.card:visible');
    await expect(visibleCards).toHaveCount(1);

    // Check that completed project is visible
    await expect(page.locator('article.card[data-slug="dermaai"]')).toBeVisible();

    // In-progress projects should be hidden
    await expect(page.locator('article.card[data-slug="ledgermind"]')).toBeHidden();
    await expect(page.locator('article.card[data-slug="clarity"]')).toBeHidden();
    await expect(page.locator('article.card[data-slug="datapipe-ai"]')).toBeHidden();
    await expect(page.locator('article.card[data-slug="pixo-banana-suite"]')).toBeHidden();

    // Completed button should be active
    await expect(completedBtn).toHaveAttribute('aria-pressed', 'true');
  });

  test('toggle to All shows all projects', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('article.card', { timeout: 5000 });

    // Click All button
    const allBtn = page.locator('button.status-chip[data-status-filter="all"]');
    await allBtn.click();

    // Wait for filter to apply
    await page.waitForTimeout(200);

    // Should show all 5 projects
    const visibleCards = page.locator('article.card:visible');
    await expect(visibleCards).toHaveCount(5);

    // All projects should be visible
    await expect(page.locator('article.card[data-slug="ledgermind"]')).toBeVisible();
    await expect(page.locator('article.card[data-slug="clarity"]')).toBeVisible();
    await expect(page.locator('article.card[data-slug="datapipe-ai"]')).toBeVisible();
    await expect(page.locator('article.card[data-slug="dermaai"]')).toBeVisible();
    await expect(page.locator('article.card[data-slug="pixo-banana-suite"]')).toBeVisible();

    // All button should be active
    await expect(allBtn).toHaveAttribute('aria-pressed', 'true');
  });

  test('persists selected filter via localStorage', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('article.card', { timeout: 5000 });

    // Choose Completed and verify
    const completedBtn = page.locator('button.status-chip[data-status-filter="completed"]');
    await completedBtn.click();
    await page.waitForTimeout(200);

    // Should show 1 completed project
    await expect(page.locator('article.card:visible')).toHaveCount(1);

    // Check localStorage was set
    const savedBeforeReload = await page.evaluate(() => localStorage.getItem('projectStatusFilter'));
    expect(savedBeforeReload).toBe('completed');

    // Reload → should stay on Completed
    await page.reload();
    await page.waitForLoadState('load');
    await page.waitForTimeout(500);

    // Should still show 1 completed project
    await expect(page.locator('article.card:visible')).toHaveCount(1);
    await expect(page.locator('article.card[data-slug="dermaai"]')).toBeVisible();

    // Button should still be active
    await expect(completedBtn).toHaveAttribute('aria-pressed', 'true');

    // localStorage should still have the value
    const savedAfterReload = await page.evaluate(() => localStorage.getItem('projectStatusFilter'));
    expect(savedAfterReload).toBe('completed');
  });

  test('combines Status + Category filters (AND logic)', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('article.card', { timeout: 5000 });

    // Start with All status to see all projects
    const allStatusBtn = page.locator('button.status-chip[data-status-filter="all"]');
    await allStatusBtn.click();
    await page.waitForTimeout(200);

    // Should see all 5 projects
    await expect(page.locator('article.card:visible')).toHaveCount(5);

    // Click category "AI Agents & Apps" (which filters to data-cats="agents")
    const agentsBtn = page.locator('button.chip[data-filter="agents"]');
    await agentsBtn.click();
    await page.waitForTimeout(200);

    // All + AI Agents → 3 projects have "agents" in data-cats:
    // - ledgermind: data-cats="agents" (in-progress)
    // - clarity: data-cats="agents" (in-progress)
    // - dermaai: data-cats="agents" (completed)
    await page.waitForTimeout(200);
    const visibleAfterCategory = page.locator('article.card:visible');
    await expect(visibleAfterCategory).toHaveCount(3);

    // Verify each card is visible
    await expect(page.locator('article.card[data-slug="ledgermind"]')).toBeVisible();
    await expect(page.locator('article.card[data-slug="clarity"]')).toBeVisible();
    await expect(page.locator('article.card[data-slug="dermaai"]')).toBeVisible();

    // Now switch to In Progress status while keeping Agents category
    const inProgressBtn = page.locator('button.status-chip[data-status-filter="in-progress"]');
    await inProgressBtn.click();
    await page.waitForTimeout(200);

    // In Progress + AI Agents → LedgerMind and Clarity (both in-progress with agents)
    await expect(page.locator('article.card:visible')).toHaveCount(2);
    await expect(page.locator('article.card[data-slug="ledgermind"]')).toBeVisible();
    await expect(page.locator('article.card[data-slug="clarity"]')).toBeVisible();
    await expect(page.locator('article.card[data-slug="dermaai"]')).not.toBeVisible();
    await expect(page.locator('article.card[data-slug="datapipe-ai"]')).not.toBeVisible();
    await expect(page.locator('article.card[data-slug="pixo-banana-suite"]')).not.toBeVisible();

    // Now switch to Completed status while keeping Agents category
    const completedBtn = page.locator('button.status-chip[data-status-filter="completed"]');
    await completedBtn.click();
    await page.waitForTimeout(200);

    // Completed + AI Agents → only DermaAI (the only completed project with agents)
    await expect(page.locator('article.card:visible')).toHaveCount(1);
    await expect(page.locator('article.card[data-slug="dermaai"]')).toBeVisible();
    await expect(page.locator('article.card[data-slug="ledgermind"]')).not.toBeVisible();
    await expect(page.locator('article.card[data-slug="clarity"]')).not.toBeVisible();
    await expect(page.locator('article.card[data-slug="datapipe-ai"]')).not.toBeVisible();
    await expect(page.locator('article.card[data-slug="pixo-banana-suite"]')).not.toBeVisible();
  });

  test('shows count badges on filter buttons', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('article.card', { timeout: 5000 });

    // Wait for counts to be updated
    await page.waitForTimeout(500);

    // Get button text content
    const inProgressBtn = page.locator('button.status-chip[data-status-filter="in-progress"]');
    const completedBtn = page.locator('button.status-chip[data-status-filter="completed"]');
    const allBtn = page.locator('button.status-chip[data-status-filter="all"]');

    await expect(inProgressBtn).toBeVisible();
    await expect(completedBtn).toBeVisible();
    await expect(allBtn).toBeVisible();

    // Check that count spans exist and have content
    const inProgressCount = inProgressBtn.locator('.filter-count');
    const completedCount = completedBtn.locator('.filter-count');
    const allCount = allBtn.locator('.filter-count');

    // Counts should be present (even if empty initially)
    await expect(inProgressCount).toBeVisible();
    await expect(completedCount).toBeVisible();
    await expect(allCount).toBeVisible();

    // Check that counts match fixture data
    // 4 in-progress (LedgerMind, DataPipe, Clarity, Pixo), 1 completed (DermaAI), 5 total
    const inProgText = await inProgressCount.textContent();
    const completedText = await completedCount.textContent();
    const allText = await allCount.textContent();

    expect(inProgText).toMatch(/\(4\)/);
    expect(completedText).toMatch(/\(1\)/);
    expect(allText).toMatch(/\(5\)/);
  });

  test('keyboard navigation works for filter buttons', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('article.card', { timeout: 5000 });

    // Focus on first status filter button
    const inProgressBtn = page.locator('button.status-chip[data-status-filter="in-progress"]');
    await inProgressBtn.focus();

    // Press Enter to activate (should already be active by default)
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    await expect(inProgressBtn).toHaveAttribute('aria-pressed', 'true');

    // Tab to next button and activate
    await page.keyboard.press('Tab');
    const completedBtn = page.locator('button.status-chip[data-status-filter="completed"]');
    await expect(completedBtn).toBeFocused();

    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    await expect(completedBtn).toHaveAttribute('aria-pressed', 'true');

    // Should now show completed projects
    await expect(page.locator('article.card:visible')).toHaveCount(1);
  });

  test('screen reader accessibility - aria attributes', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('article.card', { timeout: 5000 });

    // Check toolbar has proper ARIA labels
    const statusToolbar = page.locator('.status-filters[role="toolbar"]');
    await expect(statusToolbar).toHaveAttribute('aria-label', 'Project status filters');

    const categoryToolbar = page.locator('.filters[role="toolbar"]');
    await expect(categoryToolbar).toHaveAttribute('aria-label', 'Project category filters');

    // Check buttons have aria-pressed attributes
    const inProgressBtn = page.locator('button.status-chip[data-status-filter="in-progress"]');
    const completedBtn = page.locator('button.status-chip[data-status-filter="completed"]');

    // In Progress should be pressed by default
    await expect(inProgressBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(completedBtn).toHaveAttribute('aria-pressed', 'false');

    // Click Completed
    await completedBtn.click();
    await page.waitForTimeout(200);

    // Aria-pressed should switch
    await expect(inProgressBtn).toHaveAttribute('aria-pressed', 'false');
    await expect(completedBtn).toHaveAttribute('aria-pressed', 'true');

    // Count spans should have aria-hidden
    const countSpans = page.locator('.filter-count');
    for (let i = 0; i < await countSpans.count(); i++) {
      await expect(countSpans.nth(i)).toHaveAttribute('aria-hidden', 'true');
    }
  });

  test('filter interaction does not break on rapid clicks', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('article.card', { timeout: 5000 });

    const inProgressBtn = page.locator('button.status-chip[data-status-filter="in-progress"]');
    const completedBtn = page.locator('button.status-chip[data-status-filter="completed"]');
    const allBtn = page.locator('button.status-chip[data-status-filter="all"]');

    // Rapid clicks
    await completedBtn.click();
    await allBtn.click();
    await inProgressBtn.click();
    await completedBtn.click();
    await inProgressBtn.click();

    await page.waitForTimeout(300);

    // Should end on In Progress
    await expect(inProgressBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('article.card:visible')).toHaveCount(4);
    await expect(page.locator('article.card[data-slug="ledgermind"]')).toBeVisible();
  });

  test('visual regression - filter bar renders correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('article.card', { timeout: 5000 });
    await page.waitForTimeout(500); // Wait for counts to populate

    // Check that status filter bar exists and has proper styling
    const statusFilters = page.locator('.status-filters');
    await expect(statusFilters).toBeVisible();

    // All three buttons should be visible
    await expect(page.locator('button.status-chip')).toHaveCount(3);

    // Check button structure
    const buttons = page.locator('button.status-chip');
    for (let i = 0; i < 3; i++) {
      const button = buttons.nth(i);
      await expect(button.locator('.filter-label')).toBeVisible();
      await expect(button.locator('.filter-count')).toBeVisible();
    }
  });
});

test.describe('Homepage Status Filter - Edge Cases @frontend', () => {
  test('handles projects.json with all in-progress', async ({ page }) => {
    // Fixture with only in-progress projects (using actual slugs from HTML)
    const allInProgress = {
      'ledgermind': {
        slug: 'ledgermind',
        title: 'LedgerMind',
        summary: 'AI-powered finance agent',
        description: 'AI-powered finance agent with grounded analytics',
        status: 'in-progress',
        tags: ['AI', 'Finance', 'ML'],
        thumbnail: 'assets/ledgermind-thumb.webp'
      },
      'datapipe-ai': {
        slug: 'datapipe-ai',
        title: 'DataPipe AI',
        summary: 'RAG + pipelines',
        description: 'AI-powered ops agent for GKE deployments',
        status: 'in-progress',
        tags: ['AI', 'DevOps', 'Kubernetes', 'ML'],
        thumbnail: 'assets/datapipe-ai-cover.webp'
      },
      'clarity': {
        slug: 'clarity',
        title: 'Clarity Companion',
        summary: 'Chrome AI extension',
        description: 'On-device writing clarity assistant',
        status: 'in-progress',
        tags: ['Dev', 'Extension', 'Productivity'],
        thumbnail: 'assets/clarity-thumb.webp'
      },
      'dermaai': {
        slug: 'dermaai',
        title: 'DermaAI (SkinSight)',
        summary: 'Skin-condition assistant',
        description: 'Skin-condition assistant UI',
        status: 'in-progress',
        tags: ['Health', 'UI/UX'],
        thumbnail: 'assets/dermaai-thumb.webp'
      },
      'pixo-banana-suite': {
        slug: 'pixo-banana-suite',
        title: 'Pixo Banana Suite',
        summary: 'Pixel-art toolkit',
        description: 'Pixel-art pose/animate toolkit',
        status: 'in-progress',
        tags: ['GenAI', 'Game Art', 'Animation'],
        thumbnail: 'assets/pixo-banana-thumb.webp'
      }
    };

    await page.route(/projects\.json(\?.*)?$/, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(allInProgress)
      });
    });

    await page.goto('/');
    await page.waitForTimeout(500);

    // Completed should show (0)
    const completedBtn = page.locator('button.status-chip[data-status-filter="completed"]');
    const completedCount = await completedBtn.locator('.filter-count').textContent();
    expect(completedCount).toMatch(/\(0\)/);

    // Clicking Completed should show no cards
    await completedBtn.click();
    await page.waitForTimeout(200);

    // No visible cards (all are in-progress)
    const visibleCards = page.locator('article.card:visible');
    await expect(visibleCards).toHaveCount(0);
  });

  test('handles projects.json with missing status fields (defaults to in-progress)', async ({ page }) => {
    // Fixture with projects missing status field (using actual slugs from HTML)
    const noStatus = {
      'ledgermind': {
        slug: 'ledgermind',
        title: 'LedgerMind',
        summary: 'AI-powered finance agent',
        description: 'AI-powered finance agent with grounded analytics',
        // No status field - should default to in-progress
        tags: ['AI', 'Finance', 'ML'],
        thumbnail: 'assets/ledgermind-thumb.webp'
      },
      'datapipe-ai': {
        slug: 'datapipe-ai',
        title: 'DataPipe AI',
        summary: 'RAG + pipelines',
        description: 'AI-powered ops agent',
        // No status field - should default to in-progress
        tags: ['AI', 'DevOps', 'Kubernetes', 'ML'],
        thumbnail: 'assets/datapipe-ai-cover.webp'
      },
      'clarity': {
        slug: 'clarity',
        title: 'Clarity Companion',
        summary: 'Chrome AI extension',
        description: 'On-device writing clarity assistant',
        status: 'completed',
        date_completed: '2024-09-15',
        tags: ['Dev', 'Extension', 'Productivity'],
        thumbnail: 'assets/clarity-thumb.webp'
      },
      'dermaai': {
        slug: 'dermaai',
        title: 'DermaAI',
        summary: 'Skin-condition assistant',
        description: 'Educational skin condition UI',
        // No status field - should default to in-progress
        tags: ['Health', 'UI/UX'],
        thumbnail: 'assets/dermaai-thumb.webp'
      },
      'pixo-banana-suite': {
        slug: 'pixo-banana-suite',
        title: 'Pixo Banana Suite',
        summary: 'Pixel-art toolkit',
        description: 'Game art animation toolkit',
        // No status field - should default to in-progress
        tags: ['GenAI', 'Game Art'],
        thumbnail: 'assets/pixo-banana-thumb.webp'
      }
    };

    await page.route(/projects\.json(\?.*)?$/, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(noStatus)
      });
    });

    await page.goto('/');
    await page.waitForTimeout(500);

    // Should default missing status to in-progress
    const inProgressCount = await page.locator('button.status-chip[data-status-filter="in-progress"]')
      .locator('.filter-count').textContent();
    const completedCount = await page.locator('button.status-chip[data-status-filter="completed"]')
      .locator('.filter-count').textContent();

    // 4 in-progress (all except clarity), 1 completed (clarity)
    expect(inProgressCount).toMatch(/\(4\)/);
    expect(completedCount).toMatch(/\(1\)/);
  });
});
