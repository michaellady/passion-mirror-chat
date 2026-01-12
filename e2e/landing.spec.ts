import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
  test('should display the hero section', async ({ page }) => {
    await page.goto('/');

    // Check main headline
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Connect through your');
    await expect(page.locator('.gradient-text-primary')).toHaveText('weirdest');
    await expect(page.locator('.gradient-text-passion')).toHaveText('obsessions');
  });

  test('should have a niche input field', async ({ page }) => {
    await page.goto('/');

    const nicheInput = page.getByPlaceholder(/vintage synthesizers/i);
    await expect(nicheInput).toBeVisible();
  });

  test('should have disabled button when niche is empty', async ({ page }) => {
    await page.goto('/');

    const startButton = page.getByRole('button', { name: /start interview/i });
    await expect(startButton).toBeDisabled();
  });

  test('should enable button when niche is entered', async ({ page }) => {
    await page.goto('/');

    const nicheInput = page.getByPlaceholder(/vintage synthesizers/i);
    const startButton = page.getByRole('button', { name: /start interview/i });

    await nicheInput.fill('mechanical keyboards');
    await expect(startButton).toBeEnabled();
  });

  test('should navigate to auth page with niche parameter', async ({ page }) => {
    await page.goto('/');

    const nicheInput = page.getByPlaceholder(/vintage synthesizers/i);
    const startButton = page.getByRole('button', { name: /start interview/i });

    await nicheInput.fill('mechanical keyboards');
    await startButton.click();

    await expect(page).toHaveURL(/\/auth\?niche=mechanical%20keyboards/);
  });

  test('should navigate on Enter key press', async ({ page }) => {
    await page.goto('/');

    const nicheInput = page.getByPlaceholder(/vintage synthesizers/i);

    await nicheInput.fill('coffee brewing');
    await nicheInput.press('Enter');

    await expect(page).toHaveURL(/\/auth\?niche=coffee%20brewing/);
  });

  test('should display feature highlights', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('5-min voice interview')).toBeVisible();
    await expect(page.getByText('Passion analysis')).toBeVisible();
    await expect(page.getByText('Auto-matched communities')).toBeVisible();
  });
});
