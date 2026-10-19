const cases = [
  { name: 'pretty-print', args: { text: '{"ok":true}' }, expect: { equals: '{\n  "ok": true\n}' } },
  { name: 'recursive-sort-and-compact', args: { text: '{"z":[{"b":2,"a":1}],"a":null}', indent: 0, sort_keys: true }, expect: { equals: '{"a":null,"z":[{"a":1,"b":2}]}' } },
  { name: 'preserve-prototype-key', args: { text: '{"__proto__":{"x":1}}', indent: 0, sort_keys: true }, expect: { equals: '{"__proto__":{"x":1}}' } },
  { name: 'invalid-json', args: { text: '{' }, expect: { error: true } },
  { name: 'invalid-indent', args: { text: '{}', indent: 9 }, expect: { error: 'indent must be an integer' } }
];
