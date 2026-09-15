export interface FilterConfig {
  enabled?: boolean;
  languages?: string[];
  maxDocumentCharacters?: number;
  maxDocumentBytes?: number; // legacy fallback
  exclude?: string[];
}

export function matchesGlob(pattern: string, filePath: string): boolean {
  if (!pattern || !filePath) {
    return false;
  }

  const normalizedTarget = filePath.replace(/\\/g, '/');
  const normalizedPattern = pattern.replace(/\\/g, '/').trim();

  // Escape special regex characters except * and ?
  let regexStr = normalizedPattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '§DOUBLE_STAR§')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
    .replace(/§DOUBLE_STAR§\//g, '(?:.*/)?')
    .replace(/§DOUBLE_STAR§/g, '.*');

  try {
    const regex = new RegExp(`(^|/)${regexStr}$`, 'i');
    return regex.test(normalizedTarget);
  } catch {
    return false;
  }
}

export function isPathExcluded(normalizedPath: string, exclusions: string[]): boolean {
  if (!Array.isArray(exclusions) || exclusions.length === 0) {
    return false;
  }
  for (const pattern of exclusions) {
    if (typeof pattern === 'string' && matchesGlob(pattern, normalizedPath)) {
      return true;
    }
  }
  return false;
}

export function isEligible(
  uriString: string,
  languageId: string,
  characterCount: number,
  config: FilterConfig
): boolean {
  const isEnabled = config.enabled ?? true;
  if (!isEnabled) {
    return false;
  }

  // 1. Language check
  const languages = config.languages ?? ['*'];
  if (Array.isArray(languages) && !languages.includes('*') && !languages.includes(languageId)) {
    return false;
  }

  // 2. Document character size check (default 512,000 characters)
  const limit = config.maxDocumentCharacters ?? config.maxDocumentBytes ?? 524288;
  if (typeof limit === 'number' && limit > 0 && characterCount > limit) {
    return false;
  }

  // 3. Exclusions check
  const exclusions = config.exclude ?? [
    '**/package-lock.json',
    '**/pnpm-lock.yaml',
    '**/*.min.*',
    '**/*.map'
  ];

  const normalizedPath = uriString.replace(/\\/g, '/');
  if (isPathExcluded(normalizedPath, exclusions)) {
    return false;
  }

  return true;
}
