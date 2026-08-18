/**
 * Internal URL construction.
 *
 * Everything routes through here so the site keeps working if `base` in
 * astro.config.mjs ever changes (a move from a user site to a project page).
 */
const BASE = import.meta.env.BASE_URL || '/';

/** Build an internal path honouring the configured base. */
export function url(pathname: string): string {
  const clean = pathname.replace(/^\/+/, '');
  const base = BASE.endsWith('/') ? BASE : `${BASE}/`;
  return clean ? `${base}${clean}` : base;
}

/** Absolute URL, for canonical tags, Open Graph and structured data. */
export function absoluteUrl(pathname: string, site: URL | undefined): string {
  const path = url(pathname);
  return site ? new URL(path, site).href : path;
}

/** Is `href` the current page (or an ancestor of it)? Used for nav state. */
export function isActive(href: string, pathname: string): boolean {
  const normalise = (value: string) => `/${value.replace(/^\/+|\/+$/g, '')}`;
  const target = normalise(href);
  const current = normalise(pathname);
  if (target === '/') return current === '/' || current === normalise(BASE);
  return current === target || current.startsWith(`${target}/`);
}
