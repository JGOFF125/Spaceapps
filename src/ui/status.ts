import type { Alert } from '../types.ts';
export type HealthStatus = 'nominal' | 'learning' | 'watch' | 'warning' | 'critical' | 'recovered';
export const severityRank = { watch: 1, warning: 2, critical: 3 };
export function driftStatus(score: number, ready: boolean): HealthStatus {
  return !ready ? 'learning' : score > 0.85 ? 'critical' : score > 0.65 ? 'warning' : score > 0.45 ? 'watch' : 'nominal';
}
export function stoneStatus(risk: number): HealthStatus {
  return risk >= 0.85 ? 'critical' : risk > 0.7 ? 'warning' : risk > 0.6 ? 'watch' : 'nominal';
}
export function healthStatus(alerts: Alert[], learning = false): HealthStatus {
  if (alerts.some(a => a.level === 'critical' && a.status !== 'recovered')) return 'critical';
  if (alerts.some(a => a.level === 'warning' && a.status !== 'recovered')) return 'warning';
  if (alerts.some(a => a.status !== 'recovered')) return 'watch';
  return learning ? 'learning' : 'nominal';
}
export const statusLabel: Record<HealthStatus, string> = { nominal: 'Nominal', learning: 'Learning', watch: 'Watch', warning: 'Warning', critical: 'Critical', recovered: 'Recovered' };
