/**
 * Tests for the synchronisation pipeline.
 *
 * The property that matters most here: a sync must never lose curated content.
 * Several of these tests exist specifically to prove that a failed or partial
 * fetch degrades to "keep what we have" rather than "publish an empty page".
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { normaliseRepository, fetchAllRepositories } from '../scripts/portfolio/github-sync.js';
import { normaliseTitle } from '../scripts/portfolio/publication-sync.js';
import { extractYouTubeId, interpret, collectUrls } from '../scripts/portfolio/commands.js';
import { syncedRepositorySchema } from '../src/lib/schema.js';
import { loadContent } from '../src/lib/content.js';

const RAW_REPO = {
  name: 'sentinel-memory',
  full_name: 'ParishruthiGanesh/sentinel-memory',
  description: 'An AI incident-response agent.',
  html_url: 'https://github.com/ParishruthiGanesh/sentinel-memory',
  homepage: 'https://example.vercel.app',
  language: 'TypeScript',
  topics: ['memory', 'agents'],
  stargazers_count: 3,
  forks_count: 1,
  open_issues_count: 0,
  license: { spdx_id: 'MIT' },
  fork: false,
  archived: false,
  private: false,
  created_at: '2026-08-17T22:08:11Z',
  updated_at: '2026-08-18T04:36:35Z',
  pushed_at: '2026-08-18T04:36:35Z',
  size: 5171,
  default_branch: 'main',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('repository normalisation', () => {
  it('maps the GitHub API shape onto the schema', () => {
    const result = normaliseRepository(RAW_REPO, { TypeScript: 900, CSS: 100 });
    expect(syncedRepositorySchema.safeParse(result).success).toBe(true);
    expect(result.githubDescription).toBe('An AI incident-response agent.');
    expect(result.license).toBe('MIT');
    expect(result.isPrivate).toBe(false);
  });

  it('is deterministic — topics and languages are sorted', () => {
    const a = normaliseRepository(
      { ...RAW_REPO, topics: ['zeta', 'alpha'] },
      { Zig: 1, Awk: 2 },
    );
    const b = normaliseRepository(
      { ...RAW_REPO, topics: ['alpha', 'zeta'] },
      { Awk: 2, Zig: 1 },
    );
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('tolerates a repository with no description, licence or topics', () => {
    const result = normaliseRepository({
      ...RAW_REPO,
      description: null,
      license: null,
      topics: undefined,
      homepage: '',
    });
    expect(result.githubDescription).toBeNull();
    expect(result.license).toBeNull();
    expect(result.topics).toEqual([]);
    expect(result.homepage).toBeNull();
    expect(syncedRepositorySchema.safeParse(result).success).toBe(true);
  });
});

describe('pagination', () => {
  it('follows rel="next" until the last page', async () => {
    const pages = [
      {
        body: [{ ...RAW_REPO, name: 'one' }],
        link: '<https://api.github.com/user/repos?page=2>; rel="next"',
      },
      { body: [{ ...RAW_REPO, name: 'two' }], link: null },
    ];
    let call = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        const page = pages[call++]!;
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => page.body,
          headers: new Headers(page.link ? { link: page.link } : {}),
        } as unknown as Response;
      }),
    );

    const all = (await fetchAllRepositories('ParishruthiGanesh')) as Array<{ name: string }>;
    expect(all.map((repo) => repo.name)).toEqual(['one', 'two']);
    expect(call).toBe(2);
  });

  it('surfaces an API failure instead of returning a partial list', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        ({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          json: async () => ({}),
          headers: new Headers(),
        }) as unknown as Response,
      ),
    );
    await expect(fetchAllRepositories('ParishruthiGanesh')).rejects.toThrow(/401/);
  });
});

describe('manual override preservation', () => {
  const content = loadContent();

  it('a curated summary is shown in preference to the GitHub description', () => {
    const repo = content.repositories.find((entry) => entry.name === 'sentinel-memory');
    expect(repo?.portfolioSummary).toBeTruthy();
    expect(repo?.description).toBe(repo?.portfolioSummary);
  });

  it('the GitHub description is retained alongside the curated summary', () => {
    const repo = content.repositories.find((entry) => entry.name === 'sentinel-memory');
    expect(repo?.githubDescription).toBeTruthy();
    expect(repo?.githubDescription).not.toBe(repo?.portfolioSummary);
  });

  it('a curated repository absent from the sync is still rendered', () => {
    // astranova-trading-copilot is private, so a public sync cannot return it.
    const repo = content.repositories.find((entry) => entry.name === 'astranova-trading-copilot');
    expect(repo, 'curated entry must survive a sync that cannot see it').toBeTruthy();
    expect(repo?.synced).toBe(false);
    expect(repo?.isPrivate).toBe(true);
    expect(repo?.portfolioSummary).toBeTruthy();
  });

  it('excluded repositories do not appear at all', () => {
    const names = content.repositories.map((entry) => entry.name);
    for (const excluded of content.overrides.github.exclude) {
      expect(names).not.toContain(excluded);
    }
  });

  it('forks are excluded unless explicitly featured', () => {
    for (const repo of content.repositories) {
      if (repo.isFork) expect(repo.featured, repo.name).toBe(true);
    }
  });
});

describe('publication metadata normalisation', () => {
  it('normalises titles case-, punctuation- and whitespace-insensitively', () => {
    expect(normaliseTitle('Selecting Open-Weight Language Models: A Study')).toBe(
      normaliseTitle('selecting open weight language models   a study'),
    );
  });

  it('distinguishes genuinely different titles', () => {
    expect(normaliseTitle('Early Violence Detection')).not.toBe(normaliseTitle('Late Violence Detection'));
  });
});

describe('YouTube id extraction', () => {
  const cases: Array<[string, string | null]> = [
    ['https://youtu.be/zg6Ys6pP6LA', 'zg6Ys6pP6LA'],
    ['https://www.youtube.com/watch?v=mH3apHH-qnk&si=abc', 'mH3apHH-qnk'],
    ['https://youtu.be/mH3apHH-qnk?si=Kt19eL-SYdoWsF9W', 'mH3apHH-qnk'],
    ['https://www.youtube.com/embed/zg6Ys6pP6LA', 'zg6Ys6pP6LA'],
    ['https://www.youtube.com/shorts/zg6Ys6pP6LA', 'zg6Ys6pP6LA'],
    ['zg6Ys6pP6LA', 'zg6Ys6pP6LA'],
    ['https://vimeo.com/12345', null],
    ['not a url', null],
  ];

  for (const [input, expected] of cases) {
    it(`${input} → ${expected}`, () => {
      expect(extractYouTubeId(input)).toBe(expected);
    });
  }
});

describe('CLI natural-language shortcuts', () => {
  it('maps requests onto deterministic commands without any API key', () => {
    expect(interpret('what is missing?')?.command).toBe('status');
    expect(interpret('add a paper from arxiv')?.command).toBe('add-paper');
    expect(interpret('add my sentinel memory hackathon')?.command).toBe('add-hackathon');
    expect(interpret('validate the content files')?.command).toBe('validate');
    expect(interpret('check every link')?.command).toBe('linkcheck');
  });

  it('extracts a repository name when one is present', () => {
    const resolved = interpret('hide the repo ParishruthiGanesh/Demo-repo');
    expect(resolved?.command).toBe('hide-repo');
    expect(resolved?.argv).toEqual(['ParishruthiGanesh/Demo-repo']);
  });

  it('returns null rather than guessing at an unrecognised request', () => {
    expect(interpret('make me a sandwich')).toBeNull();
  });
});

describe('URL collection', () => {
  it('finds every outbound URL with its origin recorded', () => {
    const urls = collectUrls();
    expect(urls.length).toBeGreaterThan(5);
    for (const entry of urls) {
      expect(entry.url).toMatch(/^https?:\/\//);
      expect(entry.where).toBeTruthy();
    }
  });

  it('reports which URLs are still unverified', () => {
    const urls = collectUrls();
    expect(urls.some((entry) => entry.verified)).toBe(true);
  });
});
