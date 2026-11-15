import { ArrowCounterClockwise, ArrowRight, Bell, Brain, CaretDown, CaretRight, ChartLineUp, Check, Drop, FirstAidKit, GlobeHemisphereWest, Heartbeat, Lightning, Link, Moon, Pause, Planet, Play, ShieldCheck, SlidersHorizontal, Sun, ThermometerSimple, Watch, X } from '@phosphor-icons/react';

const icons = {
  core: Heartbeat, mind: Brain, stone: Drop, storm: Lightning, ship: Planet,
  doctor: FirstAidKit, earth: GlobeHemisphereWest, watch: Watch, arrow: ArrowRight,
  chevron: CaretRight, down: CaretDown, close: X, check: Check, play: Play,
  pause: Pause, reset: ArrowCounterClockwise, settings: SlidersHorizontal,
  shield: ShieldCheck, link: Link, sun: Sun, moon: Moon, bell: Bell, chart: ChartLineUp, temperature: ThermometerSimple,
};

export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const Glyph = icons[name as keyof typeof icons] ?? Heartbeat;
  return <Glyph size={size} weight="regular" aria-hidden="true"/>;
}
