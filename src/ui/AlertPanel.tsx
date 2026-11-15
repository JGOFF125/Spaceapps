import { useState } from 'react';
import type { Alert } from '../types.ts';
import type { MissionSession } from '../mission/session.ts';
import { allAlerts } from '../mission/session.ts';
import { Icon } from './Icon.tsx';
export function AlertPanel({ session, selected, onAction, onDismiss, onDoctor }: {
  session: MissionSession; selected: string; onAction: (id: string) => void; onDismiss: (id: string, reason: string) => void; onDoctor: () => void;
}) {
  const [reason, setReason] = useState('');
  const [dismissing, setDismissing] = useState<string | null>(null);
  const [history, setHistory] = useState(false);
  const relevant = allAlerts(session).filter(a => a.astronautId === selected || a.astronautId === 'CREW');
  const visible = relevant.filter(a => history ? a.status === 'recovered' || session.dismissals[a.id] : !session.dismissals[a.id]);
  const rank = (a: Alert) => a.level === 'critical' ? 3 : a.level === 'warning' ? 2 : 1;
  visible.sort((a, b) => Number(a.status === 'recovered') - Number(b.status === 'recovered') || rank(b) - rank(a) || b.day - a.day);
  return <aside className="alert-rail"><div className="rail-heading"><span className="eyebrow">ONBOARD DECISIONS</span><h2>Care & alerts <span className="count-badge">{relevant.filter(a => a.status !== 'recovered' && !session.dismissals[a.id]).length}</span></h2></div>
    <div className="segmented"><button onClick={() => setHistory(false)} aria-pressed={!history}>Active</button><button onClick={() => setHistory(true)} aria-pressed={history}>History</button></div>
    <div className="alert-stack" aria-live="polite">{visible.length === 0 && <div className="quiet-state"><div className="quiet-icon"><Icon name="shield" size={25}/></div><h3>{history ? 'No closed alerts yet' : 'A steady trajectory'}</h3><p>{history ? 'Recovery and review records will appear here.' : 'No open alerts for this astronaut. Onboard detection stays active, even without Earth.'}</p><span className="micro-label">CONTINUOUS REVIEW</span></div>}
      {visible.map(a => <article key={a.id} className={`alert-card ${a.status === 'recovered' ? 'recovered' : a.level}`}>
        <div className="alert-top"><span><span className={`status-dot ${a.status === 'recovered' ? 'recovered' : a.level}`}/>{a.status === 'recovered' ? 'RECOVERED' : a.level.toUpperCase()}</span><span>D{String(a.day).padStart(3, '0')}</span></div><h3>{a.title}</h3>
        <p className="alert-status">{session.dismissals[a.id] ? 'Dismissed with review note' : a.status === 'recovered' ? a.id.startsWith('storm:') ? 'Protocol complete ✓ — exposure retained' : 'Recovered ✓ — loop closed' : a.status === 'acting' ? 'Action underway · recheck in progress' : a.status === 'escalated' ? 'Escalated · further medical review needed' : 'Review & act onboard'}</p>
        <ul className="alert-reasons">{a.why.map(why => <li key={why}>{why}</li>)}</ul><div className="confidence"><span>Signal agreement</span><strong>{Math.round(a.confidence * 100)}%</strong><div><i style={{ width: `${a.confidence * 100}%` }}/></div></div>
        <details><summary>Other explanations</summary><ul>{a.confounders.map(c => <li key={c}>{c}</li>)}</ul><p>Agreement is a demo rule score, not a diagnostic probability.</p></details>
        <div className="prescription"><span className="micro-label">NEXT ACTION</span><p>{a.action}</p></div>
        {session.dismissals[a.id] && <p className="review-note">Review note: {session.dismissals[a.id]}</p>}
        {!session.dismissals[a.id] && a.status !== 'recovered' && <><div className="alert-buttons">{a.status !== 'acting' && <button className="primary-button" onClick={() => onAction(a.id)}>Start action <Icon name="arrow" size={14}/></button>}<button className="subtle-button" onClick={onDoctor}>Guided checks <Icon name="chevron" size={13}/></button></div>{a.status === 'acting' && !a.id.startsWith('storm:') && <p className="fine-print">Started D{session.brain.actionDays[a.id]}. At least 3 observed days are needed for recheck.</p>}
          <button className="text-button" onClick={() => { setDismissing(a.id); setReason(''); }}>Dismiss with reason</button>
          {dismissing === a.id && <form className="dismiss-form" onSubmit={e => { e.preventDefault(); if (reason.trim().length >= 5) { onDismiss(a.id, reason); setDismissing(null); } }}><label>Review reason<textarea autoFocus minLength={5} required value={reason} onChange={e => setReason(e.target.value)} placeholder="Document your reason…"/></label><div><button type="submit" className="subtle-button">Save review</button><button type="button" className="text-button" onClick={() => setDismissing(null)}>Cancel</button></div></form>}</>}
      </article>)}
    </div><div className="rail-foot"><Icon name="shield" size={14}/><span>Decision support. Crew medical officer remains in command.</span></div>
  </aside>;
}
