import type { Alert, Reading } from '../types.ts';
import { applyTreatment, buildMissionData } from '../engine/stories.ts';
import { advanceBrain, createBrainState, createOutbox, enqueueMessage, restoreOutbox, setBlackout, setMarsMode, startAction, tickOutbox } from '../brain/index.ts';
import { tick } from '../engine/simulate.ts';
import type { BrainState, OutboxState } from '../brain/index.ts';

export interface MissionSession {
  version: 1;
  missionId: string;
  day: number;
  readings: Reading[];
  brain: BrainState;
  outbox: OutboxState;
  inbox: OutboxState;
  earthReplies: Record<string, { sourceMessageId: string; messageId: string }>;
  reports: Record<string, string>;
  treatments: { astronautId: string; day: number }[];
  dismissals: Record<string, string>;
  storms: { day: number; dose: number }[];
  stormAlerts: Alert[];
  checklists: Record<string, number[]>;
}

function compose(treatments: MissionSession['treatments'], storms: MissionSession['storms']): Reading[] {
  // Engine treatment state is reconstructed from our saved action history.
  // This makes reset and restore repeatable, including under React StrictMode.
  let readings = buildMissionData();
  for (const t of treatments) readings = applyTreatment(t.astronautId, t.day);
  return readings.map(r => ({ ...r, radiationDose: r.radiationDose + storms.filter(s => r.day >= s.day).reduce((sum, s) => sum + s.dose, 0) }));
}
export function createMission(day = 30): MissionSession {
  if (!Number.isFinite(day) || day < 1 || day > 180) throw new RangeError('Mission day must be between 1 and 180.');
  const readings = compose([], []);
  return { version: 1, missionId: crypto.randomUUID(), day, readings, brain: advanceBrain(createBrainState(), readings, day), outbox: createOutbox(day),
    inbox: createOutbox(day), earthReplies: {}, reports: {},
    treatments: [], dismissals: {}, storms: [], stormAlerts: [], checklists: {} };
}
export const allAlerts = (state: MissionSession) => [...state.brain.alerts, ...state.stormAlerts];
export const activeAlerts = (state: MissionSession) => allAlerts(state).filter(a => a.status !== 'recovered' && !state.dismissals[a.id]);

export function advanceMission(state: MissionSession, day: number): MissionSession {
  if (!Number.isFinite(day) || day < state.day) throw new RangeError('Reset before rewinding the mission.');
  const nextDay = Math.min(180, day);
  let brain = state.brain;
  let outbox = state.outbox;
  const known = new Set(state.brain.alerts.map(a => a.id));
  // Replay detection and queueing together. A multi-day jump must not delay a
  // day-61 alert packet until the day the user jumps to.
  for (let d = Math.floor(state.day) + 1; d <= Math.floor(nextDay); d++) {
    brain = advanceBrain(brain, state.readings, d);
    outbox = tickOutbox(outbox, d);
    for (const a of brain.alerts) if (!known.has(a.id)) {
      outbox = enqueueMessage(outbox, 'alert', `${a.title} · ${a.level} · onboard review requested`, a.level === 'critical' ? 'emergency' : 'priority');
      known.add(a.id);
    }
  }
  return { ...state, day: nextDay, brain, outbox: tickOutbox(outbox, nextDay), inbox: tickOutbox(state.inbox, nextDay) };
}

export function configureLink(state: MissionSession, settings: { marsMode?: boolean; blackout?: boolean }): MissionSession {
  const configure = (box: OutboxState) => {
    let next = box;
    if (settings.marsMode !== undefined) next = setMarsMode(next, settings.marsMode);
    if (settings.blackout !== undefined) next = setBlackout(next, settings.blackout);
    return next;
  };
  return { ...state, outbox: configure(state.outbox), inbox: configure(state.inbox) };
}

// Forward jumps are ordinary clock advances. On rewind, replay only actions
// already taken by that day; clear review notes and restart communication so
// packets/advice from the abandoned future cannot leak into the new timeline.
export function seekMission(state: MissionSession, day: number): MissionSession {
  if (!Number.isFinite(day) || day < 1 || day > 180) throw new RangeError('Mission day must be between 1 and 180.');
  if (day >= state.day) return advanceMission(state, day);
  const treatments = state.treatments.filter(t => t.day <= day);
  const storms = state.storms.filter(s => s.day <= day);
  const readings = compose(treatments, storms);
  let brain = createBrainState();
  for (let d = 1; d <= Math.floor(day); d++) {
    brain = advanceBrain(brain, readings, d);
    for (const [id, actionDay] of Object.entries(state.brain.actionDays)) {
      if (actionDay === d && brain.alerts.some(a => a.id === id)) brain = startAction(brain, id);
    }
  }
  const fresh = configureLink(createMission(day), state.outbox);
  return { ...fresh, treatments, storms, readings, brain,
    stormAlerts: state.stormAlerts.filter(a => a.day <= day).map(a => ({ ...a, status: 'open', title: 'Solar particle event — shelter protocol' })) };
}

export function recordChecklist(state: MissionSession, id: string, step: number): MissionSession {
  if (!allAlerts(state).some(a => a.id === id) || !Number.isInteger(step) || step < 0 || step > 3) return state;
  const checked = state.checklists[id] ?? [];
  return { ...state, checklists: { ...state.checklists, [id]: checked.includes(step) ? checked.filter(i => i !== step) : [...checked, step] } };
}

export function packReport(state: MissionSession, id?: string, astronautId = 'maya'): MissionSession {
  const alert = id ? allAlerts(state).find(a => a.id === id) : undefined;
  if (id && !alert) throw new Error('Unknown alert ID.');
  const checked = alert ? [...new Set([...(state.checklists[alert.id] ?? []), 4])] : [];
  const reading = tick(state.readings, state.day).find(r => r.astronautId === astronautId);
  if (!reading) throw new Error('Unknown astronaut.');
  const summary = alert ? `${alert.title} · day ${Math.floor(state.day)} · ${alert.status} · ${alert.why.join(' ')} · ${checked.length}/5 guided steps recorded` : `${astronautId} · day ${Math.floor(state.day)} · HR ${reading.heartRate.toFixed(0)} bpm · HRV ${reading.hrv.toFixed(0)} ms · temperature ${reading.temperature.toFixed(1)} °C · private check-ins excluded`;
  const outbox = enqueueMessage(state.outbox, 'data', summary, alert ? 'priority' : 'routine');
  return { ...state, outbox, ...(alert ? { checklists: { ...state.checklists, [alert.id]: checked }, reports: { ...state.reports, [alert.id]: outbox.messages.at(-1)!.id } } : {}) };
}

export function completeShelter(state: MissionSession, id: string): MissionSession {
  const steps = state.checklists[id] ?? [];
  const reportId = state.reports[id];
  if (![0, 1, 2, 3, 4].every(i => steps.includes(i)) || !state.outbox.messages.some(m => m.id === reportId)) return state;
  return { ...state, stormAlerts: state.stormAlerts.map(a => a.id === id ? { ...a, status: 'recovered', title: 'Shelter protocol completed · dose ledger retained' } : a) };
}

export interface EarthReply {
  id: string;
  missionId: string;
  sourceMessageId: string;
  summary: string;
}

export function receiveEarthAdvice(state: MissionSession, reply: EarthReply): MissionSession {
  if (!reply || typeof reply.id !== 'string' || reply.id.length > 100 || !reply.id.trim() || reply.missionId !== state.missionId ||
      typeof reply.summary !== 'string' || !reply.summary.trim() || reply.summary.length > 2000 || state.earthReplies[reply.id]) return state;
  const source = state.outbox.messages.find(m => m.id === reply.sourceMessageId);
  // Earth may advise only on a packet that has actually arrived there.
  if (!source || (source.state !== 'received' && source.state !== 'confirmed')) return state;
  const inbox = enqueueMessage(state.inbox, 'request', reply.summary, 'priority');
  return { ...state, inbox, earthReplies: { ...state.earthReplies, [reply.id]: { sourceMessageId: source.id, messageId: inbox.messages.at(-1)!.id } } };
}
export function actOnAlert(state: MissionSession, id: string): MissionSession {
  const alert = allAlerts(state).find(a => a.id === id);
  if (!alert || state.dismissals[id] || alert.status === 'acting' || alert.status === 'recovered') return state;
  const day = Math.floor(state.day);
  if (id.startsWith('storm:')) return { ...state, stormAlerts: state.stormAlerts.map(a => a.id === id ? { ...a, status: 'acting' } : a) };
  const treatments = alert.astronautId === 'CREW' ? state.treatments : [...state.treatments, { astronautId: alert.astronautId, day }];
  return { ...state, treatments, readings: compose(treatments, state.storms), brain: startAction(state.brain, id),
    outbox: enqueueMessage(state.outbox, 'alert', `${alert.title} · action started on day ${day}`, 'priority') };
}
export function triggerStorm(state: MissionSession): MissionSession {
  if (state.stormAlerts.some(a => a.status !== 'recovered' && !state.dismissals[a.id])) return state;
  const day = Math.floor(state.day);
  const storms = [...state.storms, { day, dose: 20 }];
  const alert: Alert = { id: `storm:${storms.length}`, astronautId: 'CREW', day, level: 'critical', status: 'open',
    title: 'Solar particle event — shelter protocol', why: ['A simulated solar particle event added 20 mSv to each crew member’s dose ledger.', 'This is a demo event, not a live space-weather warning.'],
    confidence: 1, confounders: ['Exposure and shelter effectiveness are illustrative, not a radiation transport model.'],
    action: 'Move to the water-wall shelter area. Follow the onboard radiation protocol and log dosimeter readings.' };
  return { ...state, storms, readings: compose(state.treatments, storms), stormAlerts: [...state.stormAlerts, alert],
    outbox: enqueueMessage(state.outbox, 'alert', alert.title, 'emergency') };
}
export function dismissAlert(state: MissionSession, id: string, reason: string): MissionSession {
  if (reason.trim().length < 5) throw new Error('Enter a reason of at least 5 characters.');
  if (!allAlerts(state).some(a => a.id === id)) throw new Error('Unknown alert ID.');
  return { ...state, dismissals: { ...state.dismissals, [id]: reason.trim() } };
}
export function serializeMission(state: MissionSession): string {
  const { readings: _readings, ...saved } = state;
  return JSON.stringify(saved);
}
export function restoreMission(json: string): MissionSession {
  const s = JSON.parse(json) as MissionSession;
  if (s.version !== 1 || !Number.isFinite(s.day) || s.day < 1 || s.day > 180 || !Array.isArray(s.treatments) ||
      !Array.isArray(s.storms) || !Array.isArray(s.stormAlerts) || !Array.isArray(s.brain?.alerts) || s.brain.day !== Math.floor(s.day) ||
      !s.checklists || !s.dismissals || !s.brain.actionDays || !s.brain.activeEpisodes) throw new Error('Invalid mission session.');
  if (s.treatments.some(t => !['maya', 'leo', 'ana', 'sam'].includes(t.astronautId) || !Number.isInteger(t.day) || t.day < 1 || t.day > s.day) ||
      s.storms.some(t => !Number.isInteger(t.day) || t.day < 1 || t.day > s.day || t.dose !== 20)) throw new Error('Invalid event history.');
  const record = (value: unknown) => !!value && typeof value === 'object' && !Array.isArray(value);
  const strings = (value: unknown) => Array.isArray(value) && value.every(v => typeof v === 'string');
  const ids = new Set<string>();
  for (const a of allAlerts(s)) {
    if (!a || typeof a.id !== 'string' || !a.id || ids.has(a.id) || !['maya', 'leo', 'ana', 'sam', 'CREW'].includes(a.astronautId) ||
        !Number.isInteger(a.day) || a.day < 1 || a.day > s.day || !['watch', 'warning', 'critical'].includes(a.level) ||
        !['open', 'acting', 'recovered', 'escalated'].includes(a.status) || typeof a.title !== 'string' || typeof a.action !== 'string' ||
        !strings(a.why) || !strings(a.confounders) || !Number.isFinite(a.confidence) || a.confidence < 0 || a.confidence > 1) throw new Error('Invalid saved alert.');
    ids.add(a.id);
  }
  if (!record(s.brain.actionDays) || !record(s.brain.activeEpisodes) || !Number.isInteger(s.brain.sequence) || s.brain.sequence < 0 ||
      Object.entries(s.brain.actionDays).some(([id, day]) => !ids.has(id) || !Number.isInteger(day) || day < 1 || day > s.brain.day) ||
      Object.values(s.brain.activeEpisodes).some(id => !ids.has(id)) || !record(s.checklists) || !record(s.dismissals) ||
      Object.entries(s.checklists).some(([id, steps]) => !ids.has(id) || !Array.isArray(steps) || new Set(steps).size !== steps.length || steps.some(n => !Number.isInteger(n) || n < 0 || n > 4)) ||
      Object.entries(s.dismissals).some(([id, reason]) => !ids.has(id) || typeof reason !== 'string' || reason.trim().length < 5)) throw new Error('Invalid saved care history.');
  s.outbox = restoreOutbox(JSON.stringify(s.outbox));
  // Migrate sessions saved before the independent Earth inbox was added.
  s.missionId ??= crypto.randomUUID();
  s.inbox = s.inbox ? restoreOutbox(JSON.stringify(s.inbox)) : setBlackout(setMarsMode(createOutbox(s.day), s.outbox.marsMode), s.outbox.blackout);
  s.earthReplies ??= {};
  if (!s.reports) {
    s.reports = {};
    // Legacy manual ticks are not proof that the pack-report button ran.
    for (const id of Object.keys(s.checklists)) s.checklists[id] = s.checklists[id].filter(step => step !== 4);
  }
  if (s.outbox.day !== s.day) throw new Error('Saved clocks disagree.');
  if (typeof s.missionId !== 'string' || !s.missionId.trim() || s.inbox.day !== s.day ||
      s.inbox.marsMode !== s.outbox.marsMode || s.inbox.blackout !== s.outbox.blackout ||
      !record(s.earthReplies) || !record(s.reports) ||
      Object.entries(s.reports).some(([id, messageId]) => !ids.has(id) || !s.outbox.messages.some(m => m.id === messageId && m.kind === 'data')) ||
      Object.values(s.earthReplies).some(r => !r || !s.outbox.messages.some(m => m.id === r.sourceMessageId) || !s.inbox.messages.some(m => m.id === r.messageId))) throw new Error('Invalid Earth session.');
  s.readings = compose(s.treatments, s.storms);
  return s;
}
