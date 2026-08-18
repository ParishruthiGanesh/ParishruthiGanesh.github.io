#!/usr/bin/env tsx
/**
 * `portfolio` — the maintenance CLI for this site.
 *
 *   npm run portfolio -- <command> [options]
 *
 * Every command is deterministic and works without any API key. `ask` is a
 * convenience wrapper that maps plain English onto one of them locally.
 */
import {
  cmdStatus,
  cmdSync,
  cmdValidate,
  cmdAddProject,
  cmdAddPaper,
  cmdAddHackathon,
  cmdLinkPaperCode,
  cmdFeatureRepo,
  cmdHideRepo,
  cmdUpdateResume,
  cmdLinkCheck,
  cmdBuild,
  cmdPublish,
  cmdAsk,
} from './commands.js';
import { c } from './util.js';

const HELP = `
${c.bold('portfolio')} — maintain the content behind parishruthiganesh.github.io

${c.bold('Usage')}
  npm run portfolio -- <command> [options]

${c.bold('Inspect')}
  status                       Missing links, stale records, review queue, last sync
  validate                     Schema, duplicate ids, broken relationships, missing files
  linkcheck [--fix] [--strict] Check every external URL (--fix marks reachable ones verified)

${c.bold('Synchronise')}
  sync [--repos|--papers] [--dry-run]
                               Fetch GitHub + publication metadata, report changes

${c.bold('Add content')}
  add-project                  Add a project interactively, with validation
  add-paper                    Add a paper by arXiv ID, DOI, or by hand
  add-hackathon                Add a hackathon with repo, Devpost and YouTube links

${c.bold('Curate')}
  link-paper-code <paper-id> <owner/repo> [relationship]
                               Map a paper to its code (both sides are checked first)
  feature-repo <repository>    Mark a repository as featured
  hide-repo <repository>       Hide a repository without deleting its synced metadata
  update-resume <path.pdf>     Install a new resume PDF and record the date

${c.bold('Ship')}
  build [--no-sync]            Sync, validate, test, then build
  publish                      Build, then confirm before committing and pushing

${c.bold('Shortcut')}
  ask "<request>"              Map plain English onto one of the commands above

${c.dim('Set GITHUB_TOKEN to raise the GitHub API rate limit. See .env.example.')}
`;

export async function dispatch(command: string, argv: string[]): Promise<number> {
  switch (command) {
    case 'status':
      return cmdStatus();
    case 'sync':
      return cmdSync(argv);
    case 'validate':
      return cmdValidate();
    case 'add-project':
      return cmdAddProject();
    case 'add-paper':
      return cmdAddPaper();
    case 'add-hackathon':
      return cmdAddHackathon();
    case 'link-paper-code':
      return cmdLinkPaperCode(argv);
    case 'feature-repo':
      return cmdFeatureRepo(argv);
    case 'hide-repo':
      return cmdHideRepo(argv);
    case 'update-resume':
      return cmdUpdateResume(argv);
    case 'linkcheck':
      return cmdLinkCheck(argv);
    case 'build':
      return cmdBuild(argv);
    case 'publish':
      return cmdPublish(argv);
    case 'ask':
      return cmdAsk(argv);
    case 'help':
    case '--help':
    case '-h':
    case undefined:
      console.log(HELP);
      return 0;
    default:
      console.log(`Unknown command: ${command}`);
      console.log(HELP);
      return 1;
  }
}

async function main(): Promise<void> {
  const [command, ...argv] = process.argv.slice(2);
  try {
    process.exitCode = await dispatch(command ?? 'help', argv);
  } catch (error) {
    console.error(`\n${c.red('Error:')} ${(error as Error).message}`);
    process.exitCode = 1;
  }
}

// Only run when invoked directly, so `dispatch` stays importable from tests.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop() ?? '')) {
  void main();
}
