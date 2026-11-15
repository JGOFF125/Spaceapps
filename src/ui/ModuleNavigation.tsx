import type { ModuleId } from './model.ts';
import { MODULES } from './model.ts';
import { Icon } from './Icon.tsx';

export function ModuleTabs({ active, onChange }: { active: ModuleId; onChange: (id: ModuleId) => void }) {
  return <nav className="module-tabs" aria-label="Health modules">{MODULES.map(module =>
    <button key={module.id} aria-current={active === module.id ? 'page' : undefined}
      onClick={() => onChange(module.id)}><Icon name={module.id}/><span>{module.name}</span></button>,
  )}</nav>;
}
