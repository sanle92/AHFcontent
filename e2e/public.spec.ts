import { test, expect } from '@playwright/test';
test('public routes, the sticky header and private API boundary', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  for (const width of [1440, 768, 375, 320]) {
    await page.setViewportSize({ width, height: 900 });
    const box = await page.locator('.site-header').boundingBox();
    expect(box?.height).toBe(79);
    const bodyWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(Math.abs((box?.width || 0) - bodyWidth)).toBeLessThan(1);
    expect((await page.locator('.header-content').boundingBox())!.width).toBeLessThanOrEqual(1250);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const path of ['/about', '/programmes', '/aminia-kids', '/stories', '/contact']) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  }
  expect((await request.get('/api/editorial')).status()).toBe(401);
  expect((await request.get('/admin')).status()).toBe(404);
  expect((await request.get('/unknown-page-e2e-check')).status()).toBe(404);
  await page.goto('/holyghost');
  const config = (await (await request.get('/api/website-config')).json()) as {
    configured: boolean;
  };
  if (config.configured) await expect(page.locator('input[type="password"]')).toBeVisible();
  else await expect(page.getByText('Read-only content preview')).toBeVisible();
});
