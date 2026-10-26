/**
 * RSS feed of updates: publications, projects and hackathons, newest first.
 * Lets collaborators follow new work without checking the site.
 *
 * The site is a single page, so there is no per-item route to link to. Each
 * item points at the real artifact instead — the paper, the repository, the
 * demo — and falls back to the home page when an entry has no public link yet.
 */
import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { loadContent } from '../lib/content.js';
import { url } from '../lib/url.js';

export async function GET(context: APIContext) {
  const { profile, publications, projects, hackathons } = loadContent();

  const items = [
    ...publications.map((pub) => ({
      title: pub.title,
      description: pub.abstract ?? `${pub.authors.join(', ')} — ${pub.venue ?? pub.year}`,
      link: pub.paperUrl ?? url('/'),
      pubDate: new Date(`${pub.year}-01-01T00:00:00Z`),
      categories: ['Publication', ...pub.researchAreas],
    })),
    ...projects.map((project) => ({
      title: project.name,
      description: project.tagline,
      link: project.links.repo?.url ?? project.links.demo?.url ?? url('/'),
      pubDate: new Date(`${project.year ?? new Date().getFullYear()}-01-01T00:00:00Z`),
      categories: ['Project', ...project.researchAreas],
    })),
    ...hackathons.map((hackathon) => ({
      title: `${hackathon.projectName} — ${hackathon.hackathon}`,
      description: hackathon.tagline,
      link: hackathon.links.devpost?.url ?? hackathon.links.repo?.url ?? url('/'),
      pubDate: new Date(`${hackathon.date}T00:00:00Z`),
      categories: ['Hackathon'],
    })),
  ].sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());

  return rss({
    title: `${profile.name} — ${profile.headline}`,
    description: profile.shortBio,
    site: context.site ?? 'https://parishruthiganesh.github.io',
    items,
    customData: '<language>en-us</language>',
  });
}
