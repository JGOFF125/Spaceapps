import { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Alert } from '../src/types.ts';
import { advanceBrain, badgeText, communicationLabel, computeBaseline, createBrainState, createOutbox, driftScore, enqueueMessage, relayCountdownHours, restoreOutbox, setBlackout, setMarsMode, startAction, tickOutbox } from '../src/brain/index.ts';
import type { BrainState, OutboxState } from '../src/brain/index.ts';
import { CREW, fixtureMission } from './fixtures.ts';
import type { Treatment } from './fixtures.ts';
import './style.css';

type Scenario = 'maya' | 'sam' | 'leo' | 'crew' | 'clean';
interface Session { day: number; scenario: Scenario; treatments: Treatment[]; works: boolean; brain: BrainState; outbox: OutboxState; }
const KEY = 'baseline-member2-lab-v1';
const scenarios: Record<Scenario, { label: string; day: number; hint: string }> = {
  maya: { label: 'A · Infection drift', day: 63, hint: 'Start Maya’s action, then advance 3 days. Her alert should show recovered.' },
  sam: { label: 'B · Sleep debt', day: 102, hint: 'Start Sam’s action, then advance 3–5 days to check the improving sleep trend.' },
  leo: { label: 'C · StoneWatch', day: 120, hint: 'Start Leo’s hydration action. Risk should fall and the recovery check should close.' },
  crew: { label: 'D · Cabin air', day: 132, hint: 'A shared CO₂ event produces one crew alert. Advance 3 days for normal-air recovery.' },
  clean: { label: 'Healthy control', day: 30, hint: 'No alerts should appear. Personal baselines are learned from days 1–14.' },
};
function fresh(scenario: Scenario = 'maya'): Session {
  const day = scenarios[scenario].day;
  const treatments: Treatment[] = scenario === 'sam' || scenario === 'leo' || scenario === 'crew' ? [{ astronautId: 'maya', day: 63 }] : [];
  if (scenario === 'leo' || scenario === 'crew') treatments.push({ astronautId: 'sam', day: 102 });
  if (scenario === 'crew') treatments.push({ astronautId: 'leo', day: 120 });
  // Fixture shortcuts isolate each case; initialize directly at its observation
  // day rather than show the unrelated stories that were already resolved.
  const brain = { ...createBrainState(), day: day - 1 };
  return { day, scenario, treatments, works: true,
    brain: advanceBrain(brain, fixtureMission(treatments, true, scenario !== 'clean'), day), outbox: createOutbox(day) };
}
function restore(): Session {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const saved = JSON.parse(raw) as Session;
    if (!saved || !(saved.scenario in scenarios) || !Number.isFinite(saved.day) || saved.day < 1 || saved.day > 180 ||
        !Array.isArray(saved.treatments) || typeof saved.works !== 'boolean' || !Array.isArray(saved.brain?.alerts) ||
        saved.brain.day !== Math.floor(saved.day)) return fresh();
    saved.outbox = restoreOutbox(JSON.stringify(saved.outbox));
    if (saved.outbox.day !== saved.day) return fresh();
    return saved;
  } catch { return fresh(); }
}
function advance(session: Session, amount: number): Session {
  const day = Math.min(180, session.day + amount);
  const data = fixtureMission(session.treatments, session.works, session.scenario !== 'clean');
  return { ...session, day, brain: advanceBrain(session.brain, data, day), outbox: tickOutbox(session.outbox, day) };
}

export default function App() {
  const [session, setSession] = useState(restore);
  const [selected, setSelected] = useState('maya');
  const [playing, setPlaying] = useState(false);
  const isPlaying = playing && session.day < 180;
  const data = useMemo(() => fixtureMission(session.treatments, session.works, session.scenario !== 'clean'), [session.treatments, session.works, session.scenario]);
  const day = Math.floor(session.day);
  const selectedCrew = CREW.find(c => c.id === selected)!;
  const drift = driftScore(data, selected, day);
  const baseline = computeBaseline(data, selected)!;
  const history = data.filter(r => r.astronautId === selected && r.day <= day && r.day >= day - 14);
  const points = history.map((r, i) => `${20 + i * 40},${150 - (r.hrv - 30) * 2.5}`).join(' ');
  const alerts = session.brain.alerts;
  const active = alerts.filter(a => a.status !== 'recovered').length;

  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(session)); } catch { /* Storage may be unavailable; keep the in-memory test session usable. */ } }, [session]);
  useEffect(() => {
    if (!isPlaying) return;
    const timer = window.setInterval(() => setSession(s => advance(s, 1)), 1700);
    return () => window.clearInterval(timer);
  }, [isPlaying]);

  function takeAction(alert: Alert) {
    setSession(s => ({ ...s,
      brain: startAction(s.brain, alert.id),
      treatments: alert.astronautId === 'CREW' ? s.treatments : [...s.treatments, { astronautId: alert.astronautId, day: Math.floor(s.day) }],
      outbox: enqueueMessage(s.outbox, 'alert', `${alert.title}: onboard action started on day ${day}`, alert.level === 'critical' ? 'emergency' : 'priority', s.day),
    }));
  }
  function pickScenario(scenario: Scenario) {
    setPlaying(false); setSession(fresh(scenario)); setSelected(scenario === 'crew' || scenario === 'clean' ? 'maya' : scenario);
  }
  return <main>
    <header><div><div className="eyebrow">THE VOID VOYAGUERS / MEMBER 02</div><h1>BASELINE<span className="dot">.</span></h1><p>Logic & alerts · integration test bench</p></div>
      <div className="mission"><span className="eyebrow">MISSION DAY</span><strong data-testid="day">{session.day.toFixed(2)} <small>/ 180</small></strong><span className="live">● Onboard rules active</span></div></header>
    <section className="controls" aria-label="Mission controls">
      <div className="buttonrow"><button className="primary" onClick={() => setPlaying(p => !p)} disabled={day >= 180}>{isPlaying ? 'Pause' : 'Play'}</button>
        <button onClick={() => setSession(s => advance(s, 0.25))}>+6 hours</button><button onClick={() => setSession(s => advance(s, 1))}>+1 day</button><button onClick={() => setSession(s => advance(s, 3))}>+3 days</button>
        <button onClick={() => pickScenario(session.scenario)}>Reset case</button></div>
      <div className="buttonrow"><label className="switch"><input type="checkbox" checked={session.outbox.marsMode} onChange={e => setSession(s => ({ ...s, outbox: setMarsMode(s.outbox, e.target.checked) }))}/>Mars Mode</label>
        <label className="switch"><input type="checkbox" checked={session.outbox.blackout} onChange={e => setSession(s => ({ ...s, outbox: setBlackout(s.outbox, e.target.checked) }))}/>Blackout</label></div>
    </section>
    <nav aria-label="Test scenarios">{(Object.entries(scenarios) as [Scenario, typeof scenarios[Scenario]][]).map(([key, item]) => <button key={key} aria-pressed={session.scenario === key} className={session.scenario === key ? 'selected' : ''} onClick={() => pickScenario(key)}>{item.label}</button>)}</nav>
    <div className="case-note"><span>TEST THIS</span> {scenarios[session.scenario].hint}</div>
    <section className="crew-grid" aria-label="Crew readings">{CREW.map(person => {
      const reading = data.find(r => r.astronautId === person.id && r.day === day)!;
      const score = driftScore(data, person.id, day);
      return <button className={`crew-card ${selected === person.id ? 'chosen' : ''}`} key={person.id} style={{ borderTopColor: person.color }} onClick={() => setSelected(person.id)} aria-pressed={selected === person.id}>
        <div className="card-heading"><h2>{person.name}</h2><span className="role">{person.role}</span></div>
        <div className="metrics"><div><strong>{reading.heartRate.toFixed(0)}</strong><span>bpm · resting HR</span></div><div><strong>{reading.hrv.toFixed(0)}</strong><span>ms · HRV</span></div><div><strong>{reading.temperature.toFixed(1)}°</strong><span>temperature</span></div></div>
        <div className="card-foot"><span>{reading.sleepHours.toFixed(1)} h sleep</span><span>Drift {Math.round(score.score * 100)}/100</span></div>
      </button>;
    })}</section>
    <div className="workspace"><section className="panel trend"><div className="section-heading"><div><span className="eyebrow">PERSONAL BASELINE</span><h2>{selectedCrew.name} · explainable drift</h2></div><strong className="score">{Math.round(drift.score * 100)}<small>/100</small></strong></div>
      <p className="muted">HRV across the last 15 days · baseline {baseline.hrv.mean.toFixed(1)} ms</p>
      <svg viewBox="0 0 600 180" role="img" aria-label={`${selectedCrew.name} HRV trend with personal baseline`}><line x1="20" x2="580" y1={150 - (baseline.hrv.mean - 30) * 2.5} y2={150 - (baseline.hrv.mean - 30) * 2.5} stroke="#7183aa" strokeDasharray="5 5"/><polyline points={points} fill="none" stroke={selectedCrew.color} strokeWidth="3"/><text x="20" y="175">Day {day - 14}</text><text x="530" y="175">Day {day}</text></svg>
      <div className="signals">{drift.signals.filter(s => s.unhealthyZ >= 0.5).map(signal => <div key={signal.signal}><span>{signal.signal}</span><strong>z {signal.zScore.toFixed(2)}</strong><meter min="0" max="1" value={signal.contribution / 0.3}/></div>)}{drift.signals.every(s => s.unhealthyZ < 0.5) && <p className="good">Signals are close to personal baseline.</p>}</div>
      <div className="method">14-day personal baseline → 3-day trend → explained alert → action → recheck</div>
      <label className="failure"><input type="checkbox" checked={!session.works} onChange={e => setSession(s => ({ ...s, works: !e.target.checked }))}/> Simulate ineffective treatment (Maya escalation test)</label>
    </section>
    <section className="panel alerts"><div className="section-heading"><div><span className="eyebrow">ONBOARD DECISIONS</span><h2>Alert & action loop</h2></div><span className="count">{active} active</span></div>
      <div className="alert-list" aria-live="polite">{alerts.length === 0 && <div className="empty"><span>✓</span><h3>No active alerts</h3><p>Healthy control readings stay within personal ranges.</p></div>}{alerts.map(a => <article className={`alert ${a.level} ${a.status}`} key={a.id}>
        <div className="alert-meta"><span>{a.level.toUpperCase()} · DAY {a.day}</span><strong data-testid="alert-status">{a.status === 'recovered' ? 'Recovered ✓ — loop closed' : a.status}</strong></div>
        <h3>{a.title}</h3><ul>{a.why.map(reason => <li key={reason}>{reason}</li>)}</ul>
        <p className="agreement">Rule agreement {Math.round(a.confidence * 100)}% · not a diagnostic probability</p>
        <details><summary>Other possible explanations</summary><ul>{a.confounders.map(c => <li key={c}>{c}</li>)}</ul></details>
        <p className="action-copy">{a.action}</p>
        {(a.status === 'open' || a.status === 'escalated') && <button className="primary" onClick={() => takeAction(a)}>Start action — {a.astronautId === 'CREW' ? 'Crew' : a.astronautId}</button>}
        {a.status === 'acting' && <p className="muted">Action started day {session.brain.actionDays[a.id]}. Recheck after 3 observed days.</p>}
      </article>)}</div>
    </section></div>
    <section className="panel communications"><div className="section-heading"><div><span className="eyebrow">STORE → SEND → RECEIVE → CONFIRM</span><h2>Earth outbox</h2></div><button onClick={() => setSession(s => ({ ...s, outbox: enqueueMessage(s.outbox, 'data', `Crew status report · day ${s.day.toFixed(2)}`, 'routine') }))}>Queue test report</button></div>
      <div className="link-state"><strong>{communicationLabel(session.outbox)}</strong><span>{session.outbox.blackout ? 'Waiting for link restoration' : `Next relay in ${relayCountdownHours(session.day).toFixed(1)} mission hours`} · 22 min = 0.5 demo day</span></div>
      {session.outbox.messages.length === 0 ? <p className="muted">Queue a report, then use +6 hours to inspect each delivery state.</p> : <div className="message-list">{[...session.outbox.messages].reverse().map(m => <article className="message" key={m.id}><div><strong>{m.summary}</strong><p>{badgeText(m, session.day, session.outbox.timings[m.id])}</p></div><span className={`state ${m.state}`}>{m.state}</span></article>)}</div>}
    </section>
    <footer><p>Simulated test data · transparent demo rules · decision support, not diagnosis. Countermeasures are scripted examples for crew-medical review.</p><p>Member 2 only. The team’s production Engine and dashboard connect through <code>src/brain/index.ts</code>. Session saves locally when browser storage is available. Reset case starts fresh.</p></footer>
  </main>;
}
createRoot(document.getElementById('root')!).render(<App/>);
