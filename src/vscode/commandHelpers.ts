import {
  assessToken,
  findCandidateTokens,
  CandidateToken,
  RecognizedToken
} from '../core/index';

export interface ClaimSummary {
  icon: string;
  name: string;
  value: string;
}

/**
 * Extracts human-readable claim summaries from an assessed token.
 */
export function extractClaimSummaries(assessment: RecognizedToken): ClaimSummary[] {
  const summaries: ClaimSummary[] = [];
  if (assessment.subject) {
    summaries.push({ icon: 'person', name: 'Subject (sub)', value: assessment.subject });
  }
  if (assessment.roles.length > 0) {
    summaries.push({ icon: 'shield', name: 'Roles', value: assessment.roles.join(', ') });
  }
  if (assessment.issuer) {
    summaries.push({ icon: 'globe', name: 'Issuer (iss)', value: assessment.issuer });
  }
  if (assessment.audience) {
    const audStr = Array.isArray(assessment.audience) ? assessment.audience.join(', ') : assessment.audience;
    summaries.push({ icon: 'organization', name: 'Audience (aud)', value: audStr });
  }
  if (assessment.expiresAtIso) {
    summaries.push({ icon: 'clock', name: 'Expiration (exp)', value: assessment.expiresAtIso });
  }
  return summaries;
}

/**
 * Resolves the target candidate token for a given line text and cursor column.
 */
export function resolveTokenAtPosition(
  lineText: string,
  character: number
): CandidateToken | undefined {
  const candidates = findCandidateTokens(lineText);
  if (candidates.length === 0) {
    return undefined;
  }
  const target = candidates.find(
    (c) => character >= c.startIndex && character <= c.endIndex
  );
  return target ?? candidates[0];
}

/**
 * Resolves a valid recognized token from arbitrary text (direct or embedded like "Bearer ...").
 */
export function resolveTokenFromText(
  text: string,
  nowEpoch: number
): { raw: string; assessment: RecognizedToken } | undefined {
  const trimmed = text.trim();
  if (!trimmed) {
    return undefined;
  }
  const directAssessment = assessToken(trimmed, nowEpoch);
  if (directAssessment.recognized) {
    return { raw: trimmed, assessment: directAssessment };
  }
  const candidates = findCandidateTokens(trimmed);
  const first = candidates[0];
  if (first) {
    const candidateAssessment = assessToken(first.raw, nowEpoch);
    if (candidateAssessment.recognized) {
      return { raw: first.raw, assessment: candidateAssessment };
    }
  }
  return undefined;
}

/**
 * Opens formatted decoded header and payload JSON in a new untitled document tab.
 */
export async function openDecodedTokenInEditor(
  rawToken: string,
  assessment: RecognizedToken,
  vscodeRef: typeof import('vscode')
): Promise<void> {
  const { parseJwt } = await import('../core/index');
  const parsed = parseJwt(rawToken);
  if (!('reason' in parsed)) {
    const content = JSON.stringify(
      {
        _summary: {
          algorithm: assessment.algorithm,
          temporalStatus: assessment.temporalStatus,
          expiresAtIso: assessment.expiresAtIso,
          secondsUntilExpiration: assessment.secondsUntilExpiration,
          subject: assessment.subject,
          issuer: assessment.issuer,
          audience: assessment.audience,
          roles: assessment.roles
        },
        header: parsed.header,
        payload: parsed.payload
      },
      null,
      2
    );
    const doc = await vscodeRef.workspace.openTextDocument({
      language: 'json',
      content
    });
    await vscodeRef.window.showTextDocument(doc, { preview: true });
  }
}

