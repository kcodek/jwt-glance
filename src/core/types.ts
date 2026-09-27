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
  | 'FAILED'
  | 'KEY_NOT_FOUND';

export type SignaturePresence =
  | 'PRESENT'
  | 'EMPTY'
  | 'ABSENT'
  | 'UNEXPECTED';

export type PolicyStatus =
  | 'MATCH'
  | 'MISMATCH'
  | 'UNCHECKED';

export type StructuralWarning =
  | 'SIGNATURE_MISSING'
  | 'UNEXPECTED_SIGNATURE'
  | 'UNSECURED_ALG_NONE'
  | 'TWO_SEGMENT_INSPECTION';

export type PolicyWarning =
  | 'ISSUER_MISMATCH'
  | 'AUDIENCE_MISMATCH'
  | 'EXPIRATION_REQUIRED';

export type TokenWarning = TemporalWarning | StructuralWarning | PolicyWarning;

export interface UnrecognizedToken {
  recognized: false;
  reason: 'INVALID_SEGMENT_COUNT' | 'NOT_THREE_SEGMENTS' | 'MALFORMED_HEADER' | 'MALFORMED_PAYLOAD';
}

export interface RecognizedToken {
  recognized: true;
  recognition?: {
    recognized: true;
    format: 'JWT' | 'JWS';
  };
  signature: {
    presence: SignaturePresence;
    verification: VerificationStatus;
    algorithm?: string;
    keyId?: string;
  };
  temporal?: {
    status: TemporalStatus;
    expiresAtIso: string | null;
    secondsUntilExpiration: number | null; // positive = future, 0 = now, negative = past, null = none/indeterminate
    secondsUntilActivation?: number | null; // positive = future activation, null = none/active/indeterminate
    issuedAtIso: string | null;
    notBeforeIso: string | null;
  };
  policy?: {
    issuer: PolicyStatus;
    audience: PolicyStatus;
  };
  claims?: {
    subject: string | null;
    issuer: string | null;
    audience: string | string[] | null;
    roles: string[];
  };
  warnings: TokenWarning[];

  // Top-level convenience properties (guarantee backwards compatibility across callers):
  algorithm: string;
  isUnsecured: boolean; // true if alg === 'none'
  segmentCount: 2 | 3;
  temporalStatus: TemporalStatus;
  expiresAtIso: string | null;
  secondsUntilExpiration: number | null;
  secondsUntilActivation?: number | null;
  issuedAtIso: string | null;
  notBeforeIso: string | null;
  issuer: string | null;
  audience: string | string[] | null;
  subject: string | null;
  roles: string[];
  keyId?: string;
}

export type TokenAssessment = UnrecognizedToken | RecognizedToken;
