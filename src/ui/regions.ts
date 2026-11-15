import type { DashboardModel } from './model.ts';
import type { HealthStatus } from './status.ts';
import { stoneStatus } from './status.ts';

export type Region = 'head' | 'chest' | 'abdomen' | 'limbs' | 'exposure';
export const REGIONS: { id: Region; label: string; short: string; x: number; y: number }[] = [
  { id: 'head', label: 'Head & recovery', short: 'Head', x: 50, y: 8 },
  { id: 'chest', label: 'Cardiovascular', short: 'Heart', x: 55, y: 26 },
  { id: 'abdomen', label: 'Hydration & kidneys', short: 'Kidneys', x: 45, y: 35.5 },
  { id: 'limbs', label: 'Movement & load', short: 'Movement', x: 57, y: 68 },
  { id: 'exposure', label: 'Whole-body exposure', short: 'Exposure', x: 73, y: 43 },
];
export interface RegionInfo {
  title: string; value: string; unit: string; supporting: string; note: string; status: HealthStatus;
}
export function regionInfo(model: DashboardModel): Record<Region, RegionInfo> {
  const { reading: r, baseline: b, drift, session } = model;
  const moved = (signals: string[]) => drift.signals.some(s => signals.includes(s.signal) && s.unhealthyZ >= 1);
  return {
    head: { title: 'Rest & recovery', value: r.sleepHours.toFixed(1), unit: 'h sleep',
      supporting: b ? `Personal normal · ${b.sleepHours.mean.toFixed(1)} h` : 'Learning your personal baseline',
      note: 'Sleep is a readiness signal. Brain function and mood are not directly measured.',
      status: !b ? 'learning' : r.sleepHours < 6.5 ? 'watch' : 'nominal' },
    chest: { title: 'Cardiovascular signals', value: r.hrv.toFixed(0), unit: 'ms HRV',
      supporting: b ? `Personal normal · ${b.hrv.mean.toFixed(0)} ms` : 'Learning your personal baseline',
      note: 'Resting heart rate, HRV and temperature help explain whole-body drift. The illustration is not an organ scan.',
      status: !b ? 'learning' : moved(['heartRate', 'hrv', 'temperature']) ? drift.score > 0.85 ? 'critical' : drift.score > 0.65 ? 'warning' : 'watch' : 'nominal' },
    abdomen: { title: 'Hydration & kidneys', value: r.stoneRisk.toFixed(2), unit: 'risk index',
      supporting: `${r.waterIntake.toFixed(1)} L water recorded today`,
      note: 'A simulated prevention index, not a kidney scan or a probability of disease. Urine chemistry is not measured.',
      status: stoneStatus(r.stoneRisk) },
    limbs: { title: 'Movement & load', value: r.activity.toFixed(0), unit: 'active min',
      supporting: b ? `Personal normal · ${b.activity.mean.toFixed(0)} min` : 'Learning your personal baseline',
      note: 'Activity supports readiness monitoring. Bone density, muscle mass and joint health are not directly measured.',
      status: !b ? 'learning' : moved(['activity']) ? 'watch' : 'nominal' },
    exposure: { title: 'Whole-body exposure', value: r.radiationDose.toFixed(1), unit: 'mSv',
      supporting: 'Cumulative dose this mission',
      note: 'An illustrative whole-body exposure ledger. Tissue-specific injury and earlier career exposure are not modelled.',
      status: session.stormAlerts.some(a => a.status !== 'recovered' && !session.dismissals[a.id]) ? 'critical' : 'nominal' },
  };
}
