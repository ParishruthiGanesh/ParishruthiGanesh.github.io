/**
 * Content-integrity tests.
 *
 * These are the guard rails that make automated synchronisation safe: if a sync
 * or a hand edit breaks a reference, duplicates an id, points at a missing file
 * or publishes an unverifiable claim, the build stops here rather than shipping.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { loadContent, checkIntegrity, loadFile, contentDir, publicDir } from '../src/lib/content.js';
import { contentFiles, externalUrlSchema, idSchema } from '../src/lib/schema.js';

const content = loadContent();

describe('schemas', () => {
  for (const [fileName, schema] of Object.entries(contentFiles)) {
    it(`content/${fileName} validates`, () => {
      expect(() => loadFile(fileName, schema)).not.toThrow();
    });
  }

  it('every content file listed in the registry exists on disk', () => {
    for (const fileName of Object.keys(contentFiles)) {
      expect(existsSync(path.join(contentDir, fileName)), `content/${fileName}`).toBe(true);
    }
  });
});

describe('cross-reference integrity', () => {
  it('has no broken relationships, duplicate ids or missing files', () => {
    const problems = checkIntegrity(content);
    expect(problems.map((p) => `${p.file} ${p.path}: ${p.message}`)).toEqual([]);
  });
});

describe('duplicate identifiers', () => {
  const collections: Array<[string, Array<{ id: string }>]> = [
    ['publications', content.publications],
    ['projects', content.projects],
    ['hackathons', content.hackathons],
    ['research themes', content.research],
    ['education', content.education],
    ['experience', content.experience],
    ['skills', content.skills],
    ['current work', content.currentWork.items],
    ['review items', content.reviewItems],
  ];

  for (const [name, items] of collections) {
    it(`${name} ids are unique`, () => {
      const ids = items.map((item) => item.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it(`${name} ids are valid slugs`, () => {
      for (const item of items) {
        expect(idSchema.safeParse(item.id).success, `${name}: ${item.id}`).toBe(true);
      }
    });
  }

  it('repository override names are unique', () => {
    const names = content.overrides.repositories.map((repo) => repo.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('URL validity', () => {
  /** Collect every URL the site would render. */
  function everyUrl(): string[] {
    const urls: string[] = [];
    for (const value of Object.values(content.profile.links)) if (value) urls.push(value);
    if (content.profile.affiliationUrl) urls.push(content.profile.affiliationUrl);
    for (const entry of content.education) if (entry.institutionUrl) urls.push(entry.institutionUrl);
    for (const entry of content.experience) if (entry.organizationUrl) urls.push(entry.organizationUrl);
    for (const pub of content.publications) {
      for (const field of ['paperUrl', 'codeUrl', 'projectUrl', 'datasetUrl', 'slidesUrl', 'posterUrl', 'videoUrl'] as const) {
        const value = pub[field];
        if (value) urls.push(value);
      }
    }
    for (const project of content.projects) {
      for (const link of Object.values(project.links)) if (link) urls.push(link.url);
    }
    for (const hackathon of content.hackathons) {
      if (hackathon.hackathonUrl) urls.push(hackathon.hackathonUrl);
      for (const link of Object.values(hackathon.links)) if (link) urls.push(link.url);
    }
    return urls;
  }

  it('every URL is an absolute http(s) or mailto URL', () => {
    for (const value of everyUrl()) {
      expect(externalUrlSchema.safeParse(value).success, value).toBe(true);
    }
  });

  it('no URL uses a dangerous scheme', () => {
    for (const value of everyUrl()) {
      expect(/^\s*(javascript|data|vbscript):/i.test(value), value).toBe(false);
    }
  });

  it('every URL is served over HTTPS', () => {
    for (const value of everyUrl()) {
      if (value.startsWith('mailto:')) continue;
      expect(value.startsWith('https://'), `${value} should use https`).toBe(true);
    }
  });
});

describe('paper-to-code relationships', () => {
  it('every mapping points at an existing publication', () => {
    const ids = new Set(content.publications.map((pub) => pub.id));
    for (const link of content.researchLinks) {
      expect(ids.has(link.paper), `unknown paper "${link.paper}"`).toBe(true);
    }
  });

  it('every mapping names an owner/repository pair', () => {
    for (const link of content.researchLinks) {
      expect(/^[\w.-]+\/[\w.-]+$/.test(link.repository), link.repository).toBe(true);
    }
  });

  it('a paper is not mapped to the same repository twice', () => {
    const seen = new Set<string>();
    for (const link of content.researchLinks) {
      const key = `${link.paper}::${link.repository}`;
      expect(seen.has(key), `duplicate mapping ${key}`).toBe(false);
      seen.add(key);
    }
  });
});

describe('resume', () => {
  it('the PDF referenced by profile.yml exists', () => {
    const resumePath = path.join(publicDir, content.profile.resume.path.replace(/^\//, ''));
    expect(existsSync(resumePath), resumePath).toBe(true);
  });

  it('the file really is a PDF', () => {
    const resumePath = path.join(publicDir, content.profile.resume.path.replace(/^\//, ''));
    const header = readFileSync(resumePath).subarray(0, 5).toString('latin1');
    expect(header).toBe('%PDF-');
  });

  it('the recorded update date is not in the future', () => {
    expect(Date.parse(content.profile.resume.lastUpdated)).toBeLessThanOrEqual(Date.now() + 86_400_000);
  });
});

describe('screenshots', () => {
  it('every referenced image exists in public/', () => {
    const images = [
      ...content.projects.flatMap((project) => project.screenshots),
      ...content.hackathons.flatMap((hackathon) => hackathon.screenshots),
    ];
    for (const shot of images) {
      expect(existsSync(path.join(publicDir, shot.src.replace(/^\//, ''))), shot.src).toBe(true);
    }
  });

  it('every image has descriptive alt text', () => {
    const images = [
      ...content.projects.flatMap((project) => project.screenshots),
      ...content.hackathons.flatMap((hackathon) => hackathon.screenshots),
    ];
    for (const shot of images) {
      // "Screenshot of X" alone is not descriptive; require real content.
      expect(shot.alt.length, shot.src).toBeGreaterThan(25);
    }
  });
});

describe('evidence discipline', () => {
  it('citation counts always carry a source and a retrieval date', () => {
    for (const pub of content.publications) {
      if (pub.citations !== undefined) {
        expect(pub.citationsRetrievedFrom, pub.id).toBeTruthy();
        expect(pub.citationsRetrievedAt, pub.id).toBeTruthy();
      }
    }
  });

  it('an unverified hackathon award is never displayable', () => {
    for (const hackathon of content.hackathons) {
      if (hackathon.award) expect(hackathon.awardVerified, hackathon.id).toBe(true);
    }
  });

  it('every publication records where its metadata came from', () => {
    for (const pub of content.publications) {
      expect(pub.sources.length, pub.id).toBeGreaterThan(0);
    }
  });

  it('a private repository is never presented as a verified link', () => {
    for (const hackathon of content.hackathons) {
      if (hackathon.repositoryPrivate && hackathon.links.repo) {
        expect(hackathon.links.repo.verified, hackathon.id).toBe(false);
      }
    }
  });
});

describe('privacy', () => {
  const allText = Object.keys(contentFiles)
    .map((fileName) => readFileSync(path.join(contentDir, fileName), 'utf8'))
    .join('\n');

  it('no telephone number is published', () => {
    // The resume carries a US phone number; it must not reach the site.
    expect(/\+?1?\s*\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/.test(allText)).toBe(false);
  });

  it('no street address is published', () => {
    expect(/\b\d{1,5}\s+[A-Z][a-z]+\s+(Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Court|Ct)\b/.test(allText)).toBe(
      false,
    );
  });

  it('no API token or secret is present in content files', () => {
    expect(/\b(gh[pousr]_[A-Za-z0-9]{16,}|sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16})\b/.test(allText)).toBe(false);
  });
});

describe('unsupported-claim guard', () => {
  /** Superlatives that a research portfolio cannot support with evidence. */
  const BANNED = [
    'world-class',
    'world class',
    'cutting-edge expert',
    'industry-leading',
    'best-in-class',
    'unparalleled',
    'revolutionary',
    'guru',
    'ninja',
    '10x engineer',
  ];

  it('no unsupported superlatives appear in content', () => {
    const text = Object.keys(contentFiles)
      .map((fileName) => readFileSync(path.join(contentDir, fileName), 'utf8').toLowerCase())
      .join('\n');
    for (const phrase of BANNED) {
      expect(text.includes(phrase), `found "${phrase}"`).toBe(false);
    }
  });
});
