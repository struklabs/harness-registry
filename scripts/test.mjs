import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { Script, createContext } from 'node:vm';
import { root } from './build-index.mjs';
import { validateSchema } from './schema.mjs';

async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'harness-catalog-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  for (const path of ['scripts', 'schemas', 'tools', 'skills', 'mcp', 'index.schema.json', 'index.json']) {
    await cp(new URL(path, root), join(dir, path), { recursive: true });
  }
  return dir;
}
function cli(dir, script = 'validate') {
  return spawnSync(process.execPath, [join(dir, `scripts/${script}.mjs`)], { cwd: tmpdir(), encoding: 'utf8' });
}
async function edit(dir, path, fn) {
  const file = join(dir, path);
  const value = JSON.parse(await readFile(file, 'utf8'));
  fn(value);
  await writeFile(file, JSON.stringify(value));
}

test('build is deterministic and independent of cwd; validate does not rewrite stale index', async t => {
  const dir = await fixture(t);
  const expected = await readFile(join(dir, 'index.json'), 'utf8');
  assert.equal(cli(dir, 'build-index').status, 0);
  assert.equal(await readFile(join(dir, 'index.json'), 'utf8'), expected);
  assert.equal(cli(dir).status, 0);
  await writeFile(join(dir, 'index.json'), '{}\n');
  const result = cli(dir);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /stale/u);
  assert.equal(await readFile(join(dir, 'index.json'), 'utf8'), '{}\n');
});

for (const [name, path, mutate, message] of [
  ['missing Turkish description', 'skills/release-notes/catalog.json', e => { delete e.description.tr; }, /missing tr/u],
  ['corrupted Turkish text', 'tools/json_format/catalog.json', e => { e.description.tr = 'do?rular'; }, /looks corrupted/u],
  ['unofficial publisher', 'tools/json_format/catalog.json', e => { e.publisher = 'Community'; }, /StrukLabs/u],
  ['unknown metadata', 'tools/json_format/catalog.json', e => { e.unknown = true; }, /unknown property/u],
  ['permission mismatch', 'tools/json_format/manifest.json', e => { e.permissions.fs.read = ['.']; }, /permissions differ/u],
  ['URL as network host', 'tools/json_format/catalog.json', e => { e.permissions.network = ['https:\/\/example.com']; }, /permissions.network/u],
  ['parent traversal', 'tools/json_format/manifest.json', e => { e.entry = '../escape.js'; }, /invalid package file/u],
  ['encoded traversal is treated as a literal filename', 'tools/json_format/manifest.json', e => { e.entry = '%2e%2e/catalog.json'; }, /ENOENT/u],
  ['missing artifact', 'tools/json_format/manifest.json', e => { e.entry = 'missing.js'; }, /ENOENT/u],
  ['bad MCP transport', 'mcp/microsoft-learn/config.json', e => { e.mcpServers['microsoft-learn'].transport = 'websocket'; }, /matching variant/u],
  ['MCP host mismatch', 'mcp/microsoft-learn/config.json', e => { e.mcpServers['microsoft-learn'].url = 'https://other.com/mcp'; }, /permission mismatch/u],
  ['bad id', 'skills/release-notes/catalog.json', e => { e.id = 'struklabs.skill.other'; }, /id must be/u]
]) {
  test(`reject ${name}`, async t => {
    const dir = await fixture(t);
    await edit(dir, path, mutate);
    const result = cli(dir, 'build-index');
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stderr, message);
  });
}

test('reject incomplete entry directories and empty skill instructions', async t => {
  const dir = await fixture(t);
  await rm(join(dir, 'tools/json_format/catalog.json'));
  assert.equal(cli(dir).status, 1);
  await writeFile(join(dir, 'skills/release-notes/SKILL.md'), '---\nname: "release-notes"\n---\n');
  const result = cli(dir);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /frontmatter and instructions/u);
});

test('reject unsupported schema keywords', async () => {
  await assert.rejects(validateSchema({}, new URL('index.schema.json', root), '$', { madeUpKeyword: true }), /Unsupported schema keyword/u);
});

test('formatter passes shipped Harness cases in a plain JavaScript context', async () => {
  const source = await readFile(new URL('tools/json_format/index.js', root), 'utf8');
  const cases = await readFile(new URL('tools/json_format/test.js', root), 'utf8');
  // Node VM is a portability smoke test, not a substitute for Harness QuickJS.
  const results = new Script(source + '\n' + cases + `\ncases.map(c => {
    try { return { name: c.name, actual: run(c.args), expect: c.expect }; }
    catch (error) { return { name: c.name, error: error.message, expect: c.expect }; }
  })`).runInContext(createContext({}), { timeout: 1000 });
  for (const result of results) {
    if (result.expect.error) {
      assert.ok(result.error, result.name);
      if (typeof result.expect.error === 'string') assert.ok(result.error.includes(result.expect.error), result.name);
    } else {
      assert.equal(result.error, undefined, result.name);
      assert.equal(result.actual, result.expect.equals, result.name);
    }
  }
});
