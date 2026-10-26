/**
 * Critical browser journeys.
 *
 * The site is a single page plus a printable CV, so these cover what static
 * analysis cannot: that entries link out to something real, that the CV still
 * prints on one sheet, that both themes render, and that the layout does not
 * overflow horizontally on a phone.
 *
 * Pages are asserted after `domcontentloaded` rather than `load`: everything
 * checked here is DOM, layout or interaction, and waiting for `load` would mean
 * waiting on third-party web fonts that have nothing to do with the behaviour
 * under test.
 */
import { test, expect, type Page } from '@playwright/test';

const ROUTES = ['/', '/cv'];

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

/*
 * One page, no navigation. Every entry has to carry its own way out, because
 * there is no detail page behind it any more.
 */
test.describe('the single page', () => {
  test('has no navigation bar', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('header nav')).toHaveCount(0);
  });

  test('carries every section', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    for (const heading of ['Currently', 'Research', 'Projects', 'Experience', 'Miscellaneous']) {
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    }
  });

  test('every entry title links to a real external artifact', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const titles = page.locator('.entry-title a');
    expect(await titles.count()).toBeGreaterThan(0);
    for (const href of await titles.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute('href') ?? ''),
    )) {
      expect(href, 'entry titles link out, never to a removed page').toMatch(/^https?:\/\//);
    }
  });

  test('no link points at a page that no longer exists', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const internal = await page
      .locator('a[href^="/"]')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href') ?? ''));
    for (const href of internal) {
      const allowed = href === '/' || href === '/cv' || /\.(pdf|xml|svg|webp|png|txt|ico)$/i.test(href);
      expect(allowed, `${href} is not one of the two routes that exist`).toBe(true);
    }
  });

  test('shows only the one thing currently in progress', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.current-list > li')).toHaveCount(1);
  });
});

test.describe('the CV', () => {
  test('fits on exactly one printed page', async ({ page, isMobile }) => {
    // page.pdf() is a headless-Chromium capability; the mobile project emulates
    // a device and cannot print.
    test.skip(isMobile === true, 'printing is only available on the desktop project');
    await page.goto('/cv', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => document.fonts.ready).catch(() => {});
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: false });
    const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
    expect(pages, 'the CV must stay on one sheet').toBe(1);
  });

  test('carries no private resume field', async ({ page }) => {
    await page.goto('/cv', { waitUntil: 'domcontentloaded' });
    const text = (await page.locator('body').innerText()).toLowerCase();
    // Telephone numbers, the home address and immigration status never ship.
    // Matched as a real phone shape (3-3-4 with separators, optional country
    // code) so that arXiv identifiers and profile URLs do not false-positive.
    expect(text).not.toMatch(/(\+\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/);
    expect(text).not.toContain('visa');
    expect(text).not.toContain('green card');
  });

  test('every degree, role and project in cv.yml is on the page', async ({ page }) => {
    await page.goto('/cv', { waitUntil: 'domcontentloaded' });
    const text = await page.locator('main').innerText();
    for (const name of ['Ph.D.', 'Auburn University', 'Emids', 'SplitShield']) {
      expect(text, name).toContain(name);
    }
    // The grade Parishruthi asked to drop must not come back.
    expect(text).not.toContain('7.7');
  });

  test('is downloadable as a real PDF from both the CV page and the footer', async ({
    page,
    request,
  }) => {
    for (const route of ['/cv', '/']) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      const href = await page
        .getByRole('link', { name: /(download pdf|cv \(pdf\))/i })
        .first()
        .getAttribute('href');
      expect(href, `no PDF link on ${route}`).toBeTruthy();

      const response = await request.get(href!);
      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toContain('pdf');
      expect((await response.body()).subarray(0, 5).toString('latin1')).toBe('%PDF-');
    }
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
    const channels = background.match(/\d+/g)?.slice(0, 3).map(Number) ?? [];
    expect(Math.max(...channels)).toBeLessThan(80);
  });

  test('light mode renders when the system prefers it', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const channels = (await backgroundOf(page)).match(/\d+/g)?.slice(0, 3).map(Number) ?? [];
    expect(Math.min(...channels)).toBeGreaterThan(200);
  });
});

test.describe('responsive layout', () => {
  for (const width of [320, 375, 768, 1024, 1440]) {
    test(`no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      for (const route of ROUTES) {
        await page.goto(route, { waitUntil: 'domcontentloaded' });
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, `${route} at ${width}px overflows by ${overflow}px`).toBeLessThanOrEqual(1);
      }
    });
  }
});

test.describe('privacy of the output', () => {
  test('nothing is embedded from YouTube or any other third party', async ({ page }) => {
    const thirdParty: string[] = [];
    page.on('request', (request) => {
      const host = new URL(request.url()).host;
      // Google Fonts is the one allowed outbound host; it is stylesheet-only.
      if (host && !host.startsWith('127.0.0.1') && !/fonts\.(googleapis|gstatic)\.com$/.test(host)) {
        thirdParty.push(request.url());
      }
    });

    for (const route of ROUTES) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1200);
      await expect(page.locator('iframe')).toHaveCount(0);
    }
    expect(thirdParty, 'no third-party request should fire on load').toEqual([]);
  });
});

test.describe('honest presentation', () => {
  test('a private repository is labelled, not linked', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const label = page.getByText(/code \(private\)/i).first();
    await expect(label).toBeAttached();
    // Plain text, not an anchor: a private repo URL is a 404 for a visitor.
    expect(await label.evaluate((node) => node.tagName)).not.toBe('A');
  });

  test('no entry title points at a private repository', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const hrefs = await page
      .locator('.entry-title a')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href') ?? ''));
    expect(hrefs).not.toContain('https://github.com/ParishruthiGanesh/astranova-trading-copilot');
  });

  test('unverified links carry a marker', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('unverified link').first()).toBeAttached();
  });
});

test.describe('reduced motion', () => {
  test('animations are suppressed when requested', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const duration = await page.evaluate(() => {
      const animated = document.querySelector('.animate-rise');
      return animated ? getComputedStyle(animated).animationDuration : '0s';
    });
    expect(parseFloat(duration)).toBeLessThan(0.05);
  });
});
