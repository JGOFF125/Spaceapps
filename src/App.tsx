import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { CREW, REAL_MS_PER_MISSION_DAY, tick } from './engine/simulate.ts';
import { computeBaseline, driftScore } from './brain/index.ts';
import { actOnAlert, activeAlerts, advanceMission, allAlerts, completeShelter, createMission, dismissAlert, packReport, recordChecklist, restoreMission, seekMission, serializeMission, triggerStorm } from './mission/session.ts';
import { useShipSync } from './mission/useShipSync.ts';
import type { MissionSession } from './mission/session.ts';
import { CrewCard } from './ui/CrewCard.tsx';
import { AlertPanel } from './ui/AlertPanel.tsx';
import { ModuleTabs } from './ui/ModuleNavigation.tsx';
import { MODULES } from './ui/model.ts';
import type { DashboardModel, ModuleId } from './ui/model.ts';
import { Icon } from './ui/Icon.tsx';
import { healthStatus, statusLabel } from './ui/status.ts';
import { Sheet } from './ui/Sheet.tsx';
import { EarthLink } from './ui/EarthLink.tsx';

const STORAGE_KEY = 'baseline-cockpit-v1';
const THEME_KEY = 'baseline-appearance-v1';
const ModuleContent = lazy(() => import('./ui/ModuleTabs.tsx').then(module => ({ default: module.ModuleContent })));
const WatchView = lazy(() => import('./ui/WatchView.tsx').then(module => ({ default: module.WatchView })));
function load(): MissionSession {
  try { const saved = localStorage.getItem(STORAGE_KEY); return saved ? restoreMission(saved) : createMission(); }
  catch { return createMission(); }
}
function loadTheme(): 'dark' | 'light' {
  try { return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'; }
  catch { return 'dark'; }
}
const TITLES = { core: 'Health overview', mind: 'Mind & recovery', stone: 'StoneWatch', storm: 'Storm Shield', ship: 'Ship’s Health', doctor: 'Ship’s Doctor' };

export default function App() {
  const [session, setSession] = useState(load);
  const [selected, setSelected] = useState('maya');
  const [module, setModule] = useState<ModuleId>('core');
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [watch, setWatch] = useState(false);
  const [sheet, setSheet] = useState<'care' | 'earth' | null>(null);
  const [theme, setTheme] = useState(loadTheme);
  const [presentation, setPresentation] = useState(false);
  const [notice, setNotice] = useState('');
  const noticeId = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const day = Math.floor(session.day);
  const running = playing && session.day < 180;
  const astronaut = CREW.find(a => a.id === selected)!;
  const snapshot = useMemo(() => tick(session.readings, session.day), [session.readings, session.day]);
  const observed = useMemo(() => session.readings.filter(r => r.day <= day), [session.readings, day]);
  const baselines = useMemo(() => Object.fromEntries(CREW.map(a => [a.id, computeBaseline(observed, a.id)])), [observed]);
  const drift = useMemo(() => driftScore(session.readings, selected, day), [session.readings, selected, day]);
  const alerts = activeAlerts(session);
  const personalAlerts = allAlerts(session).filter(a => (a.astronautId === selected || a.astronautId === 'CREW') && !session.dismissals[a.id]);
  const status = healthStatus(personalAlerts, day < 15);
  const reading = snapshot.find(r => r.astronautId === selected)!;

  useShipSync(session, setSession);

  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, serializeMission(session)); } catch { /* Continue in memory if device storage is blocked. */ } }, [session]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* The chosen appearance still applies to this session. */ }
  }, [theme]);
  useEffect(() => {
    if (!running) return;
    let last = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now(); const elapsed = Math.min(1000, now - last); last = now;
      setSession(s => advanceMission(s, s.day + elapsed / REAL_MS_PER_MISSION_DAY * speed));
    }, 250);
    return () => window.clearInterval(timer);
  }, [running, speed]);
  useEffect(() => () => clearTimeout(noticeId.current), []);

  function notify(text: string) {
    setNotice(text); clearTimeout(noticeId.current);
    noticeId.current = setTimeout(() => setNotice(''), 4500);
  }
  function jump(value: number) {
    const rewinding = value < session.day;
    setPlaying(false); setSession(s => seekMission(s, value));
    setSelected(value === 132 || value === 129 ? 'ana' : value === 120 || value === 88 ? 'leo' : value === 102 || value === 93 ? 'sam' : 'maya');
    setModule(value === 102 || value === 93 ? 'mind' : value === 120 || value === 88 ? 'stone' : value === 132 || value === 129 ? 'ship' : 'core');
    notify(rewinding ? `Day ${value} replayed. Future events, review notes and communications cleared; earlier actions retained.` : `Day ${value} reached. Earlier actions and reports retained.`);
  }
  function start(id: string) {
    setSession(s => actOnAlert(s, id)); setSheet(null);
    notify('Action started. Onboard monitoring will recheck the trend.');
  }
  function report(id?: string) {
    setSession(s => packReport(s, id, selected));
    notify(session.outbox.blackout ? 'Report stored until the blackout clears.' : 'Report queued for the next relay.');
  }
  const model: DashboardModel = {
    session, astronaut, reading, baseline: baselines[selected], drift, alerts: personalAlerts,
    onAction: start, onReport: report, onReviewAlerts: () => setSheet('care'),
    onPrivateCheckin: () => setPlaying(false),
    onStorm: () => { setSession(s => triggerStorm(s)); notify('Solar event simulated. The crew shelter protocol is active.'); },
    onChecklist: (id, step) => setSession(s => recordChecklist(s, id, step)),
    onResolveStorm: id => {
      setSession(s => completeShelter(s, id));
      notify('Shelter protocol recorded. Cumulative exposure remains in the ledger.');
    },
  };
  return <div className={`mission-app ${presentation ? 'presentation' : ''}`}>
    <a className="skip-link" href="#health-content">Skip to health overview</a>
    <aside className="navigation-rail" aria-label="Application navigation">
      <a href="#health-content" className="brand-mark" aria-label="BASELINE home"><svg viewBox="0 0 30 30" aria-hidden="true"><path d="M5 22V8h8c7 0 7 7 0 7H5m8 0c9 0 9 7 0 7H5M2 27 27 2" fill="none" stroke="currentColor" strokeWidth="2"/></svg></a>
      <ModuleTabs active={module} onChange={id => { setModule(id); setWatch(false); }}/>
      <div className="rail-bottom"><Icon name="shield" size={22}/><span>Onboard</span></div>
    </aside>
    <div className="app-workspace">
      <header className="app-header"><span className="wordmark"><b>BASELINE</b><span className="wordmark-divider"/><span className="wordmark-description">Health monitoring</span></span>
        <div className="header-actions">
          <button className="header-button theme-toggle" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} onClick={() => setTheme(value => value === 'dark' ? 'light' : 'dark')}><Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18}/><span>{theme === 'dark' ? 'Light' : 'Dark'}</span></button>
          <button className={`header-button ${watch ? 'is-selected' : ''}`} aria-label={watch ? 'Console view' : 'Smartwatch'} aria-pressed={watch} onClick={() => setWatch(value => !value)}><Icon name="watch" size={18}/><span>{watch ? 'Console' : 'Smartwatch'}</span></button>
          <button className="header-button earth-trigger" onClick={() => setSheet('earth')} aria-label="Earth communications"><Icon name="earth" size={18}/><span>{session.outbox.blackout ? 'Blackout' : session.outbox.marsMode ? 'Earth +22 min' : 'Earth link'}</span></button>
          <button className="care-trigger" onClick={() => setSheet('care')} aria-label={`Care & alerts, ${alerts.length} active`}><Icon name="bell" size={19}/>{alerts.length > 0 && <span className="notification-count">{alerts.length}</span>}</button>
        </div>
      </header>
      <main id="health-content" className="health-content">
        <div className="page-heading"><div><h1>{watch ? 'Wrist companion' : TITLES[module]}</h1><p><span>{astronaut.name}<span className="person-role"> · {astronaut.role}</span></span><span>·</span><span className={`status-text ${status}`}>{statusLabel[status]}</span></p></div>
          <div className="mission-clock"><div><span>Mission day</span><strong data-testid="mission-day">{String(day).padStart(3, '0')}<small>/ 180</small></strong></div><div className="clock-controls"><button className="icon-button" aria-label={running ? 'Pause mission' : 'Play mission'} disabled={session.day >= 180} onClick={() => setPlaying(value => !value)}><Icon name={running ? 'pause' : 'play'} size={17}/></button><button className="speed-button" aria-label={`Mission speed ${speed} times`} onClick={() => setSpeed(value => value === 1 ? 4 : 1)}>{speed}×</button></div></div>
        </div>
        <section className="crew-selector" aria-label="Select astronaut">{CREW.map(a => <CrewCard key={a.id} astronaut={a} alerts={alerts.filter(alert => alert.astronautId === a.id || alert.astronautId === 'CREW')} selected={selected === a.id} onSelect={() => setSelected(a.id)} learning={day < 15}/>)}</section>
        <Suspense fallback={<div className="module-loading" role="status">Loading health view…</div>}>
          {watch ? <WatchView key={selected} model={model} onClose={() => setWatch(false)}/> : <div className="module-page" key={`${module}:${selected}`} aria-label={MODULES.find(m => m.id === module)!.name}><h2 className="sr-only">{MODULES.find(m => m.id === module)!.subtitle}</h2><ModuleContent active={module} model={model}/></div>}
        </Suspense>
      </main>
      <footer className="app-footer"><span>Simulated mission data <span>·</span> Decision support</span>
        {presentation && <button className="text-button" onClick={() => setPresentation(false)}>Exit presentation mode</button>}
        <details className="demo-tools" hidden={presentation}><summary><Icon name="settings" size={16}/>Demo controls</summary><div className="demo-controls">
          <label>Jump to story<select aria-label="Demo scenario" value="" onChange={e => { jump(Number(e.target.value)); const tools = e.currentTarget.closest('details'); tools?.removeAttribute('open'); tools?.querySelector('summary')?.focus(); }}><option value="" disabled>Select a story</option><option value="30">Healthy snapshot · day 30</option><option value="58">Story A lead-in · day 58</option><option value="63">Infection drift · day 63</option><option value="93">Story B lead-in · day 93</option><option value="102">Sleep debt · day 102</option><option value="88">Story C lead-in · day 88</option><option value="120">Stone risk · day 120</option><option value="129">CO₂ lead-in · day 129</option><option value="132">Cabin CO₂ · day 132</option></select></label>
          <div className="demo-step-buttons"><button className="subtle-button" onClick={() => setSession(s => advanceMission(s, s.day + 1))}>+1 day</button><button className="subtle-button" onClick={() => setSession(s => advanceMission(s, s.day + 3))}>+3 days</button></div>
          <button className="text-button" onClick={() => { setPlaying(false); setSession(createMission(1)); setSelected('maya'); setModule('core'); notify('Mission reset. Actions, events, reports and advice cleared.'); }}><Icon name="reset" size={16}/>Reset mission</button>
          <button className="text-button" aria-pressed={presentation} onClick={() => setPresentation(value => !value)}>{presentation ? 'Exit presentation mode' : 'Presentation mode'}</button>
        </div></details>
      </footer>
    </div>
    {notice && <div className="toast" role="status"><Icon name="check" size={18}/><span>{notice}</span><button className="icon-button" aria-label="Dismiss notification" onClick={() => setNotice('')}><Icon name="close" size={16}/></button></div>}
    {sheet === 'earth' && <Sheet title="Earth communications" onClose={() => setSheet(null)}><EarthLink session={session} setSession={setSession} onReport={() => report()}/></Sheet>}
    {sheet === 'care' && <Sheet title="Care & alerts" onClose={() => setSheet(null)}><AlertPanel session={session} selected={selected} onAction={start}
      onDismiss={(id, reason) => { setSession(s => dismissAlert(s, id, reason)); notify('Review reason saved.'); }}
      onDoctor={() => { setModule('doctor'); setWatch(false); setSheet(null); }}/></Sheet>}
  </div>;
}
