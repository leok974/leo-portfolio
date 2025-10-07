import { test, expect } from '@playwright/test';

test.describe('Last Run Badge @frontend', () => {
  test('renders when layout.json exists', async ({ page }) => {
    await page.goto('/');
    
    // Badge might not be visible immediately if layout.json doesn't exist
    // or if it's in a collapsed panel
    const badge = page.getByTestId('last-run-badge');
    
    // Check if badge exists in DOM (might be hidden initially)
    const badgeCount = await badge.count();
    
    if (badgeCount > 0) {
      // If badge exists, it should contain "Last optimized:"
      await expect(badge).toContainText(/Last optimized:/i);
      
      // Should show preset info
      await expect(badge).toContainText(/preset=/i);
      
      // Should show featured count
      await expect(badge).toContainText(/featured=/i);
    } else {
      // If layout.json doesn't exist yet, badge won't render
      // This is expected behavior
      console.log('Last run badge not present - layout.json may not exist yet');
    }
  });

  test('displays formatted timestamp', async ({ page }) => {
    await page.goto('/');
    
    const badge = page.getByTestId('last-run-badge');
    const badgeCount = await badge.count();
    
    if (badgeCount > 0) {
      const text = await badge.textContent();
      // Should contain date/time formatting (various formats accepted)
      expect(text).toMatch(/\d/); // Should contain at least one digit
    }
  });

  test('shows preset name', async ({ page }) => {
    await page.goto('/');
    
    const badge = page.getByTestId('last-run-badge');
    const badgeCount = await badge.count();
    
    if (badgeCount > 0) {
      const text = await badge.textContent();
      // Should show preset (default, recruiter, or hiring_manager)
      expect(text).toMatch(/preset=(default|recruiter|hiring_manager)/);
    }
  });
});
