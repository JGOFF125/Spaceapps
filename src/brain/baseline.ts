import type { Reading } from '../types.ts';
import { dailyReadings, mean, SIGNALS } from './data.ts';
import type { Signal } from './data.ts';

export type Baseline = Record<Signal, { mean: number; stdDev: number }>;

// All fourteen distinct learning days are required. Missing data is not healthy data.
// Population SD describes the complete demo learning period; scoring floors are
// separate, so a constant baseline still reports its true SD of zero.
export function computeBaseline(readings: Reading[], astronautId: string): Baseline | null {
  const rows = dailyReadings(readings, astronautId, 14);
  if (rows.length !== 14) return null;
  return Object.fromEntries(SIGNALS.map(signal => {
    const centre = mean(rows.map(r => r[signal]));
    return [signal, { mean: centre, stdDev: Math.sqrt(mean(rows.map(r => (r[signal] - centre) ** 2))) }];
  })) as Baseline;
}
