# Design system

A research-engineering portfolio has an unusual job: it has to look considered
enough to be taken seriously, without any of the decoration reading as a
substitute for substance. Everything below follows from that.

---

## Principles

1. **Evidence is the visual hierarchy.** The largest, most prominent element on
   a page is the actual work — a research question, a paper title, a result —
   not a decorative hero. The home page carries no hero at all: a name, a short
   bio and then the work.
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

Tokens live in `src/styles/academic.css`. **Components never hard-code a hex
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

## One page, one shell

The site is a single page. `AcademicLayout` is its only shell, and it follows
the convention research portfolios have converged on: no navigation bar, no
hero, one scroll. A masthead (name, bio, availability, contacts, portrait), then
`Currently`, `Research`, `Projects`, `Experience` and `Miscellaneous`.

There are no detail pages. Every entry links straight out to the paper, the
repository or the demo — the material already exists there, and a wrapper page
around a link is a page to maintain for no reader's benefit. `/cv` is the only
other route, and it exists because the PDF is printed from it. A build test
asserts that exactly three pages are produced (`/`, `/cv`, `404`), so a second
page has to be a decision rather than a side-effect.

Tokens live in `src/styles/academic.css` and `src/styles/cv.css`. There is no
Tailwind theme any more: the two stylesheets are the whole design system.

Three details are load-bearing:

- Paragraph rules are scoped by class (`.masthead p.bio`), never as
  `.masthead p`. The bare descendant selector outranks `.status-line` and
  `.contact-line` on specificity and silently repaints them.
- Justification and hyphenation only switch on at `min-width: 720px`. Below
  that the measure is too narrow and justification opens rivers between words.
- `url()` returns an absolute URL or a `mailto:` untouched. Entries link out,
  and prefixing the base to one of those yields `/https://…` — a broken link
  that still looks plausible in the markup.

### Entry rows

`EntryRow` renders one item in the `Research` or `Projects` list — paper,
system and hackathon build alike, so they read as one list rather than three. Thumbnail left, content
right: title, authors (the owner bolded), a red monospace venue line, an
optional blurb, `/`-separated links, then tag chips. A link marked `disabled`
renders as plain text, which is how a private repository is shown without a dead
link.

Entries without a real screenshot fall back to a schematic SVG in
`public/images/thumbs/`. These are deliberately diagrammatic rather than
plot-like: a figure that reads as a results chart would imply measurements the
page does not have.

> **Whitespace is rendered.** Astro preserves template whitespace, so a line
> break before a separator renders as `Name , Name`. Keep each separator on the
> same line as the value it follows, or derive the string in the frontmatter. A
> build test fails on any whitespace preceding `,`, `)` or `]`.

---

## Components

| Component | Purpose |
| --- | --- |
| `AcademicLayout` | The page shell: no nav, theme toggle only, metadata and JSON-LD |
| `EntryRow` | One row in the Research or Projects list |
| `ProfileIcons` | Masthead icon row, rendered only for links that exist |

Everything else — the header, the command palette, the card and detail
components, the Tailwind layer — was deleted when the site became one page.
`git log` has them if a multi-page version is ever wanted again.

### Utility classes

The classes are in `academic.css` and named for what they are: `.page`,
`.masthead`, `.section`, `.rule`, `.entries`, `.entry`, `.timeline`,
`.misc-row`, `.current-list`, `.page-footer`, `.theme-toggle`, `.sr-only`,
`.skip-link`.

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

Don't, by default. The site is one page, and the route test will fail if a new
one appears — that failure is the design working, not a bug to route around.

New material goes into `content/` and renders into an existing section. If a
page genuinely is the right answer, build it on `AcademicLayout`, add it to
`expected` in the routes test with a note saying why, and use `url()` for every
internal link.
