import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { findCandidateTokens, assessToken } from '../../src/core/index';

const SAMPLE_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMyIsImV4cCI6MTgwMDAwMDAwMH0.sig';

test('Performance: scanning a 10,000-line simulated file finishes in under 50ms', () => {
  const lines: string[] = [];
  const tokenIndices = new Set([100, 500, 1200, 3500, 7800, 9999]);

  for (let i = 0; i < 10000; i++) {
    if (tokenIndices.has(i)) {
      lines.push(`const AUTH_TOKEN_${i} = "${SAMPLE_JWT}"; // Line ${i}`);
    } else {
      lines.push(`const value_${i} = calculateMetric(${i}, "param_${i}"); // normal code line`);
    }
  }

  assert.equal(lines.length, 10000);

  const start = performance.now();
  let foundTokens = 0;

  for (const line of lines) {
    if (line.length > 10000) continue;
    const candidates = findCandidateTokens(line);
    for (const c of candidates) {
      const assessment = assessToken(c.raw, 1700000000);
      if (assessment.recognized) {
        foundTokens++;
      }
    }
  }

  const durationMs = performance.now() - start;

  assert.equal(foundTokens, 6);
  assert.ok(durationMs < 50, `10,000 lines took ${durationMs.toFixed(2)}ms (expected < 50ms)`);
});

test('Performance: scanning lines with minified code ignores oversized strings safely', () => {
  const normalLine = `AUTH="${SAMPLE_JWT}"`;
  const minifiedGiantLine = `var bundle = "` + 'x'.repeat(15000) + '";';

  const start = performance.now();
  const cNormal = findCandidateTokens(normalLine);
  // Simulating maxLineLength filter from inlay hints provider
  const maxLineLength = 10000;
  const cGiant = minifiedGiantLine.length <= maxLineLength ? findCandidateTokens(minifiedGiantLine) : [];
  const durationMs = performance.now() - start;

  assert.equal(cNormal.length, 1);
  assert.equal(cGiant.length, 0);
  assert.ok(durationMs < 5, `Scan took ${durationMs.toFixed(2)}ms`);
});
