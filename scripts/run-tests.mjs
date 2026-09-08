import { spawnSync } from 'node:child_process';
import { globSync } from 'glob';

const files = globSync('tests/**/*.test.ts');

if (files.length === 0) {
  console.error('No test files found matching tests/**/*.test.ts');
  process.exit(1);
}

console.log('Running:', files);

const result = spawnSync('npx', ['tsx', '--test', ...files], { stdio: 'inherit', shell: true });
process.exit(result.status ?? 1);
