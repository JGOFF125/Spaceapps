/**
 * BASELINE mission simulator.
 *
 * This file builds a clean 180-day mission for four astronauts. The illnesses
 * live in stories.ts, not here. Every run is identical: the wander is seeded.
 * There is no data file and no network call.
 *
 * Where the numbers come from
 * - Bone: NASA's Human Research Program reports 1–1.5% bone-density loss per
 *   month in weight-bearing bone. Calcium leaves the bone, so stoneRisk creeps
 *   up even when someone drinks steadily. A real stone-risk climb is a story
 *   in stories.ts; this file only has the slow background creep.
 * - Sleep: ISS crews average 6.09 hours against 8.5 hours scheduled. The
 *   healthy centres sit between those two, nearer a protected night (Maya is
 *   7.8 h), so a slide toward the ISS average is easy to see.
 * - Radiation: about 1 mSv per day, cumulative. The career limit this demo
 *   uses is 600 mSv. A 180-day cruise lands near 180 mSv, still under that line.
 * - Cabin CO2 holds near 1,200 ppm, under the 2,000 ppm line the brain treats
 *   as a ship warning. The spike past that line is the ship story.
 * - Heart rate, HRV, and temperature are each astronaut's own healthy centre.
 *   BASELINE compares a person to themselves, not to an Earth average.
 *
 * Days 1–14 stay close to those centres on purpose. The brain learns each
 * baseline from them.
 */
import type { Astronaut, Reading } from '../types.ts'

export const MISSION_DAYS = 180

/** 180 mission days play in about 5 minutes, so one day is about 1.7 seconds. */
export const REAL_MS_PER_MISSION_DAY = (5 * 60 * 1000) / MISSION_DAYS

export interface HealthyCentre {
  heartRate: number
  hrv: number
  temperature: number
  sleepHours: number
  activity: number
  waterIntake: number
}

export const CREW: readonly Astronaut[] = [
  { id: 'maya', name: 'Maya', role: 'Commander', color: '#38e1ff' },
  { id: 'leo', name: 'Leo', role: 'Engineer', color: '#8eb6ff' },
  { id: 'ana', name: 'Ana', role: 'Medic', color: '#d792ff' },
  { id: 'sam', name: 'Sam', role: 'Scientist', color: '#ff9b54' },
]

export const HEALTHY_CENTRES: Record<string, HealthyCentre> = {
  maya: { heartRate: 58, hrv: 65, temperature: 36.6, sleepHours: 7.8, activity: 95, waterIntake: 2.4 },
  leo: { heartRate: 63, hrv: 55, temperature: 36.5, sleepHours: 7.1, activity: 118, waterIntake: 2.7 },
  ana: { heartRate: 66, hrv: 72, temperature: 36.7, sleepHours: 7.6, activity: 84, waterIntake: 2.3 },
  sam: { heartRate: 61, hrv: 60, temperature: 36.55, sleepHours: 7.4, activity: 76, waterIntake: 2.5 },
}

const WANDER: Record<keyof HealthyCentre, number> = {
  heartRate: 1.4,
  hrv: 1.1,
  temperature: 0.05,
  sleepHours: 0.16,
  activity: 6,
  waterIntake: 0.1,
}

const FIELD_SALT: Record<keyof HealthyCentre, number> = {
  heartRate: 10,
  hrv: 20,
  temperature: 30,
  sleepHours: 40,
  activity: 50,
  waterIntake: 60,
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function roundTo(value: number, places: number): number {
  const factor = 10 ** places
  return Math.round(value * factor) / factor
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function personSalt(astronautId: string): number {
  if (astronautId === 'maya') return 1
  if (astronautId === 'leo') return 2
  if (astronautId === 'ana') return 3
  if (astronautId === 'sam') return 4
  throw new Error(`Unknown astronaut "${astronautId}". Expected maya, leo, ana, or sam.`)
}

function walkSeries(seed: number, amplitude: number): number[] {
  const random = mulberry32(seed)
  let value = 0
  const series: number[] = []
  for (let day = 1; day <= MISSION_DAYS; day++) {
    const learning = day <= 14
    const amp = learning ? amplitude * 0.35 : amplitude
    const revert = learning ? 0.7 : 0.22
    value = value * (1 - revert) + (random() - 0.5) * 2 * amp
    series.push(value)
  }
  return series
}

function centreFor(astronautId: string): HealthyCentre {
  const centre = HEALTHY_CENTRES[astronautId]
  if (!centre) throw new Error(`No healthy centre for ${astronautId}`)
  return centre
}

/**
 * Lower water raises stone risk. A slow creep sits on top, standing in for
 * calcium leaving bone over the cruise. The result stays on 0..1.
 */
export function stoneRiskFromWater(waterLitres: number, day: number): number {
  const dry = clamp((3 - waterLitres) / 3, 0, 1)
  const creep = (day / MISSION_DAYS) * 0.15
  return clamp(dry * 0.55 + creep, 0, 1)
}

interface Cabin {
  dose: number[]
  co2: number[]
}

function cabin(): Cabin {
  const random = mulberry32(20261114)
  let total = 0
  const dose: number[] = []
  const co2: number[] = []
  for (let day = 1; day <= MISSION_DAYS; day++) {
    total += 1 + (random() - 0.5) * 0.12
    dose.push(roundTo(total, 2))
    const wave =
      Math.sin((day / MISSION_DAYS) * Math.PI * 4) * 70 +
      Math.sin((day / MISSION_DAYS) * Math.PI * 11) * 25
    co2.push(Math.round(1200 + wave))
  }
  return { dose, co2 }
}

function wanderFor(astronautId: string): Record<keyof HealthyCentre, number[]> {
  const salt = personSalt(astronautId) * 100
  const fields = Object.keys(WANDER) as (keyof HealthyCentre)[]
  const series = {} as Record<keyof HealthyCentre, number[]>
  for (const field of fields) {
    series[field] = walkSeries(20261114 + salt + FIELD_SALT[field], WANDER[field])
  }
  return series
}

/**
 * One reading per astronaut per mission day: 180 × 4 = 720.
 * Order is day 1..180, and within a day Maya, Leo, Ana, Sam.
 * No story overlays — call buildMissionData() for the demo mission.
 */
export function generateMission(): Reading[] {
  const environment = cabin()
  const wander = new Map(CREW.map((astronaut) => [astronaut.id, wanderFor(astronaut.id)]))
  const readings: Reading[] = []

  for (let day = 1; day <= MISSION_DAYS; day++) {
    for (const astronaut of CREW) {
      const centre = centreFor(astronaut.id)
      const walk = wander.get(astronaut.id)
      if (!walk) throw new Error(`Missing wander for ${astronaut.id}`)
      const index = day - 1
      const water = roundTo(Math.max(0.2, centre.waterIntake + walk.waterIntake[index]), 2)
      readings.push({
        day,
        astronautId: astronaut.id,
        heartRate: roundTo(centre.heartRate + walk.heartRate[index], 1),
        hrv: roundTo(centre.hrv + walk.hrv[index], 1),
        temperature: roundTo(centre.temperature + walk.temperature[index], 2),
        sleepHours: roundTo(Math.max(0, centre.sleepHours + walk.sleepHours[index]), 2),
        activity: Math.round(Math.max(0, centre.activity + walk.activity[index])),
        waterIntake: water,
        stoneRisk: roundTo(stoneRiskFromWater(water, day), 3),
        radiationDose: environment.dose[index],
        co2: environment.co2[index],
      })
    }
  }

  return readings
}

function readingKey(astronautId: string, day: number): string {
  return `${astronautId}:${day}`
}

function indexReadings(readings: Reading[]): Map<string, Reading> {
  const index = new Map<string, Reading>()
  for (const reading of readings) index.set(readingKey(reading.astronautId, reading.day), reading)
  return index
}

function must(index: Map<string, Reading>, astronautId: string, day: number): Reading {
  const reading = index.get(readingKey(astronautId, day))
  if (!reading) throw new Error(`No reading for ${astronautId} on day ${day}`)
  return reading
}

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t
}

function lerpReading(left: Reading, right: Reading, t: number, day: number): Reading {
  if (t === 0) return { ...left, day }
  return {
    day,
    astronautId: left.astronautId,
    heartRate: lerp(left.heartRate, right.heartRate, t),
    hrv: lerp(left.hrv, right.hrv, t),
    temperature: lerp(left.temperature, right.temperature, t),
    sleepHours: lerp(left.sleepHours, right.sleepHours, t),
    activity: lerp(left.activity, right.activity, t),
    waterIntake: lerp(left.waterIntake, right.waterIntake, t),
    stoneRisk: lerp(left.stoneRisk, right.stoneRisk, t),
    radiationDose: lerp(left.radiationDose, right.radiationDose, t),
    co2: lerp(left.co2, right.co2, t),
  }
}

/**
 * Crew snapshot at a fractional mission day.
 * Day 63.4 is 40% of the way from the day-63 reading to the day-64 reading.
 * This does not move the clock — the UI passes the day it has already advanced.
 */
export function tick(readings: Reading[], day: number): Reading[] {
  if (!Number.isFinite(day)) throw new Error(`Mission day must be a finite number, received ${day}`)
  const clamped = Math.min(MISSION_DAYS, Math.max(1, day))
  const lo = Math.floor(clamped)
  const fraction = clamped - lo
  const hi = fraction === 0 ? lo : Math.min(MISSION_DAYS, lo + 1)
  const index = indexReadings(readings)
  return CREW.map((astronaut) =>
    lerpReading(must(index, astronaut.id, lo), must(index, astronaut.id, hi), fraction, clamped),
  )
}
