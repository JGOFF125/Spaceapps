import { useEffect, useRef, useState } from 'react';
import { badgeText, lightTimeToDays } from '../brain/outbox.ts';
import { adviceBadge, arrived, earthVisibleDay, HELLO_KEY, REPLIES_KEY, restoreEarthSnapshot, SNAPSHOT_KEY, SYNC_CHANNEL } from '../mission/earth.ts';
import type { EarthSnapshot } from '../mission/earth.ts';
import type { EarthReply } from '../mission/session.ts';
import { Icon } from './Icon.tsx';

function savedSnapshot(): EarthSnapshot | null {
  try { return restoreEarthSnapshot(JSON.parse(localStorage.getItem(SNAPSHOT_KEY) ?? 'null')); } catch { return null; }
}
export function EarthView() {
  const [snapshot, setSnapshot] = useState(savedSnapshot);
  const [sourceId, setSourceId] = useState('');
  const [advice, setAdvice] = useState('');
  const [notice, setNotice] = useState('');
  const channel = useRef<BroadcastChannel | null>(null);
  useEffect(() => {
    const accept = (value: unknown) => { try { setSnapshot(restoreEarthSnapshot(value)); } catch { /* Ignore unrelated or incomplete data. */ } };
    if (typeof BroadcastChannel !== 'undefined' && new URLSearchParams(location.search).get('sync') !== 'storage') {
      try {
        channel.current = new BroadcastChannel(SYNC_CHANNEL);
        channel.current.onmessage = e => { if (e.data?.type === 'snapshot') accept(e.data.snapshot); };
        channel.current.postMessage({ type: 'hello' });
      } catch { /* Use storage events. */ }
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === SNAPSHOT_KEY && e.newValue) { try { accept(JSON.parse(e.newValue)); } catch { /* Ignore malformed storage. */ } }
    };
    window.addEventListener('storage', onStorage);
    try { localStorage.setItem(HELLO_KEY, crypto.randomUUID()); } catch { /* Channel hello already requested a snapshot. */ }
    return () => { channel.current?.close(); channel.current = null; window.removeEventListener('storage', onStorage); };
  }, []);
  const received = snapshot?.outbox.messages.filter(arrived) ?? [];
  const selectedSource = received.some(m => m.id === sourceId) ? sourceId : received.at(-1)?.id ?? '';
  function sendAdvice() {
    if (!snapshot || !selectedSource || !advice.trim()) return;
    const reply: EarthReply = { id: crypto.randomUUID(), missionId: snapshot.missionId, sourceMessageId: selectedSource, summary: advice.trim() };
    let queued = false;
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(REPLIES_KEY) ?? '[]');
      const pending: EarthReply[] = Array.isArray(stored) ? stored : [];
      // A reset/rewind starts a new communication epoch. Old advice is discarded.
      localStorage.setItem(REPLIES_KEY, JSON.stringify([...pending.filter(r => r.missionId === snapshot.missionId && !snapshot.earthReplies[r.id]), reply].slice(-50)));
      queued = true;
    } catch { /* Try the channel directly. */ }
    if (channel.current) { channel.current.postMessage({ type: 'reply', reply }); queued = true; }
    setNotice(queued ? 'Advice queued. Keep the ship console open and advance its clock to deliver.' : 'Browser storage and tab communication are unavailable. Advice was not queued.');
    if (queued) setAdvice('');
  }
  return <main className="earth-view">
    <header className="earth-page-header"><div><span className="eyebrow">BASELINE / DELAYED MISSION CONTROL</span><h1>EARTH — Mission Support</h1><p>Asynchronous advice · simulated communications</p></div><a className="subtle-button" href="#health-content" target="_blank" rel="noopener">Open ship console <Icon name="arrow" size={16}/></a></header>
    {!snapshot ? <section className="panel"><h2>Waiting for the ship</h2><p>Open the ship console on this browser and origin. No server is used.</p></section> : <>
      <section className="earth-clocks" aria-label="Delayed mission clocks"><div><span>Earth-visible day</span><strong data-testid="earth-day" title={`${snapshot.day.toFixed(3)} ship day − ${snapshot.lightTimeMin}/44 (${lightTimeToDays(snapshot.lightTimeMin).toFixed(3)} mission day)`}>{earthVisibleDay(snapshot).toFixed(2)}</strong><small>Ship clock minus one-way light-time</small></div><div><span>Last synchronized ship day</span><strong>{snapshot.day.toFixed(2)}</strong><small>{snapshot.outbox.blackout ? 'Blackout · unsent packets wait' : `${snapshot.lightTimeMin}-minute one-way delay`}</small></div></section>
      <p className="fine-print earth-timing-note">Keep one ship console open. Its play/pause controls both clocks. Demo compression: 22 light-minutes = 0.5 mission day; relay windows occur every 6 mission hours. The clock is a delay illustration; only arrived packets supply health information.</p>
      <div className="earth-page-grid"><section className="panel"><div className="panel-heading"><h2>Ship reports</h2><span className="tiny-tag">{snapshot.outbox.messages.length} packets</span></div><div className="outbox-list">{snapshot.outbox.messages.length === 0 && <p className="muted">No reports queued. Queue a status report from the ship.</p>}{[...snapshot.outbox.messages].reverse().map(m => <article key={m.id}><div><span className={`state-tag ${m.state}`}>{m.state}</span><span>Source day {m.day.toFixed(2)} · {m.priority}</span></div><p>{arrived(m) ? m.summary : 'Health content withheld until the packet arrives at Earth.'}</p><small>{badgeText(m, snapshot.day, snapshot.outbox.timings[m.id])}</small></article>)}</div></section>
      <section className="panel earth-advice"><h2>Reply to an arrived report</h2><p className="muted">Advice is advisory. Onboard care never waits for a reply.</p><form onSubmit={e => { e.preventDefault(); sendAdvice(); }}><label>Report<select aria-label="Reply to report" value={selectedSource} disabled={!received.length} onChange={e => setSourceId(e.target.value)}>{!received.length && <option value="">Awaiting an arrived report</option>}{received.map(m => <option key={m.id} value={m.id}>Day {m.day.toFixed(2)} · {m.summary.slice(0, 75)}</option>)}</select></label><label>Earth advice<textarea aria-label="Earth advice" maxLength={2000} rows={5} value={advice} onChange={e => setAdvice(e.target.value)} placeholder="Type a simulated mission-support reply…"/></label><button className="primary-button" disabled={!selectedSource || !advice.trim()} type="submit">Queue advice for ship <Icon name="arrow" size={16}/></button></form>{notice && <p className="fine-print" role="status">{notice}</p>}
        <h3>Earth dispatches</h3><div className="outbox-list">{!snapshot.inbox.messages.length && <p className="muted">No advice dispatched.</p>}{[...snapshot.inbox.messages].reverse().map(m => <article key={m.id}><div><span className={`state-tag ${m.state}`}>{m.state}</span></div><p>{m.summary}</p><small>{adviceBadge(m, snapshot)}</small></article>)}</div></section></div>
    </>}
    <footer className="earth-page-footer">Local browser demonstration · no real Earth link · check-ins remain private to the device</footer>
  </main>;
}
