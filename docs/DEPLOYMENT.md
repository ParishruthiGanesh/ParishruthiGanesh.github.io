# Deployment

The site is a static build published to GitHub Pages from `main` by GitHub
Actions.

**Live URL:** <https://parishruthiganesh.github.io>

---

## One-time setup

### 1. Set the Pages source to GitHub Actions

**Settings → Pages → Build and deployment → Source: GitHub Actions**

This is the step that is easy to miss. If the source is left as *"Deploy from a
branch"*, the workflow will run and go green while nothing is ever published.

### 2. Allow Actions to open pull requests

**Settings → Actions → General → Workflow permissions** → enable
*"Allow GitHub Actions to create and approve pull requests"*.

Without it, `sync-portfolio.yml` fetches and validates correctly but fails at
the final step when it tries to open its pull request.

### 3. Optional: gate deployments

**Settings → Environments → `github-pages`** → add a required reviewer if you
want to approve each deployment by hand. Nothing else needs configuring.

### No secrets are required

Both workflows use the automatic `GITHUB_TOKEN`. There is nothing to add under
Settings → Secrets. `PORTFOLIO_CONTACT_EMAIL` may optionally be set as a
repository **variable** (not a secret) to identify this site to Crossref's
polite pool.

---

## How a deployment happens

```
push to main
  └─ deploy-pages.yml
       ├─ npm ci
       ├─ portfolio validate      ← schemas, references, missing files
       ├─ npm run build           ← Astro static build into dist/
       ├─ npm test                ← unit + built-output tests
       ├─ upload-pages-artifact
       └─ deploy-pages            ← publishes via OIDC
```

Validation and tests run before publication, so a bad content edit fails the
deployment instead of reaching the live site.

Concurrency is set to `group: pages, cancel-in-progress: false` — deployments
queue rather than cancelling one another mid-publish.

---

## Why the configuration looks the way it does

### User site, so `base` stays `/`

```js
// astro.config.mjs
site: 'https://parishruthiganesh.github.io',
base: '/',
```

`ParishruthiGanesh.github.io` is a **user site**, served from the domain root.
A project page would be served from `/repo-name/` and would need `base` set
accordingly.

Every internal link on the site is built through `url()` in `src/lib/url.ts`,
which honours `import.meta.env.BASE_URL`. If this ever moves to a project page,
change `base` and every link, asset path and canonical URL follows. No component
hard-codes a leading `/`.

### `site` drives more than links

`site` is read by the canonical tags, the Open Graph URLs, the sitemap and the
RSS feed. Changing the domain without changing `site` produces a site that works
but advertises the wrong URL to every crawler and link preview.

### `.nojekyll`

`public/.nojekyll` is shipped so GitHub Pages serves the build as-is instead of
running it through Jekyll, which would silently drop any file or directory
beginning with an underscore — including Astro's `_astro/` asset directory.

A test asserts it is present in `dist/`.

### `trailingSlash: 'ignore'`

Pages serves `/about` and `/about/` interchangeably. `ignore` matches that so
neither form 404s.

---

## Custom domain

Prepared but deliberately not enabled. `public/CNAME.example` documents the
steps; the real `CNAME` file is absent, and a test asserts that `dist/CNAME`
does not exist.

To enable one:

1. **DNS.** For an apex domain, add `A`/`AAAA` records to GitHub's Pages
   addresses. For a subdomain, add a `CNAME` record pointing at
   `parishruthiganesh.github.io`.
2. **Repository.** `cp public/CNAME.example public/CNAME`, then replace its
   contents with the bare hostname on a single line — no scheme, no path, no
   comments.
3. **Astro.** Change `site` in `astro.config.mjs` to `https://<that hostname>`.
   *Skipping this is the usual cause of a custom domain that loads correctly but
   still emits `github.io` canonical URLs.*
4. **Delete the test** in `tests/build.test.ts` that asserts no `CNAME` exists,
   or invert it.
5. Merge to `main`, then enable **Enforce HTTPS** in Settings → Pages once
   GitHub has issued the certificate (usually within an hour).

---

## Verifying a deployment

```bash
npm run build
npm run preview        # serves dist/ exactly as Pages will
```

Then check:

- Every route in the navigation loads.
- `/no-such-page` shows the custom 404.
- `/resume` previews the PDF and the download works.
- `/rss.xml`, `/sitemap-index.xml` and `/robots.txt` all resolve.
- The theme toggle works and survives a reload.
- Nothing scrolls horizontally at 320px.

`npm run test:e2e` checks all of the above automatically.

---

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| Workflow green, site unchanged | Pages source is still "Deploy from a branch" (§1) |
| `Error: Resource not accessible by integration` | Workflow permissions too narrow, or Actions cannot open pull requests (§2) |
| CSS and JS 404 in production | `.nojekyll` missing, so Jekyll dropped `_astro/` |
| Assets 404 after moving to a project page | `base` not updated in `astro.config.mjs` |
| Canonical URLs point at the old domain | `site` not updated after a domain change |
| Sync workflow stopped running | GitHub disables scheduled workflows after 60 days of repository inactivity; re-enable from the Actions tab |
| Deployment fails at `validate` | A content edit broke a schema or a cross-reference — run `npm run portfolio -- validate` locally for the exact field |

### Rolling back

Revert the offending commit on `main` and push. The deploy workflow republishes
the previous state. For a bad sync specifically, revert the automated pull
request — nothing outside `content/generated/` will have changed.
