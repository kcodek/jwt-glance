import type { RecognizedToken } from '../core/types';

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
  return `${days}d`;
}

export function formatBadgeLabel(token: RecognizedToken): string {
  let statusText = '';
  switch (token.temporalStatus) {
    case 'ACTIVE':
      statusText = token.secondsUntilExpiration !== null
        ? `Active ${formatRelativeDuration(token.secondsUntilExpiration)}`
        : 'Active';
      break;
    case 'EXPIRED':
      statusText = token.secondsUntilExpiration !== null
        ? `Expired ${formatRelativeDuration(token.secondsUntilExpiration)}`
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

  if (token.isUnsecured) {
    return `JWT · UNSECURED alg:none · ${statusText}`;
  }

  return `JWT · ${statusText} · ${token.algorithm}`;
}
