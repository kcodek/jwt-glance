import type { RecognizedToken } from './types';

export interface JwtWorkspacePolicy {
  name?: string;
  files?: string[];
  issuer?: string;
  audience?: string | string[];
  allowedAlgorithms?: string[];
  requiredClaims?: string[];
  maximumTokenAgeSeconds?: number;
  requireExpiration?: boolean;
}

export type PolicyDiagnosticCode =
  | 'ISSUER_MISMATCH'
  | 'AUDIENCE_MISMATCH'
  | 'ALGORITHM_DISALLOWED'
  | 'CLAIM_MISSING'
  | 'TOKEN_EXPIRED'
  | 'MAX_AGE_EXCEEDED'
  | 'MALFORMED_EXPIRATION';

export interface PolicyDiagnostic {
  code: PolicyDiagnosticCode;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export const DEFAULT_POLICY_FILES = ['**/*.http', '**/.env*'];

export function normalizePolicy(policy: JwtWorkspacePolicy): JwtWorkspacePolicy & {
  files: string[];
  requireExpiration: boolean;
} {
  return {
    ...policy,
    files: policy.files !== undefined ? policy.files : DEFAULT_POLICY_FILES,
    requireExpiration: policy.requireExpiration !== undefined ? policy.requireExpiration : true
  };
}

export function evaluatePolicy(
  token: RecognizedToken,
  policy: JwtWorkspacePolicy,
  referenceEpochSeconds: number
): PolicyDiagnostic[] {
  const normPolicy = normalizePolicy(policy);
  const diagnostics: PolicyDiagnostic[] = [];

  // 1. Expiration check
  const temporalStatus = token.temporal?.status ?? token.temporalStatus;
  if (temporalStatus === 'EXPIRED') {
    diagnostics.push({
      code: 'TOKEN_EXPIRED',
      message: `Token is expired (${token.temporal?.expiresAtIso ?? token.expiresAtIso ?? 'past exp'})`,
      severity: 'warning'
    });
  }

  // 2. Required expiration claim check (defaults to true if omitted in policy)
  const hasMalformedExp = token.warnings?.includes('MALFORMED_EXP');
  if (normPolicy.requireExpiration) {
    if (temporalStatus === 'NO_EXPIRATION') {
      diagnostics.push({
        code: 'CLAIM_MISSING',
        message: 'Policy requires an expiration claim ("exp"), but token has none',
        severity: 'warning'
      });
    } else if (hasMalformedExp || (temporalStatus === 'INDETERMINATE' && !token.expiresAtIso)) {
      diagnostics.push({
        code: 'MALFORMED_EXPIRATION',
        message: 'Policy requires a valid numeric expiration claim ("exp"), but token expiration is malformed',
        severity: 'warning'
      });
    }
  }

  // 3. Issuer check
  if (normPolicy.issuer) {
    const tokenIssuer = token.claims?.issuer ?? token.issuer;
    if (tokenIssuer !== normPolicy.issuer) {
      diagnostics.push({
        code: 'ISSUER_MISMATCH',
        message: `Token issuer "${tokenIssuer ?? 'none'}" does not match policy expected issuer "${normPolicy.issuer}"`,
        severity: 'warning'
      });
    }
  }

  // 4. Audience check
  if (normPolicy.audience) {
    const tokenAud = token.claims?.audience ?? token.audience;
    const expectedList = Array.isArray(normPolicy.audience) ? normPolicy.audience : [normPolicy.audience];
    const actualList = Array.isArray(tokenAud) ? tokenAud : tokenAud ? [tokenAud] : [];

    const hasMatch = expectedList.some(expected => actualList.includes(expected));
    if (!hasMatch) {
      diagnostics.push({
        code: 'AUDIENCE_MISMATCH',
        message: `Token audience ${JSON.stringify(actualList)} does not match expected audience ${JSON.stringify(normPolicy.audience)}`,
        severity: 'warning'
      });
    }
  }

  // 5. Allowed algorithms check
  if (normPolicy.allowedAlgorithms && normPolicy.allowedAlgorithms.length > 0) {
    const alg = token.signature.algorithm ?? token.algorithm;
    const isAllowed = normPolicy.allowedAlgorithms.some(
      allowed => allowed.toLowerCase() === alg.toLowerCase()
    );
    if (!isAllowed) {
      diagnostics.push({
        code: 'ALGORITHM_DISALLOWED',
        message: `Algorithm "${alg}" is not in the allowed policy list: [${normPolicy.allowedAlgorithms.join(', ')}]`,
        severity: 'error'
      });
    }
  }

  // 6. Required claims check (supports arbitrary claims like tenant_id via token.payload)
  if (normPolicy.requiredClaims && normPolicy.requiredClaims.length > 0) {
    for (const requiredClaim of normPolicy.requiredClaims) {
      let present = false;
      if (token.payload && Object.prototype.hasOwnProperty.call(token.payload, requiredClaim)) {
        present = token.payload[requiredClaim] !== undefined && token.payload[requiredClaim] !== null;
      } else {
        // Fallback for registered claims if payload is omitted or for mock test tokens
        if (requiredClaim === 'sub' && (token.claims?.subject ?? token.subject) !== null) present = true;
        else if (requiredClaim === 'iss' && (token.claims?.issuer ?? token.issuer) !== null) present = true;
        else if (requiredClaim === 'aud' && (token.claims?.audience ?? token.audience) !== null) present = true;
        else if (requiredClaim === 'exp' && (token.temporal?.expiresAtIso ?? token.expiresAtIso) !== null) present = true;
        else if (requiredClaim === 'iat' && (token.temporal?.issuedAtIso ?? token.issuedAtIso) !== null) present = true;
        else if (requiredClaim === 'nbf' && (token.temporal?.notBeforeIso ?? token.notBeforeIso) !== null) present = true;
      }

      if (!present) {
        diagnostics.push({
          code: 'CLAIM_MISSING',
          message: `Required claim "${requiredClaim}" is missing from token`,
          severity: 'warning'
        });
      }
    }
  }

  // 7. Maximum token age check (referenceEpochSeconds - iat)
  if (typeof normPolicy.maximumTokenAgeSeconds === 'number' && normPolicy.maximumTokenAgeSeconds > 0) {
    const iatIso = token.temporal?.issuedAtIso ?? token.issuedAtIso;
    if (!iatIso) {
      diagnostics.push({
        code: 'CLAIM_MISSING',
        message: 'Policy specifies maximumTokenAgeSeconds, but token is missing issued-at claim ("iat")',
        severity: 'warning'
      });
    } else {
      const iatEpoch = Math.floor(new Date(iatIso).getTime() / 1000);
      const tokenAge = referenceEpochSeconds - iatEpoch;
      if (tokenAge < -60) {
        diagnostics.push({
          code: 'MAX_AGE_EXCEEDED',
          message: `Token issued-at claim ("iat") is in the future beyond acceptable clock skew (${iatIso})`,
          severity: 'warning'
        });
      } else if (tokenAge > normPolicy.maximumTokenAgeSeconds) {
        diagnostics.push({
          code: 'MAX_AGE_EXCEEDED',
          message: `Token age (${tokenAge}s) exceeds maximum allowed age (${normPolicy.maximumTokenAgeSeconds}s)`,
          severity: 'warning'
        });
      }
    }
  }

  return diagnostics;
}
