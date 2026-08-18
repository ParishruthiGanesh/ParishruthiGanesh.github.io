/**
 * Implementations of every `npm run portfolio -- <command>`.
 *
 * Design rules these commands follow:
 *  - nothing is written until the new content validates against its schema;
 *  - no command deletes curated content — `hide-repo` hides, it does not remove;
 *  - anything that cannot be verified is recorded, not guessed at.
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync, statSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import {
  publicationsSchema,
  projectsSchema,
  hackathonsSchema,
  researchLinksSchema,
  repositoriesOverridesSchema,
  profileSchema,
  contentFiles,
  externalUrlSchema,
  type Publication,
  type Project,
  type Hackathon,
  type ResearchLink,
  type RepositoriesOverrides,
} from '../../src/lib/schema.js';
import {
  loadContent,
  checkIntegrity,
  loadFile,
  contentDir,
  publicDir,
  projectRoot,
} from '../../src/lib/content.js';
import { syncRepositories, repositoryExists } from './github-sync.js';
import { syncPublications, fetchArxiv, fetchCrossref } from './publication-sync.js';
import {
  ask,
  askList,
  confirm,
  c,
  symbols,
  heading,
  slugify,
  readContentFile,
  writeContentFile,
  today,
  relativeTime,
} from './util.js';

/** Every URL the site publishes, with where it came from. */
export function collectUrls(): Array<{ url: string; where: string; verified: boolean }> {
  const content = loadContent();
  const urls: Array<{ url: string; where: string; verified: boolean }> = [];
  const push = (url: string | undefined | null, where: string, verified = true) => {
    if (url && /^https?:/.test(url)) urls.push({ url, where, verified });
  };

  for (const [key, value] of Object.entries(content.profile.links)) {
    push(value as string, `profile.yml → links.${key}`);
  }
  push(content.profile.affiliationUrl, 'profile.yml → affiliationUrl');

  for (const entry of content.education) push(entry.institutionUrl, `education.yml → ${entry.id}`);
  for (const entry of content.experience) {
    push(entry.organizationUrl, `experience.yml → ${entry.id}`);
  }
  for (const pub of content.publications) {
    for (const field of [
      'paperUrl',
      'codeUrl',
      'projectUrl',
      'datasetUrl',
      'slidesUrl',
      'posterUrl',
      'videoUrl',
    ] as const) {
      push(pub[field], `publications.yml → ${pub.id}.${field}`);
    }
  }
  for (const project of content.projects) {
    for (const [key, link] of Object.entries(project.links)) {
      if (link) push(link.url, `projects.yml → ${project.id}.links.${key}`, link.verified);
    }
  }
  for (const hackathon of content.hackathons) {
    push(hackathon.hackathonUrl, `hackathons.yml → ${hackathon.id}.hackathonUrl`);
    for (const [key, link] of Object.entries(hackathon.links)) {
      if (link) push(link.url, `hackathons.yml → ${hackathon.id}.links.${key}`, link.verified);
    }
  }
  for (const talk of content.talks) {
    push(talk.slidesUrl, `talks.yml → ${talk.id}.slidesUrl`);
    push(talk.videoUrl, `talks.yml → ${talk.id}.videoUrl`);
    push(talk.eventUrl, `talks.yml → ${talk.id}.eventUrl`);
  }
  for (const award of content.awards) push(award.url, `awards.yml → ${award.id}`);
  for (const theme of content.research) {
    for (const dataset of theme.datasets) push(dataset.url, `research.yml → ${theme.id}.datasets`);
  }
  return urls;
}

/* ------------------------------------------------------------------ */
/* status                                                              */
/* ------------------------------------------------------------------ */

export async function cmdStatus(): Promise<number> {
  const content = loadContent();

  heading('Portfolio status');
  console.log(`  ${content.publications.length} publications, ${content.projects.length} projects, ` +
    `${content.hackathons.length} hackathons, ${content.repositories.length} repositories`);
  console.log(
    `  Resume: ${content.profile.resume.filename} ` +
      c.dim(`(updated ${content.profile.resume.lastUpdated})`),
  );
  console.log(
    `  GitHub sync: ${
      content.syncedAt
        ? `${content.syncedAt.slice(0, 10)} ${c.dim(`(${relativeTime(content.syncedAt)})`)}`
        : c.yellow('never run — run `npm run portfolio -- sync`')
    }`,
  );

  if (content.syncedAt) {
    const ageDays = (Date.now() - Date.parse(content.syncedAt)) / 86_400_000;
    if (ageDays > 14) {
      console.log(`  ${symbols.warn} Repository metadata is more than two weeks old.`);
    }
  }

  heading('Integrity');
  const problems = checkIntegrity(content);
  if (problems.length === 0) {
    console.log(`  ${symbols.ok} No broken references, duplicate ids or missing files.`);
  } else {
    for (const problem of problems) {
      console.log(`  ${symbols.fail} ${c.dim(problem.file)} ${problem.path}: ${problem.message}`);
    }
  }

  heading('Missing links');
  const missing: string[] = [];
  for (const pub of content.publications) {
    if (!pub.paperUrl && !pub.arxivId && !pub.doi) {
      missing.push(`publication "${pub.id}" has no paper URL, arXiv ID or DOI`);
    }
    if (!content.researchLinks.some((link) => link.paper === pub.id) && !pub.codeUrl) {
      missing.push(`publication "${pub.id}" has no code repository mapped`);
    }
  }
  for (const hackathon of content.hackathons) {
    if (!hackathon.youtubeId && !hackathon.links.video) {
      missing.push(`hackathon "${hackathon.id}" has no demo video`);
    }
    if (!hackathon.links.devpost) missing.push(`hackathon "${hackathon.id}" has no Devpost link`);
    if (!hackathon.links.repo) missing.push(`hackathon "${hackathon.id}" has no repository link`);
  }
  if (!content.profile.links.orcid) missing.push('profile has no ORCID iD');
  if (missing.length === 0) {
    console.log(`  ${symbols.ok} Nothing missing.`);
  } else {
    for (const item of missing) console.log(`  ${symbols.warn} ${item}`);
  }

  const notes = content.overrides.repositories.filter((repo) => repo.note);
  if (notes.length > 0) {
    heading('Repository notes');
    console.log(c.dim('  Maintainer reminders. These are never rendered on the site.'));
    for (const repo of notes) {
      console.log(`  ${symbols.info} ${c.bold(repo.name)}: ${repo.note!.replace(/\s+/g, ' ').trim()}`);
    }
  }

  const unverified = collectUrls().filter((entry) => !entry.verified);
  if (unverified.length > 0) {
    heading('Unverified links');
    console.log(c.dim('  Supplied by hand and not yet machine-checked. Run `linkcheck --fix`.'));
    for (const entry of unverified) console.log(`  ${symbols.warn} ${entry.url} ${c.dim(entry.where)}`);
  }

  const open = content.reviewItems.filter((item) => !item.resolved);
  heading(`Review queue (${open.length} open)`);
  const bySeverity = { blocker: 0, high: 1, medium: 2, low: 3 } as const;
  for (const item of [...open].sort((a, b) => bySeverity[a.severity] - bySeverity[b.severity])) {
    const badge =
      item.severity === 'blocker' || item.severity === 'high'
        ? c.red(item.severity.toUpperCase())
        : c.yellow(item.severity);
    console.log(`  ${badge} ${c.dim(`[${item.area}]`)} ${item.summary.replace(/\s+/g, ' ').trim()}`);
    console.log(`        ${c.dim('→ ' + item.action.replace(/\s+/g, ' ').trim())}`);
  }

  return problems.length > 0 ? 1 : 0;
}

/* ------------------------------------------------------------------ */
/* sync                                                                */
/* ------------------------------------------------------------------ */

export async function cmdSync(argv: string[]): Promise<number> {
  const dryRun = argv.includes('--dry-run');
  const only = argv.includes('--repos') ? 'repos' : argv.includes('--papers') ? 'papers' : 'all';
  let failures = 0;

  if (only === 'all' || only === 'repos') {
    heading('GitHub repository sync');
    try {
      const result = await syncRepositories({ dryRun });
      console.log(`  ${symbols.ok} Fetched ${result.fetched} repositories for ${result.owner}.`);
      if (result.added.length) console.log(`  ${symbols.info} added:   ${result.added.join(', ')}`);
      if (result.changed.length) console.log(`  ${symbols.info} changed: ${result.changed.join(', ')}`);
      if (result.removed.length) console.log(`  ${symbols.warn} gone:    ${result.removed.join(', ')}`);
      if (!result.added.length && !result.changed.length && !result.removed.length) {
        console.log(`  ${symbols.info} No changes.`);
      }
      console.log(
        `  ${symbols.info} content/generated/repositories.json ${
          result.written ? c.green('updated') : c.dim('unchanged')
        }${dryRun ? c.dim(' (dry run)') : ''}`,
      );
      for (const warning of result.warnings) console.log(`  ${symbols.warn} ${warning}`);
      if (result.rateLimitRemaining !== null) {
        console.log(c.dim(`  GitHub rate limit remaining: ${result.rateLimitRemaining}`));
      }
    } catch (error) {
      failures += 1;
      console.log(`  ${symbols.fail} ${(error as Error).message}`);
      console.log(
        c.dim('  Existing content/generated/repositories.json was left untouched.'),
      );
    }
  }

  if (only === 'all' || only === 'papers') {
    heading('Publication metadata sync');
    try {
      const result = await syncPublications({ dryRun });
      console.log(`  ${symbols.ok} Checked ${result.checked}, retrieved ${result.retrieved}.`);
      for (const skip of result.skipped) {
        console.log(`  ${symbols.info} ${skip.id}: ${skip.reason}`);
      }
      for (const conflict of result.conflicts) {
        console.log(`  ${symbols.warn} ${conflict.id}: ${conflict.detail}`);
      }
      for (const queued of result.reviewQueue) {
        console.log(`  ${symbols.warn} review queue: "${queued.title}" (${queued.reason})`);
      }
      for (const warning of result.warnings) console.log(`  ${symbols.warn} ${warning}`);
      console.log(
        `  ${symbols.info} content/generated/publication-metadata.json ${
          result.written ? c.green('updated') : c.dim('unchanged')
        }${dryRun ? c.dim(' (dry run)') : ''}`,
      );
      if (result.conflicts.length > 0) {
        console.log(
          c.yellow(
            '\n  Conflicts are reported, not applied. content/publications.yml is authoritative.',
          ),
        );
      }
    } catch (error) {
      failures += 1;
      console.log(`  ${symbols.fail} ${(error as Error).message}`);
    }
  }

  return failures > 0 ? 1 : 0;
}

/* ------------------------------------------------------------------ */
/* validate                                                            */
/* ------------------------------------------------------------------ */

export async function cmdValidate(): Promise<number> {
  heading('Schema validation');
  let failed = 0;
  for (const [fileName, schema] of Object.entries(contentFiles)) {
    try {
      loadFile(fileName, schema);
      console.log(`  ${symbols.ok} content/${fileName}`);
    } catch (error) {
      failed += 1;
      console.log(`  ${symbols.fail} ${(error as Error).message}`);
    }
  }
  if (failed > 0) return 1;

  heading('Cross-reference integrity');
  const problems = checkIntegrity(loadContent());
  if (problems.length === 0) {
    console.log(`  ${symbols.ok} All references resolve; no duplicate ids; all files present.`);
    return 0;
  }
  for (const problem of problems) {
    console.log(`  ${symbols.fail} ${c.dim(problem.file)} ${problem.path}: ${problem.message}`);
  }
  return 1;
}

/* ------------------------------------------------------------------ */
/* add-project / add-paper / add-hackathon                             */
/* ------------------------------------------------------------------ */

export async function cmdAddProject(): Promise<number> {
  const content = loadContent();
  heading('Add a project');
  console.log(c.dim('  Leave a field blank to omit it. Omitted is better than guessed.\n'));

  const name = await ask('Project name', { required: true });
  const id = slugify(await ask('Id (slug)', { default: slugify(name) }));
  if (content.projects.some((project) => project.id === id)) {
    console.log(`${symbols.fail} A project with id "${id}" already exists.`);
    return 1;
  }

  const tagline = await ask('One-line tagline', { required: true });
  const kind = (await ask('Kind (research/application/hackathon/coursework/tooling)', {
    default: 'research',
  })) as Project['kind'];
  const status = (await ask('Status (active/maintained/completed/prototype/archived)', {
    default: 'active',
  })) as Project['status'];
  const yearRaw = await ask('Year', { default: String(new Date().getFullYear()) });
  const areas = await askList(
    `Research areas ${c.dim(`(known: ${content.research.map((r) => r.id).join(', ')})`)}`,
  );
  const technologies = await askList('Technologies');
  const repository = await ask('GitHub repository (owner/name)');
  const repoUrl = await ask('Repository URL');
  const demoUrl = await ask('Demo URL');
  const paperUrl = await ask('Paper URL');
  const problem = await ask('Problem (one paragraph)');

  const project: Record<string, unknown> = {
    id,
    name,
    tagline,
    kind,
    status,
    ...(yearRaw ? { year: Number(yearRaw) } : {}),
    researchAreas: areas,
    technologies,
    ...(problem ? { problem } : {}),
    ...(repository ? { repository } : {}),
    links: {
      ...(repoUrl ? { repo: { label: `GitHub — ${repository || name}`, url: repoUrl, verified: false } } : {}),
      ...(demoUrl ? { demo: { label: 'Live demo', url: demoUrl, verified: false } } : {}),
      ...(paperUrl ? { paper: { label: 'Paper', url: paperUrl, verified: false } } : {}),
    },
    featured: await confirm('Feature on the homepage?'),
    order: 100,
    sources: ['Added via `portfolio add-project`'],
  };

  const existing = readContentFile<unknown[]>('projects.yml');
  const next = [...(existing ?? []), project];
  const parsed = projectsSchema.safeParse(next);
  if (!parsed.success) {
    console.log(`\n${symbols.fail} The new project does not validate; nothing was written:`);
    for (const issue of parsed.error.issues) {
      console.log(`  • ${issue.path.join('.')}: ${issue.message}`);
    }
    return 1;
  }
  writeContentFile('projects.yml', next);
  console.log(`\n${symbols.ok} Added "${name}" to content/projects.yml.`);
  console.log(c.dim('  Fill in architecture, results and limitations by editing the file.'));
  return 0;
}

export async function cmdAddPaper(): Promise<number> {
  const content = loadContent();
  heading('Add a publication');
  console.log(c.dim('  Supply an arXiv ID or DOI to pull metadata, or enter it by hand.\n'));

  const arxivId = await ask('arXiv ID (e.g. 2607.27421)');
  const doi = arxivId ? '' : await ask('DOI (e.g. 10.1145/1234567)');

  let fetched: Record<string, any> = {};
  if (arxivId) {
    try {
      fetched = await fetchArxiv(arxivId);
      console.log(`  ${symbols.ok} arXiv: "${fetched.title}"`);
    } catch (error) {
      console.log(`  ${symbols.warn} arXiv lookup failed (${(error as Error).message}). Enter manually.`);
    }
  } else if (doi) {
    try {
      fetched = await fetchCrossref(doi);
      console.log(`  ${symbols.ok} Crossref: "${fetched.title}"`);
    } catch (error) {
      console.log(`  ${symbols.warn} Crossref lookup failed (${(error as Error).message}).`);
    }
  }

  const title = await ask('Title', { required: true, default: fetched.title });
  const id = slugify(await ask('Id (slug)', { default: slugify(title).slice(0, 60) }));
  if (content.publications.some((pub) => pub.id === id)) {
    console.log(`${symbols.fail} A publication with id "${id}" already exists.`);
    return 1;
  }
  const authors = await askList('Authors', 'comma-separated, in order');
  const finalAuthors = authors.length > 0 ? authors : (fetched.authors ?? []);
  const year = Number(
    await ask('Year', {
      required: true,
      default: fetched.published?.slice(0, 4) ?? String(new Date().getFullYear()),
    }),
  );
  const status = (await ask(
    'Status (published/accepted/preprint/under-review/in-progress)',
    { required: true, default: arxivId ? 'preprint' : 'under-review' },
  )) as Publication['status'];
  const statusNote = await ask('Status note (e.g. "Submitted to AAAI")');
  const venue = await ask('Venue', { default: arxivId ? 'arXiv preprint' : '' });
  const areas = await askList(
    `Research areas ${c.dim(`(known: ${content.research.map((r) => r.id).join(', ')})`)}`,
  );

  const publication: Record<string, unknown> = {
    id,
    title,
    authors: finalAuthors,
    highlightAuthor: content.profile.name,
    ...(venue ? { venue } : {}),
    year,
    status,
    ...(statusNote ? { statusNote } : {}),
    ...(fetched.abstract ? { abstract: fetched.abstract } : {}),
    researchAreas: areas,
    ...(arxivId ? { arxivId, paperUrl: `https://arxiv.org/abs/${arxivId}` } : {}),
    ...(doi ? { doi, paperUrl: `https://doi.org/${doi}` } : {}),
    featured: await confirm('Feature on the homepage?'),
    lastVerified: today(),
    sources: [arxivId ? `arXiv ${arxivId}` : doi ? `Crossref ${doi}` : 'Entered manually'],
    order: 100,
  };

  const existing = readContentFile<unknown[]>('publications.yml');
  const next = [...(existing ?? []), publication];
  const parsed = publicationsSchema.safeParse(next);
  if (!parsed.success) {
    console.log(`\n${symbols.fail} The new publication does not validate; nothing was written:`);
    for (const issue of parsed.error.issues) {
      console.log(`  • ${issue.path.join('.')}: ${issue.message}`);
    }
    return 1;
  }
  writeContentFile('publications.yml', next);
  console.log(`\n${symbols.ok} Added "${title}" to content/publications.yml.`);
  console.log(
    c.dim(`  Link its code with: npm run portfolio -- link-paper-code ${id} <owner/repo>`),
  );
  return 0;
}

/** Accepts a full YouTube URL in any common shape, or a bare 11-char id. */
export function extractYouTubeId(input: string): string | null {
  if (/^[\w-]{11}$/.test(input)) return input;
  const patterns = [
    /youtu\.be\/([\w-]{11})/,
    /youtube\.com\/watch\?[^#]*\bv=([\w-]{11})/,
    /youtube(?:-nocookie)?\.com\/embed\/([\w-]{11})/,
    /youtube\.com\/shorts\/([\w-]{11})/,
    /youtube\.com\/live\/([\w-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) return match[1]!;
  }
  return null;
}

export async function cmdAddHackathon(): Promise<number> {
  const content = loadContent();
  heading('Add a hackathon');
  console.log(c.dim('  An award is only recorded if you confirm it was actually received.\n'));

  const hackathon = await ask('Hackathon name', { required: true });
  const projectName = await ask('Project name', { required: true });
  const id = slugify(await ask('Id (slug)', { default: slugify(hackathon) }));
  if (content.hackathons.some((entry) => entry.id === id)) {
    console.log(`${symbols.fail} A hackathon with id "${id}" already exists.`);
    return 1;
  }

  const date = await ask('Date (YYYY-MM-DD)', { required: true, default: today() });
  const tagline = await ask('Tagline', { required: true });
  const problem = await ask('Problem addressed', { required: true });
  const whatItDoes = await ask('What the system does', { required: true });
  const technologies = await askList('Technologies');
  const repoUrl = await ask('GitHub repository URL');
  const demoUrl = await ask('Functional demo URL');
  const devpostUrl = await ask('Devpost submission URL');
  const videoUrl = await ask('YouTube demo URL');
  const youtubeId = videoUrl ? extractYouTubeId(videoUrl) : null;
  if (videoUrl && !youtubeId) {
    console.log(`  ${symbols.warn} Could not read a video id from that URL; embedding is skipped.`);
  }

  const hasAward = await confirm('Did this project receive a verified award or placement?');
  const award = hasAward ? await ask('Award (exact wording)', { required: true }) : '';

  const repository = repoUrl.match(/github\.com\/([\w.-]+\/[\w.-]+)/)?.[1]?.replace(/\.git$/, '');
  let repositoryPrivate = false;
  if (repository) {
    const check = await repositoryExists(repository).catch(() => null);
    if (check && !check.exists) {
      console.log(
        `  ${symbols.warn} ${repository} is not publicly readable — it will be marked private.`,
      );
      repositoryPrivate = true;
    }
  }

  const entry: Record<string, unknown> = {
    id,
    hackathon,
    date,
    projectName,
    tagline,
    problem,
    whatItDoes,
    technologies,
    ...(award ? { award, awardVerified: true } : {}),
    submissionStatus: 'submitted',
    ...(repository ? { repository, repositoryPrivate } : {}),
    ...(youtubeId ? { youtubeId } : {}),
    links: {
      ...(repoUrl ? { repo: { label: `GitHub — ${repository ?? projectName}`, url: repoUrl, verified: false } } : {}),
      ...(demoUrl ? { demo: { label: 'Live demo', url: demoUrl, verified: false } } : {}),
      ...(devpostUrl ? { devpost: { label: 'Devpost submission', url: devpostUrl, verified: false } } : {}),
      ...(videoUrl ? { video: { label: 'YouTube demo', url: videoUrl, verified: false } } : {}),
    },
    featured: await confirm('Feature on the homepage?', true),
    order: 100,
    sources: ['Added via `portfolio add-hackathon`'],
  };

  const existing = readContentFile<unknown[]>('hackathons.yml');
  const next = [...(existing ?? []), entry];
  const parsed = hackathonsSchema.safeParse(next);
  if (!parsed.success) {
    console.log(`\n${symbols.fail} The new hackathon does not validate; nothing was written:`);
    for (const issue of parsed.error.issues) {
      console.log(`  • ${issue.path.join('.')}: ${issue.message}`);
    }
    return 1;
  }
  writeContentFile('hackathons.yml', next);
  console.log(`\n${symbols.ok} Added "${projectName}" to content/hackathons.yml.`);
  return 0;
}

/* ------------------------------------------------------------------ */
/* link-paper-code                                                     */
/* ------------------------------------------------------------------ */

export async function cmdLinkPaperCode(argv: string[]): Promise<number> {
  const [paperId, repository, ...rest] = argv.filter((arg) => !arg.startsWith('--'));
  if (!paperId || !repository) {
    console.log('Usage: npm run portfolio -- link-paper-code <paper-id> <owner/repository>');
    return 1;
  }
  const normalised = repository
    .replace(/^https?:\/\/(www\.)?github\.com\//, '')
    .replace(/\.git$/, '')
    .replace(/\/$/, '');
  if (!/^[\w.-]+\/[\w.-]+$/.test(normalised)) {
    console.log(`${symbols.fail} "${repository}" is not an owner/repository pair.`);
    return 1;
  }

  const content = loadContent();
  const paper = content.publications.find((pub) => pub.id === paperId);
  if (!paper) {
    console.log(`${symbols.fail} No publication with id "${paperId}" in content/publications.yml.`);
    console.log(c.dim(`  Known ids: ${content.publications.map((p) => p.id).join(', ')}`));
    return 1;
  }

  let verified = false;
  const check = await repositoryExists(normalised).catch((error) => {
    console.log(`${symbols.warn} Could not reach GitHub: ${(error as Error).message}`);
    return null;
  });
  if (check?.exists && !check.isPrivate) {
    verified = true;
    console.log(`${symbols.ok} ${normalised} exists and is public.`);
  } else if (check?.exists && check.isPrivate) {
    console.log(`${symbols.warn} ${normalised} exists but is private — recording as unverified.`);
  } else if (check) {
    console.log(`${symbols.fail} ${normalised} ${check.reason ?? 'could not be found'}.`);
    if (!(await confirm('Record the mapping anyway, marked unverified?'))) return 1;
  }

  const relationship = (rest[0] ?? 'implementation') as ResearchLink['relationship'];
  const existing = (readContentFile<unknown[]>('research-links.yml') ?? []) as ResearchLink[];
  const withoutDuplicate = existing.filter(
    (link) => !(link.paper === paperId && link.repository === normalised),
  );
  const next = [
    ...withoutDuplicate,
    { paper: paperId, repository: normalised, relationship, verified, linkedAt: today() },
  ];

  const parsed = researchLinksSchema.safeParse(next);
  if (!parsed.success) {
    console.log(`${symbols.fail} Invalid mapping; nothing was written.`);
    for (const issue of parsed.error.issues) console.log(`  • ${issue.path.join('.')}: ${issue.message}`);
    return 1;
  }
  writeContentFile('research-links.yml', next);
  console.log(`${symbols.ok} Linked "${paper.title}" → ${normalised} (${relationship}).`);
  return 0;
}

/* ------------------------------------------------------------------ */
/* feature-repo / hide-repo                                            */
/* ------------------------------------------------------------------ */

function upsertRepositoryOverride(
  name: string,
  patch: Record<string, unknown>,
): { ok: boolean; message: string } {
  const raw = readContentFile<RepositoriesOverrides>('repositories-overrides.yml');
  const parsedCurrent = repositoriesOverridesSchema.safeParse(raw);
  if (!parsedCurrent.success) {
    return { ok: false, message: 'content/repositories-overrides.yml is currently invalid.' };
  }
  const current = parsedCurrent.data;
  const bare = name.replace(/^https?:\/\/(www\.)?github\.com\//, '').split('/').pop()!;
  const index = current.repositories.findIndex(
    (entry) => entry.name.toLowerCase() === bare.toLowerCase(),
  );

  const repositories = [...current.repositories];
  if (index >= 0) {
    repositories[index] = { ...repositories[index]!, ...patch };
  } else {
    repositories.push({
      name: bare,
      categories: [],
      featured: false,
      hidden: false,
      order: 100,
      relatedPublications: [],
      relatedHackathons: [],
      relatedProjects: [],
      ...patch,
    } as never);
  }

  const next = { ...current, repositories };
  const parsed = repositoriesOverridesSchema.safeParse(next);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues.map((i) => i.message).join('; ') };
  }
  writeContentFile('repositories-overrides.yml', next);
  return { ok: true, message: bare };
}

export async function cmdFeatureRepo(argv: string[]): Promise<number> {
  const name = argv.find((arg) => !arg.startsWith('--'));
  if (!name) {
    console.log('Usage: npm run portfolio -- feature-repo <repository>');
    return 1;
  }
  const result = upsertRepositoryOverride(name, { featured: true, hidden: false });
  if (!result.ok) {
    console.log(`${symbols.fail} ${result.message}`);
    return 1;
  }
  console.log(`${symbols.ok} ${result.message} is now featured.`);
  return 0;
}

export async function cmdHideRepo(argv: string[]): Promise<number> {
  const name = argv.find((arg) => !arg.startsWith('--'));
  if (!name) {
    console.log('Usage: npm run portfolio -- hide-repo <repository>');
    return 1;
  }
  const result = upsertRepositoryOverride(name, { hidden: true, featured: false });
  if (!result.ok) {
    console.log(`${symbols.fail} ${result.message}`);
    return 1;
  }
  console.log(`${symbols.ok} ${result.message} is hidden from the public list.`);
  console.log(
    c.dim('  Its synchronised GitHub metadata is kept — un-hide with `feature-repo` or by editing the file.'),
  );
  return 0;
}

/* ------------------------------------------------------------------ */
/* update-resume                                                       */
/* ------------------------------------------------------------------ */

export async function cmdUpdateResume(argv: string[]): Promise<number> {
  const source = argv.find((arg) => !arg.startsWith('--'));
  if (!source) {
    console.log('Usage: npm run portfolio -- update-resume <path-to-pdf>');
    return 1;
  }
  const absolute = path.resolve(source);
  if (!existsSync(absolute)) {
    console.log(`${symbols.fail} No file at ${absolute}`);
    return 1;
  }
  if (path.extname(absolute).toLowerCase() !== '.pdf') {
    console.log(`${symbols.fail} The resume must be a PDF.`);
    return 1;
  }
  // Confirm it really is a PDF rather than a renamed file.
  const header = readFileSync(absolute).subarray(0, 5).toString('latin1');
  if (header !== '%PDF-') {
    console.log(`${symbols.fail} ${absolute} does not begin with a PDF header.`);
    return 1;
  }

  const profile = profileSchema.parse(readContentFile('profile.yml'));
  const destination = path.join(publicDir, profile.resume.path.replace(/^\//, ''));
  mkdirSync(path.dirname(destination), { recursive: true });
  copyFileSync(absolute, destination);

  const next = {
    ...readContentFile<Record<string, any>>('profile.yml'),
    resume: { ...profile.resume, lastUpdated: today() },
  };
  const parsed = profileSchema.safeParse(next);
  if (!parsed.success) {
    console.log(`${symbols.fail} profile.yml would become invalid; the PDF was copied but not recorded.`);
    return 1;
  }
  writeContentFile('profile.yml', next);

  const size = statSync(destination).size;
  console.log(`${symbols.ok} Copied to public${profile.resume.path} (${Math.round(size / 1024)} KB).`);
  console.log(`${symbols.ok} profile.yml resume.lastUpdated set to ${today()}.`);
  console.log(c.dim('  The Resume page preview and download link both point at this file.'));
  return 0;
}

/* ------------------------------------------------------------------ */
/* linkcheck                                                           */
/* ------------------------------------------------------------------ */

export async function cmdLinkCheck(argv: string[]): Promise<number> {
  const fix = argv.includes('--fix');
  const strict = argv.includes('--strict');
  const urls = collectUrls();
  heading(`Checking ${urls.length} external links`);

  const results: Array<{
    url: string;
    where: string;
    ok: boolean;
    /** True only for a genuine success response, never for a bot-block. */
    confirmed: boolean;
    detail: string;
  }> = [];

  for (const entry of urls) {
    let ok = false;
    let confirmed = false;
    let detail = '';
    for (const method of ['HEAD', 'GET'] as const) {
      try {
        const response = await fetch(entry.url, {
          method,
          redirect: 'follow',
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; portfolio-linkcheck/1.0)' },
          signal: AbortSignal.timeout(15_000),
        });
        // A 403 or 405 usually means a bot-averse host rather than a dead link,
        // so it does not count as broken — but it is not proof the URL is right
        // either, so `--fix` will not promote it to verified. An egress proxy
        // also answers 403, which is exactly the case that must not auto-verify.
        confirmed = response.ok;
        ok = response.ok || response.status === 403 || response.status === 405;
        detail = `${response.status} ${response.statusText}`;
        if (ok) break;
      } catch (error) {
        detail = (error as Error).message;
      }
    }
    const note = ok && !confirmed ? c.dim(' (reachable, but not a success response)') : '';
    results.push({ url: entry.url, where: entry.where, ok, confirmed, detail });
    console.log(
      `  ${ok ? symbols.ok : symbols.fail} ${entry.url}${note}\n    ${c.dim(`${entry.where} — ${detail}`)}`,
    );
  }

  const broken = results.filter((result) => !result.ok);
  const unconfirmed = results.filter((result) => result.ok && !result.confirmed);
  console.log(`\n  ${results.length - broken.length}/${results.length} reachable.`);
  if (unconfirmed.length > 0) {
    console.log(
      c.dim(
        `  ${unconfirmed.length} answered 403/405 — reachable, but not confirmed, so --fix leaves them unverified.`,
      ),
    );
  }

  if (fix) {
    // Only ever flips `verified` to true for a genuine success response.
    // Nothing is deleted — a temporarily unreachable host must not remove
    // content, and a bot-block is not evidence that a URL is correct.
    let flipped = 0;
    for (const fileName of ['projects.yml', 'hackathons.yml'] as const) {
      const data = readContentFile<any[]>(fileName);
      for (const item of data ?? []) {
        for (const link of Object.values(item.links ?? {}) as any[]) {
          if (
            link &&
            link.verified === false &&
            results.some((r) => r.url === link.url && r.confirmed)
          ) {
            link.verified = true;
            flipped += 1;
          }
        }
      }
      const schema = fileName === 'projects.yml' ? projectsSchema : hackathonsSchema;
      if (schema.safeParse(data).success) writeContentFile(fileName, data);
    }
    console.log(`  ${symbols.ok} Marked ${flipped} previously unverified link(s) as verified.`);
  }

  if (broken.length > 0) {
    console.log(
      c.yellow(
        '\n  Unreachable links are reported, never removed — an external host being down\n' +
          '  is not evidence that a link is wrong.',
      ),
    );
  }
  return strict && broken.length > 0 ? 1 : 0;
}

/* ------------------------------------------------------------------ */
/* build / publish                                                     */
/* ------------------------------------------------------------------ */

function run(command: string, args: string[]): void {
  execFileSync(command, args, { stdio: 'inherit', cwd: projectRoot });
}

export async function cmdBuild(argv: string[]): Promise<number> {
  const skipSync = argv.includes('--no-sync');
  if (!skipSync) {
    const syncStatus = await cmdSync([]);
    if (syncStatus !== 0) {
      console.log(
        c.yellow('\n  Sync reported a problem. Continuing with existing synchronised data.'),
      );
    }
  }
  const validateStatus = await cmdValidate();
  if (validateStatus !== 0) {
    console.log(`\n${symbols.fail} Validation failed — not building.`);
    return 1;
  }
  heading('Tests');
  try {
    run('npm', ['test', '--silent']);
  } catch {
    console.log(`\n${symbols.fail} Tests failed — not building.`);
    return 1;
  }
  heading('Astro build');
  try {
    run('npm', ['run', 'build']);
  } catch {
    return 1;
  }
  console.log(`\n${symbols.ok} Built to dist/.`);
  return 0;
}

export async function cmdPublish(argv: string[]): Promise<number> {
  const status = await cmdBuild(argv);
  if (status !== 0) return status;

  heading('Publish');
  let changed = '';
  try {
    changed = execFileSync('git', ['status', '--porcelain'], { cwd: projectRoot }).toString().trim();
  } catch {
    console.log(`${symbols.fail} Not a git repository, or git is unavailable.`);
    return 1;
  }
  if (!changed) {
    console.log(`${symbols.ok} Working tree is clean — nothing to publish.`);
    return 0;
  }

  console.log('  Changes to be committed:\n');
  for (const line of changed.split('\n')) console.log(`    ${line}`);

  const deletions = changed.split('\n').filter((line) => line.startsWith(' D') || line.startsWith('D '));
  if (deletions.length > 0) {
    console.log(
      c.yellow(
        `\n  ${symbols.warn} ${deletions.length} file(s) would be deleted. Review these carefully.`,
      ),
    );
  }

  const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: projectRoot })
    .toString()
    .trim();
  console.log(`\n  Branch: ${c.bold(branch)}`);

  if (!(await confirm('Commit and push these changes?'))) {
    console.log(`${symbols.info} Nothing was committed or pushed.`);
    return 0;
  }
  const message = await ask('Commit message', { default: 'Update portfolio content' });
  run('git', ['add', '-A']);
  run('git', ['commit', '-m', message]);
  run('git', ['push', '-u', 'origin', branch]);
  console.log(`\n${symbols.ok} Pushed to origin/${branch}.`);
  if (branch !== 'main') {
    console.log(c.dim('  Open a pull request into main to deploy to GitHub Pages.'));
  }
  return 0;
}

/* ------------------------------------------------------------------ */
/* ask — optional natural-language shortcut                            */
/* ------------------------------------------------------------------ */

/**
 * Maps a plain-English request onto one of the deterministic commands using
 * simple keyword matching. This runs entirely locally; no API key is involved.
 * Whatever it resolves to is printed for confirmation before it runs — the
 * point is discoverability, not autonomy.
 */
export function interpret(request: string): { command: string; argv: string[] } | null {
  const text = request.toLowerCase();
  const repoMatch = request.match(/\b([\w.-]+\/[\w.-]+)\b/)?.[1];

  if (/\b(status|what.*missing|what.*needs|todo|review queue)\b/.test(text)) {
    return { command: 'status', argv: [] };
  }
  if (/\b(sync|refresh|update).*(repo|github|paper|publication)/.test(text)) {
    return { command: 'sync', argv: [] };
  }
  if (/\b(validate|check content|schema)\b/.test(text)) return { command: 'validate', argv: [] };
  if (/\b(check|verify|test).*(link|url)/.test(text)) return { command: 'linkcheck', argv: [] };
  if (/\badd\b.*\b(paper|publication|preprint)\b/.test(text)) {
    return { command: 'add-paper', argv: [] };
  }
  if (/\badd\b.*\bhackathon\b/.test(text)) return { command: 'add-hackathon', argv: [] };
  if (/\badd\b.*\bproject\b/.test(text)) return { command: 'add-project', argv: [] };
  if (/\b(hide|remove|unlist)\b.*\brepo/.test(text) && repoMatch) {
    return { command: 'hide-repo', argv: [repoMatch] };
  }
  if (/\b(feature|pin|highlight|showcase)\b/.test(text) && repoMatch) {
    return { command: 'feature-repo', argv: [repoMatch] };
  }
  if (/\blink\b.*\b(paper|publication)\b.*\bcode\b/.test(text)) {
    return { command: 'link-paper-code', argv: [] };
  }
  if (/\b(update|replace|new)\b.*\bresume|cv\b/.test(text)) {
    return { command: 'update-resume', argv: [] };
  }
  if (/\b(build|deploy|publish)\b/.test(text)) return { command: 'build', argv: [] };
  return null;
}

export async function cmdAsk(argv: string[]): Promise<number> {
  const request = argv.filter((arg) => !arg.startsWith('--')).join(' ');
  if (!request) {
    console.log('Usage: npm run portfolio -- ask "add my hackathon demo video"');
    return 1;
  }
  const resolved = interpret(request);
  if (!resolved) {
    console.log(`${symbols.warn} Could not map that to a command.`);
    console.log('  Try `npm run portfolio -- help` for the full list.');
    return 1;
  }
  console.log(
    `${symbols.info} Interpreting "${request}" as: ${c.bold(
      `portfolio ${resolved.command} ${resolved.argv.join(' ')}`.trim(),
    )}`,
  );
  if (!(await confirm('Run it?', true))) return 0;
  const { dispatch } = await import('./index.js');
  return dispatch(resolved.command, resolved.argv);
}
