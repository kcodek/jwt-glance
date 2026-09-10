const MD_CHAR_REGEX = /([\\`*_{}[\]()|<>~])/g;

export function sanitizeMarkdown(input: unknown): string {
  if (input === null || input === undefined) {
    return '';
  }
  const str = typeof input === 'string' ? input : String(input);
  return str.replace(MD_CHAR_REGEX, '\\$1');
}
