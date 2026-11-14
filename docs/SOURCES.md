# Sources and demo assumptions

Reviewed November 14, 2026. The implementation plan supplies the shared contracts, stories, thresholds, and action wording. The broader ideation PDF provides the project context. Neither document is treated as authority to publish, message teammates, or expand Member 2 into another member's assignment.

## Research context consulted

- [NASA: Five Hazards of Human Spaceflight](https://www.nasa.gov/hrp/hazards/) identifies radiation, isolation/confinement, distance from Earth, gravity changes, and hostile/closed environments. This motivates onboard monitoring and the cabin-air distinction; it does not validate this app's numerical alert thresholds.
- [NASA: Risks of Human Spaceflight](https://www.nasa.gov/hrp/risks/) is a broader risk/evidence entry point, not a source of patient-specific rules for this app.
- [NASA: Ongoing HRP Research](https://www.nasa.gov/hrp/ongoing-hrp-research/) describes investigations including sleep/activity, immune biomarkers, and standard physiological measures. These support the choice of signal categories, not the synthetic values or z-score weights.
- [CSA: Monitoring radiation for astronaut health](https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp) describes autonomous neutron monitoring technology. Radiation is retained in the shared Reading contract, but the radiation display and solar-storm interaction belong to the other team modules.
- [CSA: Why conduct science experiments in space?](https://www.asc-csa.gc.ca/eng/iss/science/why-do-we-conduct-science-experiments-in-space.asp) discusses deep-space health research and communication delays, supporting the motivation for onboard decisions and asynchronous Earth support.

## Canadian resource PDF

The PDF links to the [CSA data catalogue](https://donnees-data.asc-csa.gc.ca/en/dataset/), [CSA GitHub](https://github.com/asc-csa), [EODMS](https://www.eodms-sgdot.nrcan-rncan.gc.ca/index-en.html), [EODMS FAQ](https://github.com/eodms-sgdot/eodms-website/wiki/FAQ), [RADARSAT notebooks](https://github.com/eodms-sgdot/radarsat-notebooks), and [CADC](https://www.cadc-ccda.hia-iha.nrc-cnrc.gc.ca/en/).

These are discovery resources, not astronaut vital-sign datasets attached to this project. The CSA catalogue returned a gateway error during this review. No Canadian dataset was downloaded or integrated. Earth-observation and astronomy catalogues do not by themselves justify physiological drift thresholds. Member 1 may add a specifically documented relevant dataset later; record the actual dataset, version, transformations, and license before claiming dataset use.

## What is deliberately simulated

The fixture streams, all scoring weights and noise floors, 0.45/0.65/0.85 severity boundaries, 0.8 °C temperature-change rule, 2,000 ppm CO2 trigger, StoneWatch index cutoffs, and treatment response curves are demonstration parameters. The 3 L/citrate action is quoted from the team's implementation plan, not derived as clinical guidance from these resources. Confidence means heuristic signal agreement, not calibrated probability. No model has been trained on OSDR or clinical records.

The browser labels these limitations. Avoid claims such as “NASA-validated diagnosis,” “AI-powered diagnosis,” “real astronaut live data,” or “uses Canadian datasets” when presenting this Member 2 implementation. It is transparent rule-based decision support on synthetic test streams.
