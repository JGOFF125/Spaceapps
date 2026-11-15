/**
 * Story overlays for the clean mission from simulate.ts.
 * Same seed, same output, every run — until someone starts a treatment.
 *
 * Story A — Maya, days 60–66, the hero. Across days 60–63 her HRV falls 25%,
 * resting heart rate rises 8 bpm, temperature rises 0.6 °C, and sleep falls
 * 1.5 h. The same daily slide keeps going for two more days (64 and 65).
 * With no treatment she then walks back to her own centre over 10 days
 * (66–75). applyTreatment('maya', day) sends her back to that centre in 3 days
 * and skips the worsen.
 *
 * Story B — Sam, days 95–110. Sleep slides into a 5.8–6.3 h band, HRV sags
 * 15%, activity drops 30%. Protected sleep restores him over 5 days.
 * With no treatment the debt stays after day 110.
 *
 * Story C — Leo, days 90–130. Water falls to about 1.4 L by day 100 and
 * stoneRisk climbs from 0.3 to 0.85. A hydration plan brings the risk down
 * over 7 days. With no treatment the risk stays high after day 130.
 *
 * Ship — days 130–132. Cabin CO2 is 2,800 ppm for the whole crew. Everyone's
 * HRV dips 10% and sleep falls 0.8 h on those nights. It clears when CO2
 * clears. There is no treatment.
 *
 * buildMissionData() always returns that untreated mission and forgets any
 * treatments already started. applyTreatment(astronautId, day) remembers the
 * first day each astronaut starts their action, then returns the full mission
 * with that recovery applied. Ana has no personal story.
 */
import type { Reading } from '../types.ts'
import {
  CREW,
  HEALTHY_CENTRES,
  MISSION_DAYS,
  generateMission,
  stoneRiskFromWater,
  type HealthyCentre,
} from './simulate.ts'

const MAYA_START = 60
const MAYA_NADIR = 65
const MAYA_RECOVERED = 75
const MAYA_TREATMENT_DAYS = 3

const SAM_START = 95
const SAM_FULL = 100
const SAM_TREATMENT_DAYS = 5
const SAM_SLEEP_BAND = [5.8, 6.0, 6.15, 6.3, 5.95, 6.25]

const LEO_START = 90
const LEO_WATER_LOW_BY = 100
const LEO_END = 130
const LEO_TREATMENT_DAYS = 7
const LEO_WATER_TARGET = 1.4
const LEO_STONE_START = 0.3
const LEO_STONE_END = 0.85

const SHIP_START = 130
const SHIP_END = 132
const SHIP_CO2 = 2800

const treatments = new Map<string, number>()

interface VitalDrift {
  heartRate: number
  hrv: number
  temperature: number
  sleepHours: number
}

interface LoadDrift {
  sleepHours: number
  hrv: number
  activity: number
}

interface StoneDrift {
  waterIntake: number
  stoneRisk: number
}

function roundTo(value: number, places: number): number {
  const factor = 10 ** places
  return Math.round(value * factor) / factor
}

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t
}

function readingKey(astronautId: string, day: number): string {
  return `${astronautId}:${day}`
}

function must(index: Map<string, Reading>, astronautId: string, day: number): Reading {
  const reading = index.get(readingKey(astronautId, day))
  if (!reading) throw new Error(`No reading for ${astronautId} on day ${day}`)
  return reading
}

function centreFor(astronautId: string): HealthyCentre {
  const centre = HEALTHY_CENTRES[astronautId]
  if (!centre) throw new Error(`No healthy centre for ${astronautId}`)
  return centre
}

/** 0 before day 60, 1 on day 63, 1.5 on day 65, then back to 0 on day 75. */
function mayaUntreatedProgress(day: number): number {
  if (day < MAYA_START || day > MAYA_RECOVERED) return 0
  if (day <= MAYA_NADIR) return (day - (MAYA_START - 1)) / 4
  const recovered = (day - MAYA_NADIR) / (MAYA_RECOVERED - MAYA_NADIR)
  return 1.5 * (1 - recovered)
}

function mayaDrift(clean: Reading, progress: number): VitalDrift {
  return {
    heartRate: clean.heartRate + 8 * progress,
    hrv: clean.hrv * (1 - 0.25 * progress),
    temperature: clean.temperature + 0.6 * progress,
    sleepHours: Math.max(3, clean.sleepHours - 1.5 * progress),
  }
}

function applyMaya(next: Reading, clean: Reading, index: Map<string, Reading>, treatDay: number | undefined): void {
  const centre = centreFor('maya')
  if (treatDay !== undefined && treatDay >= MAYA_START && next.day > treatDay) {
    const origin = mayaDrift(must(index, 'maya', treatDay), mayaUntreatedProgress(treatDay))
    const t = Math.min(1, (next.day - treatDay) / MAYA_TREATMENT_DAYS)
    next.heartRate = roundTo(lerp(origin.heartRate, centre.heartRate, t), 1)
    next.hrv = roundTo(lerp(origin.hrv, centre.hrv, t), 1)
    next.temperature = roundTo(lerp(origin.temperature, centre.temperature, t), 2)
    next.sleepHours = roundTo(lerp(origin.sleepHours, centre.sleepHours, t), 2)
    return
  }

  const progress = mayaUntreatedProgress(next.day)
  if (progress === 0) return
  const drifted = mayaDrift(clean, progress)
  next.heartRate = roundTo(drifted.heartRate, 1)
  next.hrv = roundTo(drifted.hrv, 1)
  next.temperature = roundTo(drifted.temperature, 2)
  next.sleepHours = roundTo(drifted.sleepHours, 2)
}

function samBlend(day: number): number {
  if (day < SAM_START) return 0
  if (day < SAM_FULL) return (day - (SAM_START - 1)) / (SAM_FULL - (SAM_START - 1))
  return 1
}

function samSleepTarget(day: number): number {
  return SAM_SLEEP_BAND[day % SAM_SLEEP_BAND.length]
}

function samDrift(clean: Reading, day: number): LoadDrift {
  const blend = samBlend(day)
  return {
    sleepHours: lerp(clean.sleepHours, samSleepTarget(day), blend),
    hrv: clean.hrv * (1 - 0.15 * blend),
    activity: clean.activity * (1 - 0.3 * blend),
  }
}

function applySam(next: Reading, clean: Reading, index: Map<string, Reading>, treatDay: number | undefined): void {
  const centre = centreFor('sam')
  if (treatDay !== undefined && treatDay >= SAM_START && next.day > treatDay) {
    const origin = samDrift(must(index, 'sam', treatDay), treatDay)
    const t = Math.min(1, (next.day - treatDay) / SAM_TREATMENT_DAYS)
    next.sleepHours = roundTo(lerp(origin.sleepHours, centre.sleepHours, t), 2)
    next.hrv = roundTo(lerp(origin.hrv, centre.hrv, t), 1)
    next.activity = roundTo(lerp(origin.activity, centre.activity, t), 0)
    return
  }

  if (samBlend(next.day) === 0) return
  const drifted = samDrift(clean, next.day)
  next.sleepHours = roundTo(drifted.sleepHours, 2)
  next.hrv = roundTo(drifted.hrv, 1)
  next.activity = roundTo(drifted.activity, 0)
}

function leoShape(day: number, waterAtStart: number): StoneDrift {
  const clamped = Math.min(Math.max(day, LEO_START), LEO_END)
  const stoneT = (clamped - LEO_START) / (LEO_END - LEO_START)
  const waterT = Math.min(1, (clamped - LEO_START) / (LEO_WATER_LOW_BY - LEO_START))
  return {
    stoneRisk: LEO_STONE_START + (LEO_STONE_END - LEO_STONE_START) * stoneT,
    waterIntake: waterAtStart + (LEO_WATER_TARGET - waterAtStart) * waterT,
  }
}

function applyLeo(
  next: Reading,
  waterAtStart: number,
  treatDay: number | undefined,
): void {
  const centre = centreFor('leo')
  if (treatDay !== undefined && treatDay >= LEO_START && next.day > treatDay) {
    const origin = leoShape(treatDay, waterAtStart)
    const t = Math.min(1, (next.day - treatDay) / LEO_TREATMENT_DAYS)
    const healthyStone = stoneRiskFromWater(centre.waterIntake, next.day)
    next.waterIntake = roundTo(lerp(origin.waterIntake, centre.waterIntake, t), 2)
    next.stoneRisk = roundTo(lerp(origin.stoneRisk, healthyStone, t), 3)
    return
  }

  if (next.day < LEO_START) return
  const story = leoShape(next.day, waterAtStart)
  next.waterIntake = roundTo(story.waterIntake, 2)
  next.stoneRisk = roundTo(story.stoneRisk, 3)
}

function applyShip(next: Reading): void {
  if (next.day < SHIP_START || next.day > SHIP_END) return
  next.co2 = SHIP_CO2
  next.hrv = roundTo(next.hrv * 0.9, 1)
  next.sleepHours = roundTo(Math.max(3, next.sleepHours - 0.8), 2)
}

function compose(active: ReadonlyMap<string, number>): Reading[] {
  const clean = generateMission()
  const index = new Map(clean.map((reading) => [readingKey(reading.astronautId, reading.day), reading]))
  const waterAtStart = must(index, 'leo', LEO_START).waterIntake

  return clean.map((reading) => {
    const next: Reading = { ...reading }
    const treatDay = active.get(reading.astronautId)
    if (reading.astronautId === 'maya') applyMaya(next, reading, index, treatDay)
    if (reading.astronautId === 'sam') applySam(next, reading, index, treatDay)
    if (reading.astronautId === 'leo') applyLeo(next, waterAtStart, treatDay)
    applyShip(next)
    return next
  })
}

function assertStoryA(readings: Reading[]): void {
  const day30 = readings.find((reading) => reading.astronautId === 'maya' && reading.day === 30)
  const day63 = readings.find((reading) => reading.astronautId === 'maya' && reading.day === 63)
  if (!day30 || !day63) throw new Error('Story A check failed: missing Maya day 30 or day 63')
  const ok = day63.hrv <= day30.hrv * 0.8
  console.assert(
    ok,
    "Maya's day-63 HRV should be at least 20% below her day-30 HRV",
    day30.hrv,
    day63.hrv,
  )
  if (!ok) {
    throw new Error(`Story A check failed: day-63 HRV ${day63.hrv} vs day-30 HRV ${day30.hrv}`)
  }
}

/** Untreated demo mission. Calling this clears any treatments already started. */
export function buildMissionData(): Reading[] {
  treatments.clear()
  const readings = compose(treatments)
  assertStoryA(readings)
  return readings
}

/**
 * Start the prescribed action for one astronaut on this mission day.
 * The first call for that person wins. Maya recovers in 3 days, Sam in 5,
 * Leo's stone risk falls over 7 days. Returns the full 720-reading mission.
 */
export function applyTreatment(astronautId: string, day: number): Reading[] {
  if (!CREW.some((astronaut) => astronaut.id === astronautId)) {
    throw new Error(`Unknown astronaut "${astronautId}". Expected maya, leo, ana, or sam.`)
  }
  if (!Number.isFinite(day)) throw new Error(`Mission day must be a finite number, received ${day}`)
  const start = Math.min(MISSION_DAYS, Math.max(1, Math.round(day)))
  if (!treatments.has(astronautId)) treatments.set(astronautId, start)
  return compose(treatments)
}
