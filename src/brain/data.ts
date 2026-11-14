import type { Reading } from '../types.ts';

export const SIGNALS = ['heartRate', 'hrv', 'temperature', 'sleepHours', 'activity'] as const;
export type Signal = typeof SIGNALS[number];
export const clamp = (value: number) => Math.max(0, Math.min(1, value));
export const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;

export function validReading(r: Reading): boolean {
  return Boolean(r.astronautId) && Number.isFinite(r.day) && r.day >= 1 && r.day <= 180 &&
    [...SIGNALS, 'waterIntake', 'stoneRisk', 'radiationDose', 'co2'].every(
      key => Number.isFinite(r[key as keyof Reading]) && Number(r[key as keyof Reading]) >= 0,
    ) && r.stoneRisk <= 1 && r.sleepHours <= 24 && r.heartRate > 0 && r.hrv > 0;
}

// One observation per mission day; prefer the integer-day engine sample.
// Later interpolation samples never overweight a day's evidence. Exact duplicates
// use the last value, allowing the Engine to replace a reading after treatment.
export function dailyReadings(readings: Reading[], astronautId: string, nowDay = 180): Reading[] {
  const days = new Map<number, Reading>();
  for (const r of readings) {
    if (r.astronautId !== astronautId || r.day > Math.floor(nowDay) || !validReading(r)) continue;
    const day = Math.floor(r.day);
    const previous = days.get(day);
    if (!previous || r.day <= previous.day) days.set(day, r);
  }
  return [...days.values()].sort((a, b) => a.day - b.day);
}

export function windowReadings(readings: Reading[], id: string, day: number, count = 3): Reading[] {
  const end = Math.floor(day);
  const rows = dailyReadings(readings, id, end).filter(r => Math.floor(r.day) > end - count);
  return rows.length === count ? rows : [];
}

export function currentReading(readings: Reading[], id: string, day: number): Reading | undefined {
  return windowReadings(readings, id, day, 1)[0];
}

export const crewIds = (readings: Reading[], day: number) =>
  [...new Set(readings.filter(r => r.day <= day && validReading(r)).map(r => r.astronautId))].sort();
