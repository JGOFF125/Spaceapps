import type { OutboxMessage } from '../types.ts';

// Deliberate visual exaggeration: 22 real light-minutes = 0.5 mission day.
// Thus 44 light-minutes = one displayed mission day, NOT physical time conversion.
export const LIGHT_MINUTES_PER_DEMO_DAY = 44;
export const lightTimeToDays = (minutes: number) => minutes / LIGHT_MINUTES_PER_DEMO_DAY;
export const nextRelayDay = (day: number) => (Math.floor(day * 4) + 1) / 4;
export const relayCountdownHours = (day: number) => (nextRelayDay(day) - day) * 24;

export interface MessageTiming {
  relayDay: number;
  sentDay?: number;
  receivedDay?: number;
  confirmedDay?: number;
}
export interface OutboxState {
  day: number;
  marsMode: boolean;
  blackout: boolean;
  lightTimeMin: number;
  messages: OutboxMessage[];
  timings: Record<string, MessageTiming>;
}
export function createOutbox(day = 1): OutboxState {
  checkDay(day);
  return { day, marsMode: false, blackout: false, lightTimeMin: 3, messages: [], timings: {} };
}
function checkDay(day: number) {
  if (!Number.isFinite(day) || day < 0) throw new RangeError('Mission day must be finite and nonnegative.');
}

export function queueMessage(kind: OutboxMessage['kind'], summary: string, priority: OutboxMessage['priority'], day: number, lightTimeMin = 3): OutboxMessage {
  checkDay(day);
  if (!summary.trim()) throw new Error('A message needs a summary.');
  if (!Number.isFinite(lightTimeMin) || lightTimeMin < 0) throw new RangeError('Light-time must be nonnegative.');
  return { id: `msg-${crypto.randomUUID()}`, day, kind, summary: summary.trim(), priority, state: 'stored', lightTimeMin };
}

export function enqueueMessage(state: OutboxState, kind: OutboxMessage['kind'], summary: string, priority: OutboxMessage['priority'], day = state.day): OutboxState {
  const next = tickOutbox(state, day);
  const message = queueMessage(kind, summary, priority, day, next.lightTimeMin);
  next.messages.push(message);
  next.timings[message.id] = { relayDay: nextRelayDay(day) };
  return next;
}

export function tickOutbox(state: OutboxState, nowDay: number): OutboxState {
  checkDay(nowDay);
  if (nowDay < state.day) throw new RangeError('Outbox clock cannot rewind. Create a new outbox on reset.');
  const next = structuredClone(state);
  for (const message of next.messages) {
    const timing = next.timings[message.id];
    if (!timing) throw new Error('Missing message timing metadata. Restore the entire OutboxState.');
    if (message.state === 'stored') {
      if (next.blackout) {
        // A later tick must not invent a transmission during the blackout.
        timing.relayDay = nextRelayDay(nowDay);
        continue;
      }
      if (nowDay < timing.relayDay) continue;
      message.state = 'sent';
      timing.sentDay = timing.relayDay;
      timing.receivedDay = timing.sentDay + lightTimeToDays(message.lightTimeMin);
      timing.confirmedDay = timing.receivedDay + lightTimeToDays(message.lightTimeMin);
    }
    // Multiple transitions may occur in one tick after a jump; timestamps remain
    // the scheduled event times, not the time the UI happened to render.
    if (message.state === 'sent' && nowDay >= timing.receivedDay!) message.state = 'received';
    if (message.state === 'received' && nowDay >= timing.confirmedDay!) message.state = 'confirmed';
  }
  next.day = nowDay;
  return next;
}

export function setMarsMode(state: OutboxState, enabled: boolean, day = state.day): OutboxState {
  const next = tickOutbox(state, day);
  next.marsMode = enabled;
  next.lightTimeMin = enabled ? 22 : 3;
  // Freeze the light-time of packets already in flight. Queued packets use the
  // new link setting; no packet arrives earlier because someone toggled a switch.
  next.messages.forEach(m => { if (m.state === 'stored') m.lightTimeMin = next.lightTimeMin; });
  return next;
}

export function setBlackout(state: OutboxState, enabled: boolean, day = state.day): OutboxState {
  const next = tickOutbox(state, day);
  next.blackout = enabled;
  if (enabled !== state.blackout) next.messages.forEach(m => {
    if (m.state === 'stored') next.timings[m.id].relayDay = nextRelayDay(day);
  });
  // Blackout blocks new ship transmissions. Already launched packets finish
  // their journey; this demo does not model packet loss or Earth relay outages.
  return next;
}

export function communicationLabel(state: OutboxState): string {
  return state.blackout ? 'Blackout — normal mode' : state.marsMode ? 'EARTH DELAY 22 MIN — ONBOARD MODE' : 'Near mode — 3 min demo delay';
}

export function badgeText(message: OutboxMessage, nowDay: number, timing?: MessageTiming): string {
  const age = (day: number) => Math.max(0, Math.floor((nowDay - day) * LIGHT_MINUTES_PER_DEMO_DAY + 1e-8));
  const dataAge = age(message.day);
  if (message.state === 'stored') return `Stored onboard · data age ${dataAge} min · one-way delay ${message.lightTimeMin} min`;
  // The shared contract has no sent timestamp. Without the optional sidecar,
  // report only known facts rather than fabricate a departure during blackout.
  if (!timing || timing.sentDay === undefined) return `${message.state} · based on data from ${dataAge} min ago · one-way delay ${message.lightTimeMin} min`;
  if (message.state === 'confirmed' && timing.receivedDay !== undefined) return `Left Earth ${age(timing.receivedDay)} min ago · based on data from ${dataAge} min ago`;
  return `Left ship ${age(timing.sentDay)} min ago · based on data from ${dataAge} min ago · ${message.state === 'received' ? 'at Earth; acknowledgement returning' : 'en route to Earth'}`;
}

// localStorage / BroadcastChannel payload. No timers, browser globals, or network
// calls in the logic: the integrator owns the clock, persistence and transport.
export const serializeOutbox = (state: OutboxState) => JSON.stringify(state);
export function restoreOutbox(json: string): OutboxState {
  const state: OutboxState = JSON.parse(json);
  if (!state || typeof state.marsMode !== 'boolean' || typeof state.blackout !== 'boolean' ||
      state.lightTimeMin !== (state.marsMode ? 22 : 3) || !Array.isArray(state.messages) || !state.timings) throw new Error('Invalid saved outbox.');
  checkDay(state.day);
  const ids = new Set<string>();
  for (const m of state.messages) {
    const t = state.timings[m.id];
    if (!m.id || ids.has(m.id) || !t || !Number.isFinite(t.relayDay) || t.relayDay <= m.day ||
        !['stored', 'sent', 'received', 'confirmed'].includes(m.state) ||
        !['data', 'alert', 'request'].includes(m.kind) || !['routine', 'priority', 'emergency'].includes(m.priority) ||
        typeof m.summary !== 'string' || !m.summary.trim() || !Number.isFinite(m.lightTimeMin) || m.lightTimeMin < 0) throw new Error('Invalid saved message.');
    checkDay(m.day);
    if (m.day > state.day) throw new Error('Message is from the future.');
    if (m.state !== 'stored' && (![t.sentDay, t.receivedDay, t.confirmedDay].every(Number.isFinite) ||
        t.sentDay! > state.day || t.sentDay! < m.day || t.receivedDay! < t.sentDay! || t.confirmedDay! < t.receivedDay! ||
        (m.state === 'received' && t.receivedDay! > state.day) || (m.state === 'confirmed' && t.confirmedDay! > state.day))) throw new Error('Invalid message timeline.');
    ids.add(m.id);
  }
  return structuredClone(state);
}
