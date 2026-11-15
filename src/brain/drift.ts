import type { Reading } from '../types.ts';
import { computeBaseline } from './baseline.ts';
import { clamp, mean, SIGNALS, windowReadings } from './data.ts';
import type { Signal } from './data.ts';

// Hackathon tuning constants, NOT validated medical thresholds.
export const SIGNAL_RULES: Record<Signal, { weight: number; floor: number; direction: 1 | -1; label: string; unit: string }> = {
  hrv: { weight: 0.30, floor: 4, direction: -1, label: 'HRV', unit: 'ms' },
  temperature: { weight: 0.30, floor: 0.15, direction: 1, label: 'Temperature', unit: '°C' },
  heartRate: { weight: 0.20, floor: 2, direction: 1, label: 'Resting heart rate', unit: 'bpm' },
  sleepHours: { weight: 0.12, floor: 0.35, direction: -1, label: 'Sleep', unit: 'h' },
  activity: { weight: 0.08, floor: 12, direction: -1, label: 'Activity', unit: 'min' },
};
export interface SignalDrift {
  signal: Signal;
  baseline: number;
  recent: number;
  zScore: number; // Signed z using max(observed SD, noise floor).
  unhealthyZ: number;
  contribution: number;
}
export interface DriftResult {
  score: number;
  ready: boolean;
  signals: SignalDrift[];
  reason?: string;
}

export function driftScore(readings: Reading[], astronautId: string, day: number): DriftResult {
  const baseline = computeBaseline(readings.filter(r => r.day <= day), astronautId);
  const recent = windowReadings(readings, astronautId, day);
  if (day < 15 || !baseline || recent.length !== 3) {
    return { score: 0, ready: false, signals: [], reason: 'Need 14 learning days and 3 consecutive recent days.' };
  }
  const signals = SIGNALS.map(signal => {
    const rule = SIGNAL_RULES[signal];
    const value = mean(recent.map(r => r[signal]));
    const zScore = (value - baseline[signal].mean) / Math.max(baseline[signal].stdDev, rule.floor);
    const unhealthyZ = Math.max(0, zScore * rule.direction);
    // Three noise-adjusted standard deviations fills a signal's weighted share.
    return { signal, baseline: baseline[signal].mean, recent: value, zScore, unhealthyZ,
      contribution: rule.weight * clamp(unhealthyZ / 3) };
  }).filter(s => s.unhealthyZ > 0).sort((a, b) => b.contribution - a.contribution);
  return { ready: true, score: clamp(signals.reduce((sum, s) => sum + s.contribution, 0)), signals };
}
