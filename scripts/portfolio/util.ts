/** Shared helpers for the `portfolio` CLI: colours, prompts and YAML writing. */
import { createInterface } from 'node:readline/promises';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { stringify as stringifyYaml, parse as parseYaml } from 'yaml';
import { contentDir } from '../../src/lib/content.js';

const ESC = '\u001b[';
const useColour = process.stdout.isTTY && process.env.NO_COLOR === undefined;
const wrap = (code: string) => (text: string) =>
  useColour ? `${ESC}${code}m${text}${ESC}0m` : text;

export const c = {
  bold: wrap('1'),
  dim: wrap('2'),
  red: wrap('31'),
  green: wrap('32'),
  yellow: wrap('33'),
  blue: wrap('34'),
  cyan: wrap('36'),
};

export const symbols = {
  ok: c.green('✓'),
  warn: c.yellow('!'),
  fail: c.red('✗'),
  info: c.blue('·'),
};

export function heading(text: string): void {
  console.log(`\n${c.bold(text)}\n${c.dim('─'.repeat(Math.min(text.length, 60)))}`);
}

/** Interactive prompt. Returns `fallback` when stdin is not a TTY. */
export async function ask(
  question: string,
  options: { required?: boolean; fallback?: string; default?: string } = {},
): Promise<string> {
  if (!process.stdin.isTTY) {
    if (options.fallback !== undefined) return options.fallback;
    throw new Error(
      `"${question}" needs an interactive terminal. Run this command from a shell, ` +
        `or edit content/*.yml directly.`,
    );
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    for (;;) {
      const suffix = options.default ? c.dim(` [${options.default}]`) : '';
      const answer = (await rl.question(`${c.cyan('?')} ${question}${suffix} `)).trim();
      const value = answer || options.default || '';
      if (value || !options.required) return value;
      console.log(c.yellow('  This field is required.'));
    }
  } finally {
    rl.close();
  }
}

export async function askList(question: string, hint = 'comma-separated'): Promise<string[]> {
  const answer = await ask(`${question} ${c.dim(`(${hint})`)}`, { fallback: '' });
  return answer
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

export async function confirm(question: string, fallback = false): Promise<boolean> {
  if (!process.stdin.isTTY) return fallback;
  const answer = await ask(`${question} ${c.dim('(y/N)')}`, { fallback: fallback ? 'y' : 'n' });
  return /^y(es)?$/i.test(answer);
}

/** Turn a title into a slug that satisfies `idSchema`. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '');
}

export function contentPath(fileName: string): string {
  return path.join(contentDir, fileName);
}

export function readContentFile<T = unknown>(fileName: string): T {
  return parseYaml(readFileSync(contentPath(fileName), 'utf8')) as T;
}

/**
 * Rewrite a YAML content file, preserving the leading comment block so the
 * guidance at the top of each file survives CLI edits.
 */
export function writeContentFile(fileName: string, data: unknown): void {
  const filePath = contentPath(fileName);
  const existing = readFileSync(filePath, 'utf8');
  const header = existing.match(/^(#[^\n]*\n)+/)?.[0] ?? '';
  const body = stringifyYaml(data, { lineWidth: 88 });
  writeFileSync(filePath, `${header}${header ? '\n' : ''}${body}`);
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function relativeTime(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return 'unknown';
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}
