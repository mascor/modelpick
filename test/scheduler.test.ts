import { test } from 'node:test';
import assert from 'node:assert/strict';
import { msUntilNextRun } from '../src/scheduler.js';

test('the next update always falls within 24 hours', () => {
  for (const iso of ['2026-09-22T00:00:00Z', '2026-09-22T04:29:00Z', '2026-09-22T04:31:00Z', '2026-09-22T23:59:00Z']) {
    const ms = msUntilNextRun(new Date(iso));
    assert.ok(ms > 0, `${iso} must produce a positive wait`);
    assert.ok(ms <= 86_400_000, `${iso} must stay within 24 hours`);
  }
});

test('the scheduled time is the documented one in the Rome time zone', () => {
  // 06:30 Europe/Rome = 04:30 UTC during daylight saving time.
  const ms = msUntilNextRun(new Date('2026-09-22T04:00:00Z'));
  assert.equal(Math.round(ms / 60_000), 30);
});
