import { useState } from 'react';
import type { DashboardModel } from './model.ts';
import { SleepChart } from './charts.tsx';
import { Icon } from './Icon.tsx';
export function Mind({ model }: { model: DashboardModel }) {
  const [scores, setScores] = useState({ Mood: 3, Energy: 3, Stress: 3 });
  const [saved, setSaved] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const day = Math.floor(model.session.day);
  const rows = model.session.readings.filter(r => r.astronautId === model.astronaut.id && r.day <= day && r.day > day - 21);
  const recentCrew = model.session.readings.filter(r => r.day <= day && r.day > day - 7);
  const average = recentCrew.reduce((sum, r) => sum + r.sleepHours, 0) / recentCrew.length;
  function save() {
    try { localStorage.setItem(`baseline-private-checkin:${model.astronaut.id}:${day}`, JSON.stringify(scores)); setSaved('Saved privately on this device. Excluded from Earth reports.'); }
    catch { setSaved('Device storage is unavailable. Your check-in was not saved.'); }
  }
  return <div className="module-layout mind-layout"><section className="panel"><div className="panel-heading"><div><span className="eyebrow">Rest & readiness</span><h3>Sleep history</h3></div><Icon name="mind"/></div><div className="module-stat"><strong>{model.reading.sleepHours.toFixed(1)}<small>h</small></strong><span>last night<br/>Personal normal {model.baseline?.sleepHours.mean.toFixed(1) ?? 'learning'} h</span></div><SleepChart rows={rows}/><p className="fine-print">Last 21 nights · the 8-hour line is a demo planning target.</p></section>
    <section className="panel checkin-panel"><span className="eyebrow">30-second check-in</span><h3>A moment for {model.astronaut.name}.</h3><p className="muted">Only you see this first. The system asks, it never reports you.</p>
      {!unlocked ? <div className="privacy-gate"><Icon name="shield" size={32}/><p>Personal responses stay on this device and never enter the crew overview or Earth outbox.</p><button className="primary-button" onClick={() => { model.onPrivateCheckin(); setUnlocked(true); }}>Open my private check-in</button><span className="fine-print">Opening pauses the demo clock. Shared device: this is a privacy flow, not authenticated storage.</span></div> : <><p className="fine-print">Personal session · {model.astronaut.name} · D{day}. Past responses are not shown on the shared console.</p>{(Object.keys(scores) as (keyof typeof scores)[]).map(key => <label className="slider-label" key={key}><span>{key}<b>{scores[key]} / 5</b></span><input aria-label={key} type="range" min="1" max="5" value={scores[key]} onChange={e => { setScores({ ...scores, [key]: Number(e.target.value) }); setSaved(''); }}/><small>Low<span>High</span></small></label>)}<button className="primary-button" onClick={save}>Save privately <Icon name="check" size={15}/></button><p className="save-result" role="status">{saved}</p></>}
    </section><section className="panel module-wide crew-pattern"><Icon name="ship" size={27}/><div><span className="eyebrow">CREW PATTERN / SLEEP ONLY</span><h3>{average < 7 ? 'Crew sleep is trending low this week.' : 'Crew sleep remains broadly steady.'}</h3><p>Seven-day crew sleep average: {average.toFixed(1)} h. Personal mood, energy and stress responses are never included.</p></div></section></div>;
}
