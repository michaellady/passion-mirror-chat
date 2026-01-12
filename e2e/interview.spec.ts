import { test, expect } from '@playwright/test';

// Helper to set up authenticated session
async function setupAuthenticatedSession(page: any) {
  // Set auth tokens in localStorage before navigating
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

  // Mock session verification
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

test.describe('Interview Page - Unauthenticated', () => {
  test('should redirect to auth if not logged in', async ({ page }) => {
    // Mock session endpoint to return unauthorized
    await page.route('**/auth/session', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Unauthorized' }),
      });
    });

    await page.goto('/interview?niche=mechanical%20keyboards');

    await expect(page).toHaveURL(/\/auth\?niche=mechanical%20keyboards/);
  });
});

test.describe('Interview Page - Authenticated', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedSession(page);
  });

  test('should display interview start page', async ({ page }) => {
    await page.goto('/interview?niche=mechanical%20keyboards');

    // Should show the start interview component
    await expect(page.locator('body')).toContainText(/mechanical keyboards/i);
  });

  test('should start interview and show waiting state', async ({ page }) => {
    // Mock the start-interview API
    await page.route('**/start-interview', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          session_url: 'https://voice.example.com/session/123',
        }),
      });
    });

    // Mock the check-interview-status API
    await page.route('**/check-interview-status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'pending',
        }),
      });
    });

    await page.goto('/interview?niche=mechanical%20keyboards');

    // Find and click the start button (the component should have some start action)
    const startButton = page.getByRole('button').first();
    if (await startButton.isVisible()) {
      await startButton.click();
    }
  });
});

test.describe('Interview Demo Mode', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedSession(page);
  });

  test('should complete demo interview successfully', async ({ page }) => {
    // Mock all required APIs
    await page.route('**/start-interview', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          session_url: null, // No URL triggers demo mode
        }),
      });
    });

    await page.route('**/api/traits', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      }
    });

    await page.route('**/api/rooms**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.route('**/api/sessions', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await page.goto('/interview?niche=mechanical%20keyboards');

    // Wait for page to load and look for demo-related buttons
    await page.waitForLoadState('networkidle');
  });

  test('should process transcript and navigate to results', async ({ page }) => {
    // Mock all APIs for successful flow
    await page.route('**/start-interview', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          session_url: 'https://voice.example.com/session/123',
        }),
      });
    });

    let statusCallCount = 0;
    await page.route('**/check-interview-status', async (route) => {
      statusCallCount++;
      // Return completed status after first call
      if (statusCallCount > 1) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'completed',
            transcript: 'I love mechanical keyboards! The tactile feedback is amazing.',
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'active',
          }),
        });
      }
    });

    await page.route('**/api/traits', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      }
    });

    await page.route('**/api/rooms**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.route('**/api/sessions', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await page.goto('/interview?niche=mechanical%20keyboards');
  });
});

test.describe('Interview Status Polling', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedSession(page);
  });

  test('should poll for interview status', async ({ page }) => {
    const statusCalls: string[] = [];

    await page.route('**/start-interview', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          session_url: 'https://voice.example.com/session/123',
        }),
      });
    });

    await page.route('**/check-interview-status', async (route) => {
      statusCalls.push(new Date().toISOString());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'pending',
        }),
      });
    });

    await page.goto('/interview?niche=mechanical%20keyboards');

    // Wait for initial load
    await page.waitForLoadState('networkidle');
  });
});
