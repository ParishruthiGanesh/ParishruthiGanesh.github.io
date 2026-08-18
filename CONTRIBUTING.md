# Contributing

This is a personal portfolio, so it is not looking for feature contributions —
but corrections are genuinely welcome, and the workflow below is also the one
Parishruthi uses day to day.

## Reporting a problem

Open an issue for a broken link, a factual error, a rendering bug, or an
accessibility problem. For anything security-related, follow
[`SECURITY.md`](SECURITY.md) instead of opening a public issue.

A useful report includes the page, what you saw, what you expected, and — for
layout or accessibility issues — the browser, viewport width and whether you
were in light or dark mode.

## Making a change

```bash
git clone https://github.com/ParishruthiGanesh/ParishruthiGanesh.github.io.git
cd ParishruthiGanesh.github.io
npm install
npm run dev
```

Before opening a pull request:

```bash
npx tsc --noEmit                 # types
npm run portfolio -- validate    # schemas, references, missing files
npm run build                    # production build
npm test                         # unit and built-output tests
npm run test:e2e                 # browser tests
```

CI runs all of these on every pull request.

## Editing content

Content lives in `content/*.yml`. Do not edit `content/generated/` — it is
written by the sync pipeline and will be overwritten.

Prefer the CLI for anything structural; it validates before it writes:

```bash
npm run portfolio -- add-paper
npm run portfolio -- add-project
npm run portfolio -- add-hackathon
npm run portfolio -- link-paper-code <paper-id> <owner/repo>
```

See [`docs/CONTENT_GUIDE.md`](docs/CONTENT_GUIDE.md) for every field.

## The evidence rule

This is the one thing to get right when contributing content.

**Nothing is published that cannot be traced to a source.**

Concretely:

- Every publication carries a `sources` list and a `lastVerified` date.
- A publication's `status` is read from an explicit source. It is never inferred
  from a venue name — "submitted to AAAI" is not "published at AAAI".
- A hackathon `award` is displayed only when `awardVerified: true`.
- A citation count is displayed only alongside `citationsRetrievedFrom` and
  `citationsRetrievedAt`.
- A paper-to-code mapping is created only through `link-paper-code`, which
  checks both sides. Names that look similar are not evidence.
- If a section (Results, Error analysis, Dataset…) has no verified source, leave
  it out. An absent section is honest; a plausible-sounding one is not.
- If something cannot be verified, add it to `content/review-needed.yml` rather
  than to a page.

The test suite enforces the mechanical parts of this, including a check that no
unsupported superlatives ("world-class", "industry-leading", …) appear anywhere
in the content.

## Code style

- TypeScript throughout, strict mode, no `any` in new code.
- Components are `.astro`; interactive behaviour is progressive enhancement
  layered on markup that already works.
- Colours come from the tokens in `src/styles/global.css` — never a hard-coded
  hex value in a component, or dark mode breaks.
- Keep to the existing comment density: explain *why*, not *what*.

## Accessibility

Changes should hold the line the site already meets:

- one `<h1>` per page, headings in order;
- visible focus states on everything interactive;
- descriptive alt text on every image;
- WCAG AA contrast in both themes;
- `prefers-reduced-motion` respected;
- no horizontal page scroll at any width from 320px up.

`npm test` and `npm run test:e2e` check several of these directly.

## Commit messages

Conventional commits, e.g. `fix(repositories): stop long names overflowing at
320px` or `content(publications): add WACV submission`.
