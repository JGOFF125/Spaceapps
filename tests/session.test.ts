import { test } from 'node:test';
import assert from 'node:assert/strict';
import { actOnAlert, activeAlerts, advanceMission, completeShelter, configureLink, createMission, dismissAlert, packReport, receiveEarthAdvice, recordChecklist, restoreMission, seekMission, serializeMission, triggerStorm } from '../src/mission/session.ts';
import { setBlackout, setMarsMode } from '../src/brain/outbox.ts';
import { adviceBadge, arrived, earthSnapshot, earthVisibleDay, restoreEarthSnapshot } from '../src/mission/earth.ts';

test('dashboard action uses actual Engine treatment and closes the Brain loop', () => {
  let state = createMission(63);
  const alert = activeAlerts(state).find(a => a.astronautId === 'maya')!;
  state = actOnAlert(state, alert.id);
  assert.equal(state.treatments[0].day, 63);
  assert.equal(state.outbox.messages[0].state, 'stored');
  assert.deepEqual(actOnAlert(state, alert.id), state);
  state = advanceMission(state, 66);
  assert.equal(state.brain.alerts.find(a => a.id === alert.id)!.status, 'recovered');
  assert.equal(state.readings.find(r => r.astronautId === 'maya' && r.day === 66)!.hrv, 65);
});
test('new alerts queue once and onboard actions remain available in blackout', () => {
  let state = createMission(58);
  state.outbox = setBlackout(setMarsMode(state.outbox, true), true);
  state = advanceMission(state, 63);
  assert.equal(state.outbox.messages.length, 1);
  assert.equal(advanceMission(state, 63.5).outbox.messages.length, 1);
  const a = activeAlerts(state)[0];
  state = advanceMission(actOnAlert(state, a.id), 66);
  assert.equal(state.brain.alerts[0].status, 'recovered');
  assert.ok(state.outbox.messages.every(m => m.state === 'stored'));
});
test('solar event adds cumulative dose from the event day and deduplicates', () => {
  const before = createMission(30);
  const state = triggerStorm(before);
  for (const person of ['maya', 'leo', 'ana', 'sam']) {
    const at = (s: typeof state, day: number) => s.readings.find(r => r.astronautId === person && r.day === day)!.radiationDose;
    assert.equal(at(state, 29), at(before, 29));
    assert.ok(Math.abs(at(state, 30) - at(before, 30) - 20) < 1e-9);
    assert.ok(Math.abs(at(state, 180) - at(before, 180) - 20) < 1e-9);
  }
  assert.equal(state.stormAlerts[0].astronautId, 'CREW');
  assert.equal(state.outbox.messages[0].priority, 'emergency');
  assert.equal(triggerStorm(state).storms.length, 1);
});
test('treating an astronaut retains solar exposure and shelter actions do not treat CREW as a person', () => {
  let state = triggerStorm(createMission(63));
  state = actOnAlert(state, state.stormAlerts[0].id);
  assert.equal(state.treatments.length, 0);
  state = actOnAlert(state, state.brain.alerts[0].id);
  assert.equal(state.stormAlerts[0].status, 'acting');
  assert.ok(state.readings.find(r => r.astronautId === 'maya' && r.day === 66)!.radiationDose > 80);
});
test('refresh restores treatment clocks, checklists, dismissals and radiation dose', () => {
  let state = triggerStorm(createMission(63));
  state = actOnAlert(state, state.brain.alerts[0].id);
  state.checklists[state.brain.alerts[0].id] = [0, 1];
  state = dismissAlert(state, state.stormAlerts[0].id, 'Reviewed by the simulated crew medic');
  state = advanceMission(state, 64.25);
  const restored = restoreMission(serializeMission(state));
  assert.deepEqual(restored, state);
  assert.deepEqual(advanceMission(restored, 66), advanceMission(state, 66));
  assert.ok(!serializeMission(state).includes('private-checkin'));
});
test('reset reconstructs an untreated mission and clears dose spikes and dismissed alerts', () => {
  let previous = triggerStorm(createMission(63));
  previous = actOnAlert(previous, previous.brain.alerts[0].id);
  const fresh = createMission(1);
  assert.equal(fresh.brain.alerts.length, 0);
  assert.equal(fresh.treatments.length, 0);
  assert.equal(fresh.storms.length, 0);
  assert.equal(fresh.outbox.messages.length, 0);
  assert.ok(fresh.readings.find(r => r.astronautId === 'maya' && r.day === 66)!.hrv < 65);
});
test('dismissal needs a reason, is retained, and cannot start treatment afterward', () => {
  let state = createMission(63);
  const a = activeAlerts(state)[0];
  assert.throws(() => dismissAlert(state, a.id, ''));
  state = dismissAlert(state, a.id, 'Sensor review completed');
  assert.equal(activeAlerts(state).length, 0);
  assert.deepEqual(actOnAlert(state, a.id), state);
  assert.equal(state.brain.alerts.length, 1);
});
test('invalid saved event history is rejected and the mission stops at day 180', () => {
  assert.throws(() => restoreMission('{}'));
  const state = createMission(30);
  assert.throws(() => restoreMission(JSON.stringify({ ...state, treatments: [{ astronautId: 'maya', day: 90 }] })));
  assert.throws(() => advanceMission(state, 29));
  assert.equal(advanceMission(state, 181).day, 180);
});

test('skipping days queues alerts on their detection day with identical delivery timing', () => {
  const initial = configureLink(createMission(58), { marsMode: true });
  const jumped = advanceMission(initial, 66);
  let stepped = initial;
  for (let day = 59; day <= 66; day++) stepped = advanceMission(stepped, day);
  const packets = (s: typeof initial) => s.outbox.messages.map(({ id, ...m }) => ({ ...m, timing: s.outbox.timings[id] }));
  assert.deepEqual(packets(jumped), packets(stepped));
  assert.equal(jumped.outbox.messages[0].day, jumped.brain.alerts[0].day);
  assert.equal(jumped.outbox.messages[0].state, 'confirmed');
});

test('packing a report records the final checklist step only when a real packet exists', () => {
  let state = configureLink(createMission(63), { blackout: true });
  const id = state.brain.alerts[0].id;
  state = recordChecklist(state, id, 0);
  assert.deepEqual(recordChecklist(state, id, 4), state);
  assert.deepEqual(recordChecklist(state, 'unknown', 1), state);
  state = packReport(state, id);
  assert.deepEqual(state.checklists[id], [0, 4]);
  const message = state.outbox.messages.find(m => m.id === state.reports[id])!;
  assert.equal(message.state, 'stored');
  assert.match(message.summary, /2\/5 guided steps/);
  assert.deepEqual(restoreMission(serializeMission(state)), state);
});

test('shelter completion requires four recorded checks and a packed report, retaining dose', () => {
  let state = triggerStorm(createMission(30));
  const id = state.stormAlerts[0].id;
  state.checklists[id] = [0, 1, 2, 3, 4];
  assert.equal(completeShelter(state, id).stormAlerts[0].status, 'open');
  state.checklists[id] = [];
  for (let i = 0; i < 4; i++) state = recordChecklist(state, id, i);
  assert.equal(completeShelter(state, id).stormAlerts[0].status, 'open');
  state = packReport(state, id);
  const doses = state.readings.map(r => r.radiationDose);
  state = completeShelter(state, id);
  assert.equal(state.stormAlerts[0].status, 'recovered');
  assert.deepEqual(state.readings.map(r => r.radiationDose), doses);
});

test('story jumps retain past actions and rewind clears future events and packets', () => {
  let state = advanceMission(createMission(58), 63);
  state = actOnAlert(state, activeAlerts(state)[0].id);
  state = seekMission(state, 102);
  assert.equal(state.treatments[0].day, 63);
  assert.equal(state.brain.alerts.find(a => a.astronautId === 'maya')!.status, 'recovered');
  state = actOnAlert(state, activeAlerts(state).find(a => a.astronautId === 'sam')!.id);
  state = advanceMission(triggerStorm(state), 110);
  const replayed = seekMission(state, 66);
  assert.deepEqual(replayed.treatments, [{ astronautId: 'maya', day: 63 }]);
  assert.equal(replayed.brain.alerts.find(a => a.astronautId === 'maya')!.status, 'recovered');
  assert.equal(replayed.storms.length, 0);
  assert.ok(replayed.brain.alerts.every(a => a.day <= 66));
  assert.equal(replayed.outbox.messages.length, 0);
  assert.notEqual(replayed.missionId, state.missionId);
  assert.deepEqual(seekMission(state, 58).treatments, []);
});

test('Earth advice waits for an arrived source report, a relay, and a one-way return leg', () => {
  let state = packReport(configureLink(createMission(30), { marsMode: true }));
  const reply = { id: 'earth-test', missionId: state.missionId, sourceMessageId: state.outbox.messages[0].id, summary: 'Simulated mission-support advice' };
  assert.deepEqual(receiveEarthAdvice(state, reply), state);
  state = advanceMission(state, 30.75);
  assert.equal(state.outbox.messages[0].state, 'received');
  state = receiveEarthAdvice(state, reply);
  assert.equal(state.inbox.messages[0].state, 'stored');
  assert.deepEqual(receiveEarthAdvice(state, reply), state);
  assert.deepEqual(receiveEarthAdvice(state, { ...reply, id: 'stale', missionId: 'old-timeline' }), state);
  state = advanceMission(state, 31);
  assert.equal(state.inbox.messages[0].state, 'sent');
  assert.equal(arrived(state.inbox.messages[0]), false);
  state = advanceMission(state, 31.5);
  assert.equal(state.inbox.messages[0].state, 'received');
  assert.match(adviceBadge(state.inbox.messages[0], earthSnapshot(state)), /Left Earth 22 min ago · based on data from 66 min ago · arrived onboard/);
  assert.deepEqual(restoreMission(serializeMission(state)), state);
});

test('blackout stores Earth replies, link changes freeze in-flight delay, reset rejects stale replies', () => {
  let state = advanceMission(packReport(configureLink(createMission(30), { marsMode: true })), 30.75);
  const reply = { id: 'earth-blackout', missionId: state.missionId, sourceMessageId: state.outbox.messages[0].id, summary: 'Check the received report with the crew medic.' };
  state = receiveEarthAdvice(configureLink(state, { blackout: true }), reply);
  state = advanceMission(state, 32);
  assert.equal(state.inbox.messages[0].state, 'stored');
  state = advanceMission(configureLink(state, { blackout: false }), 32.25);
  state = configureLink(state, { marsMode: false });
  assert.equal(state.inbox.lightTimeMin, 3);
  assert.equal(state.inbox.messages[0].lightTimeMin, 22);
  state = advanceMission(state, 32.75);
  assert.equal(state.inbox.messages[0].state, 'received');
  const reset = createMission(1);
  assert.deepEqual(receiveEarthAdvice(reset, reply), reset);
});

test('Earth snapshots include only communication state and a consistent delayed clock', () => {
  const state = configureLink(createMission(63), { marsMode: true });
  const snapshot = earthSnapshot(state);
  assert.equal(earthVisibleDay(snapshot), 62.5);
  assert.deepEqual(restoreEarthSnapshot(snapshot), snapshot);
  assert.equal('readings' in snapshot, false);
  assert.equal('brain' in snapshot, false);
  snapshot.day = 62;
  assert.throws(() => restoreEarthSnapshot(snapshot));
});

test('older saved sessions migrate to a separate Earth inbox without losing onboard actions', () => {
  let state = createMission(63);
  state = actOnAlert(state, state.brain.alerts[0].id);
  const old = JSON.parse(serializeMission(state));
  for (const key of ['missionId', 'inbox', 'earthReplies', 'reports']) delete old[key];
  const restored = restoreMission(JSON.stringify(old));
  assert.deepEqual(restored.treatments, state.treatments);
  assert.equal(restored.inbox.day, state.day);
  assert.equal(restored.inbox.messages.length, 0);
});

test('corrupt care or advice storage fails validation instead of rendering a broken console', () => {
  const state = createMission(63);
  assert.throws(() => restoreMission(JSON.stringify({ ...state, checklists: { unknown: [0] } })));
  assert.throws(() => restoreMission(JSON.stringify({ ...state, brain: { ...state.brain, activeEpisodes: { bad: 'unknown' } } })));
  assert.throws(() => restoreMission(JSON.stringify({ ...state, earthReplies: { bad: null } })));
  assert.throws(() => restoreEarthSnapshot({ ...earthSnapshot(state), earthReplies: { bad: null } }));
});

test('the integrated 180-day mission completes every care loop in Mars blackout', () => {
  let state = configureLink(createMission(1), { marsMode: true, blackout: true });
  const treated = new Set<string>();
  for (let day = 2; day <= 180; day++) {
    state = advanceMission(state, day);
    for (const alert of activeAlerts(state)) if (alert.astronautId !== 'CREW' && alert.status === 'open') {
      state = packReport(actOnAlert(state, alert.id), alert.id);
      treated.add(alert.astronautId);
    }
  }
  assert.deepEqual([...treated].sort(), ['leo', 'maya', 'sam']);
  assert.ok(state.brain.alerts.every(a => a.status === 'recovered'));
  assert.equal(state.day, 180);
  assert.ok(state.outbox.messages.every(m => m.state === 'stored'));
  assert.deepEqual(restoreMission(serializeMission(state)), state);
});
