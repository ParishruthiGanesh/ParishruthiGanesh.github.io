# Portfolio review

What was built, what needs your attention, and what to do next.

Built: **18 August 2026** · Not published as a page.

---

## 1. Pages created

22 routes, all building and tested.

| Route | Notes |
| --- | --- |
| `/` | Hero, "Currently working on", four research themes, two papers, four projects, two hackathons, live GitHub activity |
| `/about` | Bio, research philosophy, current goals, collaboration, education and skills sidebar |
| `/research` | Five themes with question / why it matters / approach / findings / next |
| `/publications` | Filterable by search, year, area and status; "Copy all BibTeX" |
| `/publications/{id}` | 2 pages — abstract, BibTeX with copy and download, provenance panel |
| `/projects` | Filter by type and research area |
| `/projects/{id}` | 9 pages — long-form write-ups with a table of contents |
| `/hackathons` | 2 entries with click-to-load video, screenshots and lessons |
| `/experience` | 3 roles with workstreams and technical contributions |
| `/resume` | Inline PDF preview, download, plus the full resume as HTML |
| `/repositories` | Live GitHub index with search, language, category and sort |
| `/contact` | Verified links only, obfuscated email, no backend form |
| `/404` | Custom, `noindex`, links every section |
| `/rss.xml`, `/sitemap-index.xml`, `/robots.txt` | Feed and crawler files |

Plus a ⌘K command palette (also `/`), light/dark themes, and Schema.org
`Person`, `ScholarlyArticle`, `SoftwareSourceCode` and `ProfilePage` data.

---

## 2. Content included

### Publications (2)

| Paper | Status shown |
| --- | --- |
| Selecting Open-Weight Language Models for Zero-Shot Intent Classification: A Systematic Evaluation of 41 Models | **Preprint** — "Preprint available on arXiv; submitted to AAAI" |
| How Much Do Interaction Representations Contribute? A Controlled Study Through Early Violence Detection | **Under review** — "Submitted to WACV" |

Neither is presented as accepted or published, because neither resume nor any
other source says so. The first carries the arXiv abstract and its three
headline findings; the second is described without inventing results.

### Research themes (5)

1. Language-Model Evaluation and Model Selection — 3 findings from the arXiv paper
2. Video Understanding and Early Detection — **no findings listed** (nothing published yet; the page says so)
3. Retrieval-Augmented Generation over Scholarly Corpora — the AUSME throughput figure
4. Agentic and Memory-Based Systems — 2 findings from the Sentinel Memory write-up
5. Applied AI and Data Integration — no findings; DEMA and fraud detection attached

### Projects (9)

Featured: Zero-Shot Intent Classification Benchmark · Interaction Representations
for Early Violence Detection · Sentinel Memory · AstraNova · AUSME Faculty
Expertise RAG · DEMA.
Also listed: Circular Trade Fraud Detection · BERT Sentiment Analysis ·
Interactive Rocket Simulation.

**Sentinel Memory is the deepest page** — problem, motivation, architecture,
method, results, error analysis, limitations, responsible use, setup, future
work, and five screenshots. All of it comes from the repository's own README and
Devpost write-up.

**AstraNova is deliberately thin.** Its repository is private, so only the
GitHub description was readable. No architecture, results or metrics are
published, and the page says why.

### Hackathons (2)

| Hackathon | Project | Submission | Award |
| --- | --- | --- | --- |
| CockroachDB × AWS — Build with Agentic Memory | Sentinel Memory | Submitted | none shown |
| Build with Gemini XPRIZE | AstraNova | In progress | none shown |

Both carry repo, demo, Devpost and YouTube links. Neither shows an award,
because no award was verified.

### Repositories (7 listed)

`sentinel-memory` · `astranova-trading-copilot` (private) ·
`Circular-trade-Fraud-Detection` · `Sentimental-Analysis` ·
`To-Do-List-Application` · `WebPage` · `ParishruthiGanesh.github.io`

Excluded: `Demo-repo`, `Demo-repo2` (empty scratch repositories) and three forks.

---

## 3. Excluded, and why

| Item | Why |
| --- | --- |
| *Vision-Based Livestock Respiratory Monitoring* | Not on the resume; no preprint, DOI or repository supplied; no trace found |
| *Geometry-Constrained Prototype Learning for Scarce-Data Open-World Detection* | Same |
| Separate LLM-as-judge / RAG evaluation papers | Same |
| A "Smart Agriculture and Vision Systems" research theme | Nothing to anchor it |
| An "LLM-as-judge" research theme | Nothing to anchor it |
| `Demo-repo`, `Demo-repo2` | Empty |
| Three forks | Not original work |
| Telephone number, street address | Private; excluded and enforced by tests |
| Supervisor names, internal project detail | Not appropriate to publish |
| Citation counts | None retrievable from a supported API with a retrieval date |

If any of the three excluded papers is real, add it with
`npm run portfolio -- add-paper` and the site picks it up on the next build.

---

## 4. Needs your verification

`npm run portfolio -- status` prints this list any time. **11 open items.**

### Blocker

**`astranova-trading-copilot` is private on GitHub.** A visitor following the
link gets a 404. The site currently labels it "Repository is private" and does
not link it. If the submission is finished, make the repository public and run
`npm run portfolio -- sync` — the private label disappears by itself and the
README-derived detail becomes available.

### High

- **AstraNova's Devpost submission was in-progress**, and the exact hackathon
  edition was not independently confirmed. The name "Build with Gemini XPRIZE"
  comes from the repository's own description. Once final, set
  `submissionStatus: submitted` in `content/hackathons.yml`, add verified team
  members, and add an award **only** if one was received.
- **Three suggested publications are excluded** (§3). Add any that are real.

### Medium

- **22 links are unverified.** Devpost, YouTube, arXiv, Vercel and Firebase are
  all blocked or bot-filtered from the build environment, so they render with an
  "unverified" marker. Every one was supplied by you or read from your own
  repository — none is invented.
  **Run `npm run portfolio -- linkcheck --fix` from your own machine.**
- **Two Sentinel Memory demo URLs exist.** The README and GitHub `homepage` say
  `sentinel-memory-lemon.vercel.app`; you supplied
  `sentinel-memory-git-main-pari19.vercel.app`. The site uses yours. Consider
  updating the repository so the two agree.
- **No paper has code mapped to it.** `content/research-links.yml` is empty on
  purpose — no repository under your account corresponds to either paper, and
  guessing by name is exactly what that file exists to prevent. When code is
  public: `npm run portfolio -- link-paper-code <paper-id> <owner/repo>`.
- **The Base44 site could not be reached** (blocked by this environment's
  network policy). Nothing was copied from it and nothing is attributed to it.
  If it has copy worth keeping, paste it and it can be merged in.

### Low

- **"Ph.D. Student" vs "Ph.D. Candidate."** Your resume profile says
  "candidate"; its Education section shows a Fall 2025 start. The site uses the
  more conservative "Ph.D. Student, Computer Science and Software Engineering".
  If candidacy has been conferred, change `role` in `content/profile.yml`.
- **LinkedIn URL differs** between the resume and what you supplied. The site
  uses your supplied URL.
- **No ORCID iD.** Adding one to `profile.yml` switches on ORCID publication
  discovery in the sync.
- **No talks or awards.** Those sections are hidden rather than showing
  placeholders; add an entry and they appear.

---

## 5. What you must do to make the site live

Two settings, once. **Nothing deploys until the first one is set.**

1. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
   If left as "Deploy from a branch", the workflow runs green and publishes
   nothing.
2. **Settings → Actions → General → Workflow permissions** → enable
   *"Allow GitHub Actions to create and approve pull requests"*, so the daily
   sync can open its pull request.

**No secrets are needed.** Both workflows use the automatic `GITHUB_TOKEN`.

Optional: add a required reviewer on the `github-pages` environment if you want
to approve each deployment.

---

## 6. Commands to run next

```bash
# 1. Confirm the links this environment could not reach
npm run portfolio -- linkcheck --fix

# 2. Refresh GitHub and publication metadata from an unrestricted network
npm run portfolio -- sync

# 3. See what is still open
npm run portfolio -- status

# 4. Look at it locally
npm run dev
```

Day to day:

```bash
npm run portfolio -- add-paper
npm run portfolio -- add-hackathon
npm run portfolio -- update-resume ~/Downloads/new-resume.pdf
npm run portfolio -- validate        # after any hand edit
```

---

## 7. Verification performed

| Check | Result |
| --- | --- |
| TypeScript strict type-check | Clean |
| Content validation (14 files, all cross-references) | Clean |
| Production build | 22 pages |
| Vitest — schemas, integrity, privacy, built output | **115 passed** |
| Playwright — desktop + mobile | **68 passed** |
| Routes at 320 / 375 / 768 / 1024 / 1440 px | No horizontal overflow |
| Light and dark themes, and the toggle's persistence | Verified |
| Resume preview, download, and PDF header | Verified |
| YouTube embeds | Zero Google requests before play |
| Secrets, tokens, telephone numbers in the output | None |
| GitHub Pages config (`.nojekyll`, 404, canonical, sitemap, RSS) | Verified |

### Issues found during verification, and fixed

The test suite earned its keep — these were all real defects it caught:

1. **Header overflowed by ~132px at every width ≥1280px**, forcing horizontal
   page scroll. The header now uses its own wider track, and the tagline appears
   only at `2xl`.
2. **Her own name was being truncated** to "Parishruthi Gan…" in the header at
   1280–1536px. The name now never truncates; space is recovered from the nav
   padding and the search button's label instead.
3. **Long repository names overflowed the viewport at 320px.** Grid items now
   have `min-w-0` and the monospace name wraps.
4. **The repository count read "13 of 13" instead of "7 of 7"** — the filter's
   `querySelectorAll('li')` was also matching the topic chips nested inside each
   card, so filtering could hide individual tags. Scoped to direct children.
5. **YouTube facades were fetching thumbnails from `i.ytimg.com` on page load**,
   which quietly undercut the "no request until you press play" claim. The
   facade is now drawn locally; a hackathons page with two demos now makes
   **zero** requests to any Google host until play is pressed.
6. **The web-font stylesheet was render-blocking**, so a slow
   `fonts.googleapis.com` delayed first paint by up to 13 seconds. It is now
   loaded off the critical path with a `<noscript>` fallback.
7. **Maintainer notes were rendering on a public page** — a visitor was being
   told to "run `npm run portfolio -- sync`". `note` is now maintainer-facing
   only, surfaced by `portfolio status`, with two regression tests.
8. **`linkcheck --fix` would have marked bot-403 responses as verified.** It now
   requires a genuine success response — which matters here, because this
   environment's egress proxy answers 403 for every blocked host.

### Known environment limitations

- `devpost.com`, `arxiv.org`, `youtu.be`, the two demo hosts and the Base44 site
  are blocked by this environment's network policy. Those links are published as
  supplied and marked unverified.
- The GitHub API is scoped here, so `content/generated/repositories.json` was
  seeded from authenticated GitHub API data in the exact shape the sync
  produces. Your first `npm run portfolio -- sync` will refresh it normally and
  add the language breakdowns.
- Playwright's bundled Chromium revision does not match this sandbox's
  pre-installed build; `PLAYWRIGHT_CHROMIUM_PATH` handles that locally, and CI
  installs the matching browser.

---

## 8. Where things live

```
content/*.yml          everything the site says       ← edit this
content/generated/     synced data                    ← never hand-edit
docs/                  content, CLI, automation, deployment, design, audit
scripts/portfolio/     the CLI and the sync pipeline
src/lib/schema.ts      the single source of truth for every content shape
tests/                 115 unit + built-output tests
tests/e2e/             68 browser tests
```

`docs/SOURCE_AUDIT.md` records where every fact came from, every conflict and
how it was resolved, and everything deliberately excluded for privacy.
