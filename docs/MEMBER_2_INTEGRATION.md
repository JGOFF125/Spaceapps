# Member 2 integration guide

The Member 3 cockpit is now wired to this API through `src/mission/session.ts` and `src/App.tsx`. The original `dev/` Brain lab remains available at `/brain-lab.html`. The README describes the integrated UI's manual test flow, smartwatch preview, private check-ins, and solar-event protocol. The event/session tests verify refresh, reset, review notes and radiation history in addition to the earlier Engine/Brain tests.

## Scope and ownership

The concrete Member 2 prompts in the supplied implementation plan define this module. Other members' prompts describe integration expectations, not additional work assigned to Member 2. The detailed three-day-window prompt is implemented rather than adding a second EWMA detector from the broader ideation document. All four shared interfaces remain unchanged; action and transmission timestamps live in separate state objects.

## Minimal wiring

```ts
import {
  createBrainState, advanceBrain, startAction,
  createOutbox, tickOutbox, enqueueMessage,
  setMarsMode, setBlackout, badgeText,
} from './brain/index.ts';

let brain = createBrainState();
let outbox = createOutbox(1);

// Call on each clock tick. readings is Member 1's Reading[] including treatments.
// Smooth fractional clock values are accepted; health rules run once per day.
function onTick(readings, day) {
  brain = advanceBrain(brain, readings, day);
  outbox = tickOutbox(outbox, day);
  // Publish brain.alerts and outbox to React state here.
}

function onStartAction(alert, day) {
  brain = startAction(brain, alert.id); // records brain.day as action start
  applyTreatment(alert.astronautId, brain.day); // Member 1's Engine function
  outbox = enqueueMessage(outbox, 'alert', alert.title + ': action started',
    alert.level === 'critical' ? 'emergency' : 'priority', day);
  // Rebuild readings from the Engine before the next onTick.
}

outbox = setMarsMode(outbox, true);
outbox = setBlackout(outbox, true);
// Earth/ship UI: pass timing metadata for precise departure badges.
const label = badgeText(outbox.messages[0], outbox.day,
  outbox.timings[outbox.messages[0].id]);
```

The snippet shows event order; annotate the application callback parameters with the team's shared `Reading` and `Alert` types. Do not call `applyTreatment` for CREW as though it were an astronaut; the cabin event is environmental. The test bench demonstrates that branch in `takeAction`.

`onTick` must run on a monotonic mission clock. On rewind/reset create fresh Brain and Outbox states and clear the Engine's treatments, then replay up to the target day. Do not feed unobserved future data to `updateAlertStatus` without an explicit `nowDay`. `advanceBrain` always supplies it. A full 180-day array is safe with `evaluateDay` and `driftScore`, which cut it off at the requested day.

The Brain never waits on outbox delivery or reads Mars Mode. The integrated cockpit uses `advanceMission` to process detection and packet queueing together on each intervening day, so jumping several days preserves the real detection/transmission times. The independent test bench queues on action start and its report button; it intentionally has no second Earth view. The main app now implements that view through `src/mission/useShipSync.ts` and `src/ui/EarthView.tsx`.

## API

| Export | Result / behavior |
| --- | --- |
| `computeBaseline(readings, astronautId)` | Five signal means and population standard deviations; `null` until all 14 distinct learning days exist |
| `driftScore(readings, astronautId, day)` | `{score, ready, signals, reason?}`; score 0–1, signed z-scores and weighted contributions. Check `ready`; zero with insufficient data is not reassurance |
| `evaluateDay(readings, day)` | Stateless current-day `Alert[]` candidates, each with deterministic pattern ID, explanation, agreement, confounders, and action |
| `createBrainState()` | Serializable lifecycle state |
| `advanceBrain(state, readings, day)` | Processes each intervening day, retains history, deduplicates episodes, and updates rechecks without mutating input |
| `startAction(state, alertId, day?)` | Records action day separately from detection day; default is `state.day`. Repeated start on an acting alert does not restart its clock |
| `updateAlertStatus(alert, readings, actionDay?, nowDay?)` | Rechecks an acting alert. With only two arguments it assumes action began on `alert.day` and uses latest readings; prefer the lifecycle wrapper |
| `createOutbox(day?)` | Near mode, 3-minute demo link, no blackout, empty queue |
| `queueMessage(kind, summary, priority, day, lightTimeMin?)` | Creates a shared-contract stored message. Default light-time is 3; it does not implicitly mutate a queue |
| `enqueueMessage(state, kind, summary, priority, day?)` | Preferred queue operation: returns new state with message and its timing sidecar |
| `tickOutbox(state, day)` | Advances relay/delivery states using exact scheduled times, including large clock jumps |
| `setMarsMode(state, enabled, day?)` | 3/22-minute link setting; updates unsent packets, preserves timing for packets in flight |
| `setBlackout(state, enabled, day?)` | Stops new ship transmissions; stored packets wait for the next future relay after restoration |
| `badgeText(message, nowDay, timing?)` | Precise timing with sidecar; without it, only known state, data age, and one-way delay are shown |
| `nextRelayDay(day)`, `relayCountdownHours(day)` | Next strictly future 0.25-day relay and countdown in mission hours |
| `lightTimeToDays(minutes)` | Shared delay compression for Member 4's delayed Earth clock |
| `serializeOutbox(state)`, `restoreOutbox(json)` | JSON persistence with structural validation of saved messages and timelines |

All code is plain TypeScript and uses platform APIs available in modern browsers (`structuredClone`, `crypto.randomUUID`). The `.ts` imports use TypeScript's `allowImportingTsExtensions` with Vite/no-emit builds. Node 24 runs tests directly without a test framework or runtime transpiler.

## Detection rules

Every threshold below is transparent demo tuning, not a NASA medical limit.

1. Deduplicate by astronaut and mission-day bucket, prefer the integer-day Engine reading, and keep the last exact duplicate. Reject nonfinite/invalid readings. Only observations at or before the evaluated integer day count. For best integration pass Member 1's canonical daily array; use interpolation for display only.
2. Freeze days 1–14 as the personal baseline. Missing learning days prevent normal drift evaluation. Three consecutive recent days are required for a rolling drift score; a current temperature more than 0.8 °C above a complete baseline can still trigger critical with an incomplete recent window.
3. Effective z-score denominator is the larger of baseline SD and the noise floor: HRV 4 ms, temperature 0.15 °C, HR 2 bpm, sleep 0.35 h, activity 12 min. The returned baseline SD remains the actual observed SD.
4. Only unhealthy directions contribute. HRV and temperature each carry 0.30, HR 0.20, sleep 0.12, activity 0.08. Each signal's share saturates at 3 effective SD. A reported z-score is signed and noise-adjusted, not a significance test.
5. Drift >0.45 on two consecutive days yields watch; >0.65 yields warning immediately; >0.85 or temperature rise >0.8 °C yields critical immediately.
6. A temperature rise at least 0.3 °C, HR rise at least 3 bpm, and HRV fall selects the infection action. Sleep under 6.5 h on three consecutive days with HRV decline selects a sleep warning (watch, or warning below mean 6.1 h). This separate rule is necessary because the sleep-only weighted score cannot reach the whole-body warning threshold.
7. StoneWatch uses its supplied risk index independently: >0.60 watch, >0.70 warning, >=0.85 critical. It does not claim to calculate kidney-stone probability from physiology.
8. CO2 >2,000 ppm and at least three astronauts with two unhealthy shifts (effective z >=0.5) produces one CREW alert. Air-only personal drift is suppressed; independent fever/infection and stone alerts are preserved. Engine input should use the same cabin CO2 value for all crew.

General drift, sleep and infection share a health episode per astronaut so a changing pattern during recovery does not create duplicate alerts. StoneWatch is independent. Recovered episodes can recur after a day without the triggering pattern. Open or escalated alerts stay visible until acted on; missing data never silently closes them.

## Recheck semantics

An action must have been started. The first recheck occurs three mission days after that action, with three observed recent days. Whole-body drift must fall by more than 0.03 and not rise on the latest day; persistent critical temperature escalates. StoneWatch checks its risk index instead. Rising scores beyond that tolerance escalate; flat or insufficiently observed trends remain acting. This follows the plan's improving-trend definition of `recovered`, not full return to baseline. It supports the three-, five-, and seven-day fixture treatment curves.

The untreated cabin event closes after three complete normal-air days for at least three astronauts. No action is needed for its scripted environmental recovery.

## Communications and persistence

Relays occur every 0.25 mission day, strictly after queuing. At 22 minutes, one leg takes 0.5 displayed day; at 3 minutes, one leg takes `3/44` day. Two legs produce acknowledgement. This is deliberate demo scaling, not a literal conversion of minutes into mission days. Near mode is also simulated; it is not a claim of a 3-minute ISS delay.

Blackout blocks new outbound packets. Already launched packets finish their scheduled journey, including the simulated automatic acknowledgement. Packet loss, Earth relay outages, capacity scheduling, expiry, and arbitrary Earth replies are outside this module. Priorities are carried in the contract for display/integration; all queued packets can fit one demo relay. This is a store-and-forward demonstration, not a compliant Bundle Protocol implementation.

Persist the **entire** `BrainState` and `OutboxState` (including actionDays, activeEpisodes, sequence, and timings), plus the Engine's treatment state and mission day. Saving only the shared Alert/OutboxMessage arrays loses essential timing. Restore the Outbox using `restoreOutbox`; version and validate the application's full session payload. In the test bench a bad session resets to a fresh case and unavailable localStorage falls back to in-memory state.

The main app broadcasts `{ day, marsMode, lightTimeMin, outbox }` plus a mission ID, incoming queue and reply correlations on `baseline-sync`; storage events provide the fallback. Readings, future telemetry and private check-ins are excluded. Earth never mounts the ship clock or writes its mission session. A confirmed outbound message's badge refers to the automatic acknowledgement leaving Earth; an outbound packet says **Left ship**, and a stored packet never pretends it has left Earth.

Free-text advice uses a separate incoming `OutboxState` and correlation records outside the shared interfaces. Only a received/confirmed source packet permits a reply. The ship accepts each reply ID once, schedules the next relay and a one-way return leg, and reveals advice only after arrival. Badges use the actual Earth departure and original ship data day. Reset and rewind generate a fresh mission ID to reject advice from the old timeline. `configureLink` keeps both queues' link settings together and freezes already-launched packets. Advice is advisory and never invokes treatment.

`packReport` queues a real packet and records checklist step five atomically. `recordChecklist` handles steps one to four; shelter completion requires all five and a report packet. Forward `seekMission` preserves state; rewind replays actions already taken by that day, clears future events and review notes, and restarts communications. Use `createMission(1)` for a full reset. Restore migrates older saved sessions and validates care and communication metadata before rendering.

## Validation and remaining integration

The automated suite covers baseline isolation, missing/invalid data, duplicate/interpolated readings, future-data leakage, strict thresholds, unhealthy directions, all three stories, confounders, shared CO2, independent fever, delayed action starts, recovery/escalation, episode deduplication, and a complete 180-day treated mission. Outbox tests cover exact boundaries, skipped ticks, mode switches, blackouts, badges, persistence, and invalid state. After merging main, `tests/integration.test.ts` also verifies a healthy 180-day run with Member 1's actual Engine, all three production story treatments, and automatic cabin recovery. `npm test` includes Member 1's original `scripts/check-engine.ts` checks.

The 58-test suite and Engine checks pass. Browser checks of the production build verify all six integrated modules, smartwatch action/recovery, cabin recovery, checklist/report completion, blackouts, near/Mars delivery, two-way advice, storage-event fallback and refresh persistence. Ineffective-treatment escalation remains available in the independent Brain lab. See `docs/QA_REPORT.md` and the README for the repeatable team walkthrough. Publication, pitch, video and final submission still require the team's review.
