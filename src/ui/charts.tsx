import { Area, AreaChart, Bar, BarChart, CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Reading } from '../types.ts';
const tooltipStyle = { backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 12 };
export function Sparkline({ values, color = 'var(--chart-line)' }: { values: number[]; color?: string }) {
  if (values.length < 2) return <div className="spark-empty"/>;
  const lo = Math.min(...values) - 0.1, hi = Math.max(...values) + 0.1;
  return <svg className="sparkline" viewBox="0 0 120 32" aria-hidden="true"><polyline points={values.map((v, i) => `${i * 120 / (values.length - 1)},${29 - (v - lo) / (hi - lo) * 26}`).join(' ')} stroke={color} strokeWidth="1.6" fill="none"/></svg>;
}
export function TrendChart({ rows, signal, color = 'var(--chart-line)', normal, day, height = 190, label }: {
  rows: Reading[]; signal: keyof Pick<Reading, 'hrv' | 'heartRate' | 'temperature' | 'waterIntake' | 'stoneRisk'>;
  color?: string; normal?: { mean: number; stdDev: number }; day: number; height?: number; label: string;
}) {
  return <div role="img" aria-label={label} style={{ width: '100%', height, minWidth: 0 }}><ResponsiveContainer width="100%" height="100%"><ComposedChart data={rows} margin={{ top: 10, right: 12, left: -22, bottom: 0 }}>
    <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="2 5" vertical={false}/><XAxis dataKey="day" type="number" domain={[1, 180]} ticks={[1, 30, 60, 90, 120, 150, 180]} tick={{ fill: 'var(--muted)', fontSize: 10 }} axisLine={false} tickLine={false}/>
    <YAxis domain={['auto', 'auto']} tick={{ fill: 'var(--muted)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => Number(v).toFixed(signal === 'temperature' ? 1 : 0)}/>
    <Tooltip contentStyle={tooltipStyle} labelFormatter={v => `Mission day ${v}`} formatter={v => [Number(v).toFixed(signal === 'temperature' || signal === 'waterIntake' ? 2 : 1), label]}/>
    {normal && <ReferenceArea y1={normal.mean - Math.max(normal.stdDev, 0.01)} y2={normal.mean + Math.max(normal.stdDev, 0.01)} fill="var(--chart-normal)" fillOpacity={0.13} ifOverflow="extendDomain"/>}{normal && <ReferenceLine y={normal.mean} stroke="var(--chart-normal)" strokeDasharray="3 5"/>}<ReferenceLine x={Math.floor(day)} stroke="var(--faint)" strokeDasharray="3 4"/>
    <Line type="monotone" dataKey={signal} stroke={color} dot={false} strokeWidth={2} isAnimationActive={false}/>
  </ComposedChart></ResponsiveContainer></div>;
}
export function SleepChart({ rows }: { rows: Reading[] }) {
  return <div className="chart-tall" role="img" aria-label="Sleep hours over the last 21 nights with an 8-hour target"><ResponsiveContainer width="100%" height="100%"><BarChart data={rows} margin={{ left: -20, right: 16, top: 20 }}>
    <CartesianGrid stroke="var(--chart-grid)" vertical={false}/><XAxis dataKey="day" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false}/><YAxis domain={[0, 10]} tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false}/><Tooltip contentStyle={tooltipStyle} labelFormatter={v => `Night ${v}`} formatter={v => [`${Number(v).toFixed(1)} h`, 'Sleep']}/><ReferenceLine y={8} stroke="var(--chart-secondary)" strokeDasharray="4 5" label={{ value: '8 h target', fill: 'var(--chart-secondary)', fontSize: 11, position: 'insideTopRight' }}/><Bar dataKey="sleepHours" fill="var(--chart-line)" radius={[3, 3, 0, 0]} isAnimationActive={false}/>
  </BarChart></ResponsiveContainer></div>;
}
export function ShipChart({ rows }: { rows: { day: number; co2: number; hrv: number }[] }) {
  return <div className="chart-tall" role="img" aria-label="Cabin CO2 and crew-average HRV over the mission"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={rows} margin={{ left: -8, right: 0, top: 20 }}>
    <CartesianGrid stroke="var(--chart-grid)" vertical={false}/><XAxis dataKey="day" type="number" domain={[1, 180]} tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false}/><YAxis yAxisId="air" domain={[0, 3200]} tick={{ fill: 'var(--chart-secondary)', fontSize: 11 }} axisLine={false} tickLine={false}/><YAxis yAxisId="hrv" orientation="right" domain={[30, 85]} tick={{ fill: 'var(--chart-line)', fontSize: 11 }} axisLine={false} tickLine={false}/><Tooltip contentStyle={tooltipStyle} labelFormatter={v => `Day ${v}`} formatter={(v, name) => [Number(v).toFixed(0), name === 'co2' ? 'CO₂ · ppm' : 'Crew HRV · ms']}/><ReferenceLine yAxisId="air" y={2000} stroke="var(--chart-secondary)" strokeDasharray="4 4"/><Area yAxisId="air" dataKey="co2" fill="color-mix(in srgb, var(--chart-secondary) 12%, transparent)" stroke="var(--chart-secondary)" isAnimationActive={false}/><Line yAxisId="hrv" dataKey="hrv" stroke="var(--chart-line)" dot={false} strokeWidth={2} isAnimationActive={false}/>
  </ComposedChart></ResponsiveContainer></div>;
}
export function DoseChart({ rows }: { rows: Reading[] }) {
  return <div className="chart-tall" role="img" aria-label="Cumulative simulated mission radiation dose"><ResponsiveContainer width="100%" height="100%"><AreaChart data={rows} margin={{ left: -16, top: 10, right: 12 }}>
    <CartesianGrid stroke="var(--chart-grid)" vertical={false}/><XAxis dataKey="day" type="number" domain={[1, 180]} tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false}/><YAxis tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false}/><Tooltip contentStyle={tooltipStyle} formatter={v => [`${Number(v).toFixed(1)} mSv`, 'Mission dose']}/><Area type="monotone" dataKey="radiationDose" stroke="var(--chart-dose)" fill="color-mix(in srgb, var(--chart-dose) 12%, transparent)" strokeWidth={2} isAnimationActive={false}/>
  </AreaChart></ResponsiveContainer></div>;
}
