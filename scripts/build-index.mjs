import { lstat, readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { canonical, serialize, validateSchema } from './schema.mjs';

export const root = new URL('../', import.meta.url);
const schema = name => new URL(name, root);
const check = (condition, message) => { if (!condition) throw new Error(message); };
const safePath = value => typeof value === 'string' && value.length > 0 &&
  !/[\\:\u0000]/u.test(value) && !value.startsWith('/') &&
  value.split('/').every(part => part !== '..');

async function regularFile(path, maxBytes = 512 * 1024) {
  check(safePath(path), `Unsafe path: ${path}`);
  const parts = path.split('/');
  for (let i = 1; i <= parts.length; i++) {
    const stat = await lstat(join(fileURLToPath(root), ...parts.slice(0, i)));
    check(!stat.isSymbolicLink(), `Symlink is not allowed: ${path}`);
    if (i === parts.length) check(stat.isFile() && stat.size <= maxBytes, `Missing or oversized file: ${path}`);
  }
  return readFile(join(fileURLToPath(root), ...parts), 'utf8');
}

export function checkPermissions(p) {
  for (const domain of p.network) {
    const host = domain.replace(/^\*\./u, '');
    check(host.length <= 253 && host.split('.').every(label =>
      label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/u.test(label)), `Invalid network host: ${domain}`);
  }
  for (const scope of [...p.fs.read, ...p.fs.write]) check(safePath(scope), `Invalid workspace scope: ${scope}`);
}

async function checkPayload(entry, dir) {
  const p = entry.permissions;
  checkPermissions(p);
  const expected = entry.type === 'tool' ? dir : `${dir}/${entry.type === 'skill' ? 'SKILL.md' : 'config.json'}`;
  check(entry.artifact === expected, `${entry.id}: artifact must be ${expected}`);
  if (entry.type === 'tool') {
    const m = JSON.parse(await regularFile(`${dir}/manifest.json`));
    await validateSchema(m, schema('schemas/tool-package.schema.json'), `${dir}/manifest.json`);
    checkPermissions(m.permissions);
    check(m.name === dir.split('/')[1] && m.version === entry.version, `${dir}: package name/version mismatch`);
    check(serialize(m.permissions) === serialize(p), `${dir}: catalog and runtime permissions differ`);
    for (const file of [m.entry, m.test].filter(v => v !== undefined)) {
      check(safePath(file) && file !== 'manifest.json', `${dir}: invalid package file ${file}`);
      await regularFile(`${dir}/${file}`);
    }
  } else if (entry.type === 'skill') {
    const text = await regularFile(entry.artifact);
    const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]+)$/u.exec(text);
    check(match, `${dir}: SKILL.md needs frontmatter and instructions`);
    // Catalog skills use a documented flat YAML subset; no dependency on a YAML parser.
    const metadata = {};
    for (const line of match[1].split(/\r?\n/u)) {
      const field = /^(name|description|license|compatibility): (.+)$/u.exec(line);
      check(field && !Object.hasOwn(metadata, field[1]), `${dir}: unsupported or duplicate frontmatter field`);
      const raw = field[2];
      check(raw.startsWith('"'), `${dir}: frontmatter values must be JSON-quoted YAML strings`);
      metadata[field[1]] = JSON.parse(raw);
      check(typeof metadata[field[1]] === 'string', `${dir}: frontmatter must contain strings`);
    }
    check(metadata.name === dir.split('/')[1] && metadata.name.length <= 64 &&
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(metadata.name), `${dir}: invalid skill name`);
    check(metadata.description === entry.description.en && metadata.description.length <= 1024 &&
      metadata.license === entry.license && match[2].trim().length > 0, `${dir}: skill metadata mismatch or empty instructions`);
    if (metadata.compatibility) check(metadata.compatibility.length <= 500, `${dir}: compatibility too long`);
    check(p.network.length === 0 && p.fs.read.length === 0 && p.fs.write.length === 0, `${dir}: instruction-only skills declare no runtime capabilities`);
  } else {
    const config = JSON.parse(await regularFile(entry.artifact));
    await validateSchema(config, schema('schemas/mcp-config.schema.json'), entry.artifact);
    const servers = Object.values(config.mcpServers);
    check(servers.length === 1, `${dir}: expected one server`);
    const server = servers[0];
    if (server.url) {
      const url = new URL(server.url);
      check(url.protocol === 'https:' && !url.username && !url.password, `${dir}: expected public HTTPS URL without credentials`);
      check(p.network.length === 1 && p.network[0] === url.hostname, `${dir}: endpoint/permission mismatch`);
    }
    check(p.fs.read.length === 0 && p.fs.write.length === 0, `${dir}: MCP file access is not sandboxed by JS permissions`);
  }
}

export async function buildIndex() {
  const entries = [];
  for (const [folder, type] of [['skills', 'skill'], ['mcp', 'mcp'], ['tools', 'tool']]) {
    for (const name of (await readdir(new URL(folder + '/', root))).sort()) {
      check(/^[a-z][a-z0-9_-]*$/u.test(name), `${folder}: invalid entry directory ${name}`);
      const dir = `${folder}/${name}`;
      const stat = await lstat(new URL(dir, root));
      check(stat.isDirectory() && !stat.isSymbolicLink(), `${dir}: expected a regular directory`);
      const entry = JSON.parse(await regularFile(`${dir}/catalog.json`));
      await validateSchema(entry, schema(`schemas/${type}.schema.json`), `${dir}/catalog.json`);
      check(entry.id === `struklabs.${type}.${name}`, `${dir}: id must be struklabs.${type}.${name}`);
      await checkPayload(entry, dir);
      entries.push(entry);
    }
  }
  entries.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  check(new Set(entries.map(e => e.id)).size === entries.length, 'Duplicate catalog id');
  const index = { schema_version: 1, entries };
  await validateSchema(index, schema('index.schema.json'));
  return canonical(index);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const index = await buildIndex();
    await writeFile(new URL('index.json', root), serialize(index));
    console.log(`Built index.json (${index.entries.length} entries).`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
