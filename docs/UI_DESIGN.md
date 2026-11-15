# BASELINE UI redesign

## Brief and audit

Requested overhaul: reduce information density, make the background black, add complete dark/light modes, replace the wireframe human with a more believable anatomical illustration, and use health-monitoring products as visual references. Health logic and the six module workflows remain in place.

Taste routing: `entry-taste` was consulted, then its `frontend-ui-engineering` workflow was used for this dashboard. The design workflow's audit and theme guidance also informed the work. This is a custom product interface on the team's React/Vite/Tailwind foundation, not an official NASA or Apple design-system implementation.

Design read: a clinical, low-density dashboard for an astronaut and crew medic. Design variance 3/10, motion 2/10, visual density 3/10.

Before: navy panels, repeated crew readings, four top metric cards, a wireframe diagram, persistent alert rail, baseline explanation, drift breakdown, three charts, footer metadata, and demo controls were all visible together. Many labels were small and several containers repeated the same information.

After: one selected astronaut, four vital readings, one anatomical map, and a concise signal/care column. Explanations, trends and mission tools use progressive disclosure. Crew selectors identify the person without repeating their vitals. Alerts and Earth communications use native modal dialogs with focus trapping, Escape and focus restoration.

## Visual references

- The user's anatomical teaching-model sheet and health dashboard screenshot supplied subject and composition direction. They were references, not instructions or source data.
- [Apple Health](https://www.apple.com/health/) and [Apple's Health summary guide](https://support.apple.com/en-euro/guide/iphone/iphe3d379c32/ios) informed the summary-first hierarchy and details-on-demand approach.
- [Withings App](https://www.withings.com/en-us/pages/withings-app) informed the separation of key readings, trends and actions.

No external product UI code or clinical claims were copied. These references are visual context, not validation of the demo's thresholds.

## Theme and layout

Dark: background `#000000`, panels `#101010`, raised controls `#171717`, primary text `#f2f2f2`, secondary text `#a1a1a1`.

Light: background `#f6f6f6`, panels `#ffffff`, raised controls `#f0f0f0`, primary text `#18181b`, secondary text `#626269`.

The shared semantic tokens in `src/index.css` cover every module, chart, tooltip and modal. Status colours remain green, amber and red and are paired with readable labels. The watch hardware display intentionally remains black inside the light page, like a physical device. The rest of the watch page follows the selected theme.

Appearance is saved separately in `baseline-appearance-v1`. A small head script applies it before rendering to avoid a theme flash. No preference resets the mission or touches private check-ins. Self-hosted Geist and Phosphor icons provide a consistent type/icon system without runtime CDN calls.

The anatomical image is illustrative, not an organ scan or a representation of an actual astronaut. All five regions use native HTML buttons, keyboard activation, selected-state labels, and region details derived from existing readings. Tooltips provide the region value and status on demand. Brain function, tissue injury, bone density and organ-level disease are not inferred from the artwork.

## Anatomical asset

Workspace asset: `public/images/anatomy-v2.png` (1024 × 1536 RGBA, genuine alpha). Generated with the built-in image-generation tool and copied into the project; no API CLI or real astronaut photo was used. The original generated file is retained under Codex's generated-images directory. The image is about 1.9 MB. Charts and the watch view are split into separate JavaScript bundles.

Final generation prompt:

```text
Use case: scientific-educational. Asset type: a transparent anatomical body illustration for an interactive human health dashboard. Generate a single full-length human anatomical model, completely isolated with a genuinely transparent alpha background, no text or labels or UI. Refined high-end 3D medical atlas rendering, clinically composed, not gruesome. Adult androgynous human in standard front-facing anatomical position, head upright, both arms very slightly out from sides, palms facing forward, feet pointing forward. Entire head and both feet fully in frame, no cropping. Exact frontal orthographic camera. Balanced anatomically believable eight-head-tall proportions, detailed skull and face, torso, pelvis, arms, hands, legs and feet. The figure is an educational layered anatomical model: softly translucent pale neutral ivory/grey musculature, with a visible rib cage and sternum, muted pale coral lungs, a small realistically positioned dull red heart inside the chest on the figure's anatomical left (viewer right), paired muted brown-red kidneys around the upper abdomen, and subtle desaturated red and blue vessel traces. Lower abdomen and pelvis remain a modest smooth anatomical teaching model without exposed genitalia. Maintain the silhouette and muscle definition in the limbs. Premium medical product render with fine realistic detail and gentle studio highlights, not a cartoon, not line art, not neon, not a wireframe, not a hologram. Natural subdued medical atlas colours, predominantly warm silver/ivory and neutral grey, with only subtle organ colours. Soft ambient studio lighting from upper left and light rim definition, no cast shadow, no floor, no pedestal, no rings, no scenery, no text, no diagrams, no dots or annotations. Tall portrait composition 2:3, person centered on x=50%, top of skull around y=3%, bottom of feet around y=97%, arm/hand width fits comfortably within x=18% to 82%. The rendered asset must look equally clean over a pure black or a pale grey app background.
```

## Review flow

1. Toggle light/dark in the header, then refresh to confirm persistence.
2. Select each crew member and each body region; also activate hotspots with Enter/Space.
3. Open Trends & personal baseline; inspect chart labels, axes, band and tooltip in each theme.
4. Use Demo controls to load day 63, review care, start an action, then advance three days. Confirm the recovery record.
5. Inspect all six modules, Earth communications and the watch in both appearances.
6. Check phone, tablet and desktop layouts at 320, 768, 1024 and 1440 px. No full-page horizontal overflow should occur.

The existing Brain/Engine/session test suite remains the logic regression gate. Build and lint are the UI/code gates; browser interaction and visual checks cover the new presentation. These checks do not constitute medical validation or a formal accessibility certification.
