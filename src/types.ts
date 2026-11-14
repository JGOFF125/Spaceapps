// Shared team contract, unchanged. Supporting metadata belongs in src/brain/.
export interface Astronaut {
  id: string;
  name: string;
  role: string;
  color: string;
}
export interface Reading {
  day: number;
  astronautId: string;
  heartRate: number;
  hrv: number;
  temperature: number;
  sleepHours: number;
  activity: number;
  waterIntake: number;
  stoneRisk: number;
  radiationDose: number;
  co2: number;
}
export interface Alert {
  id: string;
  astronautId: string;
  day: number;
  level: 'watch' | 'warning' | 'critical';
  title: string;
  why: string[];
  confidence: number;
  confounders: string[];
  action: string;
  status: 'open' | 'acting' | 'recovered' | 'escalated';
}
export interface OutboxMessage {
  id: string;
  day: number;
  kind: 'data' | 'alert' | 'request';
  summary: string;
  priority: 'routine' | 'priority' | 'emergency';
  state: 'stored' | 'sent' | 'received' | 'confirmed';
  lightTimeMin: number;
}
