#!/usr/bin/env node
/**
 * Copy a scenario .ics pair into active/ for the fixture server.
 *
 * Usage:
 *   node scripts/ical-fixtures/set-scenario.mjs 01-happy-path
 *   node scripts/ical-fixtures/set-scenario.mjs 07-sibling-feed
 *   node scripts/ical-fixtures/set-scenario.mjs --list
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const SCENARIOS_DIR = join(ROOT, 'scenarios');
const ACTIVE_DIR = join(ROOT, 'active');
const MANIFEST_PATH = join(SCENARIOS_DIR, 'manifest.json');

function loadManifest() {
  return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
}

function usage() {
  const manifest = loadManifest();
  const ids = manifest.scenarios.map((s) => `  ${s.id}`).join('\n');
  console.log(`Usage: pnpm ical:fixture:set <scenario-id>

Scenarios:
${ids}

Prep helpers (not in manifest table — use before parent scenario):
  03-prep-airbnb-only-demo-002 — Airbnb only James Chen before 09-ota-mesh-booking-com
  05-prep-with-demo-003   — import cabin-demo-003 before 05-missing-trigger
  07-prep-moved-on-unit-a — import on unit A before 07-sibling-feed
`);
}

function copyScenario(scenarioId) {
  const manifest = loadManifest();
  const hit = manifest.scenarios.find((s) => s.id === scenarioId);

  let unitAFile;
  let unitBFile;
  let bookingComFile;
  let agodaFile;

  if (hit) {
    unitAFile = hit.unitA;
    unitBFile = hit.unitB ?? 'decoy-only.ics';
    bookingComFile = hit.bookingCom ?? 'decoy-only.ics';
    agodaFile = hit.agoda ?? 'decoy-only.ics';
  } else if (scenarioId === '03-prep-airbnb-only-demo-002') {
    unitAFile = '03-prep-airbnb-only-demo-002.ics';
    unitBFile = 'decoy-only.ics';
    bookingComFile = 'decoy-only.ics';
    agodaFile = 'decoy-only.ics';
  } else if (scenarioId === '05-prep-with-demo-003') {
    unitAFile = '05-prep-with-demo-003.ics';
    unitBFile = 'decoy-only.ics';
    bookingComFile = 'decoy-only.ics';
    agodaFile = 'decoy-only.ics';
  } else if (scenarioId === '07-prep-moved-on-unit-a') {
    unitAFile = '07-prep-moved-on-unit-a.ics';
    unitBFile = 'decoy-only.ics';
    bookingComFile = 'decoy-only.ics';
    agodaFile = 'decoy-only.ics';
  } else {
    const direct = `${scenarioId}.ics`;
    if (existsSync(join(SCENARIOS_DIR, direct))) {
      unitAFile = direct;
      unitBFile = 'decoy-only.ics';
      bookingComFile = 'decoy-only.ics';
      agodaFile = 'decoy-only.ics';
    } else {
      console.error(`Unknown scenario: ${scenarioId}`);
      usage();
      process.exit(1);
    }
  }

  const srcA = join(SCENARIOS_DIR, unitAFile);
  const srcB = join(SCENARIOS_DIR, unitBFile);
  const srcBookingCom = join(SCENARIOS_DIR, bookingComFile);
  const srcAgoda = join(SCENARIOS_DIR, agodaFile);
  if (!existsSync(srcA)) {
    console.error(`Missing scenario file: ${srcA}`);
    process.exit(1);
  }
  if (!existsSync(srcB)) {
    console.error(`Missing scenario file: ${srcB}`);
    process.exit(1);
  }
  if (!existsSync(srcBookingCom)) {
    console.error(`Missing scenario file: ${srcBookingCom}`);
    process.exit(1);
  }
  if (!existsSync(srcAgoda)) {
    console.error(`Missing scenario file: ${srcAgoda}`);
    process.exit(1);
  }

  mkdirSync(ACTIVE_DIR, { recursive: true });
  copyFileSync(srcA, join(ACTIVE_DIR, 'unit-a.ics'));
  copyFileSync(srcB, join(ACTIVE_DIR, 'unit-b.ics'));
  copyFileSync(srcBookingCom, join(ACTIVE_DIR, 'booking-com-unit-a.ics'));
  copyFileSync(srcAgoda, join(ACTIVE_DIR, 'agoda-unit-a.ics'));
  writeFileSync(join(ACTIVE_DIR, 'scenario-id.txt'), scenarioId, 'utf8');

  const title = hit?.title ?? scenarioId;
  console.log(`Active scenario: ${scenarioId} — ${title}`);
  console.log(`  active/unit-a.ics ← scenarios/${unitAFile}`);
  console.log(`  active/unit-b.ics ← scenarios/${unitBFile}`);
  console.log(
    `  active/booking-com-unit-a.ics ← scenarios/${bookingComFile}`,
  );
  console.log(`  active/agoda-unit-a.ics ← scenarios/${agodaFile}`);
  if (hit?.expects) {
    console.log(`  Expect: ${hit.expects}`);
  }
  console.log('\nNext: Dashboard → Sync all (or wait for cron)');
}

const arg = process.argv[2];
if (!arg || arg === '--help' || arg === '-h') {
  usage();
  process.exit(arg ? 0 : 1);
}
if (arg === '--list' || arg === 'list') {
  usage();
  process.exit(0);
}

copyScenario(arg);
