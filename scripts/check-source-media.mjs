import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
const result = spawnSync('git', ['ls-files', '--', 'source-materials'], { encoding: 'utf8' });
const files =
  result.status === 0
    ? result.stdout.split('\n').filter(Boolean)
    : existsSync('source-materials')
      ? readdirSync('source-materials').map((v) => 'source-materials/' + v)
      : [];
const originals = files.filter((v) => v !== 'source-materials/README.md');
if (originals.length) {
  console.error(
    'Unreviewed source originals must not be tracked or packaged. Preserve them in restricted storage and follow docs/UPGRADE-DEEP-REPAIRS.md.',
  );
  process.exitCode = 1;
}
if (existsSync('package-lock.json')) {
  console.error('Remove the obsolete package-lock.json; use the pinned pnpm lockfile.');
  process.exitCode = 1;
}
