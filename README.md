# BASELINE — onboard health monitoring

A browser-based health cockpit for The Void Voyaguers' NASA Space Apps prototype. Member 1's seeded Engine, Member 2's explainable Brain, and Member 3's dashboard now run together. Personal baselines, body-region signals, countermeasures, recovery checks, and delayed Earth messaging all use the same mission state. No backend or database is required.

## Run and test

Use Node.js 24 or newer. From this folder:

```powershell
npm install
npm test
npm run build
npm run dev
```

On Windows, use `npm.cmd` if PowerShell blocks `npm.ps1`. Open the local URL printed by Vite (normally http://127.0.0.1:5173) for the integrated cockpit. Open **http://127.0.0.1:5173/brain-lab.html** for Member 2's independent test bench. After installation, the app and tests run offline. `npm test` runs 58 tests covering the Brain, actual Engine/Brain integration, mission actions, persistence, solar events, Earth advice and display severity, followed by Member 1's engine checks. `npm run build` checks TypeScript and builds both pages. `npm run lint` checks the merged source.

## Try the dashboard

The console starts at a healthy day-30 snapshot. Play advances 180 mission days in about five minutes; 4× accelerates playback. Reset returns to day 1 so the first 14 learning days can be observed. Pausing freezes the mission, including delivery timing. Forward story jumps preserve actions and reports; rewinding replays actions taken by that day, clears future events, resets review notes and starts a fresh communication timeline. Reset clears all mission actions/events/messages. The clock stops at day 180, so packets queued at mission end remain queued.

The quieter overview uses a true-black default appearance. The sun/moon button in the header switches between dark and light mode and remembers the choice on this device. Four compact crew selectors replace the repeated crew-vitals column. Detailed care opens from the bell button or **Review care**; charts and baseline explanations open under **Trends & personal baseline**. The six modules remain in the navigation rail (bottom navigation on phones).

1. Click a crew card, then click a body-map hotspot or a region label. Each region shows its related signals and the limits of what is measured.
2. Expand **Demo controls** in the footer and select **Infection drift · day 63**. Click **Review care → Guided checks**, record a few checklist steps, and click **Start prescribed action**. Expand Demo controls again and advance **+3 days**. The overview shows **Recovery recorded**; the care panel retains **Recovered — loop closed**.
3. Select **Sleep debt · day 102** for Sam's sleep chart and protected-sleep action. Select **Stone risk · day 120** for Leo's hydration and stone-risk trajectory. Start each action and advance three days to observe improving trends.
4. In **Mind**, open the personal check-in (this pauses playback), adjust Mood/Energy/Stress, and **Save privately**. Responses remain in separate device-local records and are excluded from mission reports and Earth synchronization. Switching astronaut/day closes the personal flow; past responses are not exposed on the shared console. This demo has no authentication or secure multi-user isolation.
5. In **Storm Shield**, click **Simulate solar storm**. The event adds 20 illustrative mSv for each astronaut and emits a CREW alert. **Ship's Doctor** provides a shelter checklist. Record the first four checks and click **Pack report for Earth** to complete step five, then **Record shelter protocol complete**. The packed report can remain stored during blackout; onboard completion never waits for Earth. Cumulative dose is retained. Protocol completion is not biological recovery.
6. Select **Cabin CO₂ · day 132**. Ship's Health plots cabin CO₂ against crew-average HRV. Advance three days to see the untreated environmental event clear.
7. Open **Earth link**, enable **Mars Mode**, queue a status report, then use **Advance 6 mission hours**. From an integer day, one click reaches sent; two more reach received; two more reach confirmed. Blackout stores unsent reports while onboard actions still work. **Open Earth tab** opens `#/earth`: Earth-visible day is ship day minus `22/44 = 0.5` in Mars Mode. Only arrived reports reveal their content. Reply to one, then advance the ship clock through the next relay and one return leg to see incoming advice in the ship’s Earth drawer. Advice never starts treatment automatically. Keep one ship console open; the Earth view does not run its own clock.
8. Click **Smartwatch** for Vitals, Readiness and Care screens. Starting an action on the watch updates the same mission state. This is an interactive browser view, not a connection to physical watch hardware.
9. Open the bell / care panel, dismiss an alert with a review reason, then inspect **History**. Refresh to verify treatments, checklists, outbox timestamps, review notes, theme choice and cumulative exposure survive. Private check-ins use separate storage keys.

The cockpit is responsive and supports keyboard navigation, reduced motion, and a presentation view that enlarges text and hides demo controls (use **Exit presentation mode** in the footer to return). Story lead-ins match the plan: A/58, B/93, C/88, CO₂/129; the later snapshots help inspect an alert immediately. All values and events are simulated. The body map relates available signals to regions; it does not claim organ scans, brain measurements, bone-density readings or tissue injury estimates.

To test the fallback without BroadcastChannel, open `http://127.0.0.1:5173/?sync=storage` and its **Open Earth tab** link. Both pages then use localStorage events only. They must use the same browser profile, origin and port. If both browser transports are blocked, independent Earth synchronization is unavailable; onboard care still works in memory.

## Independent Brain lab checks

| Case | Steps | Expected result |
| --- | --- | --- |
| Infection | Select **A · Infection drift**, click **Start action — maya**, then **+3 days** | One Maya alert shows **Recovered — loop closed**, with no duplicate generic alert |
| Ineffective action | Reset A, check **Simulate ineffective treatment**, start action, then **+3 days** | Maya's alert becomes **escalated** |
| Sleep | Select **B · Sleep debt**, start Sam's action, then **+3 days** | Sam's improving trend closes the loop |
| StoneWatch | Select **C · StoneWatch**, start Leo's action, then **+3 days** | Risk falls; the alert closes using stone risk, not heart-rate drift |
| Cabin air | Select **D · Cabin air**, then **+3 days**, without starting an action | One CREW alert closes after three normal-air days |
| Healthy control | Select **Healthy control** | No alerts |
| Mars delay | Reset any case, enable **Mars Mode**, **Queue test report** | Initially **stored**; click **+6 hours** once: **sent**; twice more: **received**; twice more: **confirmed** |
| Blackout | Reset, enable Mars Mode and Blackout, queue a report, advance a day | Packet remains **stored** and onboard alerts still work; disable blackout, then advance 6 hours to send |
| Refresh | Refresh during an action or queued transmission | Day, action clock, link settings, and message timing survive |

Changing scenarios resets the test session and isolates that case. These are deterministic test fixtures, not Member 1's production simulator. Play advances one mission day every 1.7 seconds; pause and manual steps make transitions easier to inspect.

## Team handoff

- `src/types.ts`: the four shared interfaces from the supplied implementation plan, unchanged.
- `src/brain/`: Member 2's deliverable. Import from `src/brain/index.ts`.
- `src/ui/`: compact crew selectors, interactive anatomy render with native button hotspots, six Recharts modules, care panel and smartwatch preview.
- `public/images/anatomy-v2.png`: generated anatomical illustration, used as a visual reference, not a medical scan.
- `src/mission/session.ts`: Engine/Brain integration, action history, solar events, persisted session and reset behavior.
- `dev/`: isolated fixture generator and earlier Brain test screen.
- `tests/`: repeatable logic and full-mission regression tests.
- [Integration guide](docs/MEMBER_2_INTEGRATION.md): exported functions, event wiring, persistence, and exact rule semantics.
- [Sources and limits](docs/SOURCES.md): what the NASA/CSA resources support and what remains a demo assumption.
- [UI design notes](docs/UI_DESIGN.md): Taste audit, theme tokens, visual references and the anatomical asset prompt.
- [Final verification](docs/QA_REPORT.md): requirement coverage, regression results, and remaining team deliverables.

The integrated cockpit was developed on **`J's-Branch`** in **JGOFF125/Spaceapps** and approved for publication to **`main`** after user review. The shared interfaces and seeded Engine are preserved. The root page is the integrated cockpit; `brain-lab.html` remains an independent test page. The reusable Brain has no dependency on React, Tailwind, or Recharts. The separate Earth view and reply queue use BroadcastChannel with a localStorage-event fallback. Supporting inbox/correlation metadata lives outside the four shared interfaces. `vercel.json` supplies static Vite deployment settings; hosted deployment is a separate team step. Real wearables and authentication remain outside this demonstration.

## Honest scope

This is a hackathon decision-support demonstration, not diagnosis or a flight-ready medical device. Confidence is a rule-agreement score, not clinical certainty. `recovered` means an improving simulated trend after an action, not proof of medical recovery. Action wording, including hydration/citrate, is scripted from the team's plan for crew-medical review, not individualized medical advice.

NASA/CSA resources inform the problem context. No real astronaut records or Canadian datasets are ingested, and no claim is made that the thresholds were clinically validated or that this is an RFC 9171 implementation. The integrated simulator and dashboard passed the documented software checks; the team should rehearse the demonstration before the event.
