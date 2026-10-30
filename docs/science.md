# LaTeX and physics animation

Untuk katalog SD–SMP yang diperluas (20 fisika, 40 matematika/bahasa), bangun datar/ruang, dan penambahan elemen baru oleh AI, lihat [model pembelajaran](learning.md).

Add **LaTeX equation**, **Physics diagram**, **Learning diagram**, or a **3D** illustration from the left **Equation** tab. Search by Indonesian or English topic and filter by group. Click a card or drag it into a frame. Their source and parameters are editable under Properties. A canvas still owns pages and each page contains frames; all source, settings, and rendered media stay in the local canvas and its JSON backups.

## 3D illustrations

The Equation library includes all 23 scenes adapted from `3d-illustration.tsx`:

| Group | Scenes |
| --- | --- |
| 3D · Matematika | Kubus, Balok, Prisma segitiga, Limas segiempat, Tabung, Kerucut, Bola, Jaring-jaring kubus, Benda putar |
| 3D · Fisika | Piston, Bandul, Pegas, Gelombang, Gerak parabola, Bidang miring, Rangkaian listrik, Tuas, Cahaya |
| 3D · IPA | Tata surya, Model atom, Siklus air, Fase Bulan, Molekul |

Select an illustration to edit its dimensions or physical parameters. Drag the inspector preview or use its arrow keys to rotate; Rotation, Tilt, Zoom, and Reset 3D view provide numeric controls. Cube folding, solids of revolution, and Moon phases have a saved progress control. Piston has a gas-height control, and Molekul offers H₂O, CO₂, and CH₄. Dimension and formula visibility are saved with the layer.

Play or scrub the timeline for animated scenes. **Animate illustration** holds the saved initial state when disabled; reduced motion also holds that state. Scene geometry and particle motion depend only on the saved parameters and requested time, so seeking and image/video exports agree. The layer retains `illustration3d` settings and a standalone SVG snapshot in local canvases, versions, templates, and JSON backups. These native diagrams work without an asset pack or provider call.

Projection, particle sizes, and planetary distances are illustrative; use the written units and formulas. The triangular prism has an isosceles cross-section; the pyramid supports a rectangular base. Pendulum angles are limited to 30° for the small-angle period approximation. Piston pressure uses an ideal isothermal Boyle-law relation; the atom scene is a Bohr teaching model for the first ten elements. Moon phase progress describes the approximately 29.5-day synodic cycle. Existing Learning and Physics diagrams keep their separate models and parameters.

Implementation: `src/editor/illustration3d*.mjs` and `illustration3d-inspector.tsx`. Verify locally with `node tests/illustration3d.check.mjs` and `npm run test:ui -- tests/illustration3d.spec.ts`.

## LaTeX equations

LaTeX uses the locally bundled MathJax renderer and TeX font data. The engine loads when an equation is first rendered. It converts math-only expressions to standalone SVG paths without a CDN, external fonts, or a provider call, following [MathJax's direct-linking interface](https://docs.mathjax.org/en/latest/server/direct.html). The equation's `latex.source` remains editable alongside its embedded `src`. Invalid expressions leave the previous rendering intact. New equations have a timed reveal; use the Animation tab to adjust it; multiple equation layers can enter in sequence for a worked solution.

Supported examples include fractions, roots, powers, aligned equations, matrices, sums, and integrals. Math source is limited to 2,000 characters and the base, AMS, and newcommand packages. Full LaTeX documents, TikZ, external-content commands, and Manim scripts are outside this renderer. Optional dollar or math delimiters are removed before typesetting.

Pasting text that is entirely math (for example `$A_n = A_0 e^{-knT}`) creates a rendered equation instead of a text box. In Properties, a text box holding math shows **Convert to equation**: with no selection the whole box converts in place, and with part of the text selected only that part becomes a new equation below the original. Plain prose is never converted.

| Example         | Source or result                                 |
| --------------- | ------------------------------------------------ |
| Fractions       | `\frac12+\frac14=\frac34`                        |
| Linear equation | Three timed layers: `2x+3=11`, `2x=8`, `x=4`     |
| Quadratic       | `(x-2)(x-3)=0`, roots 2 and 3                    |
| Geometry        | `a^2+b^2=c^2`, with 3, 4, and 5                  |
| Matrix product  | A 2×2 matrix times a 2×1 vector, giving 4 and 10 |
| Integral        | `\int_0^1 x^2\,dx=\frac13`                       |

Physics diagrams draw from analytical state at the requested timeline time. Scrubbing, playback, sequence rendering, and image/video export share the same drawing path. Reduced motion holds the initial diagram. Each diagram also stores an SVG snapshot for portability. Parameters use SI units; time is measured in scene seconds relative to the layer's start.

| Model                   | Parameters and assumptions                                                                                                                                                    |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pendulum                | Length (m), gravity (m/s²), initial angle ≤30°, damping rate (s⁻¹). Small-angle damped oscillator.                                                                            |
| Spring                  | Mass (kg), spring constant (N/m), initial displacement (m), damping rate (s⁻¹). Supports underdamped, critically damped, and overdamped solutions with zero initial velocity. |
| Projectile              | Launch speed (m/s), angle, gravity. No air resistance; launch and landing heights are equal.                                                                                  |
| Uniform circular motion | Radius (m), period (s), constant speed. This model prescribes circular motion; it does not solve a gravitational orbit.                                                       |

**Continue motion** keeps the analytical motion running; a projectile repeats its launch after landing. Turning it off holds the projectile after landing or the other diagrams after one natural period. **Show path / reference** toggles the path or equilibrium guide. Changing a diagram manually does not rewrite a separate equation layer; update both when changing the underlying example.

The external **Math & Physics** collection contains 16 presets: six equation examples, four simulation demonstrations, and three paired Q&A sets (fractions, pendulum period, projectile flight time). The earlier 16 Studio presets remain available, alongside the new SD & SMP collection. Source data lives in `design-references/science-presets.json`, with native construction in `scripts/science-presets.mjs`. Run `npm run presets:science`, `npm run presets:index`, and `npm run presets:previews` to rebuild this collection and its thumbnails. No science catalog is imported into the application bundle.

Generation has **Equation walkthrough** and **Physics demonstration** structures. Requests send equation slots with `role: "latex"` and diagram slots with their exact IDs, current model, and SI parameters. The server prompt supplies the supported models and bounds, asks for the same question to be answered across scenes, and requires numerical answers, equations, diagrams, reasoning, and narration to agree. Ordinary copy slots stay plain prose. Scientific templates are picked automatically for relevant contexts or these explicit structures, and remain selectable manually.

Existing diagram slots preserve their supplied IDs. Templates with a reserved teaching area also let AI add one typed learning/physics/LaTeX visual; see [the addition contract](learning.md#ai-dapat-menambahkan-elemen-baru). Physics results must preserve the selected model and pass its parameter checks; equations are validated and rendered locally before voice generation or canvas insertion. Invalid results do not trigger automatic paid retries. These checks verify supported syntax and ranges, not the mathematical correctness of an arbitrary AI explanation; users review the equations, parameters, and script before adding frames.

Verification uses `node tests/science.check.mjs` for analytical states, parameter bounds, LaTeX rendering, and prompt/result contracts, plus `tests/science.spec.ts` for editing, invalid input, timed rendering, PNG exports, reloads, and mocked science generation. No paid model, speech, publishing, or provider-mutation calls are required.
