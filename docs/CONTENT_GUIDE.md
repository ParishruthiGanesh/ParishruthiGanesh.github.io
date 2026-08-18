# Content guide

Everything the site renders comes from `content/`. This is the field-by-field
reference.

Schemas are in `src/lib/schema.ts` and are the real specification — this
document explains the intent behind them. An invalid file fails the build with
the exact field and reason, so you cannot ship a typo.

```bash
npm run portfolio -- validate    # after any edit
```

---

## Conventions

**Ids** are lowercase hyphenated slugs (`intent-classification-41-models`). They
appear in URLs and in cross-references, so changing one breaks links — prefer
adding a new entry to renaming an old one.

**Dates**: `YYYY-MM-DD` for events, `YYYY-MM` for role and education ranges, or
the literal `present` for something ongoing.

**URLs** must be absolute `https://` or `mailto:`. Anything else is rejected at
validation — this is what keeps a `javascript:` payload out of an `href`.

**Long-form fields** are markdown. Use YAML block scalars:

```yaml
results: |
  Three findings, each scoped to this benchmark suite:

  1. **Parameter count is a poor selection criterion.** …
```

**Omit rather than invent.** Every long-form field is optional. A missing
section renders nothing at all — which is the honest signal that no verified
source existed. A plausible-sounding placeholder is worse than an absence.

---

## `profile.yml`

One object. Drives the hero, the header, the footer, Contact, and the JSON-LD
`Person` on every page.

| Field | Notes |
| --- | --- |
| `name`, `shortName`, `headline`, `role`, `affiliation` | `role` appears in the hero eyebrow and in structured data |
| `location` | Professional location only — never a residential address |
| `tagline` | The hero paragraph. One or two sentences |
| `shortBio` | ≤400 chars. Used for meta descriptions and structured data |
| `bio` | Markdown. The About page |
| `email` | Rendered split around the `@` to blunt naive scrapers |
| `links` | `github`, `linkedin`, `googleScholar`, `arxiv`, `orcid`, `semanticScholar`, `website`, `universityProfile`. **Omit any you cannot verify** — an absent link is simply not rendered |
| `resume.path` | Must start with `/` and exist under `public/` |
| `resume.lastUpdated` | Set automatically by `update-resume` |
| `researchInterests` | The hero chips |
| `openTo` | Chips on About and Contact |

Adding an `orcid` here also switches on ORCID publication discovery in the sync.

---

## `education.yml`

Array, rendered newest-first by `start`.

`institution`, `degree`, `start`, `end` are required. `grade` is a free string
because grading scales differ (`GPA 3.82 / 4.00`, `CGPA 7.7 / 10`).
`researchFocus`, `coursework`, `advisors`, `notes` are optional.

---

## `experience.yml`

Array. Each entry has `organization`, `role`, `type`
(`research` | `industry` | `teaching` | `service` | `leadership`), `start`,
`end`.

The interesting part is **`workstreams`** — named projects inside a single role,
each with its own `stack`, `summary`, `highlights` and links to related projects
or publications. This is how one research assistantship renders as three
distinct pieces of work rather than one undifferentiated bullet list.

Do not publish supervisor names or internal project detail beyond what is
already public.

---

## `research.yml`

The spine of the site. Every theme needs:

| Field | Notes |
| --- | --- |
| `question` | The actual research question, phrased as a question |
| `whyItMatters` | Why the answer changes anything |
| `approach` | Optional. Methodology |
| `findings` | **Only established results.** An empty array renders an explicit "nothing published yet" note, which is correct — do not fill it with expectations |
| `futureDirection`, `keywords`, `status` | |
| `publications`, `projects` | Ids; validated to exist |
| `order` | Lower sorts first |

A theme should exist because work anchors it. Creating a theme for an area with
no paper, system or workstream behind it is an unsupported claim about the shape
of the research programme.

---

## `publications.yml`

| Field | Notes |
| --- | --- |
| `title`, `authors`, `year` | `authors` in publication order |
| `highlightAuthor` | Bolded in the author list. Must appear in `authors` |
| `status` | `published` \| `accepted` \| `preprint` \| `under-review` \| `in-progress` |
| `statusNote` | Free text, e.g. "Submitted to AAAI" |
| `venue`, `venueShort`, `abstract` | |
| `researchAreas` | Theme ids; validated |
| `arxivId`, `doi` | Format-checked. Both drive the sync |
| `paperUrl`, `codeUrl`, `projectUrl`, `datasetUrl`, `slidesUrl`, `posterUrl`, `videoUrl` | All optional |
| `bibtex` | Rendered with copy and download buttons |
| `citations` + `citationsRetrievedFrom` + `citationsRetrievedAt` | **All three or none** — validation rejects a bare count |
| `lastVerified`, `sources` | Shown in the Provenance panel |
| `featured`, `order` | |

### On status

Status is read from an explicit source, never inferred. A venue name in a BibTeX
entry is not evidence of acceptance; "submitted to AAAI" is not "published at
AAAI". If you are unsure, use `under-review` and say why in `statusNote`.

---

## `projects.yml`

`id`, `name`, `tagline`, `kind`, `status` are required. The long-form sections
are all optional markdown, rendered in this order:

`problem` → `motivation` → `architecture` → `dataset` → `method` →
`experimentalSetup` → `results` → `errorAnalysis` → `limitations` →
`responsibleUse` → `setup` → `futureWork`

A project with three of these renders three sections and a shorter table of
contents. That is fine. Reaching for filler to make the page look complete is
the failure mode this structure exists to prevent.

`screenshots` need `src` (a path under `public/`, checked to exist) and `alt`
(descriptive — a test requires more than 25 characters).

`links` entries are `{ label, url, verified }`. Set `verified: false` for a URL
you have not machine-checked; the site renders an "unverified" marker rather
than presenting it as confirmed.

`repository` is `owner/name` and attaches live GitHub metadata to the page.

---

## `hackathons.yml`

| Field | Notes |
| --- | --- |
| `hackathon`, `projectName`, `date`, `tagline` | |
| `problem`, `whatItDoes` | Required — these carry the page |
| `architecture`, `technologies`, `lessons` | |
| `award` + `awardVerified` | An award **only displays** when `awardVerified: true`. Validation warns if you set one without the other |
| `submissionStatus` | `submitted` \| `in-progress` \| `judged` \| `unknown` — keeps an unfinished submission from reading as a result |
| `team` + `teamVerified` | Same pattern as awards |
| `youtubeId` | Bare 11-character id. `add-hackathon` extracts it from any YouTube URL shape |
| `repository` + `repositoryPrivate` | `repositoryPrivate: true` makes the site say "Repository is private" instead of linking to a 404 |
| `links`, `screenshots`, `sources` | |

---

## `repositories-overrides.yml`

The curated layer over synced GitHub data.

```yaml
github:
  owner: ParishruthiGanesh
  includeForks: false        # forks hidden unless explicitly featured
  hideEmpty: true            # skip repos with no description, topics or stars
  exclude: [Demo-repo]       # removed from the list entirely
```

Per repository:

| Field | Notes |
| --- | --- |
| `name` | Repository name only, no owner |
| `portfolioSummary` | **Your writing. A sync never touches this.** Shown in preference to the GitHub description |
| `categories` | Drives the filter chips |
| `featured`, `hidden`, `order` | `hidden` keeps the synced metadata; it is not a delete |
| `privateRepo` | For a private repository the public API cannot see. Makes the site say so |
| `relatedPublications`, `relatedHackathons`, `relatedProjects` | Ids; validated |
| `note` | Shown alongside a private-repository notice |

`content/generated/repositories.json` holds the synced side. **Never edit it** —
the next sync overwrites it.

---

## `research-links.yml`

Explicit paper ↔ code mappings. Never inferred from name similarity.

```yaml
- paper: intent-classification-41-models
  repository: ParishruthiGanesh/intent-eval
  relationship: implementation   # or experiments | dataset | analysis | demo
  verified: true
  linkedAt: '2026-08-18'
```

Create these with the CLI, which checks both sides exist first:

```bash
npm run portfolio -- link-paper-code <paper-id> <owner/repo>
```

---

## Supporting files

**`skills.yml`** — groups of `{ id, label, items[], order }`. A flat list on
purpose: no invented proficiency percentages, no progress bars.

**`awards.yml`**, **`talks.yml`** — empty arrays today. Their sections do not
render at all while empty, rather than showing a placeholder. Add an entry and
the section appears on the next build.

**`current-work.yml`** — `updated` plus `items[]`. Drives the homepage
"Currently working on" section. `updated` is displayed, so a stale date is
visible rather than hidden. `status` is one of `writing`, `experiments`,
`building`, `reviewing`, `reading`.

**`review-needed.yml`** — the queue of things that could not be verified. **Not
published as a page.** Each item carries `severity`, `area`, `summary`,
`detail`, `currentBehaviour` (what the site does while it is unresolved),
`action` and `raisedAt`.

This is where a claim goes when it cannot be sourced. Adding it here instead of
to a page is the whole discipline: `npm run portfolio -- status` lists everything
open, sorted by severity.

---

## Cross-references checked at build time

Every id reference is validated, and the build fails on any of these:

- a publication, project, hackathon or research theme id that does not exist
- a duplicate id within any collection
- a screenshot file missing from `public/`
- a missing resume PDF
- a `highlightAuthor` not present in `authors`
- a citation count without a source and a retrieval date
- an award set without `awardVerified`
- a repository both excluded and given an override
- a URL that is not absolute `http(s)` or `mailto`
