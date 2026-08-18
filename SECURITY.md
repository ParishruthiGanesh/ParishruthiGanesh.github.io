# Security policy

This repository is a static personal portfolio. It has no backend, no database,
no user accounts and no form submissions, so the attack surface is small — but
the automation and the build pipeline are worth taking seriously.

## Reporting a vulnerability

Please report privately rather than opening a public issue:

- Use **GitHub's private vulnerability reporting** on this repository
  (Security → Report a vulnerability), or
- email **parishruthig2@gmail.com** with `SECURITY` in the subject.

Please include what you found, how to reproduce it, and what an attacker could
do with it. Expect an acknowledgement within about a week.

## What is in scope

- Cross-site scripting or content injection in the built site.
- A vulnerability in the `portfolio` CLI or the synchronisation pipeline
  (for example: a crafted API response leading to code execution or to a
  malicious URL being written into content).
- A GitHub Actions workflow misconfiguration allowing privilege escalation,
  secret exfiltration, or an unauthorised write to `main`.
- A supply-chain issue in a pinned dependency that affects this repository.

## What is out of scope

- Missing security headers that GitHub Pages does not allow a static site to
  set (there is no server to set them on).
- Findings against third-party services this site links to.
- Automated scanner output with no demonstrated impact.
- Denial of service against GitHub's own infrastructure.

## How this repository protects itself

**No secrets are required or stored.** Both workflows use the automatic
`GITHUB_TOKEN`. There is no `.env` in version control; `.gitignore` excludes
`.env` and `.env.*` while allowing `.env.example`, which contains only
commented-out placeholders.

**No token ever reaches browser code.** All GitHub API calls happen at build
time or in CI, in Node. The published site makes no authenticated request to
anything.

**Minimal workflow permissions.** Each workflow declares the least privilege it
needs: `deploy-pages.yml` gets `contents: read`, `pages: write` and
`id-token: write`; `ci.yml` gets `contents: read`; `sync-portfolio.yml` runs
read-only except for the single job that opens a pull request. Actions are
pinned to major versions, and Dependabot watches both npm and GitHub Actions.

**Every URL is validated.** `externalUrlSchema` in `src/lib/schema.ts` rejects
anything that is not absolute `http(s)` or `mailto`, so a `javascript:` or
`data:` payload cannot reach an `href` even if a content file is edited
carelessly or an API returns something unexpected. Tests assert this over every
URL the site renders.

**External content is escaped.** Markdown is rendered only from content files in
this repository, which go through pull-request review. Text arriving from the
GitHub API is rendered as escaped text, never as HTML.

**No third-party scripts.** No analytics, no tag manager, no CDN-hosted
JavaScript. The only external requests a visitor's browser makes are to Google
Fonts for the typefaces — loaded off the critical path — and to
`youtube-nocookie.com`, and only after the visitor presses play on a video.

**Automation cannot publish on its own.** The sync workflow opens a pull request
rather than pushing to `main`, and it may only commit files under
`content/generated/`. Deployment happens from `main` after review.

## Private information

Personal details that appear on the resume — home address, telephone number and
similar — are deliberately excluded from the site's content files. The test
suite asserts that no telephone number, street address or API-token-shaped
string appears in either the content files or the built output. If you find
something that slipped through, please report it using the process above.
