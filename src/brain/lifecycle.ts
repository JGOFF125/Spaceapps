import type { Alert, Reading } from '../types.ts';
import { evaluateDay, patternOf, updateAlertStatus } from './alerts.ts';
import { crewIds, windowReadings } from './data.ts';

export interface BrainState {
  day: number;
  alerts: Alert[];
  actionDays: Record<string, number>;
  activeEpisodes: Record<string, string>;
  sequence: number;
}
export const createBrainState = (): BrainState => ({ day: 0, alerts: [], actionDays: {}, activeEpisodes: {}, sequence: 0 });
const severity = { watch: 0, warning: 1, critical: 2 };
const episodeKey = (alert: Alert) => {
  const pattern = patternOf(alert);
  return `baseline:${alert.astronautId}:${pattern === 'stone' || pattern === 'crew' ? pattern : 'health'}`;
};

// Idempotent daily processing avoids alert spam on every smooth-clock frame.
// Rewind is explicit: create a fresh state and replay to the desired day.
export function advanceBrain(state: BrainState, readings: Reading[], day: number): BrainState {
  if (!Number.isFinite(day) || day < state.day || day > 180) throw new RangeError('Advance day must be finite, monotonic, and at most 180. Reset before rewinding.');
  const next: BrainState = structuredClone(state);
  for (let d = Math.floor(state.day) + 1; d <= Math.floor(day); d++) {
    const candidates = evaluateDay(readings, d);
    const present = new Set(candidates.map(episodeKey));
    next.alerts = next.alerts.map(a => updateAlertStatus(a, readings, next.actionDays[a.id], d));
    // The scripted cabin event clears without a medical treatment. Require
    // three observed normal-air days before closing its environmental alert.
    const ids = crewIds(readings, d);
    const airRecovered = ids.length >= 3 && ids.every(id => {
      const rows = windowReadings(readings, id, d);
      return rows.length === 3 && rows.every(r => r.co2 <= 2000);
    });
    if (airRecovered) next.alerts = next.alerts.map(a =>
      a.astronautId === 'CREW' && a.status !== 'recovered' ? { ...a, status: 'recovered' } : a);
    for (const [key, episode] of Object.entries(next.activeEpisodes)) {
      const alert = next.alerts.find(a => a.id === episode)!;
      if (!present.has(key) && alert.status === 'recovered') delete next.activeEpisodes[key];
    }
    for (const candidate of candidates) {
      const key = episodeKey(candidate);
      const existingId = next.activeEpisodes[key];
      const existing = next.alerts.find(a => a.id === existingId);
      if (existing) {
        // Keep detection day, action clock and terminal status. A recovering story
        // doesn't instantly re-open just because its values remain slightly low.
        if (existing.status === 'open' || existing.status === 'acting') {
          existing.why = candidate.why;
          existing.confounders = candidate.confounders;
          existing.confidence = candidate.confidence;
          // A generic drift may develop a more specific pattern, but recovery
          // from infection must not spawn a second generic-drift episode.
          if (patternOf(candidate) === 'infection' || patternOf(existing) === 'drift') {
            existing.title = candidate.title;
            existing.action = candidate.action;
          }
          if (severity[candidate.level] > severity[existing.level]) existing.level = candidate.level;
        }
      } else {
        const id = `${candidate.id}:${++next.sequence}`;
        next.activeEpisodes[key] = id;
        next.alerts.push({ ...candidate, id });
      }
    }
  }
  next.day = Math.floor(day);
  return next;
}

export function startAction(state: BrainState, alertId: string, day = state.day): BrainState {
  if (day !== state.day) throw new RangeError('Start action at the current evaluated mission day.');
  const alert = state.alerts.find(a => a.id === alertId);
  if (!alert) throw new Error('Unknown alert ID.');
  if (alert.status !== 'open' && alert.status !== 'escalated') return structuredClone(state);
  const next = structuredClone(state);
  next.alerts.find(a => a.id === alertId)!.status = 'acting';
  next.actionDays[alertId] = day;
  return next;
}
