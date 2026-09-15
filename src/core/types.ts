export type TemporalStatus =
  | 'ACTIVE'
  | 'EXPIRED'
  | 'NOT_YET_ACTIVE'
  | 'NO_EXPIRATION'
  | 'INDETERMINATE';

export type TemporalWarning =
  | 'MALFORMED_EXP'
  | 'MALFORMED_NBF'
  | 'MALFORMED_IAT'
  | 'IAT_IN_FUTURE'
  | 'NBF_AFTER_EXP';

export type VerificationStatus =
  | 'NOT_PERFORMED'
  | 'VERIFIED'
  | 'FAILED';

export type SignaturePresence =
  | 'PRESENT'
  | 'EMPTY'
  | 'ABSENT'
  | 'UNEXPECTED';

export type StructuralWarning =
  | 'SIGNATURE_MISSING'
  | 'UNEXPECTED_SIGNATURE'
  | 'UNSECURED_ALG_NONE'
  | 'TWO_SEGMENT_INSPECTION';

export type TokenWarning = TemporalWarning | StructuralWarning;

export interface UnrecognizedToken {
  recognized: false;
  reason: 'INVALID_SEGMENT_COUNT' | 'NOT_THREE_SEGMENTS' | 'MALFORMED_HEADER' | 'MALFORMED_PAYLOAD';
}

export interface RecognizedToken {
  recognized: true;
  algorithm: string;
  isUnsecured: boolean; // true if alg === 'none'
  segmentCount: 2 | 3;
  signature: {
    presence: SignaturePresence;
    verification: VerificationStatus;
  };
  temporalStatus: TemporalStatus;
  expiresAtIso: string | null;
  secondsUntilExpiration: number | null; // positive = future, 0 = now, negative = past, null = none/indeterminate
  issuedAtIso: string | null;
  notBeforeIso: string | null;
  issuer: string | null;
  audience: string | string[] | null;
  subject: string | null;
  roles: string[];
  warnings: TokenWarning[];
}

export type TokenAssessment = UnrecognizedToken | RecognizedToken;

