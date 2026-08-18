/**
 * Tests against the built `dist/` output.
 *
 * Everything here is a check the schema tests cannot make, because it depends
 * on what actually got rendered: that every route exists, that no internal link
 * points at a page that was never generated, and that the pieces GitHub Pages
 * needs are present.
 *
 * The suite builds the site once if `dist/` is missing, so `npm test` works
 * from a clean checkout.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { loadContent, projectRoot } from '../src/lib/content.js';

const distDir = path.join(projectRoot, 'dist');
const content = loadContent();

beforeAll(() => {
  if (!existsSync(path.join(distDir, 'index.html'))) {
    execFileSync('npm', ['run', 'build'], { cwd: projectRoot, stdio: 'inherit' });
  }
}, 300_000);

/** Every .html file under dist/, as site-root-relative paths. */
function htmlFiles(dir = distDir, prefix = ''): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      found.push(...htmlFiles(full, `${prefix}/${entry}`));
    } else if (entry.endsWith('.html')) {
      found.push(`${prefix}/${entry}`);
    }
  }
  return found;
}

function read(route: string): string {
  return readFileSync(path.join(distDir, route.replace(/^\//, '')), 'utf8');
}

describe('routes', () => {
  const expected = [
    'index.html',
    'about/index.html',
    'research/index.html',
    'publications/index.html',
    'projects/index.html',
    'hackathons/index.html',
    'experience/index.html',
    'resume/index.html',
    'repositories/index.html',
    'contact/index.html',
    '404.html',
  ];

  for (const route of expected) {
    it(`renders /${route}`, () => {
      expect(existsSync(path.join(distDir, route)), route).toBe(true);
    });
  }

  it('renders a detail page for every publication', () => {
    for (const pub of content.publications) {
      expect(existsSync(path.join(distDir, 'publications', pub.id, 'index.html')), pub.id).toBe(true);
    }
  });

  it('renders a detail page for every project', () => {
    for (const project of content.projects) {
      expect(existsSync(path.join(distDir, 'projects', project.id, 'index.html')), project.id).toBe(true);
    }
  });
});

describe('internal links', () => {
  /** Does this site-root-relative path resolve to something in dist/? */
  function resolves(href: string): boolean {
    const clean = href.split('#')[0]!.split('?')[0]!.replace(/^\//, '');
    if (clean === '') return true;
    const candidates = [clean, `${clean}/index.html`, `${clean}.html`, clean.replace(/\/$/, '/index.html')];
    return candidates.some((candidate) => existsSync(path.join(distDir, candidate)));
  }

  it('no internal link points at a page that was not built', () => {
    const broken: string[] = [];
    for (const file of htmlFiles()) {
      const html = read(file);
      for (const match of html.matchAll(/href="(\/[^"#][^"]*)"/g)) {
        const href = match[1]!;
        // Skip generated feeds/sitemaps, which are files rather than routes.
        if (/\.(xml|txt|pdf|svg|webp|png|jpe?g|ico|json|bib|css|js)$/i.test(href)) continue;
        if (!resolves(href)) broken.push(`${file} → ${href}`);
      }
    }
    expect(broken).toEqual([]);
  });

  it('every referenced asset exists in the output', () => {
    const missing: string[] = [];
    for (const file of htmlFiles()) {
      const html = read(file);
      for (const match of html.matchAll(/(?:src|href)="(\/[^"]*\.(?:pdf|svg|webp|png|jpe?g|ico))"/g)) {
        const asset = match[1]!.replace(/^\//, '');
        if (!existsSync(path.join(distDir, asset))) missing.push(`${file} → /${asset}`);
      }
    }
    expect(missing).toEqual([]);
  });
});

describe('GitHub Pages configuration', () => {
  it('ships .nojekyll so underscore-prefixed assets are served', () => {
    expect(existsSync(path.join(distDir, '.nojekyll'))).toBe(true);
  });

  it('ships a custom 404 page', () => {
    const html = read('404.html');
    expect(html).toContain('That page does not exist');
    expect(html).toContain('noindex');
  });

  it('ships the resume PDF', () => {
    const resume = content.profile.resume.path.replace(/^\//, '');
    expect(existsSync(path.join(distDir, resume)), resume).toBe(true);
  });

  it('generates a sitemap and an RSS feed', () => {
    expect(existsSync(path.join(distDir, 'sitemap-index.xml'))).toBe(true);
    expect(existsSync(path.join(distDir, 'rss.xml'))).toBe(true);
    expect(existsSync(path.join(distDir, 'robots.txt'))).toBe(true);
  });

  it('uses the correct canonical origin for a user site', () => {
    const html = read('index.html');
    expect(html).toContain('https://parishruthiganesh.github.io');
    expect(html).toMatch(/<link rel="canonical" href="https:\/\/parishruthiganesh\.github\.io/);
  });

  it('does not emit a CNAME until a custom domain is configured', () => {
    // public/CNAME.example documents how to enable one; the real file stays absent.
    expect(existsSync(path.join(distDir, 'CNAME'))).toBe(false);
  });
});

describe('metadata and structured data', () => {
  it('every page has a title, description and canonical URL', () => {
    for (const file of htmlFiles()) {
      const html = read(file);
      expect(html, `${file}: <title>`).toMatch(/<title>[^<]+<\/title>/);
      expect(html, `${file}: description`).toMatch(/<meta name="description" content="[^"]+"/);
      expect(html, `${file}: canonical`).toMatch(/<link rel="canonical"/);
    }
  });

  it('every page carries Open Graph tags', () => {
    for (const file of htmlFiles()) {
      const html = read(file);
      expect(html, `${file}: og:title`).toContain('property="og:title"');
      expect(html, `${file}: og:image`).toContain('property="og:image"');
    }
  });

  it('emits Person structured data on every page', () => {
    for (const file of htmlFiles()) {
      expect(read(file), file).toContain('"@type":"Person"');
    }
  });

  it('emits ScholarlyArticle structured data on publication pages', () => {
    for (const pub of content.publications) {
      const html = read(`publications/${pub.id}/index.html`);
      expect(html, pub.id).toContain('"@type":"ScholarlyArticle"');
    }
  });
});

describe('accessibility basics', () => {
  it('every page has exactly one h1', () => {
    for (const file of htmlFiles()) {
      const count = (read(file).match(/<h1[\s>]/g) ?? []).length;
      expect(count, `${file} has ${count} h1 elements`).toBe(1);
    }
  });

  it('every page declares a language', () => {
    for (const file of htmlFiles()) {
      expect(read(file), file).toContain('<html lang="en"');
    }
  });

  it('every image has an alt attribute', () => {
    for (const file of htmlFiles()) {
      for (const match of read(file).matchAll(/<img\b[^>]*>/g)) {
        expect(match[0], `${file}: ${match[0].slice(0, 90)}`).toMatch(/\balt=/);
      }
    }
  });

  it('every page has a skip link to the main region', () => {
    for (const file of htmlFiles()) {
      const html = read(file);
      expect(html, file).toContain('href="#main"');
      expect(html, file).toContain('id="main"');
    }
  });
});

describe('privacy and security of the output', () => {
  it('no YouTube iframe is loaded until the visitor presses play', () => {
    const html = read('hackathons/index.html');
    expect(html).not.toMatch(/<iframe[^>]*youtube/i);
    expect(html).toContain('youtube-nocookie.com');
  });

  it('no third-party analytics or tracker script is embedded', () => {
    const trackers = [
      'googletagmanager.com',
      'google-analytics.com',
      'connect.facebook.net',
      'hotjar.com',
      'segment.com',
      'mixpanel.com',
    ];
    for (const file of htmlFiles()) {
      const html = read(file);
      for (const tracker of trackers) {
        expect(html.includes(tracker), `${file} contains ${tracker}`).toBe(false);
      }
    }
  });

  it('no token, key or secret is baked into the output', () => {
    for (const file of htmlFiles()) {
      const html = read(file);
      expect(/\b(gh[pousr]_[A-Za-z0-9]{16,}|sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16})\b/.test(html), file).toBe(false);
    }
  });

  it('no telephone number reaches the built site', () => {
    for (const file of htmlFiles()) {
      expect(/\+?1?\s*\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/.test(read(file)), file).toBe(false);
    }
  });

  it('maintainer-facing notes never reach the published pages', () => {
    // `note` in repositories-overrides.yml and every field in review-needed.yml
    // are reminders for the site's maintainer, not content for a visitor.
    for (const override of content.overrides.repositories) {
      if (!override.note) continue;
      for (const file of htmlFiles()) {
        expect(read(file).includes(override.note.slice(0, 40)), `${file} leaks the note for ${override.name}`).toBe(
          false,
        );
      }
    }
    for (const item of content.reviewItems) {
      for (const file of htmlFiles()) {
        expect(read(file).includes(item.summary.slice(0, 40)), `${file} leaks review item ${item.id}`).toBe(false);
      }
    }
  });

  it('no CLI maintenance instruction is rendered to visitors', () => {
    for (const file of htmlFiles()) {
      expect(read(file).includes('npm run portfolio'), `${file} shows a maintenance command`).toBe(false);
    }
  });

  it('the source-audit and review documents are not published as pages', () => {
    const files = htmlFiles().join(' ');
    expect(files).not.toMatch(/source-audit|portfolio-review|review-needed/i);
  });
});
