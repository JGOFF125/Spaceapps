import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateMission, tick } from '../src/engine/simulate.ts';
import { applyTreatment, buildMissionData } from '../src/engine/stories.ts';
import { advanceBrain, createBrainState, evaluateDay, startAction } from '../src/brain/index.ts';

test('Member 1 clean engine produces no health alerts over 180 days', () => {
  const readings = generateMission();
  for (let day = 1; day <= 180; day++) assert.deepEqual(evaluateDay(readings, day), [], `day ${day}`);
});

test('Member 1 Engine and Member 2 Brain complete all stories together', () => {
  let readings = buildMissionData();
  let state = createBrainState();
  for (let day = 1; day <= 180; day++) {
    state = advanceBrain(state, readings, day);
    for (const alert of state.alerts.filter(a => a.status === 'open' && a.astronautId !== 'CREW')) {
      state = startAction(state, alert.id);
      readings = applyTreatment(alert.astronautId, day);
    }
  }
  assert.deepEqual(new Set(state.alerts.map(a => a.astronautId)), new Set(['maya', 'sam', 'leo', 'CREW']));
  assert.equal(state.alerts.length, 4, JSON.stringify(state.alerts.map(a => [a.title, a.day, a.status])));
  assert.ok(state.alerts.every(a => a.status === 'recovered'), JSON.stringify(state.alerts.map(a => [a.title, a.status])));
  assert.ok(state.alerts.find(a => a.astronautId === 'maya')!.day < 64);
});

test('Engine interpolation is for display; canonical daily observations drive alerts', () => {
  const readings = buildMissionData();
  assert.equal(tick(readings, 63.5)[0].day, 63.5);
  assert.deepEqual(evaluateDay(readings, 63.5), evaluateDay(readings, 63));
});
