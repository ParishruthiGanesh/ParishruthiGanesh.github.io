# Automation

How data gets onto the site without anyone typing it, and — more importantly —
what stops that automation from breaking carefully written content.

---

## The design rule

> **A sync may add or update machine-derived facts. It may never overwrite,
> delete or contradict a human's editorial judgement.**

Everything below is a consequence of that rule.

| Field | Written by | Never touched by |
| --- | --- | --- |
| `githubDescription` | the sync | — |
| `portfolioSummary` | a human | the sync |
| `content/generated/*.json` | the sync | a human (it gets overwritten) |
| `content/*.yml` | a human, or the CLI | the sync workflow |

The Repositories page shows both descriptions when they differ, so the curated
summary leads and the GitHub one is visible underneath as provenance.

---

## Repository synchronisation

`scripts/portfolio/github-sync.ts`

1. Reads the owner and exclusion rules from `content/repositories-overrides.yml`.
2. Fetches `GET /users/{owner}/repos?per_page=100`, following the RFC 5988
   `Link: …; rel="next"` header until there is no next page.
3. For each non-fork, fetches the language breakdown. A failure here is a
   warning, not an error — a missing breakdown must not fail a sync.
4. Normalises each repository into the schema, **sorting topics, languages and
   the repository list itself** so the output is byte-stable.
5. Compares against the previous file, ignoring the volatile `updatedAt` field,
   and reports added / changed / removed.
6. Writes only if the content actually differs. When nothing changed it reuses
   the previous `syncedAt`, so a daily run on an unchanged upstream produces no
   diff and therefore no pull request.

### Rate limits

Anonymous requests are capped at 60/hour. Setting `GITHUB_TOKEN` raises that to
5,000. When the limit is exhausted the sync raises a `RateLimitError` naming the
reset time and **leaves the existing file untouched**.

In CI the automatic `GITHUB_TOKEN` is used. It needs no extra scopes: it only
reads public metadata.

### Deletions

A repository that stops being returned by the API — renamed, deleted, or made
private — is reported as `gone` with a warning. Its curated entry in
`repositories-overrides.yml` is left alone and still renders on the site, marked
*"Not in last sync"*. **The sync never removes curated content.**

This is why `astranova-trading-copilot` still appears: it is private, so the
public API cannot see it, but its curated entry survives every sync.

---

## Publication synchronisation

`scripts/portfolio/publication-sync.ts`

Supported sources, tried in this order per entry:

| Source | Keyed by | Used for |
| --- | --- | --- |
| **arXiv** | `arxivId` | Title, authors, abstract, dates, categories, DOI |
| **Crossref** | `doi` | Title, authors, abstract, publication date, subjects |
| **ORCID** | `profile.links.orcid` | *Discovering* works not yet curated |
| **Semantic Scholar** | DOI or arXiv ID | Available as a fallback; rate-limit aware |

**Google Scholar is deliberately not scraped.** It forbids it, and a scraped
citation count cannot be attributed to a stable retrieval source. Citation counts
appear on the site only alongside `citationsRetrievedFrom` and
`citationsRetrievedAt`, and a test enforces that pairing.

### Conflicts, not corrections

When a fetched record disagrees with the curated YAML — a different title, a
different author count, a different DOI — the difference is recorded as a
`conflicts` entry in `content/generated/publication-metadata.json` and rendered
in an amber panel on that publication's detail page.

It is **never applied**. `content/publications.yml` is authoritative; a human
decides which side is right.

### Discovery goes to a queue

Works found on ORCID that are not already in `publications.yml` are printed as
review-queue items. They are never published automatically — an ambiguous author
match on a common name is exactly the kind of thing that should not silently
appear on a research portfolio.

### Failures degrade safely

If arXiv or Crossref is unreachable, the entry is *skipped* with the reason
`metadata source unreachable — curated record kept unchanged`. Nothing is
removed, and the run continues to the next paper.

---

## Workflows

### `sync-portfolio.yml`

Runs daily at **06:15 UTC**, on manual dispatch, and on pushes to `main` that
touch `content/`, `scripts/portfolio/` or `src/lib/schema.ts`.

```
install → sync repos → sync papers → validate → build → test → status → PR
```

- The publication step is `continue-on-error: true`. Four external APIs are
  involved; one being briefly down must not fail the run or discard a repository
  sync that already succeeded.
- The pull-request step uses `add-paths: content/generated`, so the workflow is
  *mechanically incapable* of committing a change to curated content.
- A pull request only opens if `git status --porcelain content/generated` is
  non-empty.
- `workflow_dispatch` accepts a `dry-run` input to see what would change without
  opening a pull request.

The workflow **never pushes to `main`**. Synchronised data can be wrong, so a
human sees the diff before it reaches the live site.

### `deploy-pages.yml`

Runs on every push to `main`, and on manual dispatch.

```
install → validate → build → test → configure-pages → upload → deploy
```

Validation and tests run *before* deployment, so a broken content edit cannot
reach the live site even if it was merged.

Permissions are `contents: read`, `pages: write`, `id-token: write` — deployment
uses OIDC, and nothing needs write access to the repository.

### `ci.yml`

Runs on every pull request: type-check, validate, build, unit tests, then
Playwright browser tests across desktop and mobile viewports. A separate
advisory `links` job runs `linkcheck` with `continue-on-error: true` — an
external host being down should not block a merge.

---

## Changing the schedule

Edit the `cron` in `sync-portfolio.yml`. The off-the-hour minute (`15`) is
deliberate: GitHub's scheduler is busiest at the top of the hour and is more
likely to drop a run there.

```yaml
- cron: '15 6 * * *'      # daily      (current)
- cron: '15 6 * * 1'      # weekly, Mondays
- cron: '15 6 1 * *'      # monthly
```

Scheduled workflows are disabled automatically after 60 days of repository
inactivity. If the sync stops running, check whether GitHub has disabled it, and
re-enable it from the Actions tab.

---

## Adding a new sync source

1. Add a fetch function to `scripts/portfolio/publication-sync.ts` returning a
   `Partial<PublicationMetadataEntry>`.
2. Add its name to the `source` enum in `publicationMetadataEntrySchema`.
3. Call it from `syncPublications`, wrapped so a failure warns rather than
   throws.
4. Add a normalisation test in `tests/sync.test.ts`.

Keep the same discipline: fetched data goes to `content/generated/`, conflicts
are reported rather than applied, and anything ambiguous goes to a review queue.
