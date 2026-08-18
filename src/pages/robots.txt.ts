import type { APIContext } from 'astro';

/** Allow everything, and point crawlers at the sitemap. */
export function GET(context: APIContext) {
  const sitemap = new URL('sitemap-index.xml', context.site ?? 'https://parishruthiganesh.github.io').href;
  return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${sitemap}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
