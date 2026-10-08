import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const evidenceRoot = resolve(process.env.PORTFOLIO_DIR ?? 'test-results/screenshots');

test('owner delivers a local email and investigates its evidence', async ({
  context,
  page,
  request,
}) => {
  await mkdir(evidenceRoot, { recursive: true });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Sign in to your workspace' })).toBeVisible();
  await capture(page, '01-login.jpg');

  await page.getByLabel('Email').fill('owner@zapx.local');
  await page.getByLabel('Password').fill('local-zapx-owner');
  await page.getByRole('button', { name: 'Open workspace' }).click();
  await expect(
    page.getByRole('heading', { name: 'Delivery, without the guesswork.' }),
  ).toBeVisible();
  await capture(page, '02-overview.jpg');

  await page.getByRole('button', { name: /Providers$/ }).click();
  await expect(page.getByRole('heading', { exact: true, name: 'Providers' })).toBeVisible();
  await expect(page.getByText('Local Mailpit')).toBeVisible();
  await capture(page, '03-providers.jpg');

  await page.getByRole('button', { name: /Templates$/ }).click();
  await expect(page.getByText('Order ready')).toBeVisible();
  await capture(page, '04-templates.jpg');

  await page.getByRole('button', { name: /Compose$/ }).click();
  await page.getByLabel('Published template').selectOption({ label: 'Order ready · v1' });
  await page.getByLabel('Ready provider').selectOption({ label: 'Local Mailpit' });
  await page.getByRole('button', { name: 'Preview' }).click();
  await expect(page.getByText('Hello Naya, your order ORDER-1042 is ready.')).toBeVisible();
  await capture(page, '05-composer-preview.jpg');

  await page.getByRole('button', { name: 'Send notification' }).click();
  const accepted = page.getByText(/was accepted for durable delivery/);
  await expect(accepted).toBeVisible();
  const prefix = (await accepted.innerText()).match(/Notification ([a-f0-9]+)/)?.[1];
  expect(prefix).toBeTruthy();

  await page.getByRole('button', { name: /Notifications$/ }).click();
  const row = page.getByRole('row').filter({ hasText: prefix! }).first();
  await expect(row.getByText('DELIVERED', { exact: true })).toBeVisible({ timeout: 20_000 });
  await capture(page, '06-delivery-log.jpg');
  await row.click();
  await expect(page.getByText('Provider accepted the delivery.')).toBeVisible();
  await capture(page, '07-notification-detail.jpg');

  const inbox = await request.get('http://127.0.0.1:8026/api/v1/messages');
  expect(inbox.ok()).toBeTruthy();
  expect((await inbox.json()).messages_count).toBeGreaterThan(0);

  const mailpit = await context.newPage();
  await mailpit.goto('http://127.0.0.1:8026');
  await expect(mailpit.getByText('ORDER-1042').first()).toBeVisible();
  await capture(mailpit, '11-mailpit-inbox.jpg');
  await mailpit.close();

  await page.getByRole('button', { name: 'Close detail' }).click();
  await page.getByRole('button', { name: /API keys$/ }).click();
  await expect(page.getByRole('heading', { exact: true, name: 'API keys' })).toBeVisible();
  await capture(page, '08-api-keys.jpg');
  await page.getByRole('button', { name: /Audit trail$/ }).click();
  await expect(page.getByText('auth · login').first()).toBeVisible();
  await capture(page, '09-audit-trail.jpg');

  await page.setViewportSize({ height: 844, width: 390 });
  await page.getByRole('button', { name: /Overview$/ }).click();
  await expect(
    page.getByRole('heading', { name: 'Delivery, without the guesswork.' }),
  ).toBeVisible();
  await capture(page, '10-responsive-overview.jpg');
});

async function capture(page: Page, filename: string): Promise<void> {
  const category = filename.startsWith('10-')
    ? 'responsive'
    : filename.startsWith('11-')
      ? 'supporting'
      : ['01-login.jpg', '02-overview.jpg'].includes(filename)
        ? 'overview'
        : 'core-features';
  const directory = resolve(evidenceRoot, category);
  await mkdir(directory, { recursive: true });
  await page.screenshot({
    fullPage: true,
    path: resolve(directory, filename),
    quality: 90,
    type: 'jpeg',
  });
}
