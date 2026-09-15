import type { TemporalStatus, TemporalWarning } from './types';

export interface TemporalEvaluation {
  temporalStatus: TemporalStatus;
  expiresAtIso: string | null;
  secondsUntilExpiration: number | null;
  issuedAtIso: string | null;
  notBeforeIso: string | null;
  warnings: TemporalWarning[];
}

function isValidNumericDate(val: unknown): val is number {
  return typeof val === 'number' && Number.isFinite(val);
}

function toIsoString(val: number | null): string | null {
  if (val === null) {
    return null;
  }
  try {
    return new Date(val * 1000).toISOString();
  } catch {
    return null;
  }
}

export function evaluateTemporal(
  payload: Record<string, unknown>,
  referenceEpochSeconds: number
): TemporalEvaluation {
  const warnings: TemporalWarning[] = [];
  let isIndeterminate = false;

  const rawExp = payload['exp'];
  const rawIat = payload['iat'];
  const rawNbf = payload['nbf'];

  let exp: number | null = null;
  if (rawExp !== undefined) {
    if (isValidNumericDate(rawExp)) {
      exp = rawExp;
    } else {
      warnings.push('MALFORMED_EXP');
      isIndeterminate = true;
    }
  }

  let iat: number | null = null;
  if (rawIat !== undefined) {
    if (isValidNumericDate(rawIat)) {
      iat = rawIat;
    } else {
      warnings.push('MALFORMED_IAT');
    }
  }

  let nbf: number | null = null;
  if (rawNbf !== undefined) {
    if (isValidNumericDate(rawNbf)) {
      nbf = rawNbf;
    } else {
      warnings.push('MALFORMED_NBF');
      isIndeterminate = true;
    }
  }

  if (iat !== null && iat > referenceEpochSeconds) {
    warnings.push('IAT_IN_FUTURE');
  }

  if (nbf !== null && exp !== null && nbf > exp) {
    warnings.push('NBF_AFTER_EXP');
  }

  let temporalStatus: TemporalStatus;
  let secondsUntilExpiration: number | null = null;

  if (isIndeterminate) {
    temporalStatus = 'INDETERMINATE';
  } else if (nbf !== null && nbf > referenceEpochSeconds) {
    temporalStatus = 'NOT_YET_ACTIVE';
    if (exp !== null) {
      secondsUntilExpiration = exp - referenceEpochSeconds;
    }
  } else if (exp !== null) {
    secondsUntilExpiration = exp - referenceEpochSeconds;
    if (secondsUntilExpiration <= 0) {
      temporalStatus = 'EXPIRED';
    } else {
      temporalStatus = 'ACTIVE';
    }
  } else {
    temporalStatus = 'NO_EXPIRATION';
  }

  return {
    temporalStatus,
    expiresAtIso: toIsoString(exp),
    secondsUntilExpiration,
    issuedAtIso: toIsoString(iat),
    notBeforeIso: toIsoString(nbf),
    warnings
  };
}
