import { test } from 'node:test';
import assert from 'node:assert/strict';
import { badgeText, communicationLabel, createOutbox, enqueueMessage, lightTimeToDays, nextRelayDay, queueMessage, relayCountdownHours, restoreOutbox, serializeOutbox, setBlackout, setMarsMode, tickOutbox } from '../src/brain/outbox.ts';
import { evaluateDay } from '../src/brain/alerts.ts';
import { fixtureMission } from '../dev/fixtures.ts';
test('contract helper creates unique stored messages', () => {
  const a = queueMessage('data', '  Report  ', 'routine', 10);
  assert.equal(a.state, 'stored'); assert.equal(a.summary, 'Report');
  assert.notEqual(a.id, queueMessage('data', 'Report', 'routine', 10).id);
});
test('demo conversion and relay boundaries are explicit', () => {
  assert.equal(lightTimeToDays(22), 0.5); assert.equal(nextRelayDay(10), 10.25);
  assert.equal(nextRelayDay(10.25), 10.5); assert.equal(relayCountdownHours(10), 6);
});
test('Mars packet follows all four states at exact boundaries', () => {
  let s = enqueueMessage(setMarsMode(createOutbox(10), true), 'alert', 'Maya drift', 'priority');
  assert.equal(tickOutbox(s, 10.249).messages[0].state, 'stored');
  s = tickOutbox(s, 10.25); assert.equal(s.messages[0].state, 'sent');
  s = tickOutbox(s, 10.749); assert.equal(s.messages[0].state, 'sent');
  s = tickOutbox(s, 10.75); assert.equal(s.messages[0].state, 'received');
  s = tickOutbox(s, 11.25); assert.equal(s.messages[0].state, 'confirmed');
});
test('near-mode jumps preserve exact event times and do not mutate input', () => {
  const initial = enqueueMessage(createOutbox(10), 'data', 'Report', 'routine');
  const final = tickOutbox(initial, 12);
  assert.equal(final.messages[0].state, 'confirmed'); assert.equal(initial.messages[0].state, 'stored');
  assert.equal(final.timings[final.messages[0].id].sentDay, 10.25);
  assert.equal(final.timings[final.messages[0].id].receivedDay, 10.25 + 3 / 44);
});
test('mode change cannot speed up in-flight packets', () => {
  let s = enqueueMessage(setMarsMode(createOutbox(10), true), 'data', 'Report', 'routine');
  s = setMarsMode(tickOutbox(s, 10.25), false);
  assert.equal(s.messages[0].lightTimeMin, 22); assert.equal(tickOutbox(s, 10.5).messages[0].state, 'sent');
  s = enqueueMessage(s, 'data', 'New report', 'routine'); assert.equal(s.messages[1].lightTimeMin, 3);
});
test('blackout holds packets and release uses next future relay', () => {
  let s = enqueueMessage(setBlackout(createOutbox(10), true), 'request', 'Review', 'emergency');
  s = tickOutbox(s, 13); assert.equal(s.messages[0].state, 'stored');
  assert.equal(communicationLabel(s), 'Blackout — normal mode');
  s = setBlackout(s, false, 13);
  assert.equal(tickOutbox(s, 13.24).messages[0].state, 'stored');
  assert.equal(tickOutbox(s, 13.25).messages[0].state, 'sent');
});
test('blackout does not recall a launched packet', () => {
  let s = enqueueMessage(setMarsMode(createOutbox(10), true), 'data', 'Report', 'routine');
  s = setBlackout(tickOutbox(s, 10.25), true);
  assert.equal(tickOutbox(s, 11.25).messages[0].state, 'confirmed');
});
test('onboard alerts work during Mars blackout', () => {
  const readings = fixtureMission(); const expected = evaluateDay(readings, 63);
  const s = setBlackout(setMarsMode(createOutbox(63), true), true);
  assert.ok(s.blackout && s.marsMode); assert.ok(expected.length > 0);
  assert.deepEqual(evaluateDay(readings, 63), expected);
});
test('badges distinguish waiting, outbound and Earth acknowledgement', () => {
  let s = enqueueMessage(setMarsMode(createOutbox(10), true), 'data', 'Report', 'routine');
  assert.ok(badgeText(s.messages[0], 10).startsWith('Stored onboard'));
  s = tickOutbox(s, 10.5);
  assert.ok(badgeText(s.messages[0], 10.5, s.timings[s.messages[0].id]).startsWith('Left ship 11 min ago'));
  assert.ok(!badgeText(s.messages[0], 10.5).includes('Left Earth'));
  s = tickOutbox(s, 11.25);
  assert.equal(badgeText(s.messages[0], 11.25, s.timings[s.messages[0].id]), 'Left Earth 22 min ago · based on data from 55 min ago');
});
test('JSON restore preserves delivery and blackout timing', () => {
  let s = enqueueMessage(setMarsMode(createOutbox(10), true), 'alert', 'Maya', 'priority');
  s = tickOutbox(s, 10.5);
  assert.deepEqual(tickOutbox(restoreOutbox(serializeOutbox(s)), 11.25), tickOutbox(s, 11.25));
  const blocked = tickOutbox(setBlackout(enqueueMessage(createOutbox(10), 'data', 'Report', 'routine'), true), 12);
  assert.deepEqual(restoreOutbox(serializeOutbox(blocked)), blocked);
});
test('invalid input, corrupt storage and clock rewinds fail clearly', () => {
  assert.throws(() => queueMessage('data', ' ', 'routine', 1)); assert.throws(() => createOutbox(NaN));
  assert.throws(() => tickOutbox(createOutbox(10), 9)); assert.throws(() => restoreOutbox('{}'));
  const s = enqueueMessage(createOutbox(10), 'data', 'Report', 'routine'); delete s.timings[s.messages[0].id];
  assert.throws(() => restoreOutbox(serializeOutbox(s)));
});
