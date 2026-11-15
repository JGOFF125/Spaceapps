import type { Alert, Astronaut } from '../types.ts';
import { healthStatus, statusLabel } from './status.ts';
export function CrewCard({ astronaut, alerts, selected, onSelect, learning }: {
  astronaut: Astronaut; alerts: Alert[]; selected: boolean; onSelect: () => void; learning: boolean;
}) {
  const status = healthStatus(alerts, learning);
  return <button className={`crew-card ${selected ? 'is-selected' : ''}`} onClick={onSelect}
    aria-pressed={selected} aria-label={`Select ${astronaut.name}, ${statusLabel[status]}`}>
    <span className="avatar">{astronaut.name.slice(0, 1)}<span className={`status-dot ${status}`}/></span>
    <span className="crew-name"><strong>{astronaut.name}</strong><span>{astronaut.role}</span></span>
    {selected && <span className="crew-selected" aria-hidden="true"/>}
  </button>;
}
