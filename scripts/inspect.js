#!/usr/bin/env node
const core = require('../out/src/core/index');
const badge = require('../out/src/vscode/badgeFormatter');
const hover = require('../out/src/vscode/hoverFormatter');

const tokenArg = process.argv[2];

if (!tokenArg) {
  console.log('Usage: npm run inspect -- "<JWT_TOKEN>"\n');
  console.log('Testing with generated sample active token (42m remaining):');
  const now = Math.floor(Date.now() / 1000);
  const hB64 = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const pB64 = Buffer.from(JSON.stringify({
    sub: 'user-42',
    name: 'Alice Smith',
    roles: ['admin', 'developer'],
    iss: 'https://auth.example.com',
    exp: now + 2520,
    iat: now - 7200
  })).toString('base64url');
  const sample = `${hB64}.${pB64}.sample_signature`;
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

  console.log('\n--- Ambient Badge Preview ---');
  console.log(`[${badge.formatBadgeLabel(assessment)}]`);

  console.log('\n--- Decoded Assessment Object ---');
  console.dir(assessment, { depth: null });

  console.log('\n--- Hover Card Markdown Preview ---');
  const parsed = core.parseJwt(rawToken);
  console.log(hover.formatHoverContent(assessment, parsed.payload));
}
