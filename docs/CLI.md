# The `portfolio` CLI

```bash
npm run portfolio -- <command> [options]
```

Every command is deterministic and works offline apart from the ones that
explicitly fetch. No API key is required for any of them.

Two rules hold across the whole CLI:

1. **Nothing is written until it validates.** Commands that add content build
   the new file in memory, parse it against the Zod schema, and only write if it
   passes. A rejected addition prints the exact field and reason and leaves the
   file untouched.
2. **Nothing curated is ever deleted.** `hide-repo` hides; it does not remove.
   A failed fetch keeps the existing record. A repository that vanishes from the
   API keeps its curated entry and raises a warning.

---

## Inspect

### `status`

The one command to run when you come back to the site after a while.

```bash
npm run portfolio -- status
```

Reports content counts, resume date, when the last GitHub sync ran (and whether
it is more than two weeks stale), any integrity problems, missing links
(publications with no paper URL or no mapped code, hackathons with no video or
Devpost link, a missing ORCID), links still marked unverified, and the open
review queue sorted by severity.

Exits non-zero if there are integrity problems.

### `validate`

```bash
npm run portfolio -- validate
```

Checks all fourteen content files against their schemas, then cross-references:
unknown ids, duplicate ids, missing screenshot files, a missing resume PDF, a
`highlightAuthor` not present in `authors`, a citation count without a source, a
repository both excluded and overridden. Exits non-zero on any problem.

This is what CI runs, and it is the fastest way to check an edit.

### `linkcheck`

```bash
npm run portfolio -- linkcheck
npm run portfolio -- linkcheck --fix      # mark reachable links verified
npm run portfolio -- linkcheck --strict   # exit non-zero if anything is broken
```

Tries `HEAD` then `GET` on every external URL the site renders, and prints where
each one came from. A `403` or `405` counts as reachable — plenty of hosts
reject bot `HEAD` requests without the link being broken.

`--fix` only ever flips `verified: false` to `true` for links that actually
resolved. It never removes a link: an external host being down is not evidence
that a link is wrong. Without `--strict` the command exits zero, so a flaky
external host cannot fail a build.

---

## Synchronise

### `sync`

```bash
npm run portfolio -- sync                 # repositories and publications
npm run portfolio -- sync --repos         # repositories only
npm run portfolio -- sync --papers        # publications only
npm run portfolio -- sync --dry-run       # report changes, write nothing
```

**Repositories.** Fetches every public repository for the owner in
`repositories-overrides.yml`, following pagination to the end, and writes
`content/generated/repositories.json`. Output is deterministic — repositories
sorted by name, topics and languages sorted, fixed key order — so an unchanged
upstream produces a byte-identical file and the scheduled workflow does not open
an empty pull request.

Reports what was added, changed and removed. A repository that has disappeared
produces a warning, not a deletion.

**Publications.** For each entry with an `arxivId`, queries arXiv; otherwise, for
each with a `doi`, queries Crossref. Results go to
`content/generated/publication-metadata.json`. If an ORCID iD is set in
`profile.yml`, works found there that are not already curated are added to a
**review queue** and printed — they are never published automatically.

Disagreements between upstream and `content/publications.yml` are reported as
conflicts and shown on the publication's detail page. They are never applied:
the curated YAML is authoritative.

Google Scholar is not scraped.

Set `GITHUB_TOKEN` to raise the GitHub rate limit from 60 to 5,000 requests per
hour. It is optional locally and supplied automatically in CI.

---

## Add content

All three are interactive and require a terminal.

### `add-project`

```bash
npm run portfolio -- add-project
```

Prompts for name, id, tagline, kind, status, year, research areas,
technologies, repository and links. Blank fields are omitted rather than filled
with placeholders. Long-form sections (architecture, results, limitations) are
written afterwards by editing `content/projects.yml`.

### `add-paper`

```bash
npm run portfolio -- add-paper
```

Give it an arXiv ID or a DOI and it fetches the title, authors, abstract and
publication date for you to confirm — or enter everything by hand.

**Status is always asked, never inferred.** A BibTeX entry naming a venue is not
evidence of acceptance.

Sets `lastVerified` to today and records where the metadata came from.

### `add-hackathon`

```bash
npm run portfolio -- add-hackathon
```

Prompts for hackathon name, project, date, problem, what it does, technologies,
and links. YouTube URLs are accepted in any common shape — `youtu.be/…`,
`watch?v=…`, `/embed/…`, `/shorts/…`, `/live/…`, or a bare 11-character id — and
the video id is extracted for the privacy-preserving embed.

An award is recorded **only** if you confirm one was actually received, and it
is stored with `awardVerified: true`. Unverified awards are never displayed.

If the repository URL points at something not publicly readable, it is marked
`repositoryPrivate: true` so the site says so instead of linking to a 404.

---

## Curate

### `link-paper-code`

```bash
npm run portfolio -- link-paper-code <paper-id> <owner/repo> [relationship]
```

`relationship` is one of `implementation` (default), `experiments`, `dataset`,
`analysis`, `demo`.

Checks that the paper id exists in `publications.yml`, and that the repository
exists and is publicly readable, before writing to `research-links.yml`. A
private repository is recorded as unverified; a missing one prompts before
recording anything. Accepts a full GitHub URL as well as `owner/repo`.

Mappings are never inferred from name similarity — that is the entire point of
keeping them in an explicit file.

```bash
npm run portfolio -- link-paper-code intent-classification-41-models ParishruthiGanesh/intent-eval
```

### `feature-repo` / `hide-repo`

```bash
npm run portfolio -- feature-repo sentinel-memory
npm run portfolio -- hide-repo Demo-repo
```

`feature-repo` sets `featured: true` and clears `hidden`. `hide-repo` sets
`hidden: true` and clears `featured`; the repository disappears from the public
list but keeps all of its synchronised metadata, so un-hiding restores it
intact. Both create the override entry if it does not exist yet.

To remove a repository from the list entirely, add its name to
`github.exclude` in `repositories-overrides.yml`.

### `update-resume`

```bash
npm run portfolio -- update-resume ~/Downloads/Parishruthi_Ganesh_Resume.pdf
```

Checks the file exists, has a `.pdf` extension, **and actually begins with a
`%PDF-` header** (a renamed file is rejected). Copies it to the path in
`profile.yml`, sets `resume.lastUpdated` to today, and prints the resulting file
size.

The Resume page's inline preview and download button both read that path, so
both update at once. Remember to update `education.yml`, `experience.yml` and
`skills.yml` too — the HTML resume should never drift from the PDF.

### `set-photo`

```bash
npm run portfolio -- set-photo ~/Pictures/headshot.jpg
```

Converts the image to WebP (capped at 960px wide, quality 82), honours EXIF
orientation so a phone photo is not sideways, writes it to
`public/images/profile/`, and sets `avatar` in `profile.yml`.

The portrait then appears on the home hero and in the About sidebar. Both slots
crop to **4:5**, so a portrait-shaped photo works best — the command warns if
you hand it a landscape one.

Removing the `avatar` line removes the photo from both pages cleanly: neither
shows a placeholder or leaves a gap.

### `add-image`

```bash
npm run portfolio -- add-image astranova ~/Pictures/astranova.png "Alt text describing the image"
```

Converts and installs the image under `public/images/projects/<project-id>/`,
then appends it to that project's `screenshots`. The **first** image for a
project also becomes its card thumbnail on `/projects`.

Alt text is required and must be longer than 25 characters — it is prompted for
if not passed, and rejected if too short. A screenshot nobody can describe is
one a screen-reader user cannot see at all, and the schema enforces the same
rule for hand edits.

You are also prompted for an optional caption, shown beneath the image.

---

## Ship

### `build`

```bash
npm run portfolio -- build
npm run portfolio -- build --no-sync
```

Sync → validate → test → build, stopping at the first failure. A sync problem is
a warning (the build continues with existing synchronised data); a validation or
test failure stops the build.

### `publish`

```bash
npm run portfolio -- publish
```

Runs `build`, then shows `git status`, highlights how many files would be
**deleted**, names the current branch, and asks for confirmation before
committing and pushing. Answering no leaves the working tree exactly as it was.

It will not push anything without an explicit yes, and it never force-pushes.

---

## `ask` — plain-English shortcut

```bash
npm run portfolio -- ask "what still needs my attention?"
npm run portfolio -- ask "add my Sentinel Memory YouTube demo"
npm run portfolio -- ask "hide the repo ParishruthiGanesh/Demo-repo"
```

Maps a request onto one of the commands above using local keyword matching.
**No API key, no network call, no LLM.** It always prints the command it
resolved to and asks before running it, and it returns "could not map that"
rather than guessing.

The deterministic commands are the real interface; `ask` exists for
discoverability.

---

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Success, or advisory-only findings (a `linkcheck` without `--strict`) |
| `1` | Validation failure, integrity problem, a fetch error, or a rejected addition |
