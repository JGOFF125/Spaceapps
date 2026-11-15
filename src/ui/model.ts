import type { Astronaut, Alert, Reading } from '../types.ts';
import type { Baseline, DriftResult } from '../brain/index.ts';
import type { MissionSession } from '../mission/session.ts';
export type ModuleId = 'core' | 'mind' | 'stone' | 'storm' | 'ship' | 'doctor';
export interface DashboardModel {
  session: MissionSession; astronaut: Astronaut; reading: Reading;
  baseline: Baseline | null; drift: DriftResult; alerts: Alert[];
  onAction: (id: string) => void; onReport: (id?: string) => void;
  onStorm: () => void; onChecklist: (id: string, step: number) => void;
  onResolveStorm: (id: string) => void;
  onReviewAlerts: () => void;
  onPrivateCheckin: () => void;
}
export const MODULES: { id: ModuleId; number: string; name: string; subtitle: string }[] = [
  { id: 'core', number: '01', name: 'Core', subtitle: 'Personal health overview' },
  { id: 'mind', number: '02', name: 'Mind', subtitle: 'Sleep & readiness' },
  { id: 'stone', number: '03', name: 'StoneWatch', subtitle: 'Hydration & prevention' },
  { id: 'storm', number: '04', name: 'Storm Shield', subtitle: 'Radiation exposure' },
  { id: 'ship', number: '05', name: 'Ship’s Health', subtitle: 'Environment & crew' },
  { id: 'doctor', number: '06', name: 'Ship’s Doctor', subtitle: 'Guided onboard care' },
];
