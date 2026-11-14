import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixtureMission } from '../dev/fixtures.ts';
import { computeBaseline, driftScore, evaluateDay, driftLevel, updateAlertStatus, advanceBrain, createBrainState, startAction } from '../src/brain/index.ts';
import type { Reading } from '../src/types.ts';
const clean = fixtureMission([], true, false);
const stories = fixtureMission();
const change = (rows: Reading[], id: string, from: number, to: number, values: Partial<Reading>) => rows.map(r => r.astronautId === id && r.day >= from && r.day <= to ? { ...r, ...values } : r);

test('baseline uses only the selected astronaut and learning days', () => {
  const b = computeBaseline(stories, 'maya')!;
  assert.ok(Math.abs(b.heartRate.mean - 58) < 0.1); assert.ok(b.hrv.stdDev > 0);
  assert.deepEqual(b, computeBaseline(change(stories, 'maya', 15, 180, { hrv: 1 }), 'maya'));
  assert.notEqual(b.hrv.mean, computeBaseline(stories, 'leo')!.hrv.mean);
});
test('incomplete baseline, unknown astronaut and invalid data do not fabricate readiness', () => {
  assert.equal(computeBaseline(clean.filter(r => r.day !== 7), 'maya'), null);
  assert.equal(computeBaseline(clean, 'unknown'), null);
  assert.equal(driftScore(change(clean, 'maya', 3, 3, { hrv: NaN }), 'maya', 30).ready, false);
  assert.equal(driftScore(clean, 'maya', 13).ready, false);
});
test('constant baseline has zero SD and finite bounded drift', () => {
  const rows = change(clean, 'maya', 1, 180, { heartRate: 58, hrv: 65, temperature: 36.6, sleepHours: 7.8, activity: 95 });
  assert.equal(computeBaseline(rows, 'maya')!.hrv.stdDev, 0);
  assert.equal(driftScore(rows, 'maya', 20).score, 0);
  assert.ok(driftScore(change(rows, 'maya', 18, 20, { hrv: 20 }), 'maya', 20).score <= 1);
});
test('healthy mission has no alerts over 180 days', () => {
  for (let day = 1; day <= 180; day++) assert.equal(evaluateDay(clean, day).length, 0, `day ${day}`);
});
test('healthy-direction shifts contribute nothing', () => {
  assert.equal(driftScore(change(clean, 'maya', 18, 20, { hrv: 100, heartRate: 45, temperature: 36, sleepHours: 9, activity: 120 }), 'maya', 20).score, 0);
});
test('missing recent days and nonfinite readings cannot count as sustained drift', () => {
  assert.equal(driftScore(stories.filter(r => r.day !== 62), 'maya', 63).ready, false);
  assert.equal(driftScore(change(stories, 'maya', 62, 62, { hrv: Infinity }), 'maya', 63).ready, false);
});
test('duplicates and interpolated samples do not overweight days', () => {
  const duplicates = [...stories, ...stories, ...stories.map(r => ({ ...r, day: r.day + 0.3 }))];
  assert.deepEqual(driftScore(duplicates, 'maya', 63.8), driftScore(stories, 'maya', 63));
});
test('future data never affects past alerts', () => {
  assert.deepEqual(evaluateDay(stories, 63), evaluateDay(stories.filter(r => r.day <= 63), 63));
  assert.deepEqual(evaluateDay(stories, 14), []);
});
test('watch needs persistence; warning and critical use strict boundaries', () => {
  assert.equal(driftLevel(0.5, 0.4, 0), null); assert.equal(driftLevel(0.5, 0.5, 0), 'watch');
  assert.equal(driftLevel(0.45, 0.5, 0), null); assert.equal(driftLevel(0.65, 0.5, 0), 'watch');
  assert.equal(driftLevel(0.65001, 0, 0), 'warning'); assert.equal(driftLevel(0.85, 0, 0), 'warning');
  assert.equal(driftLevel(0.85001, 0, 0), 'critical');
  assert.equal(driftLevel(0, 0, 0.8), null); assert.equal(driftLevel(0, 0, 0.80001), 'critical');
});
test('Maya alerts before day 64 with explanation and action', () => {
  const a = evaluateDay(stories, 63).find(a => a.astronautId === 'maya')!;
  assert.ok(a.title.includes('Possible early infection')); assert.ok(a.why.some(reason => reason.includes('HRV')));
  assert.ok(a.action.includes('white-cell')); assert.ok(a.confidence >= 0 && a.confidence <= 1); assert.ok(a.confounders.length > 0);
});
test('temperature can trigger critical without three recent observations', () => {
  const rows = change(clean.filter(r => r.day !== 29), 'maya', 30, 30, { temperature: 37.5 });
  assert.equal(evaluateDay(rows, 30).find(a => a.astronautId === 'maya')!.level, 'critical');
});
test('sleep story has its own rule and countermeasure', () => {
  const a = evaluateDay(stories, 102).find(a => a.astronautId === 'sam')!;
  assert.ok(a.title.includes('sleep debt')); assert.ok(a.action.includes('8 hours'));
});
test('StoneWatch alerts even with normal physiological drift', () => {
  const a = evaluateDay(stories, 120).find(a => a.astronautId === 'leo')!;
  assert.ok(a.id.endsWith(':stone')); assert.ok(driftScore(stories, 'leo', 120).score < 0.1); assert.ok(a.action.includes('hydration'));
});
test('exercise and cabin CO2 appear as confounders', () => {
  const rows = change(change(stories, 'maya', 62, 62, { activity: 150 }), 'maya', 63, 63, { co2: 6000 });
  const a = evaluateDay(rows, 63).find(a => a.astronautId === 'maya')!;
  assert.ok(a.confounders.some(c => c.includes('exercise'))); assert.ok(a.confounders.some(c => c.includes('CO2')));
});
test('shared CO2 emits one crew alert but retains independent fever', () => {
  let rows = clean;
  for (const id of ['maya', 'leo', 'ana', 'sam']) rows = change(rows, id, 130, 132, { co2: 2800, hrv: 45, sleepHours: 5.5 });
  const alerts = evaluateDay(rows, 132);
  assert.equal(alerts.length, 1); assert.equal(alerts[0].astronautId, 'CREW');
  assert.equal(evaluateDay(change(rows, 'maya', 132, 132, { temperature: 37.6, heartRate: 70 }), 132).length, 2);
});
test('two affected people or normal CO2 do not create a crew alert', () => {
  let rows = clean;
  for (const id of ['maya', 'leo']) rows = change(rows, id, 130, 132, { co2: 4000, hrv: 45, sleepHours: 5.5 });
  assert.ok(!evaluateDay(rows, 132).some(a => a.astronautId === 'CREW'));
  assert.ok(!evaluateDay(stories, 120).some(a => a.astronautId === 'CREW'));
});
test('lifecycle deduplicates and action clock starts on click', () => {
  let state = advanceBrain(createBrainState(), stories, 65);
  const a = state.alerts.find(a => a.astronautId === 'maya')!;
  assert.equal(state.alerts.filter(a => a.astronautId === 'maya').length, 1);
  assert.deepEqual(advanceBrain(state, stories, 65.8), state);
  state = startAction(state, a.id, 65);
  const treated = fixtureMission([{ astronautId: 'maya', day: 65 }]);
  assert.equal(advanceBrain(state, treated, 67).alerts.find(x => x.id === a.id)!.status, 'acting');
  assert.equal(advanceBrain(state, treated, 68).alerts.find(x => x.id === a.id)!.status, 'recovered');
  assert.equal(startAction(state, a.id, 65).actionDays[a.id], 65);
});
test('failed treatment escalates after three days', () => {
  let state = advanceBrain(createBrainState(), stories, 63);
  const a = state.alerts.find(a => a.astronautId === 'maya')!;
  state = startAction(state, a.id);
  assert.equal(advanceBrain(state, fixtureMission([{ astronautId: 'maya', day: 63 }], false), 66).alerts.find(x => x.id === a.id)!.status, 'escalated');
});
test('StoneWatch recovery checks stone risk, not whole-body score', () => {
  const a = { ...evaluateDay(stories, 120).find(a => a.astronautId === 'leo')!, status: 'acting' as const };
  assert.equal(updateAlertStatus(a, fixtureMission([{ astronautId: 'leo', day: 120 }]), 120, 123).status, 'recovered');
  assert.notEqual(updateAlertStatus(a, stories, 120, 123).status, 'recovered');
});
test('sleep treatment closes the recheck loop', () => {
  const a = { ...evaluateDay(stories, 102).find(a => a.astronautId === 'sam')!, status: 'acting' as const };
  assert.equal(updateAlertStatus(a, fixtureMission([{ astronautId: 'sam', day: 102 }]), 102, 107).status, 'recovered');
});
test('open, terminal, missing-data and flat trends are not falsely recovered', () => {
  const a = evaluateDay(stories, 65).find(a => a.astronautId === 'maya')!;
  assert.equal(updateAlertStatus(a, clean, 65, 70).status, 'open');
  assert.equal(updateAlertStatus({ ...a, status: 'recovered' }, stories).status, 'recovered');
  assert.equal(updateAlertStatus({ ...a, status: 'acting' }, stories.filter(r => r.day !== 67), 65, 68).status, 'acting');
  assert.equal(updateAlertStatus({ ...a, status: 'acting' }, stories, 65, 68).status, 'acting');
});
test('reset and unknown actions fail explicitly', () => {
  assert.throws(() => advanceBrain(advanceBrain(createBrainState(), clean, 20), clean, 10));
  assert.throws(() => startAction(createBrainState(), 'missing'));
});
test('infection becoming generic drift during recovery does not create a second alert', () => {
  let state = advanceBrain(createBrainState(), stories, 63);
  state = startAction(state, state.alerts.find(a => a.astronautId === 'maya')!.id);
  state = advanceBrain(state, fixtureMission([{ astronautId: 'maya', day: 63 }]), 68);
  assert.equal(state.alerts.filter(a => a.astronautId === 'maya').length, 1);
  assert.equal(state.alerts[0].status, 'recovered');
});
test('full 180-day mission closes all three treated stories and the untreated cabin event', () => {
  let state = createBrainState();
  const treatments: { astronautId: string; day: number }[] = [];
  for (let day = 1; day <= 180; day++) {
    state = advanceBrain(state, fixtureMission(treatments), day);
    for (const alert of state.alerts.filter(a => a.status === 'open' && a.astronautId !== 'CREW')) {
      state = startAction(state, alert.id);
      treatments.push({ astronautId: alert.astronautId, day });
    }
  }
  assert.deepEqual(new Set(state.alerts.map(a => a.astronautId)), new Set(['maya', 'leo', 'sam', 'CREW']));
  assert.equal(state.alerts.length, 4);
  assert.ok(state.alerts.every(a => a.status === 'recovered'), JSON.stringify(state.alerts.map(a => [a.title, a.status])));
});
