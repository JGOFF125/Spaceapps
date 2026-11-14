// TEST FIXTURES ONLY. Member 1 owns the production simulator and treatment model.
import type { Astronaut, Reading } from '../src/types.ts';
export const CREW: Astronaut[] = [
  { id: 'maya', name: 'Maya', role: 'Commander', color: '#38e1ff' },
  { id: 'leo', name: 'Leo', role: 'Engineer', color: '#ffc857' },
  { id: 'ana', name: 'Ana', role: 'Medic', color: '#a8a0ff' },
  { id: 'sam', name: 'Sam', role: 'Scientist', color: '#2ee6a8' },
];
export interface Treatment { astronautId: string; day: number; }
export function fixtureMission(treatments: Treatment[] = [], treatmentWorks = true, stories = true): Reading[] {
  const result: Reading[] = [];
  for (let day = 1; day <= 180; day++) for (const [i, person] of CREW.entries()) {
    const wave = Math.sin(day * 1.7 + i) * 0.25;
    const r: Reading = { day, astronautId: person.id, heartRate: 58 + i * 2 + wave,
      hrv: 65 - i * 3 + wave, temperature: 36.6 + wave * 0.03,
      sleepHours: 7.8 - i * 0.1 + wave * 0.1, activity: 95 - i * 5 + wave * 2,
      waterIntake: 2.4, stoneRisk: 0.25, radiationDose: day, co2: 1200 };
    const treatment = treatments.filter(t => t.astronautId === person.id && t.day < day).at(-1);
    const recovery = (days: number) => treatment && treatmentWorks ? Math.max(0, 1 - (day - treatment.day) / days) : 1;
    if (stories && person.id === 'maya' && day >= 60) {
      const strength = Math.min(1, (day - 59) / 4) * recovery(3);
      r.hrv -= 65 * 0.25 * strength; r.heartRate += 8 * strength;
      r.temperature += 0.6 * strength; r.sleepHours -= 1.5 * strength;
      if (treatment && !treatmentWorks) r.temperature += Math.min(0.5, (day - treatment.day) * 0.12);
    }
    if (stories && person.id === 'sam' && day >= 95) {
      const strength = Math.min(1, (day - 94) / 5) * recovery(5);
      r.sleepHours -= 1.7 * strength; r.hrv -= 56 * 0.15 * strength; r.activity -= 24 * strength;
    }
    if (stories && person.id === 'leo' && day >= 90) {
      const strength = Math.min(1, (day - 89) / 41);
      r.waterIntake -= recovery(7); r.stoneRisk = 0.25 + 0.6 * strength * recovery(7);
    }
    if (stories && day >= 130 && day <= 132) {
      r.co2 = 2800; r.hrv *= 0.9; r.sleepHours -= 0.8;
    }
    result.push(r);
  }
  return result;
}
