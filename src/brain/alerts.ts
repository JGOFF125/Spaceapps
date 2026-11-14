import type { Alert, Reading } from '../types.ts';
import { computeBaseline } from './baseline.ts';
import { clamp, crewIds, currentReading, mean, windowReadings } from './data.ts';
import { driftScore, SIGNAL_RULES } from './drift.ts';
import type { DriftResult } from './drift.ts';

export const ACTIONS = {
  infection: "Run the white-cell point-of-care check and protect tonight's sleep",
  sleep: "Protect 8 hours of sleep and shift tomorrow's heavy tasks",
  stone: 'Start the hydration plan: 3 L today plus citrate',
  drift: 'Repeat the measurements and ask the crew medical officer to review the trend',
  crew: 'Check cabin ventilation and CO2 removal; follow the onboard air-quality procedure',
} as const;
export type Pattern = keyof typeof ACTIONS;
export const patternOf = (alert: Alert): Pattern => alert.id.split(':')[2] as Pattern;

export function driftLevel(score: number, previousScore: number, temperatureRise: number): Alert['level'] | null {
  // Strictly above the shared-plan thresholds. A warning/critical is immediate;
  // only a watch needs two consecutive days above 0.45.
  if (score > 0.85 || temperatureRise > 0.8) return 'critical';
  if (score > 0.65) return 'warning';
  if (score > 0.45 && previousScore > 0.45) return 'watch';
  return null;
}

function explain(drift: DriftResult, name: string): string[] {
  return drift.signals.filter(s => s.unhealthyZ >= 0.5).map(s => {
    const rule = SIGNAL_RULES[s.signal];
    const percent = s.baseline ? Math.abs(100 * (s.recent - s.baseline) / s.baseline).toFixed(0) : '0';
    const direction = s.recent < s.baseline ? 'below' : 'above';
    const change = s.signal === 'temperature' ? `${Math.abs(s.recent - s.baseline).toFixed(2)} °C` : `${percent}%`;
    return `${rule.label} averages ${change} ${direction} ${name}'s normal over the last 3 days (${s.recent.toFixed(1)} vs ${s.baseline.toFixed(1)} ${rule.unit}; z=${s.zScore.toFixed(2)}).`;
  });
}

// A daily snapshot. The lifecycle helper below gives these candidates episode IDs.
// Passing the full 180-day Engine array is safe: every decision is cut off at day.
export function evaluateDay(readings: Reading[], day: number): Alert[] {
  const today = Math.floor(day);
  if (!Number.isFinite(today) || today < 15 || today > 180) return [];
  const ids = crewIds(readings, today);
  const rows = ids.flatMap(id => { const r = currentReading(readings, id, today); return r ? [r] : []; });
  const co2 = rows.length ? mean(rows.map(r => r.co2)) : 0;
  const drifting = ids.filter(id => {
    const d = driftScore(readings, id, today);
    return d.ready && d.signals.filter(s => s.unhealthyZ >= 0.5).length >= 2;
  });
  const shipEvent = co2 > 2000 && drifting.length >= 3;
  const alerts: Alert[] = [];
  if (shipEvent) alerts.push({
    id: 'baseline:CREW:crew', astronautId: 'CREW', day: today, level: 'warning',
    title: "Ship's air may be affecting the crew",
    why: [`Cabin CO2 is ${Math.round(co2)} ppm, above the demo's 2,000 ppm rule.`, `${drifting.length} astronauts show at least two shared unhealthy signal shifts.`],
    confidence: clamp(drifting.length / Math.max(1, ids.length)),
    confounders: ['Shared workload or sensor calibration can also affect several astronauts.'],
    action: ACTIONS.crew, status: 'open',
  });
  for (const id of ids) {
    const baseline = computeBaseline(readings.filter(r => r.day <= today), id);
    const latest = currentReading(readings, id, today);
    if (!baseline || !latest) continue;
    const name = id.charAt(0).toUpperCase() + id.slice(1);
    const drift = driftScore(readings, id, today);
    const previous = driftScore(readings, id, today - 1);
    const recent = windowReadings(readings, id, today);
    const rise = latest.temperature - baseline.temperature.mean;
    const infection = rise >= 0.3 && latest.heartRate >= baseline.heartRate.mean + 3 && latest.hrv < baseline.hrv.mean;
    const sleep = recent.length === 3 && recent.every(r => r.sleepHours < 6.5);
    const confounders: string[] = [];
    const yesterday = currentReading(readings, id, today - 1);
    if (yesterday && yesterday.activity > baseline.activity.mean * 1.3) confounders.push('Hard exercise yesterday can lower HRV.');
    if (co2 > 2000) confounders.push('High cabin CO2 affects the whole crew.');
    confounders.push('Sensor fit, schedule changes, and individual adaptation may affect readings.');
    let level = driftLevel(drift.score, previous.score, rise);
    // Sleep debt can matter without fever. The weighted whole-body score alone
    // cannot reach 0.65 from sleep/HRV/activity, so it has a separate story rule.
    if (!level && sleep && drift.signals.some(s => s.signal === 'hrv' && s.unhealthyZ >= 0.5)) {
      level = mean(recent.map(r => r.sleepHours)) < 6.1 ? 'warning' : 'watch';
    }
    // Attribute common mild HRV/sleep shifts to cabin air, while retaining
    // independent fever/infection signals and StoneWatch warnings.
    if (level && (!shipEvent || infection || rise > 0.8)) {
      const pattern: Pattern = infection || rise > 0.8 ? 'infection' : sleep ? 'sleep' : 'drift';
      const why = explain(drift, name);
      if (rise > 0.8) why.push(`Today's temperature is ${rise.toFixed(2)} °C above personal baseline (demo critical rule: >0.8 °C).`);
      if (sleep) why.push('Sleep was below 6.5 hours on each of the last 3 days.');
      alerts.push({ id: `baseline:${id}:${pattern}`, astronautId: id, day: today, level,
        title: `${pattern === 'infection' ? 'Possible early infection' : pattern === 'sleep' ? 'Sustained sleep debt' : 'Personal health drift'} — ${name}`,
        why, confidence: clamp(0.35 + drift.signals.filter(s => s.unhealthyZ >= 0.5).length * 0.12),
        confounders, action: ACTIONS[pattern], status: 'open' });
    }
    if (latest.stoneRisk > 0.6) alerts.push({
      id: `baseline:${id}:stone`, astronautId: id, day: today,
      level: latest.stoneRisk >= 0.85 ? 'critical' : latest.stoneRisk > 0.7 ? 'warning' : 'watch',
      title: `StoneWatch risk rising — ${name}`,
      why: [`Simulated stone-risk score is ${latest.stoneRisk.toFixed(2)} (demo watch rule: >0.60).`, `Water intake is ${latest.waterIntake.toFixed(1)} L today.`],
      confidence: latest.waterIntake < 2 ? 0.8 : 0.6,
      confounders: ['This input is a simulated risk index, not a measured probability of kidney stones.', 'Urine chemistry and clinical history are not available.'],
      action: ACTIONS.stone, status: 'open',
    });
  }
  return alerts;
}

/** actionDay is when Start action was clicked, NOT the alert detection day.
 * Two-argument compatibility assumes an acting alert began action on alert.day.
 * Prefer startAction/advanceBrain, which keep a separate persisted action clock.
 */
export function updateAlertStatus(alert: Alert, readings: Reading[], actionDay = alert.day, nowDay?: number): Alert {
  if (alert.status !== 'acting') return { ...alert };
  const day = Math.floor(nowDay ?? Math.max(0, ...readings.filter(r => r.astronautId === alert.astronautId || alert.astronautId === 'CREW').map(r => r.day)));
  if (day < actionDay + 3) return { ...alert };
  const pattern = patternOf(alert);
  let before: number;
  let after: number;
  let yesterday: number;
  if (pattern === 'crew') {
    const ids = crewIds(readings, actionDay);
    const averages = [actionDay, day - 1, day].map(d => {
      const values = ids.map(id => currentReading(readings, id, d)?.co2);
      return values.length >= 3 && values.every(v => v !== undefined) ? mean(values as number[]) : NaN;
    });
    [before, yesterday, after] = averages;
  } else {
    if (windowReadings(readings, alert.astronautId, day).length !== 3) return { ...alert };
    if (pattern === 'stone') {
      before = currentReading(readings, alert.astronautId, actionDay)?.stoneRisk ?? NaN;
      after = currentReading(readings, alert.astronautId, day)?.stoneRisk ?? NaN;
      yesterday = currentReading(readings, alert.astronautId, day - 1)?.stoneRisk ?? NaN;
    } else {
      const scores = [actionDay, day - 1, day].map(d => driftScore(readings, alert.astronautId, d));
      if (scores.some(s => !s.ready)) return { ...alert };
      [before, yesterday, after] = scores.map(s => s.score);
      const b = computeBaseline(readings, alert.astronautId)!;
      if ((currentReading(readings, alert.astronautId, day)?.temperature ?? 0) > b.temperature.mean + 0.8) return { ...alert, status: 'escalated' };
    }
  }
  if (![before, after, yesterday].every(Number.isFinite)) return { ...alert };
  const tolerance = pattern === 'crew' ? 100 : 0.03;
  // Recovery means a sustained improving demo trend, not a clinical cure.
  if (after < before - tolerance && after <= yesterday && (pattern !== 'crew' || after <= 2000)) return { ...alert, status: 'recovered' };
  if (after > before + tolerance) return { ...alert, status: 'escalated' };
  return { ...alert }; // A flat or incompletely observed trend remains under review.
}
