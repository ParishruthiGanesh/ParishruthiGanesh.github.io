# Source audit

Where every fact on this site came from, what was deliberately left out, and
what could not be verified.

This document is **not published as a page** — it lives in `docs/` and is
excluded from the site build. A test asserts that no route matching
`source-audit` is generated.

Compiled: **18 August 2026**

---

## 1. Sources used

| # | Source | How it was accessed | What it supplied |
| --- | --- | --- | --- |
| S1 | `Parishruthi_Ganesh_Resume.pdf` | Supplied directly; text and embedded link annotations extracted | Profile, education, publications, experience, projects, skills, leadership |
| S2 | GitHub REST API — repository search for `user:ParishruthiGanesh` | Authenticated GitHub API | Repository names, descriptions, languages, licences, stars, dates, visibility |
| S3 | `github.com/ParishruthiGanesh/sentinel-memory` | Repository cloned and read | README, `docs/DEVPOST_SUBMISSION.md`, `docs/screenshots/`, architecture, tests, limitations |
| S4 | arXiv listing for `2607.27421` | Web search index (arxiv.org itself unreachable — see §5) | Confirmed title, three-author list, abstract and key findings |
| S5 | Links supplied directly by Parishruthi | Provided in the build request | Devpost URLs, YouTube URLs, live demo URLs, LinkedIn, Google Scholar |
| S6 | `github.com/ParishruthiGanesh` profile page | Fetched as HTML | Cross-check of the repository list, including forks |

---

## 2. Facts extracted from the resume (S1)

### Identity and profile
- Name: Parishruthi Ganesh
- Location: Auburn, AL
- Email: parishruthig2@gmail.com
- GitHub: github.com/ParishruthiGanesh
- Profile paragraph → condensed into `profile.shortBio` and `profile.bio`

### Education → `content/education.yml`
| Institution | Degree | Dates | Grade |
| --- | --- | --- | --- |
| Auburn University | Ph.D., Computer Science and Software Engineering | Fall 2025 – Present | — |
| Auburn University | M.S., Computer Science and Software Engineering | Aug 2023 – Aug 2025 | GPA 3.82 |
| Visvesvaraya Technological University | B.E., Computer Science | Aug 2017 – Aug 2021 | CGPA 7.7 |

Coursework and the Ph.D. research focus line are quoted from the resume.

### Publications → `content/publications.yml`
1. *Selecting Open-Weight Language Models for Zero-Shot Intent Classification: A
   Systematic Evaluation of 41 Models* — Parishruthi Ganesh, Gerry Dozier,
   Cheryl Seals. "Submitted to AAAI." arXiv 2607.27421.
2. *How Much Do Interaction Representations Contribute? A Controlled Study
   Through Early Violence Detection* — Parishruthi Ganesh et al. "Submitted to
   WACV."

Both statuses are transcribed, not inferred. Neither is presented as accepted or
published.

### Experience → `content/experience.yml`
- **Auburn University**, Graduate Research & Teaching Assistant, Jan 2024 –
  Present. Teaching bullet plus three named workstreams: AUSME Faculty Expertise
  RAG System; DEMA (Digital Engineering Data Management Platform); Interactive
  Rocket Simulation for Science Education. All bullets condensed from resume
  text, no additions.
- **Emids Technologies Pvt Ltd**, Bangalore, Associate Software Developer,
  Dec 2021 – Jul 2023. Three CRM bullets.
- **The Society for Responsible Artificial Intelligence**, Treasurer,
  Dec 2024 – Present (from the Leadership Experience section).

### Metrics taken verbatim from the resume
These are the only quantitative claims on the site that come from S1, and each
appears with the same scope the resume gave it:
- ~25,000 research papers collected and pre-processed (AUSME)
- 50+ faculty members covered (AUSME)
- 30 minutes end-to-end retrieval pipeline processing time for the corpus (AUSME)
- GPA 3.82; CGPA 7.7

### Projects → `content/projects.yml`
- Sentiment Analysis with Deep Learning using BERT (bert-base-uncased, SMILE
  dataset, AdamW, linear schedule with warm-up)
- Circular Trade Fraud Detection using Graph Neural Networks (2- and 3-cycles,
  hash-based score storage, Node2Vec, DBSCAN)

### Skills → `content/skills.yml`
All nine skill groups transcribed verbatim. Rendered as a flat list — the site
has no invented proficiency percentages or progress bars.

---

## 3. Facts from GitHub (S2, S3, S6)

Nine repositories are owned by this account (forks excluded by the search):

| Repository | Visibility | Language | On the site as |
| --- | --- | --- | --- |
| `sentinel-memory` | public | TypeScript | Featured project + hackathon + repository |
| `astranova-trading-copilot` | **private** | Python | Project + hackathon, marked private; repository listed unlinked |
| `Circular-trade-Fraud-Detection` | public | Jupyter Notebook | Project + repository |
| `Sentimental-Analysis` | public | Jupyter Notebook | Project + repository |
| `To-Do-List-Application` | public | JavaScript | Repository (coursework) |
| `WebPage` | public | HTML | Repository (coursework) |
| `ParishruthiGanesh.github.io` | public | — | Repository (this site) |
| `Demo-repo` | public | HTML | **Excluded** — empty scratch repository |
| `Demo-repo2` | public | — | **Excluded** — empty scratch repository |

Three forks appear on the profile page (`Logic-Legends-Fall2024-SQA`,
`IaCTesting`, `COVID19`). Forks are excluded from the repositories list by
default, per `includeForks: false`.

### Sentinel Memory (S3)

The most detailed content on the site, all drawn from the repository's own
README and `docs/DEVPOST_SUBMISSION.md`, both written by Parishruthi:

- Hackathon name: **CockroachDB × AWS "Build with Agentic Memory"**
- Problem framing, architecture, the three-interface design decision, the
  post-model safety floor, the episodic/semantic memory distinction
- Results: 94 tests; four-write atomic approval with `FOR UPDATE` locking and
  `40001` retry
- Error analysis: per-incident retrieval capping; the honest fallback embedder
  scores (0.4–0.65 versus 0.85–0.95)
- Limitations: no authentication, no RBAC, in-process rate limiting, synthetic
  seeded incidents, version-gated vector index
- Five lessons, quoted from the "What we learned" section
- Ten screenshots from `docs/screenshots/`, converted from PNG to WebP
  (5.0 MB → 0.98 MB); eight are used on the site

### AstraNova (S2)

The repository is **private**, so only its GitHub API description was available:

> "AstraNova — AI trading copilot for India's options traders (Build with Gemini
> XPRIZE). Live Angel One data, AI-scored signals, real broker execution,
> Gemini-powered assistant."

This supplied the hackathon name, the technology list and the one-paragraph
description. No architecture detail, results, setup instructions or metrics are
published, because none could be read. The site states the repository is private
rather than linking visitors to a 404.

---

## 4. Facts from arXiv (S4)

`arxiv.org` is blocked by this build environment's network policy, so the record
was confirmed through a search index that returned the arXiv listing itself. It
confirmed:

- The full title and the three-author list, matching S1 exactly
- The abstract: 41 open-weight models, 15 families, 135M–9B parameters, eight
  English single-label intent-classification datasets
- The three headline findings now quoted on the Research and Projects pages:
  instruction-tuned 3B models outperforming several evaluated 7B base models;
  leading models on MASSIVE being statistically indistinguishable under pairwise
  McNemar tests; SNIPS having saturated

The abstract on the site is a close paraphrase of the arXiv abstract, not a
verbatim copy.

---

## 5. What could not be verified

The build environment's egress policy allowed `github.com` and a search index
but blocked several hosts. Everything below was **supplied by Parishruthi or
read from a repository she wrote** — none of it is invented — but none of it
could be confirmed to resolve. All such links carry `verified: false`, which
renders an "unverified" marker on the site.

| Host | Affects |
| --- | --- |
| `devpost.com` | Both Devpost submission links; team members; any placement |
| `arxiv.org` | Direct fetch of the paper (worked around via S4) |
| `parishruthi-ganesh.base44.app` | The existing Base44 site (see §7) |
| `youtu.be` / `youtube.com` | Both demo video links |
| `sentinel-memory-git-main-pari19.vercel.app` | Sentinel Memory live demo |
| `nifty-research-47875.web.app` | AstraNova live demo |

Run `npm run portfolio -- linkcheck --fix` from an unrestricted network to
confirm these and flip the flags automatically.

### Suggested content with no supporting evidence — excluded

Three items were suggested during the build brief. None appears on the resume,
none was found under this author, and no preprint, DOI or repository was
supplied for any of them. **None is published.**

1. *Vision-Based Livestock Respiratory Monitoring for Smart Agriculture Sensing
   Systems*
2. *Geometry-Constrained Prototype Learning for Scarce-Data Open-World Detection*
3. Separate LLM-as-judge / RAG evaluation papers

Consequently there is **no "Smart Agriculture and Vision Systems" research
theme** and **no "LLM-as-judge" theme** on the site: a theme with nothing to
anchor it would be an unsupported claim about the shape of the research
programme. The RAG theme exists because the AUSME system on the resume supports
it.

Recorded as `unverified-publications-excluded` in `content/review-needed.yml`.

---

## 6. Conflicts between sources

| Conflict | Sources | Resolution |
| --- | --- | --- |
| **Ph.D. title.** Resume profile says "Ph.D. candidate in Computer Science"; its own Education section lists "Ph.D. in Computer Science and Software Engineering" starting Fall 2025 | S1 internal | Used the more conservative **"Ph.D. Student, Computer Science and Software Engineering"**, matching the department name. "Candidate" normally implies qualifying exams are passed, which a Fall 2025 start makes unlikely by August 2026. Logged as `phd-title-conflict`. |
| **Sentinel Memory demo URL.** README and GitHub `homepage` both give `sentinel-memory-lemon.vercel.app`; Parishruthi supplied `sentinel-memory-git-main-pari19.vercel.app` as the real URL | S3 vs S5 | Used the **supplied URL** as the more recent, explicitly structured source. Logged as `sentinel-demo-url-conflict`. |
| **LinkedIn URL.** Resume hyperlinks to `linkedin.com/in/parishruthi-ganesh`; supplied URL is `linkedin.com/in/parishruthi-ganesh-85909b188/` | S1 vs S5 | Used the **supplied URL**. Logged as `linkedin-url-conflict`. |
| **AstraNova hackathon name.** The brief asked for verification of the exact hackathon | S2 vs S5 | Used **"Build with Gemini XPRIZE"** from the repository's own description — the most authoritative available source. Submission marked `in-progress`, matching the `in_progress` marker on the supplied Devpost URL. Logged as `astranova-devpost-in-progress`. |

---

## 7. The Base44 site

`parishruthi-ganesh.base44.app` is blocked by this environment's egress policy,
and no export, source archive or screenshots were supplied. **The site could not
be inspected at all.**

Consequently:

- No content, copy, image or asset was taken from it.
- No styling was reproduced from it, and nothing on this site is attributed to it.
- The visual identity was built from the stated design direction — deep navy and
  slate, restrained cyan/teal accent, warm amber reserved for featured work and
  awards, strong serif headings against a sans body — rather than from the
  Base44 page.

If there is copy worth keeping on the Base44 site (a bio paragraph, a project
write-up, images), paste or export it and it can be merged into `content/*.yml`.
Logged as `base44-site-unreachable`.

---

## 8. Privacy — deliberately excluded

The resume contains these, and **none appears anywhere on the site or in any
content file**:

| Excluded | Reason |
| --- | --- |
| Telephone number | Direct personal contact detail; email is sufficient and is the channel offered |
| Home city as a residential address | The site states "Auburn, Alabama, USA" as a professional location only |
| Any immigration or work-authorisation information | Not present on the resume, and would not be published if it were |
| References and referee contact details | Not present on the resume, and not appropriate to publish |
| Supervisor and colleague names | Not published from the experience section; only already-public co-authors on the papers appear |
| Internal project details beyond the resume's own wording | Nothing was added to the DEMA or AUSME descriptions beyond what the resume states |

The resume PDF at `public/resume/Parishruthi-Ganesh-Resume.pdf` is the file
supplied, unmodified — **it still contains the telephone number**. That is a
deliberate choice: the PDF is Parishruthi's own document to distribute. If the
phone number should not be public, replace the PDF with a redacted version and
run `npm run portfolio -- update-resume <path>`.

Three tests enforce the exclusions on the HTML side: no telephone-shaped string,
no street address, and no API-token-shaped string in either the content files or
the built output.

---

## 9. Traceability in the site itself

The audit is not only in this document. On the site:

- Every publication detail page has a **Provenance** panel listing its metadata
  sources and `lastVerified` date.
- Every project detail page has a **Sources** panel.
- Every hackathon entry records its sources in `content/hackathons.yml`.
- Unverified links render an **"unverified"** marker.
- A private repository renders **"Repository is private"** instead of a link.
- Research themes with no established findings say so explicitly rather than
  showing provisional numbers.
