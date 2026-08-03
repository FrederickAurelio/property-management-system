#!/usr/bin/env node
/**
 * Garage bootstrap: enable website hosting + bucket CORS (Node / AWS SDK — no aws CLI).
 *
 * Usage (repo root, after garage is up):
 *   pnpm archive:bootstrap
 *
 * Env (root .env via --env-file):
 *   ARCHIVE_S3_ENDPOINT, ARCHIVE_S3_* credentials, ARCHIVE_S3_BUCKET
 *   ARCHIVE_CORS_ORIGINS — comma-separated PMS origins (one CORS rule each)
 *   GARAGE_CONTAINER — docker name (default cabin-garage); set empty to skip docker website
 *
 * Examples:
 *   Local:  ARCHIVE_CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
 *   VPS IP: ARCHIVE_CORS_ORIGINS=http://YOUR_VPS_IP:8080
 *   Domain: ARCHIVE_CORS_ORIGINS=https://pms.yourdomain.com
 */

import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(__dirname, '../../apps/api/package.json'));
const {
  S3Client,
  PutBucketCorsCommand,
  GetBucketCorsCommand,
} = require('@aws-sdk/client-s3');

const endpoint = process.env.ARCHIVE_S3_ENDPOINT?.trim();
const region = process.env.ARCHIVE_S3_REGION?.trim() || 'garage';
const accessKeyId =
  process.env.ARCHIVE_S3_ACCESS_KEY_ID?.trim() ||
  process.env.GARAGE_DEFAULT_ACCESS_KEY?.trim();
const secretAccessKey =
  process.env.ARCHIVE_S3_SECRET_ACCESS_KEY?.trim() ||
  process.env.GARAGE_DEFAULT_SECRET_KEY?.trim();
const bucket =
  process.env.ARCHIVE_S3_BUCKET?.trim() ||
  process.env.GARAGE_DEFAULT_BUCKET?.trim() ||
  'cabin-archive';
const forcePathStyleRaw =
  process.env.ARCHIVE_S3_FORCE_PATH_STYLE?.trim().toLowerCase();
const forcePathStyle =
  forcePathStyleRaw === undefined ||
  forcePathStyleRaw === '' ||
  forcePathStyleRaw === 'true' ||
  forcePathStyleRaw === '1';
const container =
  process.env.GARAGE_CONTAINER === undefined
    ? 'cabin-garage'
    : process.env.GARAGE_CONTAINER.trim();
const corsOrigins = (process.env.ARCHIVE_CORS_ORIGINS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function fail(msg) {
  console.error(`archive:bootstrap: ${msg}`);
  process.exit(1);
}

if (!endpoint) fail('ARCHIVE_S3_ENDPOINT is required');
if (!accessKeyId || !secretAccessKey) {
  fail('ARCHIVE_S3_ACCESS_KEY_ID / ARCHIVE_S3_SECRET_ACCESS_KEY (or GARAGE_DEFAULT_*) required');
}
if (corsOrigins.length === 0) {
  fail(
    'ARCHIVE_CORS_ORIGINS is required (comma-separated). Example: http://localhost:5173 or http://VPS_IP:8080',
  );
}

const client = new S3Client({
  region,
  endpoint,
  forcePathStyle,
  credentials: { accessKeyId, secretAccessKey },
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});

async function waitForS3(maxAttempts = 30) {
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      const res = await fetch(endpoint, { method: 'GET' });
      // Any HTTP response means the listener is up (403/400 OK).
      if (res.status > 0) return;
    } catch {
      // retry
    }
    console.log(`archive:bootstrap: waiting for ${endpoint} (${i}/${maxAttempts})…`);
    await new Promise((r) => setTimeout(r, 1000));
  }
  fail(`S3 endpoint not reachable: ${endpoint}`);
}

function enableWebsite() {
  if (!container) {
    console.log('archive:bootstrap: GARAGE_CONTAINER empty — skip website CLI');
    return;
  }
  const result = spawnSync(
    'docker',
    ['exec', container, '/garage', 'bucket', 'website', '--allow', bucket],
    { encoding: 'utf8' },
  );
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout);
    fail(
      `docker exec website --allow failed (is ${container} running?). Set GARAGE_CONTAINER= to skip.`,
    );
  }
  console.log(`archive:bootstrap: website enabled on bucket ${bucket}`);
}

async function applyCors() {
  // One origin per rule — Garage may emit a multi-value ACAO if origins share a rule.
  const CORSRules = corsOrigins.map((origin) => ({
    AllowedOrigins: [origin],
    AllowedMethods: ['GET', 'PUT', 'HEAD', 'OPTIONS'],
    AllowedHeaders: ['*'],
    ExposeHeaders: ['ETag', 'Content-Length'],
    MaxAgeSeconds: 3000,
  }));

  await client.send(
    new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: { CORSRules },
    }),
  );

  const got = await client.send(new GetBucketCorsCommand({ Bucket: bucket }));
  const rules = got.CORSRules ?? [];
  console.log(`archive:bootstrap: CORS rules applied (${rules.length}):`);
  for (const rule of rules) {
    console.log(`  - ${(rule.AllowedOrigins ?? []).join(', ')}`);
  }

  // Sanity: preflight must return a single ACAO (not a comma list).
  const probeOrigin = corsOrigins[0];
  const probe = await fetch(`${endpoint.replace(/\/+$/, '')}/${bucket}/archive/cors-probe`, {
    method: 'OPTIONS',
    headers: {
      Origin: probeOrigin,
      'Access-Control-Request-Method': 'PUT',
      'Access-Control-Request-Headers': 'content-type',
    },
  });
  const acao = probe.headers.get('access-control-allow-origin');
  console.log(`archive:bootstrap: OPTIONS probe Origin=${probeOrigin} → ACAO=${acao}`);
  if (!acao || acao.includes(',')) {
    fail(
      `Bad Access-Control-Allow-Origin (${acao}). Use one origin per rule; check Garage version.`,
    );
  }
  if (acao !== probeOrigin && acao !== '*') {
    fail(`ACAO ${acao} did not match probe origin ${probeOrigin}`);
  }
}

await waitForS3();
enableWebsite();
await applyCors();
console.log('archive:bootstrap: done');
