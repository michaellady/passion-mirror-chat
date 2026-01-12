import { test, expect } from '@playwright/test';

test.describe('Authentication Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth?niche=mechanical%20keyboards');
  });

  test('should display signup form by default', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /join the community/i })).toBeVisible();
    await expect(page.getByText(/ready to talk about "mechanical keyboards"/i)).toBeVisible();
  });

  test('should have required form fields for signup', async ({ page }) => {
    await expect(page.getByLabel(/display name/i)).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /create account/i })).toBeVisible();
  });

  test('should toggle to login form', async ({ page }) => {
    await page.getByRole('button', { name: /already have an account/i }).click();

    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
    await expect(page.getByLabel(/display name/i)).not.toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('should toggle back to signup form', async ({ page }) => {
    await page.getByRole('button', { name: /already have an account/i }).click();
    await page.getByRole('button', { name: /don't have an account/i }).click();

    await expect(page.getByRole('heading', { name: /join the community/i })).toBeVisible();
    await expect(page.getByLabel(/display name/i)).toBeVisible();
  });

  test('should validate email format', async ({ page }) => {
    const emailInput = page.getByLabel(/email/i);
    const submitButton = page.getByRole('button', { name: /create account/i });

    await page.getByLabel(/display name/i).fill('Test User');
    await emailInput.fill('invalid-email');
    await page.getByLabel(/password/i).fill('password123');
    await submitButton.click();

    // Browser should show validation message for invalid email
    await expect(emailInput).toHaveAttribute('type', 'email');
  });

  test('should validate password minimum length', async ({ page }) => {
    const passwordInput = page.getByLabel(/password/i);

    await expect(passwordInput).toHaveAttribute('minLength', '6');
  });

  test('should require all fields before submission', async ({ page }) => {
    const displayNameInput = page.getByLabel(/display name/i);
    const emailInput = page.getByLabel(/email/i);
    const passwordInput = page.getByLabel(/password/i);

    await expect(displayNameInput).toHaveAttribute('required', '');
    await expect(emailInput).toHaveAttribute('required', '');
    await expect(passwordInput).toHaveAttribute('required', '');
  });
});

test.describe('Authentication Flow with Mocked API', () => {
  test('should handle successful signup', async ({ page }) => {
    // Mock the signup API
    await page.route('**/auth/signup', async (route) => {
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
          token: 'mock-jwt-token',
        }),
      });
    });

    await page.goto('/auth?niche=mechanical%20keyboards');

    await page.getByLabel(/display name/i).fill('Test User');
    await page.getByLabel(/email/i).fill('test@example.com');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /create account/i }).click();

    // Should redirect to interview page
    await expect(page).toHaveURL(/\/interview\?niche=mechanical%20keyboards/);
  });

  test('should handle signup error', async ({ page }) => {
    // Mock the signup API to return an error
    await page.route('**/auth/signup', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Email already exists',
        }),
      });
    });

    await page.goto('/auth?niche=mechanical%20keyboards');

    await page.getByLabel(/display name/i).fill('Test User');
    await page.getByLabel(/email/i).fill('existing@example.com');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /create account/i }).click();

    // Should show error toast - use exact match to avoid multiple elements
    await expect(page.getByText('Email already exists', { exact: true })).toBeVisible();
  });

  test('should handle successful signin', async ({ page }) => {
    // Mock the signin API
    await page.route('**/auth/signin', async (route) => {
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
          token: 'mock-jwt-token',
        }),
      });
    });

    await page.goto('/auth?niche=mechanical%20keyboards');

    // Switch to login form
    await page.getByRole('button', { name: /already have an account/i }).click();

    await page.getByLabel(/email/i).fill('test@example.com');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Should redirect to interview page
    await expect(page).toHaveURL(/\/interview\?niche=mechanical%20keyboards/);
  });

  test('should handle signin error', async ({ page }) => {
    // Mock the signin API to return an error
    await page.route('**/auth/signin', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Invalid credentials',
        }),
      });
    });

    await page.goto('/auth?niche=mechanical%20keyboards');

    // Switch to login form
    await page.getByRole('button', { name: /already have an account/i }).click();

    await page.getByLabel(/email/i).fill('test@example.com');
    await page.getByLabel(/password/i).fill('wrongpassword');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Should show error toast - use exact match to avoid multiple elements
    await expect(page.getByText('Invalid credentials', { exact: true })).toBeVisible();
  });
});
