import { test } from "node:test";
import assert from "node:assert/strict";
import { modelCatalog, threadOptions } from "../sidecar/codex-options.mjs";

test("turn choices reach SDK options without changing the conversation sandbox", () => {
  const options = threadOptions(
    {
      model: "example-model",
      reasoningEffort: "high",
      webSearchMode: "live",
      sandboxMode: "danger-full-access",
    },
    "/local/chat",
  );
  assert.equal(options.model, "example-model");
  assert.equal(options.modelReasoningEffort, "high");
  assert.equal(options.webSearchMode, "live");
  assert.equal(options.sandboxMode, "workspace-write");
  assert.equal(options.approvalPolicy, "never");
  const defaults = threadOptions(
    { reasoningEffort: "default", webSearchMode: "default" },
    "/local/chat",
  );
  assert.equal("modelReasoningEffort" in defaults, false);
  assert.equal("webSearchMode" in defaults, false);
  assert.throws(() =>
    threadOptions({ reasoningEffort: "unsupported" }, "/local/chat"),
  );
  assert.throws(() =>
    threadOptions({ webSearchMode: "unsupported" }, "/local/chat"),
  );
});
test("catalogue preserves reported model names and exposes only supported effort values", () => {
  const result = modelCatalog([
    {
      model: "example-model",
      displayName: "Example",
      isDefault: true,
      supportedReasoningEfforts: [
        { reasoningEffort: "low", description: "Faster" },
        { reasoningEffort: "future-value" },
      ],
    },
    { model: "hidden-model", hidden: true },
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, "example-model");
  assert.equal(result[0].label, "Example");
  assert.deepEqual(result[0].efforts, [
    { value: "low", description: "Faster" },
  ]);
});
