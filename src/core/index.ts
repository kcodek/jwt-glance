import type { TokenAssessment, RecognizedToken, SignaturePresence, TokenWarning } from './types';
import { parseJwt } from './parse';
import { evaluateTemporal } from './temporal';

export * from './types';
export * from './detect';
export * from './parse';
export * from './temporal';
export * from './sanitize';

function extractRoles(payload: Record<string, unknown>): string[] {
  const rolesSet = new Set<string>();

  function addVal(val: unknown): void {
    if (typeof val === 'string' && val.trim().length > 0) {
      rolesSet.add(val.trim());
    } else if (Array.isArray(val)) {
      for (const item of val) {
        if (typeof item === 'string' && item.trim().length > 0) {
          rolesSet.add(item.trim());
        }
      }
    }
  }

  addVal(payload['roles']);
  addVal(payload['role']);
  addVal(payload['groups']);
  addVal(payload['cognito:groups']);

  const realmAccess = payload['realm_access'];
  if (typeof realmAccess === 'object' && realmAccess !== null && !Array.isArray(realmAccess)) {
    addVal((realmAccess as Record<string, unknown>)['roles']);
  }

  return Array.from(rolesSet);
}

export function assessToken(
  rawCandidate: string,
  referenceEpochSeconds: number
): TokenAssessment {
  const parsed = parseJwt(rawCandidate);
  if ('reason' in parsed) {
    return parsed;
  }

  const { header, payload } = parsed;
  const algorithm = typeof header['alg'] === 'string' ? header['alg'] : 'unknown';
  const isAlgNone = algorithm.toLowerCase() === 'none';
  const isUnsecured = isAlgNone;

  const temporal = evaluateTemporal(payload, referenceEpochSeconds);
  const warnings: TokenWarning[] = [...temporal.warnings];

  let signaturePresence: SignaturePresence;
  if (parsed.segmentCount === 2) {
    signaturePresence = 'MISSING';
    warnings.push('TWO_SEGMENT_INSPECTION');
    if (!isAlgNone) {
      warnings.push('SIGNATURE_MISSING');
    }
  } else if (!parsed.hasSignature) {
    signaturePresence = 'MISSING';
    if (isAlgNone) {
      warnings.push('UNSECURED_ALG_NONE');
    } else {
      warnings.push('SIGNATURE_MISSING');
    }
  } else {
    if (isAlgNone) {
      signaturePresence = 'UNEXPECTED';
      warnings.push('UNEXPECTED_SIGNATURE');
    } else {
      signaturePresence = 'PRESENT';
    }
  }

  let issuer: string | null = null;
  if (typeof payload['iss'] === 'string') {
    issuer = payload['iss'];
  }

  let subject: string | null = null;
  if (typeof payload['sub'] === 'string') {
    subject = payload['sub'];
  }

  let audience: string | string[] | null = null;
  if (typeof payload['aud'] === 'string') {
    audience = payload['aud'];
  } else if (Array.isArray(payload['aud'])) {
    audience = payload['aud'].filter((a): a is string => typeof a === 'string');
  }

  const roles = extractRoles(payload);

  const recognized: RecognizedToken = {
    recognized: true,
    algorithm,
    isUnsecured,
    segmentCount: parsed.segmentCount,
    signature: {
      presence: signaturePresence,
      verification: 'NOT_PERFORMED'
    },
    temporalStatus: temporal.temporalStatus,
    expiresAtIso: temporal.expiresAtIso,
    secondsUntilExpiration: temporal.secondsUntilExpiration,
    issuedAtIso: temporal.issuedAtIso,
    notBeforeIso: temporal.notBeforeIso,
    issuer,
    audience,
    subject,
    roles,
    warnings,
    verification: {
      status: 'NOT_PERFORMED'
    }
  };

  return recognized;
}
