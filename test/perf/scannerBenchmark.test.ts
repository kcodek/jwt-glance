import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import Module from 'node:module';
import { findCandidateTokens, assessToken } from '../../src/core/index';

const mockVscode = {
  workspace: {
    getConfiguration: () => ({
      get: (_k: string, d: unknown) => d
    })
  }
};

const originalRequire = Module.prototype.require;
Module.prototype.require = function (path: string) {
  if (path === 'vscode') {
    return mockVscode;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return originalRequire.apply(this, arguments as any);
};

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

test('Performance: cached token re-evaluation for 1,000 tokens finishes in under 5ms', () => {
  const cachedTokens = [];
  for (let i = 0; i < 1000; i++) {
    cachedTokens.push({
      raw: SAMPLE_JWT,
      lineNum: i,
      startIndex: 0,
      endIndex: SAMPLE_JWT.length
    });
  }

  const start = performance.now();
  const now = 1750000000;
  let reEvaluated = 0;
  for (const c of cachedTokens) {
    const assessment = assessToken(c.raw, now);
    if (assessment.recognized) reEvaluated++;
  }
  const durationMs = performance.now() - start;

  assert.equal(reEvaluated, 1000);
  assert.ok(durationMs < 5, `1000 cached tokens took ${durationMs.toFixed(2)}ms (expected < 5ms)`);
});

test('Performance: DocumentTokenIndex candidate extraction on 10,000 lines with 100 tokens finishes in under 30ms', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { extractCandidateTokensFromLines } = require('../../src/vscode/tokenIndex');
  const lines: string[] = [];
  for (let i = 0; i < 10000; i++) {
    if (i % 100 === 0) {
      lines.push(`const KEY_${i} = "${SAMPLE_JWT}";`);
    } else {
      lines.push(`const value_${i} = calculateMetric(${i}, "param_${i}");`);
    }
  }

  const start = performance.now();
  const tokens = extractCandidateTokensFromLines(lines, 10000);
  const durationMs = performance.now() - start;

  assert.equal(tokens.length, 100);
  assert.ok(durationMs < 30, `10,000 lines (100 tokens) took ${durationMs.toFixed(2)}ms (expected < 30ms)`);
});

test('Performance: near-limit 512 KB (~524,000 chars) VS Code document scanning finishes in under 30ms', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { extractCandidateTokensFromLines } = require('../../src/vscode/tokenIndex');
  const lines: string[] = [];
  let totalChars = 0;
  const targetChars = 520000; // ~512 KB
  let lineIdx = 0;

  while (totalChars < targetChars) {
    let line: string;
    if (lineIdx % 100 === 0) {
      line = `const SERVICE_TOKEN_${lineIdx} = "${SAMPLE_JWT}"; // Line ${lineIdx} configuration`;
    } else {
      line = `const metricRecord_${lineIdx} = executeCalculationStep(${lineIdx}, "alpha_${lineIdx}", "beta_${lineIdx}");`;
    }
    lines.push(line);
    totalChars += line.length + 1; // including newline
    lineIdx++;
  }

  assert.ok(totalChars >= 500000 && totalChars <= 530000, `Generated ${totalChars} chars`);

  const start = performance.now();
  const tokens = extractCandidateTokensFromLines(lines, 10000);
  const durationMs = performance.now() - start;

  assert.ok(tokens.length > 0);
  assert.ok(
    durationMs < 30,
    `512 KB document (${lines.length} lines, ${tokens.length} tokens) took ${durationMs.toFixed(2)}ms (expected < 30ms)`
  );
});
