/**
 * GitHub repository synchronisation.
 *
 * Fetches public repositories for the configured owner, normalises them, and
 * writes `content/generated/repositories.json`.
 *
 * Guarantees this module is responsible for:
 *  - pagination is followed to the end;
 *  - rate limits are respected (and reported, not silently swallowed);
 *  - output is deterministic — repositories sorted by name, object keys in a
 *    fixed order — so an unchanged upstream produces a byte-identical file and
 *    the scheduled workflow does not open an empty pull request;
 *  - curated content in content/*.yml is never written to.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import {
  repositoriesOverridesSchema,
  syncedRepositoriesFileSchema,
  type SyncedRepository,
} from '../../src/lib/schema.js';
import { contentDir, generatedDir } from '../../src/lib/content.js';

const GITHUB_API = 'https://api.github.com';

export interface SyncOptions {
  /** Skip the language breakdown call (one extra request per repository). */
  skipLanguages?: boolean;
  /** Report what would change without writing. */
  dryRun?: boolean;
  token?: string;
}

export interface SyncResult {
  owner: string;
  fetched: number;
  written: boolean;
  added: string[];
  removed: string[];
  changed: string[];
  rateLimitRemaining: number | null;
  warnings: string[];
}

function authHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'parishruthiganesh-portfolio-sync',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

class RateLimitError extends Error {
  constructor(public resetAt: Date | null) {
    super(
      `GitHub API rate limit exhausted${
        resetAt ? `; resets at ${resetAt.toISOString()}` : ''
      }. Set GITHUB_TOKEN to raise the limit.`,
    );
    this.name = 'RateLimitError';
  }
}

let lastRateLimitRemaining: number | null = null;

async function githubFetch(url: string, token?: string): Promise<Response> {
  const response = await fetch(url, { headers: authHeaders(token) });
  const remaining = response.headers.get('x-ratelimit-remaining');
  if (remaining !== null) lastRateLimitRemaining = Number(remaining);

  if (response.status === 403 || response.status === 429) {
    if (lastRateLimitRemaining === 0) {
      const reset = response.headers.get('x-ratelimit-reset');
      throw new RateLimitError(reset ? new Date(Number(reset) * 1000) : null);
    }
  }
  return response;
}

/** Follow RFC 5988 `Link: <…>; rel="next"` pagination to the last page. */
export async function fetchAllRepositories(owner: string, token?: string): Promise<unknown[]> {
  const all: unknown[] = [];
  let url: string | null = `${GITHUB_API}/users/${encodeURIComponent(owner)}/repos?per_page=100&sort=full_name`;

  while (url) {
    const response = await githubFetch(url, token);
    if (!response.ok) {
      throw new Error(`GitHub API ${response.status} ${response.statusText} for ${url}`);
    }
    const page = (await response.json()) as unknown[];
    all.push(...page);

    const link = response.headers.get('link');
    const next = link?.split(',').find((part) => part.includes('rel="next"'));
    const match = next?.match(/<([^>]+)>/);
    url = match ? match[1]! : null;
  }
  return all;
}

async function fetchLanguages(
  owner: string,
  repo: string,
  token?: string,
): Promise<Record<string, number>> {
  const response = await githubFetch(
    `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/languages`,
    token,
  );
  if (!response.ok) return {};
  return (await response.json()) as Record<string, number>;
}

/** Map a raw API object onto the schema, with keys in a fixed order. */
export function normaliseRepository(
  raw: Record<string, any>,
  languages: Record<string, number> = {},
): SyncedRepository {
  const sortedLanguages: Record<string, number> = {};
  for (const key of Object.keys(languages).sort()) sortedLanguages[key] = languages[key]!;

  return {
    name: raw.name,
    fullName: raw.full_name,
    githubDescription: raw.description ?? null,
    url: raw.html_url,
    homepage: raw.homepage ? String(raw.homepage) : null,
    language: raw.language ?? null,
    languages: sortedLanguages,
    topics: [...(raw.topics ?? [])].sort(),
    stars: raw.stargazers_count ?? 0,
    forks: raw.forks_count ?? 0,
    openIssues: raw.open_issues_count ?? 0,
    license: raw.license?.spdx_id ?? null,
    isFork: Boolean(raw.fork),
    isArchived: Boolean(raw.archived),
    isPrivate: Boolean(raw.private),
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    pushedAt: raw.pushed_at,
    size: raw.size ?? 0,
    defaultBranch: raw.default_branch ?? 'main',
  };
}

function readExisting(): SyncedRepository[] {
  const file = path.join(generatedDir, 'repositories.json');
  if (!existsSync(file)) return [];
  const parsed = syncedRepositoriesFileSchema.safeParse(JSON.parse(readFileSync(file, 'utf8')));
  return parsed.success ? parsed.data.repositories : [];
}

/** Compare two records ignoring volatile fields that would churn every run. */
function meaningfullyDifferent(a: SyncedRepository, b: SyncedRepository): boolean {
  const strip = ({ updatedAt, ...rest }: SyncedRepository) => rest;
  return JSON.stringify(strip(a)) !== JSON.stringify(strip(b));
}

export async function syncRepositories(options: SyncOptions = {}): Promise<SyncResult> {
  const overrides = repositoriesOverridesSchema.parse(
    parseYaml(readFileSync(path.join(contentDir, 'repositories-overrides.yml'), 'utf8')),
  );
  const owner = overrides.github.owner;
  const token = options.token ?? process.env.GITHUB_TOKEN;
  const warnings: string[] = [];

  const raw = (await fetchAllRepositories(owner, token)) as Array<Record<string, any>>;

  const repositories: SyncedRepository[] = [];
  for (const item of raw) {
    let languages: Record<string, number> = {};
    if (!options.skipLanguages && !item.fork) {
      try {
        languages = await fetchLanguages(owner, item.name, token);
      } catch (error) {
        // A language breakdown is a nice-to-have; losing it must not fail a sync.
        warnings.push(`language breakdown unavailable for ${item.name}: ${(error as Error).message}`);
      }
    }
    repositories.push(normaliseRepository(item, languages));
  }
  repositories.sort((a, b) => a.name.localeCompare(b.name));

  const previous = readExisting();
  const previousByName = new Map(previous.map((r) => [r.name, r]));
  const currentByName = new Map(repositories.map((r) => [r.name, r]));

  const added = repositories.filter((r) => !previousByName.has(r.name)).map((r) => r.name);
  const removed = previous.filter((r) => !currentByName.has(r.name)).map((r) => r.name);
  const changed = repositories
    .filter((r) => {
      const before = previousByName.get(r.name);
      return before && meaningfullyDifferent(before, r);
    })
    .map((r) => r.name);

  // The public API cannot return private repositories anonymously. If a
  // repository disappears from the feed we keep the curated override (the site
  // still renders it) and warn — we never delete curated content on our own.
  for (const name of removed) {
    warnings.push(
      `${name} is no longer returned by the GitHub API. Its curated entry in ` +
        `content/repositories-overrides.yml has been left untouched.`,
    );
  }

  const nothingChanged = added.length === 0 && removed.length === 0 && changed.length === 0;
  const payload = {
    // A fixed timestamp when nothing changed keeps the file byte-identical, so
    // the scheduled workflow doesn't raise a pull request that only bumps a date.
    syncedAt: nothingChanged && previous.length > 0 ? readSyncedAt() : new Date().toISOString(),
    owner,
    source: 'https://api.github.com/users/' + owner + '/repos',
    repositories,
  };

  let written = false;
  if (!options.dryRun) {
    mkdirSync(generatedDir, { recursive: true });
    const file = path.join(generatedDir, 'repositories.json');
    const next = JSON.stringify(payload, null, 2) + '\n';
    const current = existsSync(file) ? readFileSync(file, 'utf8') : '';
    if (next !== current) {
      writeFileSync(file, next);
      written = true;
    }
  }

  return {
    owner,
    fetched: repositories.length,
    written,
    added,
    removed,
    changed,
    rateLimitRemaining: lastRateLimitRemaining,
    warnings,
  };
}

function readSyncedAt(): string {
  const file = path.join(generatedDir, 'repositories.json');
  if (!existsSync(file)) return new Date().toISOString();
  try {
    return JSON.parse(readFileSync(file, 'utf8')).syncedAt ?? new Date().toISOString();
  } catch {
    return new Date().toISOString();
  }
}

/** Does this repository exist and is it publicly readable? Used by link-paper-code. */
export async function repositoryExists(
  fullName: string,
  token?: string,
): Promise<{ exists: boolean; isPrivate: boolean; reason?: string }> {
  const response = await githubFetch(`${GITHUB_API}/repos/${fullName}`, token ?? process.env.GITHUB_TOKEN);
  if (response.status === 404) return { exists: false, isPrivate: false, reason: 'not found (404)' };
  if (!response.ok) {
    return { exists: false, isPrivate: false, reason: `${response.status} ${response.statusText}` };
  }
  const body = (await response.json()) as { private?: boolean };
  return { exists: true, isPrivate: Boolean(body.private) };
}
