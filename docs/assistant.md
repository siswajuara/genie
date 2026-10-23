# Assistant controls

Idea and Canvas chat use the installed Codex CLI through the official Codex SDK. The app exposes supported SDK choices explicitly; Codex capabilities do not automatically create interface controls.

Select the model/settings control above the message box to open:

- Model selection, populated by the local CLI's app-server `model/list` protocol. **Codex default** leaves the model unset, respecting the user's Codex configuration. A custom identifier remains available under Advanced connection if discovery fails or a provider uses an unlisted model.
- Reasoning effort, using the chosen model's reported options intersected with the bundled SDK's supported values: minimal, low, medium, high, and xhigh. This integration does not expose unsupported future effort values. Higher effort can increase latency and token use. Selecting another model resets effort to its default.
- Web search: inherit Codex settings, off, cached, or live. Availability also depends on model/provider policy.
- Account connection and plan, plus quota windows when the local CLI returns them. Refresh updates the catalogue and account information. Quota information is a snapshot, not a live subscription.
- Advanced custom model/CLI path, installation check, and access to conversation working files.

Choices are saved locally for each canvas and apply to the next message, including resumed conversations. Existing thread history is retained when changing model. Skills, Discuss/Draw, canvas conflict review, version history, streamed responses, activity, and cancellation continue to use the existing flow. Search, task-list, and MCP activity include more useful detail.

Completed turns show input, output, and cached-input token counts from SDK `turn.completed.usage` events. Totals accumulate locally from turns recorded after this feature is enabled. Cached tokens are a subset of input, not added to the total again. These numbers describe token activity; they are not a context-capacity gauge, account balance, or billing estimate. Failed/interrupted turns without a completion usage event are not counted.

## Integration

`src/components/AssistantSettings.tsx` loads capabilities through the native `codex_capabilities` command. The native command launches the existing Node bridge with `--capabilities`. `sidecar/codex-capabilities.mjs` initializes a temporary Codex app-server over stdio, reads paginated model metadata and account information, optionally reads ChatGPT quota windows, then closes the process. It starts no inference turn. Credentials are managed by Codex and are not returned to React. Metadata reads time out and report errors without blocking use of default/custom model configuration.

`sidecar/codex-options.mjs` validates preferences and maps them to `ThreadOptions.model`, `modelReasoningEffort`, and `webSearchMode`. The same options are used for new and resumed threads. The app's existing workspace sandbox is retained. The sidecar preparation script bundles both modules on every supported platform.

This is an SDK integration with a read-only app-server metadata connection. Interactive approval requests, mid-turn steering, attachment uploads, and a complete app-server session lifecycle are not implemented by these controls. A catalogue can be cached or bundled and does not itself prove access to every model. Actual availability is established when the user's chosen model accepts a turn.

macOS signature verification still applies before using the CLI. If the installed executable fails verification, use a valid signed official CLI or a properly signed app build. The controls display that error; they do not weaken verification.

References: [official Codex SDK](https://developers.openai.com/codex/sdk/), [app-server model and account protocol](https://developers.openai.com/codex/app-server/), [catalogue and access distinction](https://developers.openai.com/siwc/token-sharing-open-source/codex-app-server).
