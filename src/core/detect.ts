export const MAX_TOKEN_LENGTH = 8192;

export interface CandidateToken {
  raw: string;
  startIndex: number;
  endIndex: number;
}

// Regex matching candidate 2- or 3-segment dot-separated strings
// Allows 2 segments (signature omitted) or 3 segments (including empty 3rd segment for alg: none)
const CANDIDATE_REGEX = /(?:^|[^A-Za-z0-9_.-])([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]*)?)(?=[^A-Za-z0-9_.-]|$)/g;

export function findCandidateTokens(text: string): CandidateToken[] {
  if (!text || text.length === 0) {
    return [];
  }

  const results: CandidateToken[] = [];
  CANDIDATE_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = CANDIDATE_REGEX.exec(text)) !== null) {
    const rawMatch = match[1];
    if (!rawMatch) {
      continue;
    }

    // Discard candidates that exceed the sanity length limit
    if (rawMatch.length > MAX_TOKEN_LENGTH) {
      continue;
    }

    // Verify it contains 2 or 3 segments
    const segments = rawMatch.split('.');
    if (segments.length !== 2 && segments.length !== 3) {
      continue;
    }

    // Ensure first two segments are non-empty
    if (!segments[0] || !segments[1]) {
      continue;
    }

    // Calculate exact start index of the captured group
    const prefixLength = match[0].length - rawMatch.length;
    const startIndex = match.index + prefixLength;
    const endIndex = startIndex + rawMatch.length;

    results.push({
      raw: rawMatch,
      startIndex,
      endIndex
    });
  }

  return results;
}
