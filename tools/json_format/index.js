function run(args) {
  if (!args || typeof args.text !== 'string') throw new Error('text must be a JSON string');
  const indent = args.indent === undefined ? 2 : args.indent;
  if (!Number.isInteger(indent) || indent < 0 || indent > 8) throw new Error('indent must be an integer from 0 to 8');
  if (args.sort_keys !== undefined && typeof args.sort_keys !== 'boolean') throw new Error('sort_keys must be a boolean');
  const value = JSON.parse(args.text);
  function sort(item) {
    if (Array.isArray(item)) return item.map(sort);
    if (item !== null && typeof item === 'object') {
      const result = Object.create(null);
      Object.keys(item).sort().forEach(key => { result[key] = sort(item[key]); });
      return result;
    }
    return item;
  }
  return JSON.stringify(args.sort_keys ? sort(value) : value, null, indent);
}
