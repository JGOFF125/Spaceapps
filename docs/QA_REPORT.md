# Final software verification

Verified locally on November 14, 2026 against the supplied BASELINE implementation plan and the user's later UI requirements. The detailed implementation prompts define the demo's rules; the ideation PDF supplies broader context. The user's true-black/light-theme redesign, interactive anatomy map and smartwatch preview supersede the earlier layout examples. Attached documents do not authorize publication.

## Results

| Check | Result |
| --- | --- |
| `npm test` | **58 passed, 0 failed**, followed by Member 1's Engine checks |
| `npm run build` | **Passed** TypeScript and Vite production builds for the cockpit and Brain lab |
| `npm run lint` | **Passed**, no warnings |
| Shared integration contract | `src/types.ts` and the seeded `src/engine/` remain unchanged |
| Production-browser walkthrough | Passed on `http://127.0.0.1:4173/`; no error/warning console entries in the checked production tabs |
| Responsive Core | 320, 768, 1024, 1440 px: document width equals available viewport width; no horizontal overflow |
| Phone additions | Watch and Earth at 320 px: no horizontal overflow; light appearance also checked |
| Keyboard | Body hotspot selection with Enter; drawer opening, Tab/Shift+Tab wrap, Escape dismissal and focus restoration |

The complete 180-day mission is exercised deterministically by automated tests, including all personal care loops during Mars blackout. Browser verification uses the scenario jumps and real app controls rather than waiting five minutes for every replay.

## Requirement coverage

| Requirement | Verified behavior |
| --- | --- |
| Four astronauts, deterministic 180-day Engine | 720 daily observations; smooth interpolation used only for display; clean first 14 learning days |
| Personal normal and drift | Separate means/SDs per astronaut, recent three-day windows, ordered signal weights, bounded score, no future-data leakage |
| Explainable alerts | Watch persistence, strict warning/critical boundaries, temperature exception, reasons, signal agreement, confounders and prescribed actions |
| Maya infection story | Alert before the sick day; starting from the watch updates the console; improving trend closes the loop after three observed days |
| Sam sleep story | Sleep chart and independent sleep-debt rule; protected-sleep/workload action; improving trend recheck |
| Leo stone story | Independent risk thresholds, hydration action and seven-day trajectory; recovery uses stone risk rather than whole-body drift |
| Shared CO₂ event | Cabin plot, one CREW alert with independent personal alerts retained; closes after three normal-air days |
| Mars/near link | 22/3 demo light-minutes, six-hour relay windows, stored → sent → received → confirmed with scheduled event timestamps |
| Blackout | Unsent reports/advice remain queued; onboard decisions continue; launched packets finish their scheduled journey |
| Core, Mind, StoneWatch, Storm Shield, Ship's Health, Ship's Doctor | All six production views opened and exercised with actual Engine/Brain/session state |
| Guided care and report | First four steps recorded manually; packing a real report atomically completes step five; shelter completion requires that packet |
| Solar storm | Adds an illustrative 20 mSv from the event day, CREW critical alert, shelter guidance and retained cumulative dose |
| Private 30-second check-in | Mood/Energy/Stress sliders, local save, playback pauses on opening; changing day/astronaut closes the private flow; excluded from reports/sync |
| Interactive human map | Five keyboard/clickable regions with related signals and measurement limits; illustrated organs are not claimed as measured scans |
| Smartwatch | Vitals, Readiness and Care; same mission and action loop; explicitly a browser preview |
| Dark/light appearance | True-black default; semantic chart/status colors; preference survives refresh; watch hardware remains dark |
| Separate Earth tab | `#/earth`, delayed clock, arrived-only report content, reply box, incoming ship advice with departure/source-age badge |
| Cross-tab transport | `baseline-sync` BroadcastChannel and localStorage events both verified; `?sync=storage` selects the fallback for testing |
| Stale/duplicate advice | Received source packet required; reply IDs deduplicate; reset/rewind creates a new mission ID to reject abandoned-timeline advice |
| Demo controls | Lead-ins at 58/93/88/129 plus alert snapshots; forward jumps retain actions; rewinds clear future events and restart communications |
| Presentation mode | Enlarges reading/crew/alert text and hides demo controls; separate exit control remains available |
| Refresh/reset | Validated, versioned browser persistence with migration; treatments, clocks, reports, advice and dose retained on refresh; reset clears mission history |
| Deployment preparation | Static Vite configuration supplied in `vercel.json`; no deployment performed |

## Problems corrected during this audit

1. Multi-day jumps previously queued newly detected alert packets at the destination day. Detection and packet queueing now replay together on the original day.
2. Packing a report did not complete its checklist step. Report creation and the final tick are now one operation; checking a box alone cannot claim a report exists.
3. The plan's independent Earth tab and advice return path were missing. They now use a separate incoming queue and correlation metadata without changing the shared interfaces.
4. Forward story jumps discarded successful earlier treatments. They now preserve state; rewinds replay only actions already taken by that day and reject future communications.
5. Drift and StoneWatch indicators had severity/color mismatches. They now use the Brain's threshold boundaries; care summaries/watch prioritize warning over watch.
6. Presentation mode left demo controls visible. It now hides them and retains a separate exit control.
7. A check-in's saved confirmation could survive into a new day. The private form now resets on day/astronaut changes and pauses playback when opened.
8. Drawer autofocus interfered with keyboard focus restoration. Drawers now capture their opener before focusing, wrap Tab explicitly and restore focus after Escape/close.
9. Saved care/advice metadata validation now rejects corrupt records before rendering.

## Quick review for the team

1. Open the cockpit, select **Infection drift · day 63**, then **Smartwatch → Care → Start action**. Advance three days with Demo controls; return to Core and inspect care history.
2. Test Sam/102 and Leo/120 with their actions. Three days shows an improving trend; full Engine treatment curves are five and seven days respectively. `recovered` means the plan's improving-trend loop closure, not full biological recovery.
3. Simulate a storm. In Ship's Doctor record four checks, pack the report, and complete the shelter protocol. Confirm dose remains in the ledger.
4. Open Earth communications, enable Mars Mode, queue a report, then **Open Earth tab**. From an integer source day, advance 0.25 day to sent, another 0.5 to received, another 0.5 to confirmed. Reply to the arrived report and advance through the next relay plus a 0.5-day return leg. Repeat in blackout and with `?sync=storage` on both tabs.
5. Try light mode, body hotspots and presentation mode. Refresh during a care action or transmission. Reset before rehearsal.

## Remaining team deliverables and limits

No known blocking software defect remains from these checks. This is a tested hackathon simulation, not proof against every possible browser/device condition. Keep one ship console open and both tabs on the same browser profile/origin/port. The ship owns the clock; pausing or closing it stops delivery. The clock ends at day 180, so messages queued at mission end stay queued. If browser storage is blocked, onboard care can continue in memory; refresh persistence and the storage-event transport need available storage.

The broader ideation document includes research aspirations beyond this implementation plan. The software does not ingest live astronaut/CSA records, connect physical watches or dosimeters, diagnose disease, authenticate multiple users, or clinically validate the demonstration thresholds. See `SOURCES.md` for the data and rule provenance.

Following this verification and user review, the user authorized GitHub publication to **`main`**. Development history is retained on **`J's-Branch`**. The team's pitch/deck, backup video, hosted deployment, rehearsal and Space Apps submission remain separate deliverables; a passing software check does not mark them complete.
