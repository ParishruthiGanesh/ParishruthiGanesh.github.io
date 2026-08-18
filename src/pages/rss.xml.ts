/**
 * RSS feed of updates: publications, projects and hackathons, newest first.
 * Lets collaborators follow new work without checking the site.
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
      link: url(`/publications/${pub.id}`),
      pubDate: new Date(`${pub.year}-01-01T00:00:00Z`),
      categories: ['Publication', ...pub.researchAreas],
    })),
    ...projects.map((project) => ({
      title: project.name,
      description: project.tagline,
      link: url(`/projects/${project.id}`),
      pubDate: new Date(`${project.year ?? new Date().getFullYear()}-01-01T00:00:00Z`),
      categories: ['Project', ...project.researchAreas],
    })),
    ...hackathons.map((hackathon) => ({
      title: `${hackathon.projectName} — ${hackathon.hackathon}`,
      description: hackathon.tagline,
      link: url(`/hackathons#${hackathon.id}`),
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
