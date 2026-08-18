/**
 * Critical browser journeys.
 *
 * These cover the things static analysis cannot: that navigation works, that
 * the command palette and filters behave, that both themes render, and that the
 * layout does not overflow horizontally on a phone.
 */
import { test, expect, type Page } from '@playwright/test';

/**
 * Pages are asserted after `domcontentloaded` rather than `load`: everything
 * these tests check is DOM, layout or interaction, and waiting for `load` would
 * mean waiting on third-party web fonts that have nothing to do with the
 * behaviour under test.
 */
const ROUTES = [
  '/',
  '/about',
  '/research',
  '/publications',
  '/projects',
  '/hackathons',
  '/experience',
  '/resume',
  '/repositories',
  '/contact',
];

test.describe('every route renders', () => {
  for (const route of ROUTES) {
    test(`${route} loads with a heading and no console errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });

      const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
      expect(response?.status()).toBe(200);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('main')).toBeVisible();
      expect(errors, `console errors on ${route}`).toEqual([]);
    });
  }
});

test('the 404 page renders for an unknown route', async ({ page }) => {
  const response = await page.goto('/no-such-page', { waitUntil: 'domcontentloaded' });
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: /does not exist/i })).toBeVisible();
});

test.describe('navigation', () => {
  test('primary links reach their pages', async ({ page, isMobile }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    if (isMobile) {
      await page.getByRole('button', { name: /open navigation menu/i }).click();
    }
    await page.getByRole('navigation').getByRole('link', { name: 'Publications', exact: true }).first().click();
    await expect(page).toHaveURL(/\/publications/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/papers/i);
  });

  test('the skip link moves focus to the main region', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: /skip to content/i });
    await expect(skip).toBeFocused();
  });
});

test.describe('command palette', () => {
  test('opens with the keyboard and navigates to a result', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.keyboard.press('ControlOrMeta+k');
    const dialog = page.locator('#palette');
    await expect(dialog).toBeVisible();

    await page.locator('#palette-input').fill('sentinel');
    const first = page.locator('#palette-results a').first();
    await expect(first).toBeVisible();
    await first.click();
    await expect(page).toHaveURL(/sentinel-memory|repositories|hackathons/);
  });

  test('closes with Escape', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.keyboard.press('ControlOrMeta+k');
    await expect(page.locator('#palette')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#palette')).toBeHidden();
  });

  test('finds a publication by a word from its title', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.keyboard.press('ControlOrMeta+k');
    await page.locator('#palette-input').fill('intent classification');
    await expect(page.locator('#palette-results a').first()).toContainText(/intent/i);
  });
});

test.describe('filters', () => {
  test('publication filters narrow the list and report the count', async ({ page }) => {
    await page.goto('/publications', { waitUntil: 'domcontentloaded' });
    const cards = page.locator('#publication-list article');
    const total = await cards.count();
    expect(total).toBeGreaterThan(0);

    await page.locator('#filter-status').selectOption('preprint');
    await expect(page.locator('#publication-count')).toContainText(/Showing \d+ of/);
    const visible = await cards.evaluateAll((nodes) => nodes.filter((node) => !(node as HTMLElement).hidden).length);
    expect(visible).toBeGreaterThan(0);
    expect(visible).toBeLessThanOrEqual(total);
  });

  test('clearing filters restores every publication', async ({ page }) => {
    await page.goto('/publications', { waitUntil: 'domcontentloaded' });
    const total = await page.locator('#publication-list article').count();
    await page.locator('#filter-search').fill('zzzznomatch');
    await expect(page.locator('#publication-empty')).toBeVisible();
    await page.getByRole('button', { name: /clear filters/i }).click();
    await expect(page.locator('#publication-count')).toContainText(`Showing ${total} of ${total}`);
  });

  test('repository search filters the list', async ({ page }) => {
    await page.goto('/repositories', { waitUntil: 'domcontentloaded' });
    await page.locator('#repo-search').fill('sentinel');
    const visible = await page
      .locator('#repo-list li')
      .evaluateAll((nodes) => nodes.filter((node) => !(node as HTMLElement).hidden).length);
    expect(visible).toBeGreaterThan(0);
    expect(visible).toBeLessThan(8);
  });

  test('project type filter works', async ({ page }) => {
    await page.goto('/projects', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Research', exact: true }).click();
    await expect(page.locator('#project-count')).toContainText(/project/);
  });
});

test.describe('themes', () => {
  async function backgroundOf(page: Page): Promise<string> {
    return page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  }

  test('the toggle switches between light and dark and persists', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const before = await backgroundOf(page);
    await page.getByRole('button', { name: /switch between light and dark/i }).click();
    const after = await backgroundOf(page);
    expect(after).not.toBe(before);

    // The choice survives a reload, applied before paint.
    await page.reload();
    expect(await backgroundOf(page)).toBe(after);
  });

  test('dark mode renders when the system prefers it', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const background = await backgroundOf(page);
    // Deep navy: every channel well below mid-grey.
    const channels = background.match(/\d+/g)?.slice(0, 3).map(Number) ?? [];
    expect(Math.max(...channels)).toBeLessThan(80);
  });

  test('light mode renders when the system prefers it', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const channels =
      (await backgroundOf(page)).match(/\d+/g)?.slice(0, 3).map(Number) ?? [];
    expect(Math.min(...channels)).toBeGreaterThan(200);
  });
});

test.describe('responsive layout', () => {
  for (const width of [320, 375, 768, 1024, 1440]) {
    test(`no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      for (const route of ['/', '/projects/sentinel-memory', '/hackathons', '/repositories', '/publications']) {
        await page.goto(route, { waitUntil: 'domcontentloaded' });
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, `${route} at ${width}px overflows by ${overflow}px`).toBeLessThanOrEqual(1);
      }
    });
  }
});

test.describe('resume', () => {
  test('the PDF is downloadable and really is a PDF', async ({ page, request }) => {
    await page.goto('/resume', { waitUntil: 'domcontentloaded' });
    const link = page.getByRole('link', { name: /download pdf/i });
    await expect(link).toBeVisible();
    const href = await link.getAttribute('href');
    expect(href).toBeTruthy();

    const response = await request.get(href!);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('pdf');
    expect((await response.body()).subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  test('resume content is readable without the PDF', async ({ page }) => {
    await page.goto('/resume', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Education' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Experience' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Publications' })).toBeVisible();
    await expect(page.getByText('Auburn University').first()).toBeVisible();
  });
});

test.describe('YouTube embeds', () => {
  test('no iframe loads until the visitor presses play', async ({ page }) => {
    const youtubeRequests: string[] = [];
    page.on('request', (request) => {
      if (/youtube(-nocookie)?\.com/.test(request.url())) youtubeRequests.push(request.url());
    });

    await page.goto('/hackathons', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    expect(youtubeRequests, 'no YouTube request should fire on load').toEqual([]);
    await expect(page.locator('iframe')).toHaveCount(0);

    const play = page.getByRole('button', { name: /play video/i }).first();
    await expect(play).toBeVisible();
    await play.click();
    await expect(page.locator('iframe').first()).toHaveAttribute('src', /youtube-nocookie\.com/);
  });
});

test.describe('honest presentation', () => {
  test('a private repository is labelled, not linked', async ({ page }) => {
    await page.goto('/hackathons', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/repository is private/i).first()).toBeVisible();
  });

  test('unverified links carry a marker', async ({ page }) => {
    await page.goto('/hackathons', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('unverified').first()).toBeVisible();
  });
});

test.describe('reduced motion', () => {
  test('animations are suppressed when requested', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const duration = await page.evaluate(() => {
      const hero = document.querySelector('.animate-rise');
      return hero ? getComputedStyle(hero).animationDuration : '0s';
    });
    expect(parseFloat(duration)).toBeLessThan(0.05);
  });
});
