# BASELINE — shared app and Member 2: The Brain

Personal baselines, explainable drift alerts, countermeasures, recovery checks, and delayed Earth messaging for the team's NASA Space Apps prototype. The reusable logic is plain TypeScript with no runtime libraries, backend, database, or network requests. A separate React + Vite test bench lets Member 2 be tested before the other members' code arrives.

## Run and test

Use Node.js 24 or newer. From this folder:

```powershell
npm install
npm test
npm run build
npm run dev
```

On Windows, use `npm.cmd` if PowerShell blocks `npm.ps1`. Open the local URL printed by Vite (normally http://127.0.0.1:5173) for the shared cockpit shell. Open **http://127.0.0.1:5173/brain-lab.html** for Member 2's independent test bench. After installation, the app and tests run offline. `npm test` runs the Brain tests, actual Engine/Brain integration tests, and Member 1's engine checks. `npm run build` checks TypeScript and builds both pages. `npm run lint` checks the merged source.

## Try it yourself

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
- `dev/`: isolated fixture generator and test screen. Do not replace Member 1's Engine or Member 3's dashboard with these.
- `tests/`: repeatable logic and full-mission regression tests.
- [Integration guide](docs/MEMBER_2_INTEGRATION.md): exported functions, event wiring, persistence, and exact rule semantics.
- [Sources and limits](docs/SOURCES.md): what the NASA/CSA resources support and what remains a demo assumption.

The checkout uses the existing GitHub branch **`J's-Branch`** in **JGOFF125/Spaceapps**. Main's React/Vite/Tailwind/Recharts setup, cockpit shell, shared types, and seeded Engine are preserved. Member 2's Brain replaces main's empty Brain placeholders. The root page remains the shared shell for Member 3; `brain-lab.html` is an independent test page. The Brain has no dependency on React, Tailwind, or Recharts. The automated integration suite runs Member 1's actual engine through detection, action, and recovery; connecting these APIs to the production cockpit is still Member 4's wiring task.

## Honest scope

This is a hackathon decision-support demonstration, not diagnosis or a flight-ready medical device. Confidence is a rule-agreement score, not clinical certainty. `recovered` means an improving simulated trend after an action, not proof of medical recovery. Action wording, including hydration/citrate, is scripted from the team's plan for crew-medical review, not individualized medical advice.

NASA/CSA resources inform the problem context. No real astronaut records or Canadian datasets are ingested, and no claim is made that the thresholds were clinically validated or that this is an RFC 9171 implementation. The production simulator and dashboard must still be connected and tested together by the team.
