/**
 * Print the CV page to a PDF.
 *
 * The CV lives at /cv as ordinary HTML so it can be read in a browser and kept
 * in step with the rest of the content automatically. This turns that page into
 * the file that actually gets attached to an application.
 *
 * Run it with `npm run cv` — that builds the site first, so the PDF is always
 * printed from current content rather than a stale `dist/`.
 *
 * The page is printed with `preferCSSPageSize`, so the sheet size and margins
 * come from the `@page` rule in src/styles/cv.css and nowhere else. The script
 * fails if the result runs past one page: a two-page CV is a regression, not an
 * acceptable output.
 */
import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { chromium } from '@playwright/test';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/*
 * Write to whatever profile.yml calls the resume, rather than a path repeated
 * here. Every "Resume" link on the site reads that same field, so the file this
 * produces and the file those links point at cannot drift apart.
 */
const profile = parseYaml(readFileSync(path.join(projectRoot, 'content', 'profile.yml'), 'utf8'));
const resumePath = profile?.resume?.path;
if (typeof resumePath !== 'string' || !resumePath.endsWith('.pdf')) {
  throw new Error('profile.yml needs a resume.path ending in .pdf for the CV to be written to');
}
const outPath = path.join(projectRoot, 'public', resumePath.replace(/^\//, ''));
const port = Number(process.env.CV_PORT ?? 4327);

/** Chromium is pre-installed in some environments and downloaded in others. */
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;

async function waitForServer(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      /* not up yet */
    }
    if (Date.now() > deadline) throw new Error(`preview server did not start at ${url}`);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

const preview = spawn('npx', ['astro', 'preview', '--port', String(port)], {
  cwd: projectRoot,
  stdio: 'ignore',
});

let browser;
try {
  await waitForServer(`http://127.0.0.1:${port}/cv`);

  browser = await chromium.launch(executablePath ? { executablePath } : {});
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${port}/cv`, { waitUntil: 'domcontentloaded' });
  // Web fonts change the metrics, so never print before they have settled.
  await page.evaluate(() => document.fonts.ready).catch(() => {});

  mkdirSync(path.dirname(outPath), { recursive: true });
  await page.pdf({ path: outPath, preferCSSPageSize: true, printBackground: false });

  const pdf = readFileSync(outPath);
  const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  if (pages !== 1) {
    throw new Error(
      `the CV printed as ${pages} pages. Shorten content/cv.yml or adjust the print ` +
        `type scale in src/styles/cv.css until it fits one sheet.`,
    );
  }

  console.log(`CV written to public${resumePath} (1 page)`);
} finally {
  await browser?.close();
  preview.kill();
}
