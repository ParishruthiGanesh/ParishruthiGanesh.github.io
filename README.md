# parishruthiganesh.github.io

The research and engineering portfolio of **Parishruthi Ganesh** — Ph.D. student in
Computer Science and Software Engineering at Auburn University.

**Live site:** <https://parishruthiganesh.github.io>

Built with Astro, TypeScript and Tailwind CSS. Every piece of content lives in a
Zod-validated YAML file, GitHub repository data synchronises itself on a
schedule, and a `portfolio` CLI handles the day-to-day maintenance.

---

## What the site contains

| Page | What's on it |
| --- | --- |
| **Home** | Positioning, current work, featured research, selected papers, recent hackathons, live GitHub activity |
| **About** | Research biography, education, research philosophy, current goals, collaboration interests |
| **Research** | Five themes, each with its research question, why it matters, findings, related papers, code and projects |
| **Publications** | Filterable by year, area and status; BibTeX copy/download; a detail page per paper with full provenance |
| **Projects** | Long-form write-ups: problem, method, experimental setup, results, error analysis, limitations, responsible use |
| **Hackathons** | Each build with its problem, architecture, source, demo, Devpost link and privacy-preserving video embed |
| **Experience** | Research, industry and teaching roles with the technical contributions in each |
| **Resume** | Inline PDF preview, download, and the same content rendered as accessible HTML |
| **Repositories** | Auto-synchronised GitHub index with filters, curated summaries and related paper/hackathon links |
| **Contact** | Verified links only, with an obfuscated `mailto:` and no backend form |

Plus a ⌘K command palette, an RSS feed, a sitemap, Schema.org structured data,
a custom 404 page, and light/dark themes.

---

## Two rules the whole repository is built around

**1. Nothing is published that cannot be traced to a source.** Every publication
records where its metadata came from and when a human last verified it. Every
project lists its sources. A missing "Results" section means there was no
verified source for one — not that results were quietly omitted. Anything that
could not be confirmed goes into `content/review-needed.yml` instead of onto the
site.

**2. Automation never overwrites editorial judgement.** A sync updates
`githubDescription`; it never touches `portfolioSummary`. A repository that
disappears from the GitHub API keeps its curated entry and raises a warning. A
failed metadata fetch leaves the existing record alone. `hide-repo` hides, it
does not delete.

---

## Local development

Requires **Node.js 20.11 or newer**.

```bash
npm install
npm run dev          # http://localhost:4321
```

Other commands:

```bash
npm run build        # production build into dist/
npm run preview      # serve dist/ exactly as GitHub Pages will
npm test             # schema, integrity and built-output tests (Vitest)
npm run test:e2e     # browser tests (Playwright)
npx tsc --noEmit     # type-check
```

---

## Editing content

All content lives in `content/` as YAML. There is no CMS and no database — edit
a file, run `npm run portfolio -- validate`, and commit.

| File | Holds |
| --- | --- |
| `profile.yml` | Name, role, bio, links, resume metadata, research interests |
| `education.yml` | Degrees, institutions, dates, coursework |
| `experience.yml` | Roles, responsibilities, workstreams |
| `research.yml` | Research themes: question, why it matters, findings, status |
| `publications.yml` | Papers, status, abstracts, identifiers, BibTeX, provenance |
| `projects.yml` | Project write-ups with long-form markdown sections |
| `hackathons.yml` | Hackathons with links, videos, lessons |
| `repositories-overrides.yml` | Curated layer over synced GitHub data |
| `research-links.yml` | Explicit paper ↔ code mappings |
| `skills.yml`, `awards.yml`, `talks.yml` | Supporting lists |
| `current-work.yml` | The homepage "Currently working on" section |
| `review-needed.yml` | Open questions and unverified claims (never published) |

`content/generated/` is written by the sync pipeline. **Do not edit it by hand** —
the next sync overwrites it.

Schemas live in `src/lib/schema.ts`. An invalid file fails the build with the
exact field and reason, so a typo can't reach the live site.

Full field-by-field reference: [`docs/CONTENT_GUIDE.md`](docs/CONTENT_GUIDE.md).

---

## CLI commands

```bash
npm run portfolio -- <command>
```

| Command | What it does |
| --- | --- |
| `status` | Missing links, stale records, unresolved review items, last sync time |
| `validate` | Schemas, duplicate ids, broken relationships, missing files, invalid URLs |
| `sync [--repos\|--papers] [--dry-run]` | Fetch GitHub and publication metadata; report changes |
| `linkcheck [--fix] [--strict]` | Check every external URL; `--fix` marks reachable ones verified |
| `add-project` | Add a project interactively, validated before anything is written |
| `add-paper` | Add a paper by arXiv ID, DOI, or by hand |
| `add-hackathon` | Add a hackathon with repo, Devpost and YouTube links |
| `link-paper-code <paper-id> <owner/repo>` | Map a paper to its code, checking both sides first |
| `feature-repo <repository>` | Mark a repository as featured |
| `hide-repo <repository>` | Hide a repository, keeping its synced metadata |
| `update-resume <path.pdf>` | Install a new resume and record the date |
| `build [--no-sync]` | Sync, validate, test, build |
| `publish` | Build, then show the diff and confirm before committing and pushing |
| `ask "<request>"` | Map plain English onto one of the above (works offline, no API key) |

Full reference: [`docs/CLI.md`](docs/CLI.md).

---

## Automatic synchronisation

`.github/workflows/sync-portfolio.yml` runs daily at 06:15 UTC, on manual
dispatch, and whenever `content/` or the sync scripts change on `main`. It:

1. fetches public repositories for `ParishruthiGanesh` (paginated, rate-limit
   aware, using the automatic `GITHUB_TOKEN`);
2. fetches publication metadata from arXiv and Crossref (and ORCID once an
   ORCID iD is configured);
3. validates all content, builds the site and runs the tests;
4. **opens a pull request** if — and only if — `content/generated/` changed.

It never pushes to `main`, and it only ever commits files under
`content/generated/`. Publication conflicts are *reported*, not applied:
`content/publications.yml` stays authoritative.

Google Scholar is deliberately not scraped. Citation counts are displayed only
when retrieved from a supported API and labelled with a retrieval date.

Details: [`docs/AUTOMATION.md`](docs/AUTOMATION.md).

---

## Deployment

`.github/workflows/deploy-pages.yml` validates, tests, builds and publishes to
GitHub Pages on every push to `main`.

### Required GitHub settings (one-time)

1. **Settings → Pages → Build and deployment → Source:** select
   **GitHub Actions** (not "Deploy from a branch"). Nothing deploys until this
   is set.
2. **Settings → Actions → General → Workflow permissions:** ensure
   *"Allow GitHub Actions to create and approve pull requests"* is enabled, so
   the sync workflow can open its pull request.
3. Optional: **Settings → Environments → `github-pages`** to add a protection
   rule if you want to approve each deployment by hand.

No secrets are required. Both workflows use the automatic `GITHUB_TOKEN`.

Details, including custom-domain setup: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

---

## How to…

### Update the resume

```bash
npm run portfolio -- update-resume ~/Downloads/Parishruthi_Ganesh_Resume.pdf
```

Verifies the file is really a PDF, copies it to `public/resume/`, and sets
`resume.lastUpdated` in `profile.yml`. Then update the HTML resume sections
(`education.yml`, `experience.yml`, `skills.yml`) so the page and the PDF agree —
the PDF is never the only way to read the content.

### Add a paper

```bash
npm run portfolio -- add-paper
```

Give it an arXiv ID or a DOI and it pulls the title, authors and abstract for
you to confirm. **Status is always asked, never inferred** — a venue name in a
BibTeX entry is not evidence of acceptance.

### Link code to a paper

```bash
npm run portfolio -- link-paper-code intent-classification-41-models ParishruthiGanesh/intent-eval
```

Checks that the paper id exists and that the repository is real and public
before writing to `content/research-links.yml`. Mappings are never inferred from
name similarity.

### Add a hackathon video

```bash
npm run portfolio -- add-hackathon
```

Paste any YouTube URL — `youtu.be/…`, `watch?v=…`, `/embed/…`, `/shorts/…` — and
the video id is extracted for you. Videos render as a click-to-load facade with
**no request to any Google host until the visitor presses play**.

To add a video to an existing entry, set `youtubeId` in `content/hackathons.yml`.

### Recover from a failed synchronisation

A failed sync leaves everything as it was — that is the design — so recovery is
usually just re-running it.

```bash
npm run portfolio -- status          # what is stale or unresolved?
npm run portfolio -- sync --dry-run  # what would change, without writing?
npm run portfolio -- validate        # is the current state consistent?
```

- **`GitHub API 401/403`** — you have a stale or scoped-out `GITHUB_TOKEN` in
  your environment. The sync needs no token at all for public data; unset it, or
  set one with read-only public access.
- **`rate limit exhausted`** — anonymous requests are capped at 60/hour. Set a
  `GITHUB_TOKEN`, or wait for the reset time in the error.
- **arXiv or Crossref unreachable** — reported as a warning; curated records are
  kept unchanged. Re-run later.
- **`content/generated/repositories.json` failed validation** — delete it and
  re-run `npm run portfolio -- sync --repos`. The site falls back to the curated
  layer in the meantime, so no page breaks.
- **A repository vanished from the list** — the sync warns rather than deleting.
  Its curated entry in `repositories-overrides.yml` still renders, marked
  *"Not in last sync"*.

To roll back entirely, revert the automated sync pull request; nothing outside
`content/generated/` will have changed.

---

## Repository layout

```
content/            structured YAML content (the source of truth)
  generated/        synced data — machine-written, do not hand-edit
docs/               content, CLI, automation, deployment and design docs
public/             static assets: resume PDF, images, favicon, OG image
scripts/portfolio/  the `portfolio` CLI and sync pipeline
src/
  components/       Astro components
  layouts/          page shell, metadata, structured data
  lib/              schemas, content loading, search index, formatting
  pages/            routes
  styles/           design tokens and global CSS
tests/              Vitest suites
  e2e/              Playwright browser tests
```

---

## Documentation

- [`docs/CONTENT_GUIDE.md`](docs/CONTENT_GUIDE.md) — every content field explained
- [`docs/CLI.md`](docs/CLI.md) — full CLI reference
- [`docs/AUTOMATION.md`](docs/AUTOMATION.md) — how synchronisation works and how to change it
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — GitHub Pages setup and custom domains
- [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) — tokens, typography, components, accessibility
- [`docs/SOURCE_AUDIT.md`](docs/SOURCE_AUDIT.md) — where every fact on the site came from
- [`docs/PORTFOLIO_REVIEW.md`](docs/PORTFOLIO_REVIEW.md) — what was built, what needs review
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — how to propose a change
- [`SECURITY.md`](SECURITY.md) — reporting a vulnerability

---

## Licence

Code is MIT-licensed (see [`LICENSE`](LICENSE)). Written content, the resume,
and project screenshots are © Parishruthi Ganesh and are not covered by that
licence.
