/**
 * Loads, validates and cross-links every structured content file.
 *
 * Everything the site renders comes through here. Schema failures and broken
 * cross-references throw at build time rather than producing a page with an
 * empty section, so a bad edit fails loudly in CI instead of quietly on the
 * live site.
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import {
  profileSchema,
  educationSchema,
  experienceSchema,
  researchSchema,
  publicationsSchema,
  projectsSchema,
  hackathonsSchema,
  repositoriesOverridesSchema,
  researchLinksSchema,
  skillsSchema,
  awardsSchema,
  talksSchema,
  currentWorkSchema,
  reviewNeededSchema,
  syncedRepositoriesFileSchema,
  publicationMetadataFileSchema,
  type Profile,
  type EducationEntry,
  type ExperienceEntry,
  type ResearchTheme,
  type Publication,
  type Project,
  type Hackathon,
  type RepositoriesOverrides,
  type RepositoryOverride,
  type ResearchLink,
  type SkillGroup,
  type Award,
  type Talk,
  type ReviewItem,
  type SyncedRepository,
  type CurrentWorkItem,
  type PublicationMetadataEntry,
} from './schema.js';
import type { z } from 'zod';

export const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
export const contentDir = path.join(projectRoot, 'content');
export const generatedDir = path.join(contentDir, 'generated');
export const publicDir = path.join(projectRoot, 'public');

function readYaml(fileName: string): unknown {
  const filePath = path.join(contentDir, fileName);
  if (!existsSync(filePath)) {
    throw new Error(`Missing content file: content/${fileName}`);
  }
  return parseYaml(readFileSync(filePath, 'utf8'));
}

/** Parse a content file, turning a Zod failure into a readable build error. */
export function loadFile<T extends z.ZodTypeAny>(fileName: string, schema: T): z.infer<T> {
  const raw = readYaml(fileName);
  const result = schema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  • ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`content/${fileName} failed validation:\n${issues}`);
  }
  return result.data;
}

/** Optional JSON file produced by `portfolio sync`. Absent is not an error. */
function loadGeneratedJson<T extends z.ZodTypeAny>(fileName: string, schema: T): z.infer<T> | null {
  const filePath = path.join(generatedDir, fileName);
  if (!existsSync(filePath)) return null;
  const parsed = schema.safeParse(JSON.parse(readFileSync(filePath, 'utf8')));
  if (!parsed.success) {
    throw new Error(
      `content/generated/${fileName} failed validation. Re-run \`npm run portfolio -- sync\`.`,
    );
  }
  return parsed.data;
}

/* ------------------------------------------------------------------ */
/* Derived view models                                                 */
/* ------------------------------------------------------------------ */

/** A repository as the Repositories page needs it: synced data + curation. */
export interface RepositoryView {
  name: string;
  fullName: string;
  url: string;
  /** Straight from GitHub. Never edited by hand. */
  githubDescription: string | null;
  /** Curated. Never overwritten by a sync. */
  portfolioSummary: string | null;
  /** What the card actually shows. */
  description: string | null;
  language: string | null;
  languages: Array<{ name: string; bytes: number; percent: number }>;
  topics: string[];
  stars: number;
  forks: number;
  license: string | null;
  homepage: string | null;
  isFork: boolean;
  isArchived: boolean;
  isPrivate: boolean;
  updatedAt: string;
  pushedAt: string;
  categories: string[];
  featured: boolean;
  hidden: boolean;
  order: number;
  note: string | null;
  relatedPublications: Publication[];
  relatedHackathons: Hackathon[];
  relatedProjects: Project[];
  /** True when this entry has curation but no synced GitHub record yet. */
  synced: boolean;
}

export interface PortfolioContent {
  profile: Profile;
  education: EducationEntry[];
  experience: ExperienceEntry[];
  research: ResearchTheme[];
  publications: Publication[];
  projects: Project[];
  hackathons: Hackathon[];
  overrides: RepositoriesOverrides;
  researchLinks: ResearchLink[];
  skills: SkillGroup[];
  awards: Award[];
  talks: Talk[];
  currentWork: { updated: string; items: CurrentWorkItem[] };
  reviewItems: ReviewItem[];
  repositories: RepositoryView[];
  publicationMetadata: PublicationMetadataEntry[];
  syncedAt: string | null;
}

function byOrderThen<T extends { order: number }>(
  items: T[],
  tiebreak: (a: T, b: T) => number,
): T[] {
  return [...items].sort((a, b) => a.order - b.order || tiebreak(a, b));
}

function percentages(languages: Record<string, number>) {
  const total = Object.values(languages).reduce((sum, n) => sum + n, 0);
  if (total === 0) return [];
  return Object.entries(languages)
    .sort((a, b) => b[1] - a[1])
    .map(([name, bytes]) => ({ name, bytes, percent: (bytes / total) * 100 }));
}

/**
 * Merge synced GitHub metadata with the curated override layer.
 *
 * Rules that matter:
 *  - `portfolioSummary` always wins over `githubDescription` for display, but
 *    both are kept so the Repositories page can show the GitHub one too.
 *  - A curated entry with no synced counterpart still renders (marked
 *    `synced: false`) — a sync failure must never silently delete curation.
 *  - Excluded repositories disappear entirely; hidden ones keep their synced
 *    metadata but are filtered out of the public list.
 */
function buildRepositories(
  synced: SyncedRepository[],
  overrides: RepositoriesOverrides,
  publications: Publication[],
  hackathons: Hackathon[],
  projects: Project[],
): RepositoryView[] {
  const overrideByName = new Map<string, RepositoryOverride>(
    overrides.repositories.map((entry) => [entry.name.toLowerCase(), entry]),
  );
  const excluded = new Set(overrides.github.exclude.map((name) => name.toLowerCase()));
  const pubById = new Map(publications.map((p) => [p.id, p]));
  const hackById = new Map(hackathons.map((h) => [h.id, h]));
  const projById = new Map(projects.map((p) => [p.id, p]));

  const views: RepositoryView[] = [];
  const seen = new Set<string>();

  for (const repo of synced) {
    const key = repo.name.toLowerCase();
    if (excluded.has(key)) continue;
    const override = overrideByName.get(key);
    if (repo.isFork && !overrides.github.includeForks && !override?.featured) continue;
    const looksEmpty =
      !repo.githubDescription && repo.topics.length === 0 && repo.stars === 0 && repo.size <= 2;
    if (looksEmpty && overrides.github.hideEmpty && !override) continue;

    seen.add(key);
    views.push({
      name: repo.name,
      fullName: repo.fullName,
      url: repo.url,
      githubDescription: repo.githubDescription,
      portfolioSummary: override?.portfolioSummary ?? null,
      description: override?.portfolioSummary ?? repo.githubDescription,
      language: repo.language,
      languages: percentages(repo.languages),
      topics: repo.topics,
      stars: repo.stars,
      forks: repo.forks,
      license: repo.license,
      homepage: repo.homepage,
      isFork: repo.isFork,
      isArchived: repo.isArchived,
      isPrivate: repo.isPrivate || (override?.privateRepo ?? false),
      updatedAt: repo.updatedAt,
      pushedAt: repo.pushedAt,
      categories: override?.categories ?? [],
      featured: override?.featured ?? false,
      hidden: override?.hidden ?? false,
      order: override?.order ?? 500,
      note: override?.note ?? null,
      relatedPublications: (override?.relatedPublications ?? [])
        .map((id) => pubById.get(id))
        .filter((x): x is Publication => Boolean(x)),
      relatedHackathons: (override?.relatedHackathons ?? [])
        .map((id) => hackById.get(id))
        .filter((x): x is Hackathon => Boolean(x)),
      relatedProjects: (override?.relatedProjects ?? [])
        .map((id) => projById.get(id))
        .filter((x): x is Project => Boolean(x)),
      synced: true,
    });
  }

  // Curated entries with no synced record — kept, never dropped.
  for (const override of overrides.repositories) {
    const key = override.name.toLowerCase();
    if (seen.has(key) || excluded.has(key)) continue;
    views.push({
      name: override.name,
      fullName: `${overrides.github.owner}/${override.name}`,
      url: `https://github.com/${overrides.github.owner}/${override.name}`,
      githubDescription: null,
      portfolioSummary: override.portfolioSummary ?? null,
      description: override.portfolioSummary ?? null,
      language: null,
      languages: [],
      topics: [],
      stars: 0,
      forks: 0,
      license: null,
      homepage: null,
      isFork: false,
      isArchived: false,
      isPrivate: override.privateRepo,
      updatedAt: '',
      pushedAt: '',
      categories: override.categories,
      featured: override.featured,
      hidden: override.hidden,
      order: override.order,
      note: override.note ?? null,
      relatedPublications: override.relatedPublications
        .map((id) => pubById.get(id))
        .filter((x): x is Publication => Boolean(x)),
      relatedHackathons: override.relatedHackathons
        .map((id) => hackById.get(id))
        .filter((x): x is Hackathon => Boolean(x)),
      relatedProjects: override.relatedProjects
        .map((id) => projById.get(id))
        .filter((x): x is Project => Boolean(x)),
      synced: false,
    });
  }

  return byOrderThen(views, (a, b) => a.name.localeCompare(b.name));
}

let cached: PortfolioContent | null = null;

/** Load everything. Cached, because Astro calls this from many pages. */
export function loadContent(): PortfolioContent {
  if (cached) return cached;

  const profile = loadFile('profile.yml', profileSchema);
  const education = loadFile('education.yml', educationSchema);
  const experience = loadFile('experience.yml', experienceSchema);
  const research = loadFile('research.yml', researchSchema);
  const publications = loadFile('publications.yml', publicationsSchema);
  const projects = loadFile('projects.yml', projectsSchema);
  const hackathons = loadFile('hackathons.yml', hackathonsSchema);
  const overrides = loadFile('repositories-overrides.yml', repositoriesOverridesSchema);
  const researchLinks = loadFile('research-links.yml', researchLinksSchema);
  const skills = loadFile('skills.yml', skillsSchema);
  const awards = loadFile('awards.yml', awardsSchema);
  const talks = loadFile('talks.yml', talksSchema);
  const currentWork = loadFile('current-work.yml', currentWorkSchema);
  const reviewItems = loadFile('review-needed.yml', reviewNeededSchema);

  const syncedRepos = loadGeneratedJson('repositories.json', syncedRepositoriesFileSchema);
  const pubMeta = loadGeneratedJson('publication-metadata.json', publicationMetadataFileSchema);

  cached = {
    profile,
    education: [...education].sort((a, b) => b.start.localeCompare(a.start)),
    experience: [...experience].sort((a, b) => b.start.localeCompare(a.start)),
    research: byOrderThen(research, (a, b) => a.title.localeCompare(b.title)),
    publications: byOrderThen(publications, (a, b) => b.year - a.year),
    projects: byOrderThen(projects, (a, b) => a.name.localeCompare(b.name)),
    hackathons: byOrderThen(hackathons, (a, b) => b.date.localeCompare(a.date)),
    overrides,
    researchLinks,
    skills: byOrderThen(skills, (a, b) => a.label.localeCompare(b.label)),
    awards: [...awards].sort((a, b) => b.date.localeCompare(a.date)),
    talks: [...talks].sort((a, b) => b.date.localeCompare(a.date)),
    currentWork: {
      updated: currentWork.updated,
      items: byOrderThen(currentWork.items, (a, b) => a.title.localeCompare(b.title)),
    },
    reviewItems,
    repositories: buildRepositories(
      syncedRepos?.repositories ?? [],
      overrides,
      publications,
      hackathons,
      projects,
    ),
    publicationMetadata: pubMeta?.entries ?? [],
    syncedAt: syncedRepos?.syncedAt ?? null,
  };
  return cached;
}

/* ------------------------------------------------------------------ */
/* Cross-reference integrity                                           */
/* ------------------------------------------------------------------ */

export interface IntegrityProblem {
  file: string;
  path: string;
  message: string;
}

/**
 * Check every id reference across content files, plus duplicate ids and
 * on-disk assets. Returns problems rather than throwing so the CLI can format
 * them and the test suite can assert on them.
 */
export function checkIntegrity(content: PortfolioContent): IntegrityProblem[] {
  const problems: IntegrityProblem[] = [];
  const add = (file: string, at: string, message: string) =>
    problems.push({ file, path: at, message });

  const researchIds = new Set(content.research.map((r) => r.id));
  const publicationIds = new Set(content.publications.map((p) => p.id));
  const projectIds = new Set(content.projects.map((p) => p.id));
  const hackathonIds = new Set(content.hackathons.map((h) => h.id));

  /* -- duplicate ids -- */
  const duplicateCheck: Array<[string, Array<{ id: string }>]> = [
    ['research.yml', content.research],
    ['publications.yml', content.publications],
    ['projects.yml', content.projects],
    ['hackathons.yml', content.hackathons],
    ['education.yml', content.education],
    ['experience.yml', content.experience],
    ['skills.yml', content.skills],
    ['awards.yml', content.awards],
    ['talks.yml', content.talks],
    ['current-work.yml', content.currentWork.items],
    ['review-needed.yml', content.reviewItems],
  ];
  for (const [file, items] of duplicateCheck) {
    const seen = new Set<string>();
    for (const item of items) {
      if (seen.has(item.id)) add(file, item.id, `duplicate id "${item.id}"`);
      seen.add(item.id);
    }
  }

  const repoNames = new Set(content.overrides.repositories.map((r) => r.name.toLowerCase()));
  for (const name of content.overrides.repositories.map((r) => r.name)) {
    const lower = name.toLowerCase();
    if (content.overrides.repositories.filter((r) => r.name.toLowerCase() === lower).length > 1) {
      add('repositories-overrides.yml', name, `duplicate repository override "${name}"`);
    }
  }

  const ref = (
    file: string,
    at: string,
    ids: string[],
    known: Set<string>,
    kind: string,
  ) => {
    for (const id of ids) {
      if (!known.has(id)) add(file, at, `references unknown ${kind} "${id}"`);
    }
  };

  for (const theme of content.research) {
    ref('research.yml', theme.id, theme.publications, publicationIds, 'publication');
    ref('research.yml', theme.id, theme.projects, projectIds, 'project');
  }
  for (const pub of content.publications) {
    ref('publications.yml', pub.id, pub.researchAreas, researchIds, 'research theme');
    if (pub.highlightAuthor && !pub.authors.includes(pub.highlightAuthor)) {
      add('publications.yml', pub.id, 'highlightAuthor is not present in authors');
    }
    if (pub.citations !== undefined && (!pub.citationsRetrievedFrom || !pub.citationsRetrievedAt)) {
      add(
        'publications.yml',
        pub.id,
        'citations require both citationsRetrievedFrom and citationsRetrievedAt',
      );
    }
  }
  for (const project of content.projects) {
    ref('projects.yml', project.id, project.researchAreas, researchIds, 'research theme');
    ref('projects.yml', project.id, project.relatedPublications, publicationIds, 'publication');
    ref('projects.yml', project.id, project.relatedHackathons, hackathonIds, 'hackathon');
    for (const shot of project.screenshots) {
      if (!existsSync(path.join(publicDir, shot.src.replace(/^\//, '')))) {
        add('projects.yml', project.id, `screenshot file not found: public${shot.src}`);
      }
    }
  }
  for (const hackathon of content.hackathons) {
    ref('hackathons.yml', hackathon.id, hackathon.relatedProjects, projectIds, 'project');
    for (const shot of hackathon.screenshots) {
      if (!existsSync(path.join(publicDir, shot.src.replace(/^\//, '')))) {
        add('hackathons.yml', hackathon.id, `screenshot file not found: public${shot.src}`);
      }
    }
    if (hackathon.award && !hackathon.awardVerified) {
      add(
        'hackathons.yml',
        hackathon.id,
        'award is set but awardVerified is false — it will not be displayed',
      );
    }
  }
  for (const entry of content.experience) {
    ref('experience.yml', entry.id, entry.relatedProjects, projectIds, 'project');
    ref('experience.yml', entry.id, entry.relatedPublications, publicationIds, 'publication');
    for (const stream of entry.workstreams) {
      ref('experience.yml', entry.id, stream.relatedProjects, projectIds, 'project');
      ref('experience.yml', entry.id, stream.relatedPublications, publicationIds, 'publication');
    }
  }
  for (const item of content.currentWork.items) {
    ref('current-work.yml', item.id, item.researchAreas, researchIds, 'research theme');
    ref('current-work.yml', item.id, item.relatedProjects, projectIds, 'project');
    ref('current-work.yml', item.id, item.relatedPublications, publicationIds, 'publication');
  }
  for (const link of content.researchLinks) {
    if (!publicationIds.has(link.paper)) {
      add('research-links.yml', link.paper, `references unknown publication "${link.paper}"`);
    }
  }
  for (const override of content.overrides.repositories) {
    ref(
      'repositories-overrides.yml',
      override.name,
      override.relatedPublications,
      publicationIds,
      'publication',
    );
    ref(
      'repositories-overrides.yml',
      override.name,
      override.relatedHackathons,
      hackathonIds,
      'hackathon',
    );
    ref(
      'repositories-overrides.yml',
      override.name,
      override.relatedProjects,
      projectIds,
      'project',
    );
  }
  for (const excluded of content.overrides.github.exclude) {
    if (repoNames.has(excluded.toLowerCase())) {
      add(
        'repositories-overrides.yml',
        excluded,
        `"${excluded}" is both excluded and given an override — the exclusion wins`,
      );
    }
  }

  /* -- the resume must actually be on disk -- */
  const resumePath = path.join(publicDir, content.profile.resume.path.replace(/^\//, ''));
  if (!existsSync(resumePath)) {
    add('profile.yml', 'resume.path', `resume file not found: public${content.profile.resume.path}`);
  }

  return problems;
}
