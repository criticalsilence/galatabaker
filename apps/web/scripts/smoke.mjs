#!/usr/bin/env node
/* eslint-disable -- Node CLI script: not part of the app bundle, uses
   Node 22 globals (fetch, process, console) that the shared ESLint
   config doesn't whitelist for the web workspace. */
//
// Starts the production server (or assumes one is already on PORT),
// fetches each route, and asserts HTTP 200 + a non-empty body.
// Pages with auth-only UX still render the shell; auth-state is
// hydrated client-side, so 200 is the right signal here.
//
// Usage:
//   PORT=3000 WEB_BASE=http://localhost:3000 node smoke.mjs
//
// The script prefers an externally-started server (set WEB_BASE)
// so CI can manage lifecycle. Without WEB_BASE it spawns
// `pnpm start` itself and tears it down on exit.

import { spawn } from 'node:child_process';
import { setTimeout as wait } from 'node:timers/promises';

const PORT = process.env.PORT ?? '3000';
const EXTERNAL = process.env.WEB_BASE;
const BASE = EXTERNAL ?? `http://localhost:${PORT}`;

const ROUTES = ['/', '/dashboard', '/delegate', '/rewards', '/sign-in'];

function log(stage, ok, detail) {
  const icon = ok ? '✓' : '✗';
  console.log(`${icon} [${stage}] ${detail}`);
  if (!ok) process.exit(1);
}

let child;
async function maybeStartServer() {
  if (EXTERNAL) return;
  console.log(`[smoke] spawning 'pnpm start' on :${PORT} …`);
  child = spawn('pnpm', ['start'], {
    env: { ...process.env, PORT },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (b) => process.stdout.write(`  > ${b}`));
  child.stderr.on('data', (b) => process.stderr.write(`  ! ${b}`));
  // Poll / until ready (max 30s)
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(BASE);
      if (r.ok) return;
    } catch {
      /* not ready yet */
    }
    await wait(500);
  }
  throw new Error('next start did not become ready in 30s');
}

async function shutdown() {
  if (child) {
    child.kill('SIGTERM');
    await new Promise((r) => child.once('exit', r));
  }
}

try {
  await maybeStartServer();
  for (const route of ROUTES) {
    const res = await fetch(BASE + route, { redirect: 'manual' });
    const body = await res.text();
    const ok = res.status === 200 && body.length > 100;
    log('PAGE ' + route, ok, `status=${res.status} bytes=${body.length}`);
  }
  log('ALL', true, `${ROUTES.length} routes returned 200`);
} finally {
  await shutdown();
}
