import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { findCandidateTokens } from '../../src/core/detect';
import { assessToken } from '../../src/core/index';

const POSITIVE_CONTROL_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

test('Positive control token is recognized', () => {
  const candidates = findCandidateTokens(`TOKEN=${POSITIVE_CONTROL_JWT}`);
  assert.equal(candidates.length, 1);
  const assessment = assessToken(candidates[0]!.raw, 1516239022);
  assert.equal(assessment.recognized, true);
});

test('12,000-sample adversarial suite produces zero false-positive recognized tokens', () => {
  const samples: string[] = [];

  // 1. 3,000 UUID strings with prefixes and suffixes
  for (let i = 0; i < 3000; i++) {
    const hex = (len: number) => Math.floor(Math.random() * (16 ** len)).toString(16).padStart(len, '0');
    const uuid = `${hex(8)}-${hex(4)}-4${hex(3)}-8${hex(3)}-${hex(12)}`;
    samples.push(`ID_${i}=${uuid}`);
  }

  // 2. 3,000 Semantic versions with build metadata and prerelease tags
  for (let i = 0; i < 3000; i++) {
    const major = i % 100;
    const minor = (i * 3) % 100;
    const patch = (i * 7) % 500;
    samples.push(`version: "${major}.${minor}.${patch}-alpha.${i}+sha.${i * 12345}"`);
  }

  // 3. 3,000 URLs, FQDNs, and package names
  for (let i = 0; i < 3000; i++) {
    const domain = `sub${i % 10}.api.service${i % 50}.region${i % 5}.internal.corp.example.com`;
    const pkg = `com.enterprise.app.module${i % 100}.service.impl.Worker${i}`;
    samples.push(`https://${domain}/v1/endpoint?query=${pkg}`);
  }

  // 4. 3,000 Dot-notated environment keys, config lines, and log outputs
  for (let i = 0; i < 3000; i++) {
    const key = `SERVICE.DATABASE.REPLICA_${i % 10}.CONNECTION.TIMEOUT_MS`;
    const log = `2026-09-10 12:34:56.${(i % 1000).toString().padStart(3, '0')} [thread-${i % 16}] DEBUG worker.core.processor - status code 200`;
    samples.push(`${key}=${i * 100} ; ${log}`);
  }

  assert.equal(samples.length, 12000);

  let falsePositives = 0;
  const falsePositiveSamples: string[] = [];

  for (const sample of samples) {
    const candidates = findCandidateTokens(sample);
    for (const candidate of candidates) {
      const assessment = assessToken(candidate.raw, 1700000000);
      if (assessment.recognized) {
        falsePositives++;
        falsePositiveSamples.push(candidate.raw);
      }
    }
  }

  assert.equal(falsePositives, 0, `Detected false positives: ${falsePositiveSamples.slice(0, 5).join(', ')}`);
});
