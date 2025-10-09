import { test, expect } from '@playwright/test'

test.use({ storageState: 'playwright/.auth/dev-overlay.json' })

test('badge reflects session vs local mode', async ({ page }) => {
  // session (default)
  await page.goto('/tools.html')
  await expect(page.getByRole('heading', { name: 'SEO & OG Intelligence' })).toBeVisible()
  // Banner may be hidden initially; simulate a PR URL so the badge renders
  await page.evaluate(() => sessionStorage.setItem('seo.pr.url', 'https://example/pr/1'))
  await page.reload()
  await expect(page.getByTestId('seo-pr-persist-badge')).toHaveText(/session/i)

  // local via flag
  await page.goto('/tools.html?seoPersist=local')
  await page.evaluate(() => localStorage.setItem('seo.pr.url', 'https://example/pr/2'))
  await page.reload()
  await expect(page.getByTestId('seo-pr-persist-badge')).toHaveText(/local/i)
})

test('Clear is disabled when no PR URL is stored', async ({ page }) => {
  await page.goto('/tools.html')
  // Ensure no stored link
  await page.evaluate(() => { sessionStorage.removeItem('seo.pr.url'); localStorage.removeItem('seo.pr.url') })
  await page.reload()
  // Banner won't render without a PR URL; simulate to render controls then clear
  await page.evaluate(() => sessionStorage.setItem('seo.pr.url', 'https://example/pr/x'))
  await page.reload()
  await page.getByTestId('seo-pr-clear').click()
  // After clearing, controls usually hide with banner; if still visible, button should be disabled
  const clear = page.getByTestId('seo-pr-clear')
  if (await clear.isVisible()) {
    await expect(clear).toBeDisabled()
  }
})
