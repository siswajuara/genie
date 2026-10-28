# AI generation with OpenCode

Genie uses `@opencode/client` 2.2+ for writing. The default model is `beam-free`, preferring provider `opencode-go` when more than one provider exposes it. Codex, Cloudflare, and GPT-OSS 120B are disabled in the generation route and model overrides. Legacy Cloudflare settings remain readable in existing config files but are ignored.

## Connect

1. Install OpenCode 2 and connect your OpenCode Go provider in OpenCode.
2. Open **Setting → AI generation**, or **Generate → Settings**.
3. Leave the service URL blank to start/reuse the local service with `Service.ensure()`. Alternatively, enter a running service URL and optional bearer token. Save settings.
4. Choose **Load models** to check the saved connection and available models. This starts/reuses a service if necessary but does not run inference. Leave the model override blank for automatic Beam Free selection.
5. Enter context, pick a template and purpose per scene, then choose **Generate frames**.

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

The request contains context, language, narration enabled, and 1–10 scenes in order. Each scene supplies purpose, tone, duration, narration enabled, note, editable slots with exact IDs/roles/examples/capacities, any typed physics/learning diagrams, and permission to add a teaching visual when a reserved area exists. Fixed branding, badges, and page numbering are excluded from editable text slots. The prompt follows [canvas ownership](canvas.md), [scene timing and animation](animation.md), and [LaTeX/physics capabilities](science.md).

The model returns JSON content in this form:

```json
{
  "post": {
    "name": "Pendulum lesson",
    "caption": "Compare two pendulum lengths and explain the difference."
  },
  "frames": [
    {
      "useCase": "question",
      "title": "Predict the period",
      "texts": [
        { "id": "supplied-headline-id", "text": "Which pendulum takes longer?" }
      ],
      "narration": "[curious] Compare both lengths and predict which pendulum takes longer to complete one swing."
    }
  ]
}
```

This is a structural example: the returned frame count, use cases, and text IDs must match the actual selected sequence. Diagram scenes also return `physics:[{id,settings}]`, keeping the supplied diagram IDs and model kinds. Equation slots return math-only LaTeX, with JSON-escaped backslashes. Scenes with `allowVisual:true` may additionally return one optional typed `visual` (learning, physics, or LaTeX), selected from the supplied teaching catalog. The app assigns its ID and places it inside the template’s reserved `teachingArea`. Existing learning slots return `learning:[{id,settings}]`. The model cannot supply geometry, IDs, assets, executable code, or replacement canvas documents. See [SD–SMP models and the addition contract](learning.md).

| Model output / chosen setting        | Local result when frames are added                                             |
| ------------------------------------ | ------------------------------------------------------------------------------ |
| Ordered `frames`                     | New frames appended to the current page; existing content preserved            |
| Frame `title`, `texts`, `physics`    | Frame name and editable layers in the chosen templates                         |
| Chosen scene duration/transition     | `frame.scene`, with narration extending timing when needed                     |
| Frame `narration`                    | Local `voiceoverDraft`; optional ElevenLabs audio and matching captions        |
| Post `name`, `caption`               | Current page document's `metadata.post`, alongside locally assigned `frameIds` |
| Canvas/page/frame IDs and timestamps | Assigned or preserved by the local editor                                      |

Validation rejects missing/reordered scenes, missing or duplicated slot IDs, overflowing copy, repeated headlines, missing/unfinished narration, invalid LaTeX, unsupported physics parameters or changed model kinds. If the model omits a physics or learning echo, the template's current diagram settings are kept and the review notes which scene was repaired; anything the model did return is still checked strictly. The prompt requires complete question/answer reasoning, consistent SI units, and distinct scene purposes. Review remains editable before any canvas mutation. Existing animation and template geometry stay under app control.

## Narration and usage

Writing produces narration scripts. With narration enabled and a configured ElevenLabs account selected, **Add (n) frames** then requests speech for each narrated scene, embeds recordings, adds timed captions, and extends scene duration as needed. Disabling narration produces no speech calls. **Add without audio** retains scripts for later. Failed speech keeps the review and reuses already completed recordings on explicit retry.

The Narration panel header has a reload button that rewrites the current frame's script from its canvas text via OpenCode (`ai.narration`), keeping the draft language. It collects the frame's readable text layers in visual order, so empty frames stay disabled until text is added. Rewriting only replaces the script draft; generating audio still uses ElevenLabs explicitly.

The current OpenCode one-shot response reports text only. Genie returns `usage:null` and does not invent token counts, cost, or free-plan allowances. The selected provider/model is returned with the result. ElevenLabs costs remain based on provider responses. Model catalog and API schema checks time out after 30 seconds; writing after 180 seconds. HTTP 404 for catalog access, HTTP 404 during generation, and HTTP 422 for unsupported text models have separate errors; generation errors identify the selected model. Errors never silently switch models or automatically repeat a generation request.

## Verify without provider calls

```sh
node tests/generate.check.mjs
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
