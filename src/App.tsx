import { useState } from 'react'

export default function App() {
  const [playing, setPlaying] = useState(false)

  return (
    <div className="flex h-screen flex-col bg-cockpit font-sans text-ink">
      <header className="flex items-center justify-between gap-6 border-b border-line px-6 py-4">
        <h1 className="text-xl font-semibold tracking-[0.28em] text-accent">BASELINE</h1>
        <div className="flex items-center gap-3">
          <p className="text-3xl font-semibold tabular-nums">
            Day 1 <span className="text-base font-normal text-ink/70">/ 180</span>
          </p>
          <button
            type="button"
            aria-pressed={playing}
            onClick={() => setPlaying(true)}
            className={`border px-4 py-2 ${playing ? 'border-accent text-accent' : 'border-line bg-panel'}`}
          >
            Play
          </button>
          <button
            type="button"
            aria-pressed={!playing}
            onClick={() => setPlaying(false)}
            className={`border px-4 py-2 ${playing ? 'border-line bg-panel' : 'border-accent text-accent'}`}
          >
            Pause
          </button>
        </div>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)_320px]">
        <aside className="border-r border-line bg-panel p-4">
          <h2 className="text-sm tracking-wide text-accent">Crew</h2>
        </aside>
        <main className="p-4">
          <h2 className="text-sm tracking-wide text-accent">Modules</h2>
        </main>
        <aside className="border-l border-line bg-panel p-4">
          <h2 className="text-sm tracking-wide text-accent">Alerts</h2>
        </aside>
      </div>
    </div>
  )
}
