# Design system

A research-engineering portfolio has an unusual job: it has to look considered
enough to be taken seriously, without any of the decoration reading as a
substitute for substance. Everything below follows from that.

---

## Principles

1. **Evidence is the visual hierarchy.** The largest, most prominent element on
   a page is the actual work — a research question, a paper title, a result —
   not a decorative hero. The homepage hero is deliberately short so featured
   work is visible without scrolling far.
2. **Restraint is the aesthetic.** One accent colour, one warm accent reserved
   for featured and award context, and a hairline grid used once. No gradients
   beyond a single soft radial, no particles, no fake terminal, no skill bars.
3. **Absence is information.** A missing "Results" section means there was no
   verified source. The design makes omissions read as deliberate — sections
   simply do not render — rather than papering over them with placeholders.
4. **Both themes are first-class.** Neither is an inversion of the other; both
   were checked for contrast independently.

---

## Colour

Tokens live in `src/styles/global.css`. **Components never hard-code a hex
value** — they reference semantic tokens, which is what makes dark mode work.

### Palette

| Ramp | Role |
| --- | --- |
| `navy-950` … `navy-600` | Dark-theme surfaces; the spine of the identity |
| `slate-50` … `slate-800` | Light-theme surfaces and all muted text |
| `accent-300` … `accent-700` | Cyan/teal. Links, active state, small marks |
| `ember-300` … `ember-600` | Warm amber. **Only** featured work and awards |

The accent is deliberately deep (`accent-600`, `#0d8489`) in light mode so it
passes AA on white for body-sized text, and light (`accent-300`) in dark mode
for the same reason against navy.

### Semantic tokens

| Token | Use |
| --- | --- |
| `--surface` / `--surface-raised` / `--surface-sunken` | Page, card, recessed band |
| `--border` / `--border-strong` | Hairlines; `-strong` on hover and focus |
| `--ink` / `--ink-muted` / `--ink-subtle` | Headings / body / metadata |
| `--accent` / `--accent-hover` / `--accent-soft` | Interactive text; `-soft` for tag backgrounds |
| `--ember` / `--ember-soft` | Featured and award context |
| `--ring` | Focus outline |

### The three theme states

The viewer's theme has three states, and all three are handled:

```css
:root { /* complete light palette */ }

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) { /* dark overrides */ }
}

:root[data-theme='dark'] { /* dark overrides again, so the toggle wins */ }
```

The guard on the media query is what lets an explicit *light* choice override a
system preference for dark. The explicit `[data-theme='dark']` block is what
lets an explicit *dark* choice override a system preference for light. Omitting
either one breaks the toggle in one direction.

The stored choice is applied by an inline script in `<head>` before first paint,
so there is no flash of the wrong theme.

---

## Typography

| Face | Role |
| --- | --- |
| **Newsreader** (serif) | `h1`–`h4`. The academic register, and what stops the site reading as a generic SaaS template |
| **Inter** (sans) | Body, UI, navigation |
| **JetBrains Mono** | Repository names, dates, eyebrow labels, code, BibTeX |

Every stack has a real system fallback, and the web-font stylesheet is loaded
**off the critical path** (`media="print"` promoted to `all` on load, with a
`<noscript>` fallback). A slow or unreachable `fonts.googleapis.com` costs a
typeface, never a blank screen.

Headings use `text-wrap: balance`; body copy uses `text-wrap: pretty`.

The `.eyebrow` class — mono, 11px, uppercase, wide tracking — labels sections
without adding another heading level.

---

## Components

| Component | Purpose |
| --- | --- |
| `BaseLayout` | Page shell, metadata, Open Graph, JSON-LD, theme bootstrap |
| `SiteHeader` | Sticky nav, wider track than the prose container, mobile disclosure |
| `CommandPalette` | ⌘K search over a build-time index; no network, no service |
| `PageHeader` | Eyebrow + `h1` + lead, with a slot for filters or actions |
| `PublicationCard` / `ProjectCard` | List cards carrying filter data attributes |
| `LinkList` | Outbound links, with `unverified` markers and private-repo handling |
| `YouTubeEmbed` | Locally-drawn facade; loads nothing from Google until play |
| `Screenshot` | Lazy image with caption; first image on a page loads eagerly |
| `DetailSection` | One labelled markdown section; renders nothing when empty |
| `RelatedContent` | "Related paper / code / demo" cross-links |
| `Prose` | Markdown from a content field, styled by `.prose-research` |
| `Tag` | Chip in four tones: neutral, accent, ember, outline |

### Utility classes

- `.container-page` — 72rem max, the standard content track
- `.container-prose` — 46rem max, for long-form reading
- `.header-track` — 88rem max; the header is chrome and needs more room than prose
- `.surface-card` / `.card-interactive` — card surface, and the 2px hover lift
- `.scroll-x` — wide content (tables, code, BibTeX) scrolls inside itself so the
  page body never scrolls horizontally
- `.eyebrow`, `.link-underline`, `.prose-research`

---

## Motion

Deliberately minimal: a 520ms entrance rise on the hero, a 220ms 2px lift on
card hover, 160ms colour transitions on links.

Two rules:

- **Content is visible by default.** `.animate-rise` only adds an animation; a
  JavaScript or animation failure can never leave content hidden.
- **`prefers-reduced-motion: reduce` collapses everything** to 0.01ms, including
  smooth scrolling. A Playwright test asserts this.

---

## Accessibility

Targets WCAG 2.1 AA. What is implemented, and what is tested:

| Practice | Enforced by |
| --- | --- |
| One `<h1>` per page, headings in order | `tests/build.test.ts` |
| `lang="en"` on every page | `tests/build.test.ts` |
| Alt text on every image | Schema (min length) + build test + e2e test |
| Skip link to `#main` | Build test + e2e focus test |
| Visible focus ring on everything interactive | Global `:focus-visible` rule |
| No horizontal scroll from 320px up | e2e test at five widths |
| Reduced motion respected | e2e test |
| Live regions on filter counts | `aria-live="polite"` |
| Full keyboard control of the palette | ↑↓ / ↵ / Esc, `aria-activedescendant` |
| Descriptive link text | Reviewed; no bare "click here" |
| Language breakdown bars | `role="img"` with a text `aria-label` |

Filters, the palette and the theme toggle are all progressive enhancement: with
JavaScript disabled, every page still renders its full content and every link
still works.

---

## Performance

- Static output; no client framework. The only JavaScript is a few small inline
  islands.
- Screenshots converted to WebP and capped at 1600px (5.0 MB → 0.98 MB).
- Images lazy-loaded except the first on a page.
- Web fonts off the critical path.
- No third-party scripts, no analytics, no CDN JavaScript.
- YouTube facades: zero requests to any Google host until play is pressed.
- `inlineStylesheets: 'auto'` so small CSS is inlined rather than round-tripped.

---

## Adding a page

1. Create `src/pages/<name>.astro` using `BaseLayout` with a `title` and
   `description`.
2. Add it to `NAV_ITEMS` in `src/lib/nav.ts` — that one array drives the header,
   the mobile menu, the footer, the 404 page and the command palette.
3. If it has indexable content, add it to `buildSearchIndex()` in
   `src/lib/search.ts`.
4. Use `url()` for every internal link.
5. Run `npm test` — the build tests will check its heading structure, metadata,
   alt text and skip link automatically.
