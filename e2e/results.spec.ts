import { test, expect } from '@playwright/test';

// Helper to set up authenticated session
async function setupAuthenticatedSession(page: any) {
  await page.addInitScript(() => {
    localStorage.setItem('passion_auth_token', 'mock-jwt-token');
    localStorage.setItem(
      'passion_auth_user',
      JSON.stringify({
        id: 'test-user-id',
        email: 'test@example.com',
        display_name: 'Test User',
        niche_interest: 'mechanical keyboards',
        created_at: new Date().toISOString(),
      })
    );
  });

  await page.route('**/auth/session', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: 'test-user-id',
          email: 'test@example.com',
          display_name: 'Test User',
          niche_interest: 'mechanical keyboards',
          created_at: new Date().toISOString(),
        },
      }),
    });
  });
}

test.describe('Results Page - Unauthenticated', () => {
  test('should redirect to home if not logged in', async ({ page }) => {
    await page.route('**/auth/session', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Unauthorized' }),
      });
    });

    await page.goto('/results');

    await expect(page).toHaveURL('/');
  });
});

test.describe('Results Page - Authenticated', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedSession(page);
  });

  test('should display loading state initially', async ({ page }) => {
    // Delay API response to see loading state
    await page.route('**/api/profiles/**', async (route) => {
      await new Promise((r) => setTimeout(r, 500));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-user-id',
          display_name: 'Test User',
          niche_interest: 'mechanical keyboards',
        }),
      });
    });

    await page.route('**/api/traits/**', async (route) => {
      await new Promise((r) => setTimeout(r, 500));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          big5: {
            openness: 80,
            conscientiousness: 70,
            extraversion: 60,
            agreeableness: 75,
            neuroticism: 40,
          },
          passion_score: 85,
          archetype: 'Explorer',
          tags: ['enthusiast', 'collector'],
          deep_hooks: ['tactile feedback', 'custom builds'],
        }),
      });
    });

    await page.goto('/results');

    // Should see loading spinner
    await expect(page.locator('.animate-spin')).toBeVisible();
  });

  test('should display passion card after data loads', async ({ page }) => {
    await page.route('**/api/profiles/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-user-id',
          display_name: 'Test User',
          niche_interest: 'mechanical keyboards',
        }),
      });
    });

    await page.route('**/api/traits/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          big5: {
            openness: 80,
            conscientiousness: 70,
            extraversion: 60,
            agreeableness: 75,
            neuroticism: 40,
          },
          passion_score: 85,
          archetype: 'Explorer',
          tags: ['enthusiast', 'collector'],
          deep_hooks: ['tactile feedback', 'custom builds'],
        }),
      });
    });

    await page.goto('/results');

    // Wait for data to load
    await page.waitForLoadState('networkidle');

    // Should display user's display name and niche
    await expect(page.getByText('Test User')).toBeVisible();
  });

  test('should navigate to rooms on continue', async ({ page }) => {
    await page.route('**/api/profiles/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-user-id',
          display_name: 'Test User',
          niche_interest: 'mechanical keyboards',
        }),
      });
    });

    await page.route('**/api/traits/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          big5: {
            openness: 80,
            conscientiousness: 70,
            extraversion: 60,
            agreeableness: 75,
            neuroticism: 40,
          },
          passion_score: 85,
          archetype: 'Explorer',
          tags: ['enthusiast', 'collector'],
          deep_hooks: ['tactile feedback', 'custom builds'],
        }),
      });
    });

    // Mock rooms API for navigation
    await page.route('**/api/user-rooms', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.goto('/results');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Find and click continue button
    const continueButton = page.getByRole('button', { name: /continue|join|explore/i });
    if (await continueButton.isVisible()) {
      await continueButton.click();
      await expect(page).toHaveURL('/rooms');
    }
  });
});
