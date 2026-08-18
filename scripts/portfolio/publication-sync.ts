/**
 * Publication metadata synchronisation.
 *
 * Supported sources, in the order the CLI tries them:
 *   arXiv            — by arXiv ID (Atom API)
 *   Crossref         — by DOI
 *   ORCID            — by ORCID iD, for discovering new work
 *   Semantic Scholar — by DOI or arXiv ID, rate-limit compliant
 *
 * Google Scholar is deliberately NOT scraped: it forbids it, and a scraped
 * citation count cannot be attributed to a stable retrieval source.
 *
 * Nothing here overwrites content/publications.yml. Fetched records land in
 * content/generated/publication-metadata.json, and any disagreement with the
 * curated YAML is recorded as a `conflicts` entry for a human to resolve.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import {
  publicationsSchema,
  profileSchema,
  publicationMetadataFileSchema,
  type Publication,
  type PublicationMetadataEntry,
} from '../../src/lib/schema.js';
import { contentDir, generatedDir } from '../../src/lib/content.js';

const USER_AGENT = () =>
  `parishruthiganesh-portfolio/1.0 (+https://parishruthiganesh.github.io${
    process.env.PORTFOLIO_CONTACT_EMAIL ? `; mailto:${process.env.PORTFOLIO_CONTACT_EMAIL}` : ''
  })`;

export interface PublicationSyncResult {
  checked: number;
  retrieved: number;
  skipped: Array<{ id: string; reason: string }>;
  conflicts: Array<{ id: string; field: string; detail: string }>;
  /** Records found upstream that match no curated entry — never auto-published. */
  reviewQueue: Array<{ title: string; source: string; url?: string; reason: string }>;
  written: boolean;
  warnings: string[];
}

function textBetween(xml: string, tag: string): string | undefined {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return match ? decodeXml(match[1]!.trim()) : undefined;
}

function allBetween(xml: string, tag: string): string[] {
  const matches = xml.matchAll(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'g'));
  return [...matches].map((m) => decodeXml(m[1]!.trim()));
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Normalise a title for comparison: case, punctuation and whitespace insensitive. */
export function normaliseTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export async function fetchArxiv(arxivId: string): Promise<Partial<PublicationMetadataEntry>> {
  const response = await fetch(
    `https://export.arxiv.org/api/query?id_list=${encodeURIComponent(arxivId)}`,
    { headers: { 'User-Agent': USER_AGENT() } },
  );
  if (!response.ok) throw new Error(`arXiv API ${response.status} ${response.statusText}`);
  const xml = await response.text();

  const entry = xml.split('<entry>')[1];
  if (!entry) throw new Error(`arXiv returned no entry for ${arxivId}`);

  const categories = [...entry.matchAll(/<category[^>]*term="([^"]+)"/g)].map((m) => m[1]!);

  return {
    source: 'arxiv',
    title: textBetween(entry, 'title'),
    authors: allBetween(entry, 'name'),
    abstract: textBetween(entry, 'summary'),
    published: textBetween(entry, 'published'),
    updated: textBetween(entry, 'updated'),
    categories,
    doi: textBetween(entry, 'arxiv:doi'),
    url: `https://arxiv.org/abs/${arxivId}`,
  };
}

export async function fetchCrossref(doi: string): Promise<Partial<PublicationMetadataEntry>> {
  const response = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
    headers: { 'User-Agent': USER_AGENT() },
  });
  if (!response.ok) throw new Error(`Crossref API ${response.status} ${response.statusText}`);
  const body = (await response.json()) as { message: Record<string, any> };
  const work = body.message;

  return {
    source: 'crossref',
    title: Array.isArray(work.title) ? work.title[0] : work.title,
    authors: (work.author ?? []).map((a: any) => [a.given, a.family].filter(Boolean).join(' ')),
    abstract: typeof work.abstract === 'string' ? decodeXml(work.abstract.replace(/<[^>]+>/g, ' ')) : undefined,
    published: work.issued?.['date-parts']?.[0]?.join('-'),
    doi: work.DOI,
    url: work.URL,
    categories: work.subject ?? [],
  };
}

export async function fetchSemanticScholar(
  identifier: string,
): Promise<Partial<PublicationMetadataEntry>> {
  const response = await fetch(
    `https://api.semanticscholar.org/graph/v1/paper/${encodeURIComponent(identifier)}?fields=title,abstract,authors,year,externalIds,url`,
    { headers: { 'User-Agent': USER_AGENT() } },
  );
  if (response.status === 429) throw new Error('Semantic Scholar rate limit reached; try again later');
  if (!response.ok) throw new Error(`Semantic Scholar ${response.status} ${response.statusText}`);
  const body = (await response.json()) as Record<string, any>;

  return {
    source: 'semantic-scholar',
    title: body.title,
    authors: (body.authors ?? []).map((a: any) => a.name),
    abstract: body.abstract ?? undefined,
    published: body.year ? String(body.year) : undefined,
    doi: body.externalIds?.DOI,
    url: body.url,
    categories: [],
  };
}

/** Discover works from an ORCID record. Matches are queued, never published. */
export async function fetchOrcidWorks(
  orcidId: string,
): Promise<Array<{ title: string; doi?: string; url?: string; year?: string }>> {
  const response = await fetch(`https://pub.orcid.org/v3.0/${encodeURIComponent(orcidId)}/works`, {
    headers: { Accept: 'application/json', 'User-Agent': USER_AGENT() },
  });
  if (!response.ok) throw new Error(`ORCID API ${response.status} ${response.statusText}`);
  const body = (await response.json()) as Record<string, any>;

  return (body.group ?? []).map((group: any) => {
    const summary = group['work-summary']?.[0] ?? {};
    const ids: any[] = summary['external-ids']?.['external-id'] ?? [];
    const doi = ids.find((id) => id['external-id-type'] === 'doi')?.['external-id-value'];
    return {
      title: summary.title?.title?.value ?? '(untitled)',
      doi,
      url: summary.url?.value,
      year: summary['publication-date']?.year?.value,
    };
  });
}

/** Compare a fetched record against the curated YAML entry. */
function findConflicts(
  publication: Publication,
  fetched: Partial<PublicationMetadataEntry>,
): string[] {
  const conflicts: string[] = [];
  if (fetched.title && normaliseTitle(fetched.title) !== normaliseTitle(publication.title)) {
    conflicts.push(`title differs upstream: "${fetched.title}"`);
  }
  if (fetched.authors?.length && fetched.authors.length !== publication.authors.length) {
    const curated = publication.authors.join(', ');
    if (!publication.authors.includes('et al.')) {
      conflicts.push(
        `author count differs: upstream has ${fetched.authors.length} ` +
          `(${fetched.authors.join(', ')}), curated has ${publication.authors.length} (${curated})`,
      );
    }
  }
  if (fetched.doi && publication.doi && fetched.doi.toLowerCase() !== publication.doi.toLowerCase()) {
    conflicts.push(`DOI differs upstream: ${fetched.doi}`);
  }
  return conflicts;
}

export async function syncPublications(
  options: { dryRun?: boolean } = {},
): Promise<PublicationSyncResult> {
  const publications = publicationsSchema.parse(
    parseYaml(readFileSync(path.join(contentDir, 'publications.yml'), 'utf8')),
  );
  const profile = profileSchema.parse(
    parseYaml(readFileSync(path.join(contentDir, 'profile.yml'), 'utf8')),
  );

  const entries: PublicationMetadataEntry[] = [];
  const skipped: PublicationSyncResult['skipped'] = [];
  const conflicts: PublicationSyncResult['conflicts'] = [];
  const reviewQueue: PublicationSyncResult['reviewQueue'] = [];
  const warnings: string[] = [];
  const retrievedAt = new Date().toISOString();

  for (const publication of publications) {
    let fetched: Partial<PublicationMetadataEntry> | null = null;

    try {
      if (publication.arxivId) {
        fetched = await fetchArxiv(publication.arxivId);
      } else if (publication.doi) {
        fetched = await fetchCrossref(publication.doi);
      }
    } catch (error) {
      // An unreachable metadata service must never remove a curated record.
      warnings.push(`${publication.id}: ${(error as Error).message}`);
    }

    if (!fetched) {
      skipped.push({
        id: publication.id,
        reason: publication.arxivId || publication.doi
          ? 'metadata source unreachable — curated record kept unchanged'
          : 'no arXiv ID or DOI recorded, nothing to synchronise from',
      });
      continue;
    }

    const found = findConflicts(publication, fetched);
    for (const detail of found) conflicts.push({ id: publication.id, field: 'metadata', detail });

    entries.push({
      id: publication.id,
      source: fetched.source ?? 'arxiv',
      retrievedAt,
      title: fetched.title,
      authors: fetched.authors ?? [],
      abstract: fetched.abstract,
      published: fetched.published,
      updated: fetched.updated,
      categories: fetched.categories ?? [],
      doi: fetched.doi,
      url: fetched.url,
      conflicts: found,
    });
  }

  // ORCID discovery: anything not already curated goes to the review queue.
  const orcid = profile.links.orcid;
  if (orcid) {
    const orcidId = orcid.replace(/^https?:\/\/(www\.)?orcid\.org\//, '').replace(/\/$/, '');
    try {
      const works = await fetchOrcidWorks(orcidId);
      const known = new Set(publications.map((p) => normaliseTitle(p.title)));
      for (const work of works) {
        if (known.has(normaliseTitle(work.title))) continue;
        reviewQueue.push({
          title: work.title,
          source: 'orcid',
          url: work.url ?? (work.doi ? `https://doi.org/${work.doi}` : undefined),
          reason: 'found on ORCID but not present in content/publications.yml',
        });
      }
    } catch (error) {
      warnings.push(`ORCID discovery failed: ${(error as Error).message}`);
    }
  }

  const payload = { syncedAt: retrievedAt, entries };
  publicationMetadataFileSchema.parse(payload);

  let written = false;
  if (!options.dryRun && entries.length > 0) {
    mkdirSync(generatedDir, { recursive: true });
    const file = path.join(generatedDir, 'publication-metadata.json');
    // Ignore `retrievedAt`/`syncedAt` when deciding whether anything changed,
    // so an unchanged upstream does not produce a daily diff.
    const stableOf = (text: string) =>
      text.replace(/"(syncedAt|retrievedAt)": "[^"]*"/g, '"$1": ""');
    const next = JSON.stringify(payload, null, 2) + '\n';
    const current = existsSync(file) ? readFileSync(file, 'utf8') : '';
    if (stableOf(next) !== stableOf(current)) {
      writeFileSync(file, next);
      written = true;
    }
  }

  return {
    checked: publications.length,
    retrieved: entries.length,
    skipped,
    conflicts,
    reviewQueue,
    written,
    warnings,
  };
}
