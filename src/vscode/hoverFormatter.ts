import type { RecognizedToken } from '../core/types';
import { sanitizeCodeSpan } from '../core/sanitize';
import { formatRelativeDuration } from './badgeFormatter';
import { getTokenSemanticTier } from './semanticTier';

export interface HoverFormatOptions {
  expiringSoonThreshold?: number;
}

export function getSafeCodeFence(content: string): string {
  const matches = content.match(/`{3,}/g);
  if (!matches) {
    return '```';
  }
  const maxBackticks = Math.max(...matches.map(m => m.length));
  return '`'.repeat(maxBackticks + 1);
}

function formatStatusHeading(
  token: RecognizedToken,
  expiringSoonThreshold = 1800
): string {
  const tier = getTokenSemanticTier(token, expiringSoonThreshold);

  if (tier === 'UNSECURED') {
    let timing = '';
    const temporalStatus = token.temporal?.status ?? token.temporalStatus;
    const secondsLeft = token.temporal?.secondsUntilExpiration ?? token.secondsUntilExpiration;
    const secondsUntilActivation = token.temporal?.secondsUntilActivation ?? token.secondsUntilActivation;

    if (temporalStatus === 'ACTIVE' && secondsLeft !== null) {
      timing = ` · expires in ${formatRelativeDuration(secondsLeft)}`;
    } else if (temporalStatus === 'EXPIRED' && secondsLeft !== null) {
      timing = ` · expired ${formatRelativeDuration(Math.abs(secondsLeft))} ago`;
    } else if (temporalStatus === 'NOT_YET_ACTIVE' && secondsUntilActivation !== null && secondsUntilActivation !== undefined) {
      timing = ` · starts in ${formatRelativeDuration(secondsUntilActivation)}`;
    } else if (temporalStatus === 'NO_EXPIRATION') {
      timing = ` · no expiration`;
    }

    return `$(shield) $(alert) **Unsecured**${timing}`;
  }

  const temporalStatus = token.temporal?.status ?? token.temporalStatus;
  const secondsUntilExpiration = token.temporal?.secondsUntilExpiration ?? token.secondsUntilExpiration;
  const secondsUntilActivation = token.temporal?.secondsUntilActivation ?? token.secondsUntilActivation;

  switch (temporalStatus) {
    case 'ACTIVE': {
      const dur = secondsUntilExpiration !== null
        ? formatRelativeDuration(secondsUntilExpiration)
        : null;
      const timing = dur ? ` · expires in ${dur}` : '';
      if (tier === 'EXPIRING_SOON') {
        return `$(clock) **Expiring Soon**${timing}`;
      }
      return `$(pass-filled) **Active**${timing}`;
    }
    case 'EXPIRED': {
      const dur = secondsUntilExpiration !== null
        ? formatRelativeDuration(Math.abs(secondsUntilExpiration))
        : null;
      const timing = dur ? ` · ${dur} ago` : '';
      return `$(error) **Expired**${timing}`;
    }
    case 'NOT_YET_ACTIVE': {
      const dur = secondsUntilActivation !== null && secondsUntilActivation !== undefined
        ? formatRelativeDuration(secondsUntilActivation)
        : null;
      const timing = dur ? ` · starts in ${dur}` : '';
      return `$(clock) **Not Yet Active**${timing}`;
    }
    case 'NO_EXPIRATION':
      return `$(key) **No Expiration**`;
    case 'INDETERMINATE':
    default:
      return `$(question) **Indeterminate**`;
  }
}

export function formatHoverContent(
  token: RecognizedToken,
  payload?: Record<string, unknown>,
  options?: HoverFormatOptions
): string {
  const lines: string[] = [];

  // 1. Semantic Status Heading
  lines.push(formatStatusHeading(token, options?.expiringSoonThreshold));
  lines.push('');

  // 2. Algorithm & Signature Line
  const unsecuredBadge = token.isUnsecured ? ' ⚠️ **UNSECURED (alg:none)**' : '';

  let sigText = 'ℹ️ **Signature:** Present, not verified';
  if (token.signature?.verification === 'VERIFIED') {
    sigText = '✅ **Signature:** Verified';
  } else if (token.signature?.verification === 'FAILED') {
    sigText = '❌ **Signature:** Verification failed';
  } else if (token.signature?.verification === 'KEY_NOT_FOUND') {
    sigText = '❓ **Signature:** Key not found';
  } else if (token.signature?.presence === 'ABSENT') {
    sigText = '⚠️ **Signature:** Absent *(Two-segment draft)*';
  } else if (token.signature?.presence === 'EMPTY') {
    if (token.isUnsecured) {
      sigText = 'ℹ️ **Signature:** Empty *(Expected RFC 7519 unsecured form)*';
    } else {
      sigText = '⚠️ **Signature:** Empty *(Signature bytes missing)*';
    }
  } else if (token.signature?.presence === 'UNEXPECTED') {
    sigText = '⚠️ **Signature:** Unexpected *(alg:none with signature)*';
  }

  const policyAlerts: string[] = [];
  if (token.policy?.audience === 'MISMATCH') {
    policyAlerts.push('⚠️ **Policy: Audience mismatch**');
  }
  if (token.policy?.issuer === 'MISMATCH') {
    policyAlerts.push('⚠️ **Policy: Issuer mismatch**');
  }
  const policyText = policyAlerts.length > 0 ? ` · ${policyAlerts.join(' ')}` : '';

  lines.push(`**Algorithm:** \`${sanitizeCodeSpan(token.algorithm)}\`${unsecuredBadge} · ${sigText}${policyText}`);

  // 3. Lifecycle Timing Row (Exact ISO timestamps — relative delta is already in the heading above)
  const lifecycle: string[] = [];
  if (token.notBeforeIso) {
    lifecycle.push(`**Valid from:** \`${token.notBeforeIso}\``);
  }
  if (token.expiresAtIso) {
    lifecycle.push(`**Expires:** \`${token.expiresAtIso}\``);
  }

  if (lifecycle.length > 0) {
    lines.push('');
    lines.push(lifecycle.join(' &nbsp;•&nbsp; '));
  }

  // 4. Warnings (if any)
  if (token.warnings.length > 0) {
    lines.push('');
    lines.push('⚠️ **Warnings:** ' + token.warnings.map(w => `\`${w}\``).join(', '));
  }

  // 5. Decoded Payload JSON (Dynamic Code Fence) with Section Dividers
  if (payload) {
    const jsonStr = JSON.stringify(payload, null, 2);
    const fence = getSafeCodeFence(jsonStr);
    lines.push('');
    lines.push('---');
    lines.push(`${fence}json\n${jsonStr}\n${fence}`);
  }

  // 6. Security Disclaimer Footer
  lines.push('');
  lines.push('---');
  if (token.signature?.verification === 'VERIFIED') {
    lines.push('*Local structural inspection — cryptographically verified.*');
  } else {
    lines.push('*Local structural inspection only — signature not cryptographically verified.*');
  }

  return lines.join('\n');
}
