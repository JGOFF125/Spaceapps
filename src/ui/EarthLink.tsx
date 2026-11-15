import { badgeText, relayCountdownHours } from '../brain/outbox.ts';
import type { MissionSession } from '../mission/session.ts';
import type { Dispatch, SetStateAction } from 'react';
import { advanceMission, configureLink } from '../mission/session.ts';
import { adviceBadge, arrived, earthSnapshot } from '../mission/earth.ts';
import { Icon } from './Icon.tsx';

export function EarthLink({ session, setSession, onReport }: {
  session: MissionSession; setSession: Dispatch<SetStateAction<MissionSession>>; onReport: () => void;
}) {
  return <div className="earth-content">
    <p className="muted">Decisions stay onboard. Reports travel when the link is available.</p>
    <a className="subtle-button earth-open-link" href="#/earth" target="_blank" rel="noopener">Open Earth tab <Icon name="arrow" size={16}/></a>
    <label className="toggle-row"><span><b>Mars Mode</b><small>22-minute one-way light-time · onboard mode</small></span><input aria-label="Mars Mode" type="checkbox" checked={session.outbox.marsMode} onChange={e => setSession(s => configureLink(s, { marsMode: e.target.checked }))}/></label>
    <label className="toggle-row"><span><b>Communications blackout</b><small>Unsent reports and advice remain queued</small></span><input aria-label="Communications blackout" type="checkbox" checked={session.outbox.blackout} onChange={e => setSession(s => configureLink(s, { blackout: e.target.checked }))}/></label>
    <div className="relay-info"><Icon name="link"/><div><strong>{session.outbox.blackout ? 'Blackout · onboard care active' : `Next relay in ${relayCountdownHours(session.day).toFixed(1)} mission hours`}</strong><p>Demo timing: 22 light-minutes = 0.5 mission day. Near mode uses 3 minutes.</p></div></div>
    <button className="primary-button" onClick={onReport}>Queue status report <Icon name="arrow" size={16}/></button>
    <div className="outbox-heading"><h3>Incoming Earth advice</h3><span>{session.inbox.messages.filter(arrived).length} arrived</span></div>
    <div className="outbox-list">{!session.inbox.messages.some(arrived) && <p className="muted">No advice has arrived. Onboard care remains active.</p>}{[...session.inbox.messages].reverse().filter(arrived).map(m => <article key={m.id}><div><span className="state-tag received">Earth advice · advisory</span></div><p>{m.summary}</p><small>{adviceBadge(m, earthSnapshot(session))}</small></article>)}</div>
    <div className="outbox-heading"><h3>Delivery ledger</h3><span>{session.outbox.messages.length} packets</span></div>
    <div className="outbox-list">{session.outbox.messages.length === 0 && <p className="muted">No reports queued yet.</p>}{[...session.outbox.messages].reverse().map(m => <article key={m.id}>
      <div><span className={`state-tag ${m.state}`}>{m.state}</span><span>{m.priority} · Day {Math.floor(m.day)}</span></div><p>{m.summary}</p><small>{badgeText(m, session.day, session.outbox.timings[m.id])}</small>
    </article>)}</div>
    <div className="drawer-clock"><span>Test delivery</span><button className="subtle-button" onClick={() => setSession(s => advanceMission(s, s.day + 0.25))}>Advance 6 mission hours</button></div>
  </div>;
}
