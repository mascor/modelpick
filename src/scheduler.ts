/**
 * Daily update, server-side and independent of site traffic.
 *
 * Implemented with a plain timer instead of a cron library: one dependency
 * fewer, and the next run time is computed in the documented timezone.
 */
import { SCHEDULE } from './config.js';
import { runUpdate } from './pipeline/run.js';
import { loadCurrent } from './pipeline/store.js';
import { hoursSince } from './lib/normalize.js';

const log = (msg: string) => console.log(`[modelpick:scheduler] ${new Date().toISOString()} ${msg}`);

/** Milliseconds until the next HH:MM in the configured timezone. */
export function msUntilNextRun(now = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: SCHEDULE.timezone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? '0');
  const secondsNow = get('hour') * 3600 + get('minute') * 60 + get('second');
  const target = SCHEDULE.hour * 3600 + SCHEDULE.minute * 60;
  const delta = target - secondsNow;
  const seconds = delta > 0 ? delta : delta + 86_400;
  return seconds * 1000;
}

async function runOnce(reason: string) {
  log(`starting update (${reason})`);
  try {
    const status = await runUpdate();
    log(`${status.ok ? 'ok' : 'with problems'}: ${status.message}`);
    for (const w of status.warnings) log(`  - ${w}`);
  } catch (err) {
    // A failed run must never kill the scheduler.
    log(`unhandled error: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function scheduleNext() {
  const wait = msUntilNextRun();
  log(`next update in ${Math.round(wait / 60_000)} minutes (${SCHEDULE.hour}:${String(SCHEDULE.minute).padStart(2, '0')} ${SCHEDULE.timezone})`);
  setTimeout(async () => {
    await runOnce('scheduled time');
    scheduleNext();
  }, wait).unref?.();
}

const invokedDirectly = process.argv[1] && /scheduler\.(ts|js)$/.test(process.argv[1]);
if (invokedDirectly) {
  const snapshot = await loadCurrent();
  const age = hoursSince(snapshot?.generatedAt);
  if (!snapshot || (age !== null && age > SCHEDULE.catchUpAfterHours)) {
    await runOnce(snapshot ? `data is ${Math.round(age!)} hours old` : 'no published snapshot');
  }
  scheduleNext();
  // Keep the process alive for the timers.
  setInterval(() => {}, 1 << 30);
}
