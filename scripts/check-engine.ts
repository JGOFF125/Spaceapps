import { CREW, HEALTHY_CENTRES, generateMission, tick } from '../src/engine/simulate.ts'
import { applyTreatment, buildMissionData } from '../src/engine/stories.ts'
import type { Reading } from '../src/types.ts'

function must(readings: Reading[], astronautId: string, day: number): Reading {
  const reading = readings.find((item) => item.astronautId === astronautId && item.day === day)
  if (!reading) throw new Error(`Missing ${astronautId} day ${day}`)
  return reading
}

function sd(values: number[]): number {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

function fail(message: string): never {
  throw new Error(message)
}

const clean = generateMission()
if (clean.length !== 720) fail(`expected 720 clean readings, got ${clean.length}`)
if (JSON.stringify(generateMission()) !== JSON.stringify(clean)) fail('generateMission is not deterministic')

const mission = buildMissionData()
if (mission.length !== 720) fail(`expected 720 story readings, got ${mission.length}`)
if (JSON.stringify(buildMissionData()) !== JSON.stringify(mission)) fail('buildMissionData is not deterministic')

for (const reading of mission) {
  if (reading.day > 14) continue
  const original = must(clean, reading.astronautId, reading.day)
  if (JSON.stringify(reading) !== JSON.stringify(original)) {
    fail(`day ${reading.day} ${reading.astronautId} left the learning window`)
  }
}

const maya30 = must(mission, 'maya', 30)
const maya63 = must(mission, 'maya', 63)
const maya65 = must(mission, 'maya', 65)
const maya75 = must(mission, 'maya', 75)
if (maya63.hrv > maya30.hrv * 0.8) fail(`HRV drop too small: ${maya63.hrv} vs ${maya30.hrv}`)
if (maya65.hrv >= maya63.hrv) fail('Maya did not worsen after day 63')
if (Math.abs(maya75.hrv - HEALTHY_CENTRES.maya.hrv) > 3) fail(`Maya did not self-recover: ${maya75.hrv}`)
if (maya63.heartRate < maya30.heartRate + 6) fail(`heart rate rise too small: ${maya63.heartRate}`)
if (maya63.temperature < maya30.temperature + 0.45) fail(`temperature rise too small: ${maya63.temperature}`)
if (maya63.sleepHours > maya30.sleepHours - 1.2) fail(`sleep drop too small: ${maya63.sleepHours}`)

const sam105 = must(mission, 'sam', 105)
if (sam105.sleepHours < 5.8 || sam105.sleepHours > 6.3) fail(`Sam sleep out of band: ${sam105.sleepHours}`)
const samClean = must(clean, 'sam', 105)
if (sam105.hrv > samClean.hrv * 0.86) fail(`Sam HRV did not sag: ${sam105.hrv} vs ${samClean.hrv}`)
if (sam105.activity > samClean.activity * 0.75) fail(`Sam activity did not drop: ${sam105.activity}`)

const leo90 = must(mission, 'leo', 90)
const leo100 = must(mission, 'leo', 100)
const leo130 = must(mission, 'leo', 130)
const leo140 = must(mission, 'leo', 140)
if (Math.abs(leo90.stoneRisk - 0.3) > 0.001) fail(`Leo day 90 stone ${leo90.stoneRisk}`)
if (Math.abs(leo100.waterIntake - 1.4) > 0.001) fail(`Leo day 100 water ${leo100.waterIntake}`)
if (Math.abs(leo130.stoneRisk - 0.85) > 0.001) fail(`Leo day 130 stone ${leo130.stoneRisk}`)
if (Math.abs(leo140.stoneRisk - 0.85) > 0.001) fail(`Leo risk fell without treatment: ${leo140.stoneRisk}`)

for (const astronaut of CREW) {
  const night = must(mission, astronaut.id, 131)
  if (night.co2 !== 2800) fail(`${astronaut.id} CO2 was ${night.co2}`)
  const hrvs = mission.filter((reading) => reading.astronautId === astronaut.id && reading.day <= 14).map((reading) => reading.hrv)
  const spread = sd(hrvs)
  if (!(spread > 0 && spread < 1.5)) fail(`${astronaut.id} learning HRV sd ${spread}`)
}

const anaNight = must(mission, 'ana', 131)
const anaClean = must(clean, 'ana', 131)
const expectedHrv = Math.round(anaClean.hrv * 0.9 * 10) / 10
const expectedSleep = Math.round(Math.max(3, anaClean.sleepHours - 0.8) * 100) / 100
if (Math.abs(anaNight.hrv - expectedHrv) > 0.05) fail(`Ana ship HRV ${anaNight.hrv} vs ${expectedHrv}`)
if (Math.abs(anaNight.sleepHours - expectedSleep) > 0.02) fail(`Ana ship sleep ${anaNight.sleepHours} vs ${expectedSleep}`)
if (must(mission, 'ana', 133).co2 > 1400) fail('CO2 did not clear')

const day10 = mission.filter((reading) => reading.day === 10)
if (new Set(day10.map((reading) => reading.co2)).size !== 1) fail('CO2 differed across the crew')
if (new Set(day10.map((reading) => reading.radiationDose)).size !== 1) fail('dose differed across the crew')
const dose = must(mission, 'maya', 180).radiationDose
if (dose < 160 || dose > 200) fail(`end dose ${dose}`)

const at30 = tick(mission, 30)
if (Math.abs(at30[0].hrv - maya30.hrv) > 1e-9) fail('tick missed an integer day')
const atMid = tick(mission, 30.5)
const maya31 = must(mission, 'maya', 31)
if (Math.abs(atMid[0].hrv - (maya30.hrv + maya31.hrv) / 2) > 1e-6) fail('tick did not interpolate')

const treatedMaya = applyTreatment('maya', 63)
if (Math.abs(must(treatedMaya, 'maya', 63).hrv - maya63.hrv) > 0.05) fail('treatment changed the start day')
if (Math.abs(must(treatedMaya, 'maya', 66).hrv - HEALTHY_CENTRES.maya.hrv) > 0.05) {
  fail(`Maya was not back at centre: ${must(treatedMaya, 'maya', 66).hrv}`)
}
if (must(treatedMaya, 'maya', 65).hrv <= maya65.hrv) fail('treatment did not beat the untreated worsen')
if (must(treatedMaya, 'sam', 105).sleepHours > 6.3) fail('Sam changed when only Maya was treated')

const treatedSam = applyTreatment('sam', 100)
if (Math.abs(must(treatedSam, 'sam', 105).sleepHours - HEALTHY_CENTRES.sam.sleepHours) > 0.05) {
  fail(`Sam sleep did not recover: ${must(treatedSam, 'sam', 105).sleepHours}`)
}
if (Math.abs(must(treatedSam, 'maya', 66).hrv - HEALTHY_CENTRES.maya.hrv) > 0.05) fail('Maya recovery was lost')

const treatedLeo = applyTreatment('leo', 100)
if (must(treatedLeo, 'leo', 107).stoneRisk >= must(treatedLeo, 'leo', 100).stoneRisk) fail('Leo stone risk did not fall')
if (must(treatedLeo, 'leo', 107).stoneRisk > 0.4) fail(`Leo stone stayed high: ${must(treatedLeo, 'leo', 107).stoneRisk}`)

const reset = buildMissionData()
if (Math.abs(must(reset, 'maya', 66).hrv - must(mission, 'maya', 66).hrv) > 0.05) fail('reset did not restore the story')

applyTreatment('maya', 63)
const ignored = applyTreatment('maya', 70)
if (Math.abs(must(ignored, 'maya', 66).hrv - HEALTHY_CENTRES.maya.hrv) > 0.05) fail('a second treatment overwrote the first')

console.log('engine checks passed', {
  mayaDay30Hrv: maya30.hrv,
  mayaDay63Hrv: maya63.hrv,
  endDoseMsv: dose,
})
