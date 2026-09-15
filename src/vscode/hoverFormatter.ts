import type { RecognizedToken } from '../core/types';
import { sanitizeMarkdown } from '../core/sanitize';
import { formatRelativeDuration } from './badgeFormatter';

export function formatHoverContent(
  token: RecognizedToken,
  payload?: Record<string, unknown>
): string {
  const lines: string[] = [];

  const unsecuredBadge = token.isUnsecured ? ' ⚠️ **UNSECURED (alg:none)**' : '';
  let relativeTimeStr = '';
  if (token.secondsUntilExpiration !== null) {
    const dur = formatRelativeDuration(token.secondsUntilExpiration);
    relativeTimeStr = token.secondsUntilExpiration >= 0 ? `(expires in ${dur})` : `(expired ${dur} ago)`;
  }

  // --- BRIEF GLANCE SUMMARY (Top Level) ---
  lines.push(`### JWT Glance · \`${token.temporalStatus}\` ${relativeTimeStr}`);

  let sigText = 'ℹ️ **Signature: Not performed** *(Local inspection only)*';
  if (token.signature?.presence === 'ABSENT') {
    sigText = '⚠️ **Signature: Absent** *(Two-segment inspection)*';
  } else if (token.signature?.presence === 'EMPTY') {
    if (token.isUnsecured) {
      sigText = 'ℹ️ **Signature: Empty** *(Expected RFC 7519 unsecured form)*';
    } else {
      sigText = '⚠️ **Signature: Empty** *(Signature bytes missing)*';
    }
  } else if (token.signature?.presence === 'UNEXPECTED') {
    sigText = '⚠️ **Signature: Unexpected** *(alg:none with signature)*';
  } else if (token.signature?.presence === 'PRESENT') {
    sigText = 'ℹ️ **Signature: Present, not verified** *(Local inspection only)*';
  }


  lines.push(`**Algorithm:** \`${token.algorithm}\`${unsecuredBadge} &nbsp;|&nbsp; ${sigText}`);
  lines.push('');

  const vitals: string[] = [];
  if (token.expiresAtIso) {
    vitals.push(`**Expires:** \`${token.expiresAtIso}\``);
  }
  if (token.subject) {
    vitals.push(`**Subject:** \`${sanitizeMarkdown(token.subject)}\``);
  }
  if (token.issuer) {
    vitals.push(`**Issuer:** ${sanitizeMarkdown(token.issuer)}`);
  }
  if (token.roles.length > 0) {
    vitals.push(`**Roles:** \`${sanitizeMarkdown(token.roles.join(', '))}\``);
  }
  if (token.audience) {
    const audStr = Array.isArray(token.audience) ? token.audience.join(', ') : token.audience;
    vitals.push(`**Audience:** \`${sanitizeMarkdown(audStr)}\``);
  }

  if (vitals.length > 0) {
    lines.push(vitals.join(' &nbsp;•&nbsp; '));
    lines.push('');
  }

  if (token.warnings.length > 0) {
    lines.push('⚠️ **Warnings:** ' + token.warnings.map(w => `\`${w}\``).join(', '));
    lines.push('');
  }

  // --- COLLAPSED DETAILS (Click to expand) ---
  lines.push('<details>');
  lines.push('<summary><b>🔍 View Complete Details & Decoded Payload</b></summary>');
  lines.push('');
  lines.push('#### Claims Table');
  lines.push('| Claim | Value |');
  lines.push('| :--- | :--- |');

  if (token.issuer) lines.push(`| \`iss\` | ${sanitizeMarkdown(token.issuer)} |`);
  if (token.subject) lines.push(`| \`sub\` | ${sanitizeMarkdown(token.subject)} |`);
  if (token.audience) {
    const audStr = Array.isArray(token.audience) ? token.audience.join(', ') : token.audience;
    lines.push(`| \`aud\` | ${sanitizeMarkdown(audStr)} |`);
  }
  if (token.roles.length > 0) lines.push(`| \`roles\` | ${sanitizeMarkdown(token.roles.join(', '))} |`);
  if (token.issuedAtIso) lines.push(`| \`iat\` | \`${token.issuedAtIso}\` |`);
  if (token.notBeforeIso) lines.push(`| \`nbf\` | \`${token.notBeforeIso}\` |`);

  if (payload) {
    lines.push('');
    lines.push('#### Decoded Payload JSON');
    lines.push('```json');
    lines.push(JSON.stringify(payload, null, 2));
    lines.push('```');
  }

  lines.push('</details>');
  lines.push('');
  lines.push('> 🔒 *Note: JWT Glance provides ambient structural inspection only. Decoding does not establish cryptographic authenticity.*');

  return lines.join('\n');
}
