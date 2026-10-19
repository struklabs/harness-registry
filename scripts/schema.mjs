import { readFile } from 'node:fs/promises';

// Deliberately small JSON Schema evaluator: only the keywords used by our schemas.
// Unknown keywords fail closed so a schema edit cannot silently weaken validation.
const keywords = new Set(['$schema', '$id', '$ref', '$defs', 'title', 'description',
  'type', 'const', 'enum', 'allOf', 'oneOf', 'properties', 'required',
  'additionalProperties', 'items', 'minItems', 'maxItems', 'uniqueItems',
  'minLength', 'maxLength', 'pattern', 'minimum', 'maximum']);
const cache = new Map();
const equal = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
export function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
  }
  return value;
}
export const serialize = value => JSON.stringify(canonical(value), null, 2) + '\n';

export async function validateSchema(value, url, path = '$', schema) {
  const documentUrl = new URL(url);
  documentUrl.hash = '';
  const key = documentUrl.href;
  if (!cache.has(key)) cache.set(key, JSON.parse(await readFile(documentUrl, 'utf8')));
  if (!schema) schema = cache.get(key);
  for (const keyword of Object.keys(schema)) {
    if (!keywords.has(keyword)) throw new Error(`Unsupported schema keyword: ${keyword}`);
  }
  const fail = message => { throw new Error(`${path}: ${message}`); };
  if (schema.$ref) {
    const ref = new URL(schema.$ref, documentUrl);
    if (ref.protocol !== 'file:') fail('only local schema references are supported');
    const pointer = ref.hash.slice(1);
    ref.hash = '';
    if (!cache.has(ref.href)) cache.set(ref.href, JSON.parse(await readFile(ref, 'utf8')));
    let target = cache.get(ref.href);
    for (const part of pointer ? pointer.slice(1).split('/') : []) {
      target = target[part.replace(/~1/g, '/').replace(/~0/g, '~')];
    }
    if (!target) fail(`unresolved reference ${schema.$ref}`);
    await validateSchema(value, ref, path, target);
  }
  for (const sub of schema.allOf ?? []) await validateSchema(value, documentUrl, path, sub);
  if (schema.oneOf) {
    let matches = 0;
    const errors = [];
    for (const sub of schema.oneOf) {
      try { await validateSchema(value, documentUrl, path, sub); matches++; }
      catch (error) { errors.push(error.message); }
    }
    if (matches !== 1) fail(`expected one matching variant (${matches}); ${errors.join('; ')}`);
  }
  const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
  if (schema.type && !(schema.type === 'integer' ? Number.isInteger(value) : type === schema.type)) fail(`expected ${schema.type}`);
  if ('const' in schema && !equal(value, schema.const)) fail(`expected ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.some(item => equal(item, value))) fail('value is not in enum');
  if (type === 'object') {
    for (const name of schema.required ?? []) if (!Object.hasOwn(value, name)) fail(`missing ${name}`);
    for (const [name, item] of Object.entries(value)) {
      const sub = Object.hasOwn(schema.properties ?? {}, name) ? schema.properties[name] : schema.additionalProperties;
      if (sub === false) fail(`unknown property ${name}`);
      if (sub && sub !== true) await validateSchema(item, documentUrl, `${path}.${name}`, sub);
    }
  }
  if (type === 'string') {
    const length = [...value].length;
    if (length < (schema.minLength ?? 0) || length > (schema.maxLength ?? Infinity)) fail('invalid string length');
    if (schema.pattern && !new RegExp(schema.pattern, 'u').test(value)) fail(`must match ${schema.pattern}`);
  }
  if (type === 'array') {
    if (value.length < (schema.minItems ?? 0) || value.length > (schema.maxItems ?? Infinity)) fail('invalid array length');
    if (schema.uniqueItems && value.some((v, i) => value.slice(0, i).some(item => equal(v, item)))) fail('duplicate array item');
    if (schema.items) for (let i = 0; i < value.length; i++) await validateSchema(value[i], documentUrl, `${path}[${i}]`, schema.items);
  }
  if (type === 'number' && (value < (schema.minimum ?? -Infinity) || value > (schema.maximum ?? Infinity))) fail('number outside range');
}
