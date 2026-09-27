import type { RecognizedToken } from '../core/types';

export type SemanticTier =
  | 'ACTIVE'
  | 'EXPIRING_SOON'
  | 'EXPIRED'
  | 'UNSECURED'
  | 'NO_EXPIRATION'
  | 'INDETERMINATE';

/**
 * Maps an assessed token to its semantic health tier.
 * Pure logic — zero dependency on the 'vscode' runtime module.
 */
export function getTokenSemanticTier(
  token: RecognizedToken,
  expiringSoonSeconds = 1800
): SemanticTier {
  // 1. Highest priority: security failures, signature failure, or missing signatures
  if (
    token.signature?.verification === 'FAILED' ||
    token.isUnsecured ||
    token.signature?.presence === 'ABSENT' ||
    token.signature?.presence === 'EMPTY' ||
    token.signature?.presence === 'UNEXPECTED'
  ) {
    return 'UNSECURED';
  }

  // 2. Expired tokens (dead credentials take precedence over policy warnings)
  const temporalStatus = token.temporal?.status ?? token.temporalStatus;
  const secondsLeft = token.temporal?.secondsUntilExpiration ?? token.secondsUntilExpiration;

  if (temporalStatus === 'EXPIRED') {
    return 'EXPIRED';
  }

  // 3. Policy mismatch (issuer or audience mismatch flags as security failure)
  if (token.policy?.audience === 'MISMATCH' || token.policy?.issuer === 'MISMATCH') {
    return 'UNSECURED';
  }

  // 4. Expiring soon (active but within urgency threshold, default 30 mins)
  if (
    temporalStatus === 'ACTIVE' &&
    secondsLeft !== null &&
    secondsLeft > 0 &&
    secondsLeft <= expiringSoonSeconds
  ) {
    return 'EXPIRING_SOON';
  }

  // 5. Fully active and healthy
  if (temporalStatus === 'ACTIVE') {
    return 'ACTIVE';
  }

  // 6. Permanent credentials without expiration claims
  if (temporalStatus === 'NO_EXPIRATION') {
    return 'NO_EXPIRATION';
  }

  return 'INDETERMINATE';
}

/**
 * Returns the semantic Codicon icon for CodeLens and action items.
 */
export function getSemanticCodicon(tier: SemanticTier): string {
  switch (tier) {
    case 'ACTIVE':
      return '$(pass-filled)';
    case 'EXPIRING_SOON':
      return '$(clock)';
    case 'EXPIRED':
      return '$(error)';
    case 'UNSECURED':
      return '$(shield) $(alert)';
    case 'NO_EXPIRATION':
      return '$(key)';
    case 'INDETERMINATE':
    default:
      return '$(question)';
  }
}
