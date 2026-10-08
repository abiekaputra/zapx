import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import process from 'node:process';

const root = process.cwd();
const productionLimit = 300;
const testLimit = 1000;
const sourceExtensions = new Set(['.cjs', '.js', '.jsx', '.mjs', '.ts', '.tsx']);
const ignoredDirectories = new Set(['.git', 'coverage', 'dist', 'node_modules']);
const violations = [];

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await walk(path);
      continue;
    }
    if (!sourceExtensions.has(extname(entry.name))) continue;
    const contents = await readFile(path, 'utf8');
    const lines = contents.split(/\r?\n/u).length;
    const isTest = /(?:^|\/)(?:__tests__|test|tests)(?:\/|$)|\.(?:spec|test)\.[^.]+$/u.test(
      relative(root, path),
    );
    const limit = isTest ? testLimit : productionLimit;
    if (lines > limit) violations.push(`${relative(root, path)}: ${lines}/${limit}`);
  }
}

await walk(root);

if (violations.length > 0) {
  process.stderr.write(`File length limits failed:\n${violations.join('\n')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write('File length limits passed.\n');
}
