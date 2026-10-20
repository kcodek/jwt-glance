import type { RecognizedToken } from '../core/types';
import { resolveGlanceClaims } from '../core/index';
import { getTokenSemanticTier, getSemanticCodicon } from './semanticTier';

export function formatRelativeDuration(seconds: number): string {
  const abs = Math.abs(seconds);
  if (abs < 60) {
    return '<1m';
  }
  const minutes = Math.floor(abs / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const remainingMins = minutes % 60;
    return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  if (days < 365) {
    return `${days}d`;
  }
  const years = Math.floor(days / 365);
  return `${years}y`;
}

export interface BadgeFormatOptions {
  showUncheckedStatus?: boolean;
  omitPrefix?: boolean;
  glanceClaims?: string | string[];
  maxGlanceClaims?: number;
}

export function formatBadgeLabel(
  token: RecognizedToken,
  options?: BadgeFormatOptions
): string {
  let statusText = '';
  const temporalStatus = token.temporal?.status ?? token.temporalStatus;
  const secondsLeft = token.temporal?.secondsUntilExpiration ?? token.secondsUntilExpiration;

  switch (temporalStatus) {
    case 'ACTIVE':
      statusText = secondsLeft !== null
        ? `Active ${formatRelativeDuration(secondsLeft)}`
        : 'Active';
      break;
    case 'EXPIRED':
      statusText = secondsLeft !== null
        ? `Expired ${formatRelativeDuration(secondsLeft)}`
        : 'Expired';
      break;
    case 'NOT_YET_ACTIVE':
      statusText = 'Not Yet Active';
      break;
    case 'NO_EXPIRATION':
      statusText = 'No Expiration';
      break;
    case 'INDETERMINATE':
    default:
      statusText = 'Indeterminate';
      break;
  }

  const parts: string[] = options?.omitPrefix ? [] : ['JWT'];

  // Signature dimension
  const sig = token.signature;
  const algorithm = sig?.algorithm || token.algorithm;

  if (sig?.verification === 'FAILED') {
    parts.push('✕ BAD SIGNATURE');
  } else if (sig?.verification === 'VERIFIED') {
    parts.push(`${algorithm} ✓`);
  } else if (sig?.verification === 'KEY_NOT_FOUND') {
    parts.push('? Key Not Found');
  } else if (token.isUnsecured) {
    parts.push('UNSECURED alg:none');
  } else if (sig?.presence === 'ABSENT' || sig?.presence === 'EMPTY') {
    parts.push(`${algorithm} NO SIG ⚠️`);
  } else if (options?.showUncheckedStatus) {
    parts.push(`${algorithm} ? Unchecked`);
  }

  // Policy dimension
  if (token.policy?.audience === 'MISMATCH') {
    parts.push('AUD mismatch');
  }
  if (token.policy?.issuer === 'MISMATCH') {
    parts.push('ISS mismatch');
  }

  const configuredClaims = options?.glanceClaims ?? ['sub'];
  const maxGlanceClaims = options?.maxGlanceClaims ?? 3;
  const candidates = Array.isArray(configuredClaims) ? configuredClaims : [configuredClaims];
  const claimTexts = resolveGlanceClaims(token.payload, candidates, maxGlanceClaims);

  if (claimTexts.length === 0 && candidates.includes('sub')) {
    const fallbackSub = token.claims?.subject ?? token.subject;
    if (fallbackSub && fallbackSub.trim().length > 0) {
      claimTexts.push(fallbackSub.trim());
    }
  }

  for (const text of claimTexts) {
    if (text && text.trim().length > 0) {
      parts.push(text.trim());
    }
  }

  // Only append temporal status if signature didn't fail
  if (sig?.verification !== 'FAILED') {
    parts.push(statusText);
  }

  return parts.join(' · ');
}

export function formatCodeLensLabel(
  token: RecognizedToken,
  expiringSoonSeconds = 1800,
  glanceClaims?: string | string[],
  maxGlanceClaims = 3
): string {
  const tier = getTokenSemanticTier(token, expiringSoonSeconds);
  let icon = getSemanticCodicon(tier);
  if (token.signature?.verification === 'VERIFIED') {
    icon = '$(pass-filled)';
  } else if (token.signature?.verification === 'FAILED') {
    icon = '$(error)';
  }
  const label = formatBadgeLabel(token, { glanceClaims, maxGlanceClaims });
  return `${icon} ${label}`;
}
