# BASELINE

BASELINE is a crew health console for long-duration spaceflight that learns each astronaut's personal baseline and flags sustained drift before it becomes an emergency. It explains every alert, suggests an onboard countermeasure, and tracks whether the astronaut recovers. A second "Earth" tab shows how delayed mission support works when messages take up to 22 minutes each way from Mars.

## How to run

```sh
npm install
npm run dev
```

Open the local address printed in the terminal. Run the tests with `node --test tests/*.test.ts`.

## Demo script

1. **Clock** – press play on the mission clock and watch the crew vitals move day by day.
2. **Story A alert** – open the gear menu (Demo controls) and jump to Story A (day 58). Play until Maya's infection-drift alert appears.
3. **Start action** – open the alert and press the action button to start the countermeasure.
4. **Recovery** – keep the clock running; the recheck shows Maya returning toward her baseline and the alert closes.
5. **Mars Mode** – open Earth link and switch on Mars Mode. The one-way delay becomes 22 minutes and messages visibly crawl.
6. **Earth tab** – press "Open Earth tab". Watch reports arrive late, then send advice back and see it land on the ship stamped "Left Earth X min ago".

Turn on **Presentation mode** to hide the demo controls and enlarge crew and alert text.

## Data statement

Live data is simulated for the demo; patterns, ranges and thresholds are drawn from NASA's Open Science Data Repository (OSDR) and Human Research Program evidence.

## Honest limits

- **Decision support, not diagnosis.** BASELINE highlights trends for the crew and flight surgeons to review; it does not diagnose illness.
- **Transparent rules, not deep learning.** Alerts come from readable baseline-and-threshold rules so every flag can be explained and checked.

## Deploy

`vercel.json` builds the site with `npm run build` and serves it as a static app.
