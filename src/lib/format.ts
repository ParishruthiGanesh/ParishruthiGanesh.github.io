/** Presentation helpers shared across components. */
import { marked } from 'marked';

marked.setOptions({ gfm: true, breaks: false });

/**
 * Render a markdown string from a YAML content field.
 *
 * Content files are authored in this repository and reviewed through pull
 * requests, so this is trusted input. Anything arriving from an external API
 * (GitHub descriptions, sync results) is rendered as escaped text instead —
 * see `escapeHtml` below and its use in the repository components.
 */
export function md(source: string | undefined | null): string {
  if (!source) return '';
  return marked.parse(source.trim(), { async: false }) as string;
}

/** Inline markdown — no wrapping paragraph. */
export function mdInline(source: string | undefined | null): string {
  if (!source) return '';
  return marked.parseInline(source.trim(), { async: false }) as string;
}

/** Escape untrusted text before it reaches an HTML context. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** `2025-08` → `August 2025`; `present` → `Present`. */
export function formatMonth(value: string): string {
  if (value === 'present') return 'Present';
  const [year, month] = value.split('-');
  const index = Number(month) - 1;
  return `${MONTHS[index] ?? month} ${year}`;
}

export function formatRange(start: string, end: string): string {
  return `${formatMonth(start)} – ${formatMonth(end)}`;
}

/** `2026-08-18` → `18 August 2026`. */
export function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${Number(day)} ${MONTHS[Number(month) - 1] ?? month} ${year}`;
}

/** A compact form for card metadata: `Aug 2026`. */
export function formatShortDate(iso: string): string {
  const [year, month] = iso.split('-');
  return `${(MONTHS[Number(month) - 1] ?? '').slice(0, 3)} ${year}`;
}

export function relativeDate(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  if (days < 60) return 'last month';
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  if (days < 730) return 'last year';
  return `${Math.floor(days / 365)} years ago`;
}

/** Human labels for the publication status enum. */
export const STATUS_LABELS: Record<string, string> = {
  published: 'Published',
  accepted: 'Accepted',
  preprint: 'Preprint',
  'under-review': 'Under review',
  'in-progress': 'In progress',
};

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  maintained: 'Maintained',
  completed: 'Completed',
  prototype: 'Prototype',
  archived: 'Archived',
};

export const RESEARCH_STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  ongoing: 'Ongoing',
  exploratory: 'Exploratory',
  concluded: 'Concluded',
};

export const CURRENT_WORK_LABELS: Record<string, string> = {
  writing: 'Writing',
  experiments: 'Running experiments',
  building: 'Building',
  reviewing: 'Under review',
  reading: 'Reading',
};

export const REPO_CATEGORY_LABELS: Record<string, string> = {
  research: 'Research',
  applications: 'Applications',
  hackathons: 'Hackathons',
  'computer-vision': 'Computer Vision',
  'nlp-llm': 'NLP / LLMs',
  rag: 'RAG',
  agentic: 'Agentic Systems',
  coursework: 'Coursework & Labs',
  archived: 'Archived',
};

/** Split an author list around the portfolio owner for emphasis. */
export function authorParts(
  authors: string[],
  highlight: string | undefined,
): Array<{ name: string; isSelf: boolean }> {
  return authors.map((name) => ({ name, isSelf: Boolean(highlight) && name === highlight }));
}

/**
 * Privacy-enhanced YouTube embed URL.
 *
 * youtube-nocookie.com does not set tracking cookies until the viewer actually
 * plays the video, and the embeds are lazy-loaded, so a page with three demos
 * still costs nothing until one is played.
 */
export function youtubeEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`;
}

export function youtubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

/** Obfuscate an email against naive scrapers while keeping it selectable. */
export function splitEmail(email: string): { user: string; domain: string } {
  const [user = '', domain = ''] = email.split('@');
  return { user, domain };
}

/** Ordinal-free citation string used on publication cards and in metadata. */
export function citationLine(pub: {
  authors: string[];
  title: string;
  venue?: string;
  year: number;
}): string {
  const authors = pub.authors.join(', ');
  const venue = pub.venue ? `. ${pub.venue}` : '';
  return `${authors}. "${pub.title}"${venue}, ${pub.year}.`;
}
