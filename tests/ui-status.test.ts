import { test } from 'node:test';
import assert from 'node:assert/strict';
import { driftStatus, healthStatus, severityRank, stoneStatus } from '../src/ui/status.ts';
import { createMission } from '../src/mission/session.ts';

test('dashboard severity indicators match the Brain boundaries', () => {
  assert.equal(driftStatus(1, false), 'learning');
  for (const [score, expected] of [[0.45, 'nominal'], [0.4501, 'watch'], [0.65, 'watch'], [0.6501, 'warning'], [0.85, 'warning'], [0.8501, 'critical']] as const) assert.equal(driftStatus(score, true), expected);
  for (const [risk, expected] of [[0.6, 'nominal'], [0.6001, 'watch'], [0.7, 'watch'], [0.7001, 'warning'], [0.85, 'critical']] as const) assert.equal(stoneStatus(risk), expected);
  assert.ok(severityRank.critical > severityRank.warning && severityRank.warning > severityRank.watch);
});

test('a recovered critical alert does not leave the crew card red', () => {
  const alert = createMission(63).brain.alerts[0];
  assert.equal(healthStatus([alert]), 'critical');
  assert.equal(healthStatus([{ ...alert, status: 'recovered' }]), 'nominal');
  assert.equal(healthStatus([]), 'nominal');
  assert.equal(healthStatus([], true), 'learning');
});
