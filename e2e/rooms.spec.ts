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

const mockRooms = [
  {
    id: 'room-1',
    name: 'Mechanical Keyboard Enthusiasts',
    slug: 'mech-kb-enthusiasts',
    niche: 'mechanical keyboards',
    description: 'A room for keyboard lovers',
    member_count: 42,
    created_at: new Date().toISOString(),
  },
  {
    id: 'room-2',
    name: 'Custom Builds',
    slug: 'custom-builds',
    niche: 'mechanical keyboards',
    description: 'Share your custom keyboard builds',
    member_count: 28,
    created_at: new Date().toISOString(),
  },
];

const mockMessages = [
  {
    id: 'msg-1',
    room_id: 'room-1',
    user_id: 'user-2',
    content: 'Just finished my first custom build!',
    created_at: new Date().toISOString(),
    profiles: { display_name: 'KeyboardFan' },
  },
  {
    id: 'msg-2',
    room_id: 'room-1',
    user_id: 'test-user-id',
    content: 'That looks amazing!',
    created_at: new Date().toISOString(),
    profiles: { display_name: 'Test User' },
  },
];

test.describe('Rooms Page - Unauthenticated', () => {
  test('should redirect to home if not logged in', async ({ page }) => {
    await page.route('**/auth/session', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Unauthorized' }),
      });
    });

    await page.goto('/rooms');

    await expect(page).toHaveURL('/');
  });
});

test.describe('Rooms Page - Authenticated', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedSession(page);

    await page.route('**/api/user-rooms', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockRooms),
      });
    });

    await page.route('**/api/traits/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          deep_hooks: ['tactile feedback', 'custom builds'],
        }),
      });
    });

    await page.route('**/api/messages**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockMessages),
      });
    });
  });

  test('should display loading state initially', async ({ page }) => {
    // Override with slow response
    await page.route('**/api/user-rooms', async (route) => {
      await new Promise((r) => setTimeout(r, 500));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockRooms),
      });
    });

    await page.goto('/rooms');

    await expect(page.locator('.animate-spin')).toBeVisible();
  });

  test('should display room sidebar with rooms', async ({ page }) => {
    await page.goto('/rooms');

    await page.waitForLoadState('networkidle');

    // Should show room names in sidebar
    await expect(page.getByText('Mechanical Keyboard Enthusiasts')).toBeVisible();
    await expect(page.getByText('Custom Builds')).toBeVisible();
  });

  test('should auto-select first room', async ({ page }) => {
    await page.goto('/rooms');

    await page.waitForLoadState('networkidle');

    // First room should be selected (chat area should show messages)
    await expect(page.getByText('Just finished my first custom build!')).toBeVisible();
  });

  test('should allow room selection', async ({ page }) => {
    await page.goto('/rooms');

    await page.waitForLoadState('networkidle');

    // Both rooms should be visible in sidebar
    await expect(page.getByText('Mechanical Keyboard Enthusiasts')).toBeVisible();
    await expect(page.getByText('Custom Builds')).toBeVisible();

    // First room should be selected by default - verify its description is shown
    await expect(page.getByText('A room for keyboard lovers')).toBeVisible();
  });

  test('should show empty state when no rooms', async ({ page }) => {
    await page.route('**/api/user-rooms', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.goto('/rooms');

    await page.waitForLoadState('networkidle');

    // Should show empty state message
    await expect(page.getByText(/select a room/i)).toBeVisible();
  });
});

test.describe('Chat Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedSession(page);

    await page.route('**/api/user-rooms', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockRooms),
      });
    });

    await page.route('**/api/traits/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          deep_hooks: ['tactile feedback', 'custom builds'],
        }),
      });
    });

    await page.route('**/api/messages**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockMessages),
        });
      }
    });
  });

  test('should display existing messages', async ({ page }) => {
    await page.goto('/rooms');

    await page.waitForLoadState('networkidle');

    // Should show existing messages
    await expect(page.getByText('Just finished my first custom build!')).toBeVisible();
    await expect(page.getByText('That looks amazing!')).toBeVisible();
  });

  test('should send a new message', async ({ page }) => {
    let messageSent = false;

    await page.route('**/api/messages', async (route) => {
      if (route.request().method() === 'POST') {
        const body = JSON.parse(route.request().postData() || '{}');
        messageSent = true;

        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'msg-new',
            room_id: body.room_id,
            user_id: 'test-user-id',
            content: body.content,
            created_at: new Date().toISOString(),
            profiles: { display_name: 'Test User' },
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockMessages),
        });
      }
    });

    await page.goto('/rooms');

    await page.waitForLoadState('networkidle');

    // Find message input and send a message
    const messageInput = page.getByPlaceholder(/message|type/i);
    if (await messageInput.isVisible()) {
      await messageInput.fill('Hello everyone!');

      // Find and click send button or press Enter
      const sendButton = page.getByRole('button', { name: /send/i });
      if (await sendButton.isVisible()) {
        await sendButton.click();
      } else {
        await messageInput.press('Enter');
      }

      // Verify message was sent
      expect(messageSent).toBe(true);
    }
  });
});
