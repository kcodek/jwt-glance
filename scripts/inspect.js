#!/usr/bin/env node
const core = require('../out/src/core/index');
const badge = require('../out/src/vscode/badgeFormatter');
const hover = require('../out/src/vscode/hoverFormatter');

const tokenArg = process.argv[2];

if (!tokenArg) {
  console.log('Usage: npm run inspect -- "<JWT_TOKEN>"\n');
  console.log('Testing with default fixture token:');
  const sample = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTQyIiwibmFtZSI6IkFsaWNlIFNtaXRoIiwicm9sZXMiOlsiYWRtaW4iLCJkZXZlbG9wZXIiXSwiaXNzIjoiaHR0cHM6Ly9hdXRoLmV4YW1wbGUuY29tIiwiZXhwIjoyNTM0MDIzMDA3OTl9.sig';
  runInspection(sample);
} else {
  runInspection(tokenArg);
}

function runInspection(rawToken) {
  const now = Math.floor(Date.now() / 1000);
  const assessment = core.assessToken(rawToken, now);

  if (!assessment.recognized) {
    console.error('❌ Token not recognized:', assessment.reason);
    process.exit(1);
  }

  console.log('\n--- Inlay Hint Badge Preview ---');
  console.log(`[${badge.formatBadgeLabel(assessment)}]`);

  console.log('\n--- Decoded Assessment Object ---');
  console.dir(assessment, { depth: null });

  console.log('\n--- Hover Card Markdown Preview ---');
  const parsed = core.parseJwt(rawToken);
  console.log(hover.formatHoverContent(assessment, parsed.payload));
}
