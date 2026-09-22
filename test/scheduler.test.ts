import { test } from 'node:test';
import assert from 'node:assert/strict';
import { msUntilNextRun } from '../src/scheduler.js';

test('il prossimo aggiornamento cade sempre entro le 24 ore', () => {
  for (const iso of ['2026-09-22T00:00:00Z', '2026-09-22T04:29:00Z', '2026-09-22T04:31:00Z', '2026-09-22T23:59:00Z']) {
    const ms = msUntilNextRun(new Date(iso));
    assert.ok(ms > 0, `${iso} deve produrre un attesa positiva`);
    assert.ok(ms <= 86_400_000, `${iso} deve restare entro 24 ore`);
  }
});

test('l orario pianificato e quello documentato nel fuso di Roma', () => {
  // 06:30 Europe/Rome = 04:30 UTC con l ora legale.
  const ms = msUntilNextRun(new Date('2026-09-22T04:00:00Z'));
  assert.equal(Math.round(ms / 60_000), 30);
});
