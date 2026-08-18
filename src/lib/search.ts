/**
 * Builds the static search index that backs the ⌘K command palette.
 *
 * The index is generated at build time and shipped as JSON inside the page, so
 * search works with no network request and no third-party service. It stays
 * small because it indexes titles, summaries and keywords rather than full
 * page bodies.
 */
import { loadContent } from './content.js';
import { NAV_ITEMS } from './nav.js';
import { url } from './url.js';

export type SearchKind =
  | 'page'
  | 'publication'
  | 'project'
  | 'research'
  | 'hackathon'
  | 'repository'
  | 'experience';

export interface SearchEntry {
  id: string;
  kind: SearchKind;
  title: string;
  subtitle: string;
  href: string;
  /** Lowercased haystack of every searchable term for this entry. */
  terms: string;
}

const KIND_ORDER: Record<SearchKind, number> = {
  page: 0,
  research: 1,
  publication: 2,
  project: 3,
  hackathon: 4,
  experience: 5,
  repository: 6,
};

function haystack(...parts: Array<string | undefined | null | string[]>): string {
  return parts
    .flat()
    .filter((part): part is string => Boolean(part))
    .join(' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .slice(0, 1200);
}

export function buildSearchIndex(): SearchEntry[] {
  const content = loadContent();
  const entries: SearchEntry[] = [];

  for (const item of NAV_ITEMS) {
    entries.push({
      id: `page:${item.href}`,
      kind: 'page',
      title: item.label,
      subtitle: item.description,
      href: url(item.href),
      terms: haystack(item.label, item.description),
    });
  }

  for (const theme of content.research) {
    entries.push({
      id: `research:${theme.id}`,
      kind: 'research',
      title: theme.title,
      subtitle: theme.question,
      href: url(`/research#${theme.id}`),
      terms: haystack(theme.title, theme.shortTitle, theme.question, theme.whyItMatters, theme.keywords),
    });
  }

  for (const pub of content.publications) {
    entries.push({
      id: `publication:${pub.id}`,
      kind: 'publication',
      title: pub.title,
      subtitle: `${pub.authors.join(', ')} · ${pub.venue ?? pub.year}`,
      href: url(`/publications/${pub.id}`),
      terms: haystack(pub.title, pub.authors, pub.venue, pub.abstract, pub.researchAreas, String(pub.year), pub.status),
    });
  }

  for (const project of content.projects) {
    entries.push({
      id: `project:${project.id}`,
      kind: 'project',
      title: project.name,
      subtitle: project.tagline,
      href: url(`/projects/${project.id}`),
      terms: haystack(
        project.name,
        project.tagline,
        project.technologies,
        project.researchAreas,
        project.problem,
        project.method,
        project.kind,
      ),
    });
  }

  for (const hackathon of content.hackathons) {
    entries.push({
      id: `hackathon:${hackathon.id}`,
      kind: 'hackathon',
      title: hackathon.projectName,
      subtitle: hackathon.hackathon,
      href: url(`/hackathons#${hackathon.id}`),
      terms: haystack(
        hackathon.projectName,
        hackathon.hackathon,
        hackathon.tagline,
        hackathon.problem,
        hackathon.whatItDoes,
        hackathon.technologies,
      ),
    });
  }

  for (const entry of content.experience) {
    entries.push({
      id: `experience:${entry.id}`,
      kind: 'experience',
      title: `${entry.role}, ${entry.organization}`,
      subtitle: entry.summary ?? entry.organization,
      href: url(`/experience#${entry.id}`),
      terms: haystack(
        entry.role,
        entry.organization,
        entry.summary,
        entry.technologies,
        entry.workstreams.map((stream) => stream.name),
      ),
    });
  }

  for (const repo of content.repositories) {
    if (repo.hidden) continue;
    entries.push({
      id: `repository:${repo.name}`,
      kind: 'repository',
      title: repo.name,
      subtitle: repo.description ?? 'GitHub repository',
      href: url(`/repositories#repo-${repo.name.toLowerCase()}`),
      terms: haystack(repo.name, repo.description, repo.githubDescription, repo.language, repo.topics, repo.categories),
    });
  }

  return entries.sort(
    (a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.title.localeCompare(b.title),
  );
}
