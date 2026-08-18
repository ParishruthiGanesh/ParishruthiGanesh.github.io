/**
 * Zod schemas for every structured content file under `content/`.
 *
 * These are the single source of truth. The Astro site, the `portfolio` CLI and
 * the Vitest suite all validate against exactly these definitions, so a change
 * here is caught everywhere at once.
 */
import { z } from 'zod';

/* ------------------------------------------------------------------ */
/* Shared primitives                                                   */
/* ------------------------------------------------------------------ */

/** A slug-safe identifier: lowercase letters, digits and hyphens. */
export const idSchema = z
  .string()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, 'must be a lowercase hyphenated slug');

/**
 * An external URL. Only http(s) and mailto are allowed — this is what keeps a
 * `javascript:` payload out of an `href` if a content file is ever edited
 * carelessly or a sync source returns something unexpected.
 */
export const externalUrlSchema = z
  .string()
  .trim()
  .refine(
    (value) => {
      try {
        const parsed = new URL(value);
        return ['http:', 'https:', 'mailto:'].includes(parsed.protocol);
      } catch {
        return false;
      }
    },
    { message: 'must be an absolute http(s) or mailto URL' },
  );

/** An ISO-8601 calendar date, `YYYY-MM-DD`. */
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be an ISO date (YYYY-MM-DD)')
  .refine((value) => !Number.isNaN(Date.parse(value)), 'must be a real calendar date');

/** A month-precision date, `YYYY-MM`, used for role and education ranges. */
export const monthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'must be a year-month (YYYY-MM)');

/** `YYYY-MM` or the literal `present` for an ongoing role. */
export const monthOrPresentSchema = z.union([monthSchema, z.literal('present')]);

export const researchAreaIdSchema = idSchema;

/** A link that carries its own provenance so the UI can be honest about it. */
export const linkSchema = z.object({
  label: z.string().min(1),
  url: externalUrlSchema,
  /**
   * `verified: false` renders the link with a "not machine-verified" marker.
   * Set it when a URL was supplied by a human but could not be checked (for
   * example because the host is unreachable from CI).
   */
  verified: z.boolean().default(true),
});

/* ------------------------------------------------------------------ */
/* profile.yml                                                         */
/* ------------------------------------------------------------------ */

export const profileSchema = z.object({
  name: z.string().min(1),
  /** Short form used in the nav and the browser tab. */
  shortName: z.string().min(1),
  pronouns: z.string().optional(),
  headline: z.string().min(1),
  role: z.string().min(1),
  affiliation: z.string().min(1),
  affiliationUrl: externalUrlSchema.optional(),
  location: z.string().min(1),
  /** One-paragraph positioning statement used on the home hero. */
  tagline: z.string().min(1),
  /** Longer biography, markdown. Rendered on About. */
  bio: z.string().min(1),
  /** A short bio suitable for talk introductions and meta descriptions. */
  shortBio: z.string().min(1).max(400),
  email: z.string().email(),
  avatar: z.string().optional(),
  openGraphImage: z.string().optional(),
  links: z
    .object({
      github: externalUrlSchema.optional(),
      linkedin: externalUrlSchema.optional(),
      googleScholar: externalUrlSchema.optional(),
      arxiv: externalUrlSchema.optional(),
      orcid: externalUrlSchema.optional(),
      semanticScholar: externalUrlSchema.optional(),
      website: externalUrlSchema.optional(),
      universityProfile: externalUrlSchema.optional(),
    })
    .default({}),
  resume: z.object({
    path: z.string().startsWith('/'),
    lastUpdated: isoDateSchema,
    filename: z.string().min(1),
  }),
  /** Themes shown as the "what I work on" chips. Must match research theme ids. */
  researchInterests: z.array(z.string().min(1)).min(1),
  /** Topics the user is open to being contacted about. */
  openTo: z.array(z.string().min(1)).default([]),
});
export type Profile = z.infer<typeof profileSchema>;

/* ------------------------------------------------------------------ */
/* education.yml                                                       */
/* ------------------------------------------------------------------ */

export const educationEntrySchema = z.object({
  id: idSchema,
  institution: z.string().min(1),
  institutionUrl: externalUrlSchema.optional(),
  degree: z.string().min(1),
  field: z.string().optional(),
  location: z.string().optional(),
  start: monthSchema,
  end: monthOrPresentSchema,
  /** Kept as a free string because grading scales differ between institutions. */
  grade: z.string().optional(),
  researchFocus: z.string().optional(),
  advisors: z.array(z.string().min(1)).default([]),
  coursework: z.array(z.string().min(1)).default([]),
  notes: z.string().optional(),
});
export const educationSchema = z.array(educationEntrySchema);
export type EducationEntry = z.infer<typeof educationEntrySchema>;

/* ------------------------------------------------------------------ */
/* experience.yml                                                      */
/* ------------------------------------------------------------------ */

export const experienceProjectSchema = z.object({
  name: z.string().min(1),
  stack: z.array(z.string().min(1)).default([]),
  summary: z.string().optional(),
  highlights: z.array(z.string().min(1)).default([]),
  /** ids from projects.yml */
  relatedProjects: z.array(idSchema).default([]),
  /** ids from publications.yml */
  relatedPublications: z.array(idSchema).default([]),
});

export const experienceEntrySchema = z.object({
  id: idSchema,
  organization: z.string().min(1),
  organizationUrl: externalUrlSchema.optional(),
  role: z.string().min(1),
  type: z.enum(['research', 'industry', 'teaching', 'service', 'leadership']),
  location: z.string().optional(),
  start: monthSchema,
  end: monthOrPresentSchema,
  summary: z.string().optional(),
  responsibilities: z.array(z.string().min(1)).default([]),
  /** Named workstreams inside a single role, each with its own stack. */
  workstreams: z.array(experienceProjectSchema).default([]),
  technologies: z.array(z.string().min(1)).default([]),
  relatedProjects: z.array(idSchema).default([]),
  relatedPublications: z.array(idSchema).default([]),
  featured: z.boolean().default(false),
});
export const experienceSchema = z.array(experienceEntrySchema);
export type ExperienceEntry = z.infer<typeof experienceEntrySchema>;

/* ------------------------------------------------------------------ */
/* research.yml                                                        */
/* ------------------------------------------------------------------ */

export const researchThemeSchema = z.object({
  id: researchAreaIdSchema,
  title: z.string().min(1),
  /** Short label used in filter chips. */
  shortTitle: z.string().min(1),
  question: z.string().min(1),
  whyItMatters: z.string().min(1),
  approach: z.string().optional(),
  status: z.enum(['active', 'ongoing', 'exploratory', 'concluded']),
  /** Verified, benchmark-scoped findings only. Leave empty rather than guess. */
  findings: z.array(z.string().min(1)).default([]),
  futureDirection: z.string().optional(),
  keywords: z.array(z.string().min(1)).default([]),
  publications: z.array(idSchema).default([]),
  projects: z.array(idSchema).default([]),
  datasets: z
    .array(
      z.object({
        name: z.string().min(1),
        url: externalUrlSchema.optional(),
        note: z.string().optional(),
      }),
    )
    .default([]),
  order: z.number().int().default(100),
  featured: z.boolean().default(false),
});
export const researchSchema = z.array(researchThemeSchema);
export type ResearchTheme = z.infer<typeof researchThemeSchema>;

/* ------------------------------------------------------------------ */
/* publications.yml                                                    */
/* ------------------------------------------------------------------ */

export const publicationStatusSchema = z.enum([
  'published',
  'accepted',
  'preprint',
  'under-review',
  'in-progress',
]);

export const publicationSchema = z.object({
  id: idSchema,
  title: z.string().min(1),
  authors: z.array(z.string().min(1)).min(1),
  /** Highlighted in the author list. Must appear in `authors`. */
  highlightAuthor: z.string().optional(),
  venue: z.string().optional(),
  venueShort: z.string().optional(),
  year: z.number().int().min(1990).max(2100),
  status: publicationStatusSchema,
  /**
   * Free-text note explaining the status, e.g. "Submitted to AAAI".
   * Status is never inferred from a venue string.
   */
  statusNote: z.string().optional(),
  abstract: z.string().optional(),
  /** ids from research.yml */
  researchAreas: z.array(researchAreaIdSchema).default([]),
  arxivId: z
    .string()
    .regex(/^\d{4}\.\d{4,5}(v\d+)?$/, 'must look like 2401.01234')
    .optional(),
  doi: z
    .string()
    .regex(/^10\.\d{4,9}\/\S+$/, 'must be a bare DOI such as 10.1145/1234567')
    .optional(),
  paperUrl: externalUrlSchema.optional(),
  codeUrl: externalUrlSchema.optional(),
  projectUrl: externalUrlSchema.optional(),
  datasetUrl: externalUrlSchema.optional(),
  slidesUrl: externalUrlSchema.optional(),
  posterUrl: externalUrlSchema.optional(),
  videoUrl: externalUrlSchema.optional(),
  bibtex: z.string().optional(),
  /** Displayed only with `citationsRetrievedFrom` + `citationsRetrievedAt`. */
  citations: z.number().int().nonnegative().optional(),
  citationsRetrievedFrom: z.string().optional(),
  citationsRetrievedAt: isoDateSchema.optional(),
  featured: z.boolean().default(false),
  /** Date a human last confirmed the metadata against the source. */
  lastVerified: isoDateSchema.optional(),
  /** Where the metadata came from, for the source audit. */
  sources: z.array(z.string().min(1)).default([]),
  order: z.number().int().default(100),
});
export const publicationsSchema = z.array(publicationSchema);
export type Publication = z.infer<typeof publicationSchema>;

/* ------------------------------------------------------------------ */
/* projects.yml                                                        */
/* ------------------------------------------------------------------ */

export const projectKindSchema = z.enum([
  'research',
  'application',
  'hackathon',
  'coursework',
  'tooling',
]);

export const screenshotSchema = z.object({
  src: z.string().min(1),
  alt: z.string().min(1),
  caption: z.string().optional(),
});

export const projectSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  /** One line, shown on the card. */
  tagline: z.string().min(1).max(220),
  kind: projectKindSchema,
  status: z.enum(['active', 'maintained', 'completed', 'prototype', 'archived']),
  year: z.number().int().min(1990).max(2100).optional(),
  period: z.string().optional(),
  /** ids from research.yml */
  researchAreas: z.array(researchAreaIdSchema).default([]),
  technologies: z.array(z.string().min(1)).default([]),
  /* Long-form, markdown-formatted sections. Omit rather than invent. */
  problem: z.string().optional(),
  motivation: z.string().optional(),
  architecture: z.string().optional(),
  dataset: z.string().optional(),
  method: z.string().optional(),
  experimentalSetup: z.string().optional(),
  results: z.string().optional(),
  errorAnalysis: z.string().optional(),
  limitations: z.string().optional(),
  responsibleUse: z.string().optional(),
  setup: z.string().optional(),
  futureWork: z.string().optional(),
  highlights: z.array(z.string().min(1)).default([]),
  screenshots: z.array(screenshotSchema).default([]),
  links: z
    .object({
      repo: linkSchema.optional(),
      demo: linkSchema.optional(),
      paper: linkSchema.optional(),
      devpost: linkSchema.optional(),
      video: linkSchema.optional(),
      docs: linkSchema.optional(),
    })
    .default({}),
  /** GitHub `owner/name`, used to attach live sync metadata. */
  repository: z
    .string()
    .regex(/^[\w.-]+\/[\w.-]+$/, 'must be owner/name')
    .optional(),
  relatedPublications: z.array(idSchema).default([]),
  relatedHackathons: z.array(idSchema).default([]),
  featured: z.boolean().default(false),
  order: z.number().int().default(100),
  sources: z.array(z.string().min(1)).default([]),
});
export const projectsSchema = z.array(projectSchema);
export type Project = z.infer<typeof projectSchema>;

/* ------------------------------------------------------------------ */
/* hackathons.yml                                                      */
/* ------------------------------------------------------------------ */

export const hackathonSchema = z.object({
  id: idSchema,
  hackathon: z.string().min(1),
  hackathonUrl: externalUrlSchema.optional(),
  organizer: z.string().optional(),
  date: isoDateSchema,
  dateLabel: z.string().optional(),
  projectName: z.string().min(1),
  tagline: z.string().min(1),
  problem: z.string().min(1),
  whatItDoes: z.string().min(1),
  architecture: z.string().optional(),
  technologies: z.array(z.string().min(1)).default([]),
  /** Only ever set from a verified source — never inferred. */
  award: z.string().optional(),
  awardVerified: z.boolean().default(false),
  /** Submission state, so an in-progress entry is never shown as a win. */
  submissionStatus: z.enum(['submitted', 'in-progress', 'judged', 'unknown']).default('unknown'),
  team: z.array(z.string().min(1)).default([]),
  teamVerified: z.boolean().default(false),
  lessons: z.array(z.string().min(1)).default([]),
  screenshots: z.array(screenshotSchema).default([]),
  links: z
    .object({
      repo: linkSchema.optional(),
      demo: linkSchema.optional(),
      devpost: linkSchema.optional(),
      video: linkSchema.optional(),
    })
    .default({}),
  /** Bare YouTube video id — the site builds a privacy-enhanced embed from it. */
  youtubeId: z
    .string()
    .regex(/^[\w-]{11}$/, 'must be an 11-character YouTube video id')
    .optional(),
  /** GitHub repository, if public. */
  repository: z
    .string()
    .regex(/^[\w.-]+\/[\w.-]+$/, 'must be owner/name')
    .optional(),
  /** True when the linked repository is private, so the UI says so plainly. */
  repositoryPrivate: z.boolean().default(false),
  relatedProjects: z.array(idSchema).default([]),
  featured: z.boolean().default(false),
  order: z.number().int().default(100),
  sources: z.array(z.string().min(1)).default([]),
});
export const hackathonsSchema = z.array(hackathonSchema);
export type Hackathon = z.infer<typeof hackathonSchema>;

/* ------------------------------------------------------------------ */
/* repositories-overrides.yml                                          */
/* ------------------------------------------------------------------ */

export const repositoryCategorySchema = z.enum([
  'research',
  'applications',
  'hackathons',
  'computer-vision',
  'nlp-llm',
  'rag',
  'agentic',
  'coursework',
  'archived',
]);

export const repositoryOverrideSchema = z.object({
  /** Repository name only (no owner) — the owner comes from `github.owner`. */
  name: z.string().min(1),
  /**
   * Curated one-paragraph summary. Never overwritten by a sync; the GitHub
   * description is stored separately as `githubDescription`.
   */
  portfolioSummary: z.string().optional(),
  categories: z.array(repositoryCategorySchema).default([]),
  featured: z.boolean().default(false),
  hidden: z.boolean().default(false),
  /**
   * Declares that the repository is private on GitHub. A public API sync cannot
   * see private repositories at all, so this has to be curated: it makes the
   * site say "private repository" instead of linking visitors to a 404.
   */
  privateRepo: z.boolean().default(false),
  order: z.number().int().default(100),
  relatedPublications: z.array(idSchema).default([]),
  relatedHackathons: z.array(idSchema).default([]),
  relatedProjects: z.array(idSchema).default([]),
  /**
   * Maintainer-facing reminder. Surfaced by `portfolio status`, never rendered
   * on the site — a visitor has no use for "run the sync after you do X".
   */
  note: z.string().optional(),
});

export const repositoriesOverridesSchema = z.object({
  github: z.object({
    owner: z.string().min(1),
    /** Repositories excluded from the public list entirely. */
    exclude: z.array(z.string().min(1)).default([]),
    /** Skip forks unless explicitly featured. */
    includeForks: z.boolean().default(false),
    /** Skip repositories with no description, no topics and no stars. */
    hideEmpty: z.boolean().default(true),
  }),
  repositories: z.array(repositoryOverrideSchema).default([]),
});
export type RepositoriesOverrides = z.infer<typeof repositoriesOverridesSchema>;
export type RepositoryOverride = z.infer<typeof repositoryOverrideSchema>;

/* ------------------------------------------------------------------ */
/* Synced GitHub data (generated — content/generated/repositories.json)  */
/* ------------------------------------------------------------------ */

export const syncedRepositorySchema = z.object({
  name: z.string(),
  fullName: z.string(),
  githubDescription: z.string().nullable(),
  url: externalUrlSchema,
  homepage: z.string().nullable(),
  language: z.string().nullable(),
  languages: z.record(z.string(), z.number()).default({}),
  topics: z.array(z.string()).default([]),
  stars: z.number().int().nonnegative(),
  forks: z.number().int().nonnegative(),
  openIssues: z.number().int().nonnegative().default(0),
  license: z.string().nullable(),
  isFork: z.boolean(),
  isArchived: z.boolean(),
  isPrivate: z.boolean().default(false),
  createdAt: z.string(),
  updatedAt: z.string(),
  pushedAt: z.string(),
  size: z.number().int().nonnegative(),
  defaultBranch: z.string(),
});

export const syncedRepositoriesFileSchema = z.object({
  syncedAt: z.string(),
  owner: z.string(),
  source: z.string(),
  repositories: z.array(syncedRepositorySchema),
});
export type SyncedRepository = z.infer<typeof syncedRepositorySchema>;
export type SyncedRepositoriesFile = z.infer<typeof syncedRepositoriesFileSchema>;

/* ------------------------------------------------------------------ */
/* Synced publication metadata (content/generated/publication-metadata.json) */
/* ------------------------------------------------------------------ */

export const publicationMetadataEntrySchema = z.object({
  id: idSchema,
  source: z.enum(['arxiv', 'crossref', 'orcid', 'semantic-scholar']),
  retrievedAt: z.string(),
  title: z.string().optional(),
  authors: z.array(z.string()).default([]),
  abstract: z.string().optional(),
  published: z.string().optional(),
  updated: z.string().optional(),
  categories: z.array(z.string()).default([]),
  doi: z.string().optional(),
  url: z.string().optional(),
  /** Set when the fetched record disagrees with the curated YAML. */
  conflicts: z.array(z.string()).default([]),
});

export const publicationMetadataFileSchema = z.object({
  syncedAt: z.string(),
  entries: z.array(publicationMetadataEntrySchema),
});
export type PublicationMetadataEntry = z.infer<typeof publicationMetadataEntrySchema>;

/* ------------------------------------------------------------------ */
/* research-links.yml — explicit paper ↔ code mapping                  */
/* ------------------------------------------------------------------ */

export const researchLinkSchema = z.object({
  paper: idSchema,
  /** GitHub `owner/name`. Both sides are validated before a link is written. */
  repository: z
    .string()
    .regex(/^[\w.-]+\/[\w.-]+$/, 'must be owner/name'),
  relationship: z.enum(['implementation', 'experiments', 'dataset', 'analysis', 'demo']).default('implementation'),
  note: z.string().optional(),
  /** False when the repository could not be confirmed public at link time. */
  verified: z.boolean().default(false),
  linkedAt: isoDateSchema.optional(),
});
export const researchLinksSchema = z.array(researchLinkSchema);
export type ResearchLink = z.infer<typeof researchLinkSchema>;

/* ------------------------------------------------------------------ */
/* skills.yml                                                          */
/* ------------------------------------------------------------------ */

export const skillGroupSchema = z.object({
  id: idSchema,
  label: z.string().min(1),
  /** Deliberately a flat list: no invented proficiency percentages. */
  items: z.array(z.string().min(1)).min(1),
  order: z.number().int().default(100),
});
export const skillsSchema = z.array(skillGroupSchema);
export type SkillGroup = z.infer<typeof skillGroupSchema>;

/* ------------------------------------------------------------------ */
/* awards.yml                                                          */
/* ------------------------------------------------------------------ */

export const awardSchema = z.object({
  id: idSchema,
  title: z.string().min(1),
  organization: z.string().min(1),
  date: isoDateSchema,
  description: z.string().optional(),
  url: externalUrlSchema.optional(),
  featured: z.boolean().default(false),
});
export const awardsSchema = z.array(awardSchema);
export type Award = z.infer<typeof awardSchema>;

/* ------------------------------------------------------------------ */
/* talks.yml                                                           */
/* ------------------------------------------------------------------ */

export const talkSchema = z.object({
  id: idSchema,
  title: z.string().min(1),
  event: z.string().min(1),
  date: isoDateSchema,
  location: z.string().optional(),
  type: z.enum(['talk', 'poster', 'panel', 'guest-lecture', 'workshop']).default('talk'),
  description: z.string().optional(),
  slidesUrl: externalUrlSchema.optional(),
  videoUrl: externalUrlSchema.optional(),
  eventUrl: externalUrlSchema.optional(),
  relatedPublications: z.array(idSchema).default([]),
});
export const talksSchema = z.array(talkSchema);
export type Talk = z.infer<typeof talkSchema>;

/* ------------------------------------------------------------------ */
/* current-work.yml                                                    */
/* ------------------------------------------------------------------ */

export const currentWorkItemSchema = z.object({
  id: idSchema,
  title: z.string().min(1),
  description: z.string().min(1),
  status: z.enum(['writing', 'experiments', 'building', 'reviewing', 'reading']),
  since: monthSchema.optional(),
  researchAreas: z.array(researchAreaIdSchema).default([]),
  relatedProjects: z.array(idSchema).default([]),
  relatedPublications: z.array(idSchema).default([]),
  order: z.number().int().default(100),
});
export const currentWorkSchema = z.object({
  updated: isoDateSchema,
  items: z.array(currentWorkItemSchema),
});
export type CurrentWorkItem = z.infer<typeof currentWorkItemSchema>;

/* ------------------------------------------------------------------ */
/* review-needed.yml                                                   */
/* ------------------------------------------------------------------ */

export const reviewItemSchema = z.object({
  id: idSchema,
  severity: z.enum(['blocker', 'high', 'medium', 'low']),
  area: z.enum([
    'publications',
    'projects',
    'hackathons',
    'repositories',
    'experience',
    'profile',
    'design',
    'links',
  ]),
  summary: z.string().min(1),
  detail: z.string().optional(),
  /** What the site currently does while this is unresolved. */
  currentBehaviour: z.string().optional(),
  action: z.string().min(1),
  raisedAt: isoDateSchema,
  resolved: z.boolean().default(false),
});
export const reviewNeededSchema = z.array(reviewItemSchema);
export type ReviewItem = z.infer<typeof reviewItemSchema>;

/* ------------------------------------------------------------------ */
/* Registry — used by the CLI and the validator to iterate every file  */
/* ------------------------------------------------------------------ */

export const contentFiles = {
  'profile.yml': profileSchema,
  'education.yml': educationSchema,
  'experience.yml': experienceSchema,
  'research.yml': researchSchema,
  'publications.yml': publicationsSchema,
  'projects.yml': projectsSchema,
  'hackathons.yml': hackathonsSchema,
  'repositories-overrides.yml': repositoriesOverridesSchema,
  'research-links.yml': researchLinksSchema,
  'skills.yml': skillsSchema,
  'awards.yml': awardsSchema,
  'talks.yml': talksSchema,
  'current-work.yml': currentWorkSchema,
  'review-needed.yml': reviewNeededSchema,
} as const;

export type ContentFileName = keyof typeof contentFiles;
