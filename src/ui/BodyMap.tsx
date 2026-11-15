import { useState } from 'react';
import type { DashboardModel } from './model.ts';
import { REGIONS, regionInfo } from './regions.ts';
import type { Region } from './regions.ts';
import { statusLabel } from './status.ts';

export function BodyMap({ model, selected, onSelect }: {
  model: DashboardModel; selected: Region; onSelect: (region: Region) => void;
}) {
  const [unavailable, setUnavailable] = useState(false);
  const regions = regionInfo(model);
  return <section className="anatomy-view" aria-label="Interactive human body health map">
    <header className="anatomy-header"><h3>Body overview</h3><span>Select a point to explore</span></header>
    <div className="anatomy-stage">
      <div className="anatomy-model">
        {!unavailable ? <img src="/images/anatomy-v2.png" width="1024" height="1536" decoding="async" fetchPriority="high"
          alt="Illustrative front-view anatomical model showing muscles, skeleton and organs"
          onError={() => setUnavailable(true)}/> : <div className="asset-error">Illustration unavailable. Use the region buttons below to inspect your signals.</div>}
        {REGIONS.map(item => <button key={item.id} type="button"
          className={`anatomy-hotspot ${regions[item.id].status} ${selected === item.id ? 'is-active' : ''}`}
          style={{ left: `${item.x}%`, top: `${item.y}%` }}
          aria-label={`Inspect ${item.label}`} aria-pressed={selected === item.id}
          onClick={() => onSelect(item.id)}>
          <span className="hotspot-dot"/><span className={`hotspot-tooltip ${item.id === 'head' ? 'tooltip-below' : ''}`}><strong>{item.label}</strong><span>{regions[item.id].value} {regions[item.id].unit} · {statusLabel[regions[item.id].status]}</span></span>
        </button>)}
      </div>
    </div>
    <div className="region-options" aria-label="Body regions">{REGIONS.map(item => <button key={item.id}
      aria-pressed={selected === item.id} onClick={() => onSelect(item.id)}>{item.short}</button>)}</div>
    <p className="anatomy-caption">Illustrative anatomy · simulated health signals</p>
  </section>;
}
