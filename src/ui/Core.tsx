import { useState } from 'react';
import { BodyMap } from './BodyMap.tsx';
import { Icon } from './Icon.tsx';
import { TrendChart } from './charts.tsx';
import type { DashboardModel } from './model.ts';
import { regionInfo } from './regions.ts';
import type { Region } from './regions.ts';
import { driftStatus, severityRank, statusLabel } from './status.ts';
import { SIGNAL_RULES } from '../brain/drift.ts';

export function Core({ model }: { model: DashboardModel }) {
  const [region, setRegion] = useState<Region>('chest');
  const [trendsOpen, setTrendsOpen] = useState(false);
  const [signal, setSignal] = useState<'heartRate' | 'hrv' | 'temperature'>('hrv');
  const { session, reading: r, baseline: b, astronaut, drift } = model;
  const rows = session.readings.filter(row => row.astronautId === astronaut.id && row.day <= Math.floor(session.day));
  const info = regionInfo(model)[region];
  const active = model.alerts.filter(a => a.status !== 'recovered');
  const recovered = model.alerts.filter(a => a.status === 'recovered');
  const top = [...active].sort((a, other) => severityRank[other.level] - severityRank[a.level])[0];
  const metrics = [
    { key: 'heartRate' as const, title: 'Heart rate', value: r.heartRate.toFixed(0), unit: 'bpm', normal: b?.heartRate.mean.toFixed(0), icon: 'core' },
    { key: 'hrv' as const, title: 'Heart rate variability', value: r.hrv.toFixed(0), unit: 'ms', normal: b?.hrv.mean.toFixed(0), icon: 'chart' },
    { key: 'temperature' as const, title: 'Temperature', value: r.temperature.toFixed(1), unit: '°C', normal: b?.temperature.mean.toFixed(1), icon: 'temperature' },
    { key: 'sleepHours' as const, title: 'Sleep', value: r.sleepHours.toFixed(1), unit: 'h', normal: b?.sleepHours.mean.toFixed(1), icon: 'moon' },
  ];
  const currentDriftStatus = driftStatus(drift.score, drift.ready);
  return <>
    <div className="health-overview-grid">
      <section className="vitals-column" aria-label="Key readings"><h3 className="column-heading">Today’s vitals</h3>
        {metrics.map(m => <article className="vital-card" key={m.key}>
          <div className="vital-heading"><Icon name={m.icon} size={18}/><span>{m.title}</span></div>
          <div className="vital-value">{m.value}<span>{m.unit}</span></div>
          <div className="vital-reference">{m.normal ? `Personal normal ${m.normal} ${m.unit}` : 'Learning your normal'}</div>
        </article>)}
      </section>
      <BodyMap model={model} selected={region} onSelect={setRegion}/>
      <aside className="insights-column" aria-label="Selected signals and care">
        <section className="insight-card drift-summary"><div className="insight-title"><h3>Personal drift</h3><Icon name="chart" size={18}/></div>
          <div className="drift-summary-value">{drift.ready ? Math.round(drift.score * 100) : '—'}<span>/100</span><span className={`status-text ${currentDriftStatus}`}>{currentDriftStatus === 'nominal' ? 'Stable' : statusLabel[currentDriftStatus]}</span></div>
          <p>Compared with your 14-day normal.</p>
        </section>
        <section className="insight-card region-card" aria-live="polite">
          <span className="section-label">Selected region</span><h3>{info.title}</h3>
          <span className={`region-status ${info.status}`}><span className={`status-dot ${info.status}`}/>{statusLabel[info.status]}</span>
          <div className="region-reading">{info.value}<span>{info.unit}</span></div><p>{info.supporting}</p>
          <details className="quiet-details"><summary>About this signal <Icon name="down" size={14}/></summary><p>{info.note}</p></details>
        </section>
        <section className={`insight-card care-summary ${top ? 'needs-review' : ''}`}>
          <div className="insight-title"><h3>Care summary</h3><Icon name={top ? 'bell' : 'shield'} size={18}/></div>
          {top ? <><span className={`status-text ${top.level}`}>{active.length} {active.length === 1 ? 'active alert' : 'active alerts'}</span><h4>{top.title.replace(/ — /g, ' · ')}</h4><p>{top.status === 'acting' ? 'Action underway. Your trend recheck is in progress.' : 'Review the signals and the suggested next step.'}</p></> : <><h4>{recovered.length ? 'Recovery recorded' : 'No open alerts'}</h4><p>{recovered.length ? 'Your action loop has closed. The record is available in care history.' : 'Onboard monitoring continues in the background.'}</p></>}
          <button className="text-button" onClick={model.onReviewAlerts}>{top ? 'Review care' : 'View care history'}<Icon name="arrow" size={16}/></button>
        </section>
      </aside>
    </div>
    <section className={`trend-disclosure ${trendsOpen ? 'is-open' : ''}`}>
      <button className="trend-disclosure-toggle" aria-expanded={trendsOpen} aria-controls="personal-trends" onClick={() => setTrendsOpen(value => !value)}><span><Icon name="chart" size={19}/>Trends & personal baseline</span><span>{trendsOpen ? 'Hide details' : 'Explore details'}<Icon name="down" size={16}/></span></button>
      {trendsOpen && <div id="personal-trends" className="expanded-trends"><div className="trend-picker" aria-label="Signal trend">{metrics.slice(0, 3).map(m => <button key={m.key} aria-pressed={signal === m.key} onClick={() => setSignal(m.key as typeof signal)}>{m.title}</button>)}</div>
        <TrendChart rows={rows} signal={signal} normal={b?.[signal]} day={session.day} label={metrics.find(m => m.key === signal)!.title} height={240}/>
        <div className="trend-explanation"><p>{b ? 'The shaded band is your normal range from days 1–14. The vertical line marks today.' : `Learning your normal: ${Math.min(14, Math.floor(session.day))} of 14 days observed.`}</p><p>Drift uses the last 3 days of HRV, temperature, heart rate, sleep and activity. It is a rule-based signal, not a diagnosis.</p></div>
        {drift.signals.some(s => s.unhealthyZ >= 0.5) && <div className="drift-breakdown">{drift.signals.filter(s => s.unhealthyZ >= 0.5).map(s => <span key={s.signal}>{SIGNAL_RULES[s.signal].label}<b>{s.zScore > 0 ? '+' : ''}{s.zScore.toFixed(1)} z</b></span>)}</div>}
      </div>}
    </section>
    <p className="fine-print core-data-note">Simulated demo data · NASA/CSA research context; demonstration thresholds follow the team’s plan.</p>
  </>;
}
