#!/usr/bin/env node
/**
 * Local OTA iCal fixture server for Cabin PMS demos.
 *
 * Serves stable URLs — swap scenario files with `pnpm ical:fixture:set <id>`.
 *
 *   Unit A Airbnb:    http://localhost:8765/airbnb/unit-a.ics
 *   Unit A Booking:   http://localhost:8765/booking-com/unit-a.ics
 *   Unit A Agoda:     http://localhost:8765/agoda/unit-a.ics
 *   Unit B (sibling): http://localhost:8765/airbnb/unit-b.ics
 *   HTTP errors:      http://localhost:8765/errors/http-404.ics
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const ACTIVE_DIR = join(ROOT, 'active');
const MANIFEST_PATH = join(ROOT, 'scenarios', 'manifest.json');
const PORT = Number(process.env.ICAL_FIXTURE_PORT ?? 8765);

function readActive(name) {
  const path = join(ACTIVE_DIR, name);
  if (!existsSync(path)) {
    return null;
  }
  return readFileSync(path, 'utf8');
}

function loadManifest() {
  try {
    return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
  } catch {
    return { scenarios: [], uids: {} };
  }
}

function escapeHtml(s) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function renderIndex() {
  const manifest = loadManifest();
  const unitA = readActive('unit-a.ics');
  const activeId = readActive('scenario-id.txt')?.trim();
  const activeMeta = manifest.scenarios.find((s) => s.id === activeId);

  const rows = manifest.scenarios
    .map(
      (s) => `
    <tr>
      <td><code>${escapeHtml(s.id)}</code></td>
      <td>${escapeHtml(s.title)}</td>
      <td>${escapeHtml(s.expects)}</td>
      <td><code>pnpm ical:fixture:set ${escapeHtml(s.id)}</code></td>
    </tr>`,
    )
    .join('');

  const uidRows = Object.entries(manifest.uids ?? {})
    .map(
      ([uid, label]) =>
        `<tr><td><code>${escapeHtml(uid)}</code></td><td>${escapeHtml(label)}</td></tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Cabin PMS — iCal fixtures</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 960px; margin: 2rem auto; padding: 0 1rem; line-height: 1.5; }
    code { background: #f4f4f5; padding: 0.1em 0.35em; border-radius: 4px; font-size: 0.9em; }
    table { border-collapse: collapse; width: 100%; margin: 1rem 0; font-size: 0.92rem; }
    th, td { border: 1px solid #e4e4e7; padding: 0.5rem 0.65rem; text-align: left; vertical-align: top; }
    th { background: #fafafa; }
    .urls { background: #fffbeb; border: 1px solid #fde68a; padding: 1rem; border-radius: 8px; }
    h1 { font-size: 1.35rem; }
    h2 { font-size: 1.1rem; margin-top: 2rem; }
  </style>
</head>
<body>
  <h1>Cabin PMS — mock OTA iCal feeds</h1>
  <p>Paste these URLs into unit <strong>Calendars → Airbnb import</strong>, then <strong>Dashboard → Sync all</strong>.</p>
  <div class="urls">
    <p><strong>Unit A — Airbnb</strong> (e.g. B-0801):<br /><code>http://localhost:${PORT}/airbnb/unit-a.ics</code></p>
    <p><strong>Unit A — Booking.com</strong> (mesh overlap demo):<br /><code>http://localhost:${PORT}/booking-com/unit-a.ics</code></p>
    <p><strong>Unit A — Agoda</strong> (mesh overlap demo):<br /><code>http://localhost:${PORT}/agoda/unit-a.ics</code></p>
    <p><strong>Unit B</strong> (e.g. B-0802, sibling demo only):<br /><code>http://localhost:${PORT}/airbnb/unit-b.ics</code></p>
    <p><strong>HTTP error demos</strong> (paste temporarily):<br /><code>http://localhost:${PORT}/errors/http-404.ics</code> · <code>http://localhost:${PORT}/errors/http-500.ics</code></p>
    <p>Active scenario guess: <strong>${escapeHtml(activeMeta?.id ?? 'custom / run ical:fixture:set')}</strong></p>
    <p>Unit A body: ${unitA ? `${unitA.split('\n').filter(Boolean).length} lines` : '<em>missing — run pnpm ical:fixture:set 01-happy-path</em>'}</p>
  </div>
  <h2>Switch scenario</h2>
  <table>
    <thead><tr><th>ID</th><th>Title</th><th>Expected PMS behavior</th><th>Command</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <h2>Fixture UIDs</h2>
  <table>
    <thead><tr><th>UID</th><th>Role</th></tr></thead>
    <tbody>${uidRows}</tbody>
  </table>
  <p>Full matrix: <code>scripts/ical-fixtures/COVERAGE.md</code> · Walkthrough: <code>README.md</code></p>
</body>
</html>`;
}

const server = createServer((req, res) => {
  const url = req.url?.split('?')[0] ?? '/';

  if (url === '/' || url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(renderIndex());
    return;
  }

  if (url === '/errors/http-404.ics') {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found (fixture)');
    return;
  }

  if (url === '/errors/http-500.ics') {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Internal Server Error (fixture)');
    return;
  }

  const feedMap = {
    '/airbnb/unit-a.ics': 'unit-a.ics',
    '/airbnb/unit-b.ics': 'unit-b.ics',
    '/booking-com/unit-a.ics': 'booking-com-unit-a.ics',
    '/agoda/unit-a.ics': 'agoda-unit-a.ics',
  };

  const activeName = feedMap[url];
  if (activeName) {
    const body = readActive(activeName);
    if (!body) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(
        `Missing active/${activeName}. Run: pnpm ical:fixture:set 01-happy-path`,
      );
      return;
    }
    res.writeHead(200, {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    res.end(body);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found. Try /airbnb/unit-a.ics or /');
});

server.listen(PORT, () => {
  console.log(`iCal fixture server http://localhost:${PORT}/`);
  console.log(`  Unit A Airbnb:  http://localhost:${PORT}/airbnb/unit-a.ics`);
  console.log(
    `  Unit A Booking: http://localhost:${PORT}/booking-com/unit-a.ics`,
  );
  console.log(`  Unit A Agoda:   http://localhost:${PORT}/agoda/unit-a.ics`);
  console.log(`  Unit B Airbnb:  http://localhost:${PORT}/airbnb/unit-b.ics`);
  console.log(`  HTTP 404 demo:  http://localhost:${PORT}/errors/http-404.ics`);
  console.log('  Switch: pnpm ical:fixture:set <scenario-id>');
});
