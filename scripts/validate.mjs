import { readFile } from 'node:fs/promises';
import { buildIndex, root } from './build-index.mjs';
import { serialize } from './schema.mjs';

try {
  const index = await buildIndex();
  const actual = await readFile(new URL('index.json', root), 'utf8');
  if (actual !== serialize(index)) throw new Error('index.json is stale. Run node scripts/build-index.mjs and commit the result.');
  console.log(`Valid catalog: ${index.entries.length} entries; index.json is current.`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
