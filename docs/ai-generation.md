# AI generation with OpenCode

Genie uses `@opencode/client` 2.2+ for scene composition and writing. The default model is `beam-free`, preferring provider `opencode-go` when more than one provider exposes it. Codex, Cloudflare, and GPT-OSS 120B are disabled in the generation route and model overrides. Legacy Cloudflare settings remain readable in existing config files but are ignored.

## Connect

1. Install OpenCode 2 and connect your OpenCode Go provider in OpenCode.
2. Open **Setting → AI generation**, or **Generate → Settings**.
3. Leave the service URL blank to start/reuse the local service with `Service.ensure()`. Alternatively, enter a running service URL and optional bearer token. Save settings.
4. Choose **Load models** to check the saved connection and available models. This starts/reuses a service if necessary but does not run inference. Leave the model override blank for automatic Beam Free selection.
5. Enter a creative brief and each scene’s purpose, timing, tone, and direction, then choose **Generate frames**. Review the story, look, and storyboard before previewing motion or adding frames.

An unavailable Beam Free model produces an error without falling back to a different model. An explicit `provider/model` override must be present in the catalog and can consume provider credits. Provider authentication and model access are managed by OpenCode. A service token authenticates the HTTP service; it is not an OpenCode Go provider key.

Optional backend environment overrides:

| Variable         | Meaning                                                |
| ---------------- | ------------------------------------------------------ |
| `OPENCODE_URL`   | Service URL; overrides the saved URL                   |
| `OPENCODE_TOKEN` | Bearer token for URL mode; overrides the saved token   |
| `OPENCODE_MODEL` | Explicit `provider/model`; overrides the saved model   |
| `OPENCODE_BIN`   | OpenCode executable used when starting a local service |

Without `OPENCODE_BIN`, Genie checks `~/.opencode/bin/opencode` (`opencode.exe` on Windows), then the SDK uses `opencode` from PATH. An already registered compatible local service can be reused without starting another process. The packaged desktop app includes Node and the SDK; it does not include the OpenCode executable. No service is contacted when merely opening settings, browsing templates, or editing a canvas.

Saved settings live in local `config.json`:

```json
{ "opencode": { "url": "", "token": "", "model": "" } }
```

The UI receives only URL/model, mode, and whether a token exists. Tokens never go into canvases, exports, or model prompts. The app does not use the OS credential vault.

## Canvas, page, and scene contract

A canvas owns pages; the current page owns the generated frames. **Generate frames** sends one ordered sequence to OpenCode so questions, answers, diagrams, and narration can remain consistent across scenes. It does not create an assistant session or ask an agent to modify project files. Before inference, Genie reads the service’s `/openapi.json` and selects its advertised stateless text route: `/api/experimental/generate` on OpenCode 2.1.4, or `/api/experimental/generate/text` on newer services. The SDK retains input/output handling while its transport uses the supported path. If a proxy hides the schema with HTTP 404, Genie selects the original route (also supported as an alias by 2.2). It sends one generation POST; a model error never triggers a retry on another route. You do not need to upgrade OpenCode 2.1.4 for this integration.

Generate starts each scene from a blank frame with the standard Siswa Juara logo at top left and username at top right. It uses the selected frame’s dimensions, or 1080 × 1920 on an empty page. Custom standard branding remains supported. The content area stays below the header and above the default subtitle band. There is no template picker or alternate generation mode.

The request contains context, language, narration enabled, full semantic frame context, and 1–10 ordered scenes. Each scene supplies purpose, tone, duration, note, and a composition contract with frame dimensions and available asset references. The catalog contains up to 240 relevant metadata records from current canvas elements, built-in 3D illustrations with their default parameters, connected illustrations/video clips, and reusable object presets. Full template layouts are not candidates. The prompt shares each distinct asset catalog once across scenes. Asset metadata is reference data, not proof that the model has seen its pixels.

The model returns an original composition for every scene:

```json
{
  "post": { "name": "Read together", "caption": "Discuss a story with your child." },
  "story": {
    "idea": "A question turns reading into a conversation",
    "format": "Question and resolution",
    "device": "A recurring blue book",
    "look": "Warm paper and blue ink",
    "palette": ["#ffffff", "#0757ec", "#1b2a7a"]
  },
  "frames": [{
    "useCase": "question",
    "title": "Predict the next step",
    "texts": [],
    "narration": "[curious] Read the story together and ask what might happen next.",
    "motionPlan": "hold",
    "direction": {
      "action": "The book opens into a question",
      "framing": "close",
      "bridge": "Hold before revealing the answer"
    },
    "composition": {
      "background": "#ffffff",
      "layers": [{
        "type": "text", "name": "Question", "role": "headline",
        "text": "What happens next?", "x": 0, "y": 0, "w": 100, "h": 25,
        "fontSize": 6, "weight": 800, "align": "left", "color": "#1b2a7a"
      }]
    }
  }]
}
```

Each composition has 1–24 layers in drawing order: text, rectangle, ellipse, line, an exact asset reference, learning diagram, physics diagram, or LaTeX. Positions and sizes are percentages of the safe content area, mapped into pixels by the editor. The editor assigns IDs, embeds selected media, prepares diagrams, fits text, and creates ordinary editable layer/scene animation settings. The model never returns source URLs, file paths, SVG/HTML, executable code, publishing actions, or replacement canvas documents.

Assets load only when selected in a generated composition. Only selected assets embed into the resulting local canvas; browsing/generation never embeds the whole pack. Generation works without a pack using built-in branding, text, shapes, and typed teaching diagrams. Missing referenced media produces a review error before audio or canvas changes.

Every closing scene must contain visible `siswajuara.com`. Narrated closings must also say `siswajuara dot com` (or `siswajuara titik com`). The resolution and CTA copy follow the topic and audience; the default closing no longer introduces an unrelated academic-test pitch.

Validation rejects missing/reordered scenes, unsupported layers or animation, unknown asset references, invalid diagram parameters/LaTeX, out-of-area layouts or movement, repeated headlines, missing/unfinished narration, and absent closing destinations. Before approval, local preflight fits text, rejects overlapping text boxes, decodes placed media, and renders every scene. It does not verify source facts or infer unseen media. Legacy slot-based responses remain readable by internal compatibility helpers; the Generate dialog always requests blank compositions.

## Embedded animation direction

The story/frame/craft guidance and review sequence are adapted from the local `animate-main` and `opencode-animation-skill` Animate repositories. `sidecar/animation-direction.mjs` guides framework drafts; `sidecar/scene-composition.mjs` adds story devices, look, beat actions/framing/bridges, and editable composition/motion contracts. Both ship with the sidecar and retain the MIT notice in `sidecar/licenses/Animate.LICENSE`. Neither skill checkout is a runtime dependency.

The dialog follows **Story → Look → Storyboard → Animate**:

1. **Story** presents the idea, format, recurring visual device, look, palette, visible action, bridge, and narration for every beat. Review accuracy and change the direction before continuing. **Edit setup** allows explicit regeneration.
2. **Look** presents opening/middle/ending stills for comparing visual identity and varied staging. Scene layers can be adjusted before approval.
3. **Storyboard** shows every scene as a thumbnail, with a larger selected-scene preview and editable copy, placement, colours, diagrams, assets, narration, transition, and animation timing. Local preflight checks all scenes before approval.
4. **Animate** enables **Play scene motion** and adding frames, with optional ElevenLabs speech/captions. Editing scene content after approval returns to Storyboard for another check. No speech requests or canvas mutation occur during the first three reviews.

The model can choose default `motionPlan` (`hold`, `build`, `focus`, `compare`, `resolve`), per-layer reveal/idle motion, and 2–8 bounded movement keyframes. Keyframes use layer-local timing with normalized offsets; the editor converts them into its existing deterministic animation poses. Supported outgoing transitions are cut, crossfade, wipe, slide-left, and zoom. Layer-specific choreography takes precedence over scene defaults. Narration can extend scene duration while preserving the chosen transition and final layer state. Review stills, motion previews, playback, and export use the same renderer and ordinary document fields.

This adapts the skills’ workflow to Genie’s editable renderer. It does not execute their generated JavaScript, procedural style kits, shape-morph bridges, synthesizer, CLI/ffmpeg pipeline, automatic artwork generation, factual web checks, or measured beat/loudness tests. No additional model calls occur during review. Custom subtitle size, position, and offsets can still require layout adjustments.

## Narration and usage

Writing produces narration scripts. With narration enabled and a configured ElevenLabs account selected, **Add (n) frames** then requests speech for each narrated scene, embeds recordings, adds timed captions, and extends scene duration as needed. Disabling narration produces no speech calls. **Add without audio** retains scripts for later. Failed speech keeps the review and reuses already completed recordings on explicit retry.

The Narration panel header has a reload button that rewrites the current frame's script from its canvas text via OpenCode (`ai.narration`), keeping the draft language. It collects the frame's readable text layers in visual order, so empty frames stay disabled until text is added. Rewriting only replaces the script draft; generating audio still uses ElevenLabs explicitly.

The current OpenCode one-shot response reports text only. Genie returns `usage:null` and does not invent token counts, cost, or free-plan allowances. The selected provider/model is returned with the result. ElevenLabs costs remain based on provider responses. Model catalog and API schema checks time out after 30 seconds; writing after 180 seconds. HTTP 404 for catalog access, HTTP 404 during generation, and HTTP 422 for unsupported text models have separate errors; generation errors identify the selected model. Errors never silently switch models or automatically repeat a generation request.

## Verify without provider calls

```sh
node tests/generate.check.mjs
node tests/scene-composition.check.mjs
node tests/narration.check.mjs
node tests/subtitles.check.mjs
node tests/science.check.mjs
npm run build
npm run sidecar:prepare
npm run sidecar:check
npm run test:ui -- tests/generate.spec.ts tests/science.spec.ts
```

The generation checks use the actual SDK with a mocked HTTP service. They cover local startup injection, URL/token/environment settings, catalog selection, OpenCode 2.1.4 and 2.2 route shapes, service URL prefixes, hidden/unreadable schemas, unavailable models, no inference retries, error handling, JSON parsing, ordered scene validation, and selected voices. Browser checks mock all provider responses and verify settings, frame metadata, equations, physics, narration, and audio retries. Packaging checks import and exercise the staged native SDK without a real OpenCode service or inference.

SDK/API references: [OpenCode client](https://dev.opencode.ai/v2/docs/build/client/) and [API reference](https://dev.opencode.ai/v2/docs/api).

Generate and narration also receive a full semantic frame context, including hidden/locked layers, diagram results, SVG labels, captions, and media descriptions. Pixel/audio contents are not inferred from filenames; see [frame context and media limits](frame-context.md).
