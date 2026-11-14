export interface Astronaut {
  id: string;            // 'maya' | 'leo' | 'ana' | 'sam'
  name: string;          // 'Maya', 'Leo', 'Ana', 'Sam'
  role: string;          // 'Commander', 'Engineer', 'Medic', 'Scientist'
  color: string;         // hex accent colour
}

export interface Reading {
  day: number;           // mission day, 1..180 (float — the clock is smooth)
  astronautId: string;
  heartRate: number;     // bpm, resting trend value
  hrv: number;           // ms (RMSSD)
  temperature: number;   // °C
  sleepHours: number;    // last night
  activity: number;      // active minutes today
  waterIntake: number;   // litres today
  stoneRisk: number;     // 0..1 — StoneWatch input score
  radiationDose: number; // cumulative mSv
  co2: number;           // cabin ppm — same value for the whole crew
}

export interface Alert {
  id: string;
  astronautId: string;   // or 'CREW' for ship-level alerts
  day: number;
  level: 'watch' | 'warning' | 'critical';
  title: string;         // 'Possible early infection — Maya'
  why: string[];         // plain-language reasons, shown in the UI
  confidence: number;    // 0..1
  confounders: string[]; // other possible explanations
  action: string;        // the prescribed fix
  status: 'open' | 'acting' | 'recovered' | 'escalated';
}

export interface OutboxMessage {
  id: string;
  day: number;
  kind: 'data' | 'alert' | 'request';
  summary: string;
  priority: 'routine' | 'priority' | 'emergency';
  state: 'stored' | 'sent' | 'received' | 'confirmed';
  lightTimeMin: number;  // current one-way delay in minutes
}
