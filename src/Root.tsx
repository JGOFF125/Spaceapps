import { lazy, Suspense, useEffect, useState } from 'react';
import App from './App.tsx';
const EarthView = lazy(() => import('./ui/EarthView.tsx').then(m => ({ default: m.EarthView })));

export function Root() {
  const [earth, setEarth] = useState(() => location.hash === '#/earth');
  useEffect(() => { document.title = earth ? 'EARTH — BASELINE Mission Support' : 'BASELINE'; }, [earth]);
  useEffect(() => {
    const route = () => setEarth(location.hash === '#/earth');
    window.addEventListener('hashchange', route);
    return () => window.removeEventListener('hashchange', route);
  }, []);
  // Earth never mounts the ship's clock or writes its persisted mission.
  return earth ? <Suspense fallback={<p className="module-loading" role="status">Loading Earth inbox…</p>}><EarthView/></Suspense> : <App/>;
}
