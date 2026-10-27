import assert from "node:assert/strict";
import {
  buildNarrationPrompt,
  parseNarrationResult,
} from "../sidecar/opencode-narration.mjs";
import { generateNarration } from "../sidecar/opencode-narration.mjs";
import { createSocialService } from "../sidecar/social-core.mjs";

const config = {
  opencode: { url: "http://127.0.0.1:4096", token: "test-token" },
  buffer: { key: "" },
  zernio: { key: "" },
  elevenlabs: { accounts: [] },
};
const request = {
  texts:
    "COBA BACA CERITA INI\nSepulang sekolah, hujan turun deras. Raka lupa membawa payung.",
  language: "id",
  seconds: 6,
  currentScript: "[encouraging] Old script.",
  confirmed: true,
};
const narration =
  "[encouraging] [warm] Baca cerita hujan, lalu minta anak menceritakan kembali dengan kata sendiri.";
const result = { narration };

const prompt = buildNarrationPrompt(request);
assert.match(prompt.system, /Indonesian/);
assert.match(prompt.system, /Return JSON only/);
assert.match(prompt.system, /at most 2 English/);
assert.match(prompt.user, /COBA BACA/);
assert.deepEqual(JSON.parse(prompt.user).targetWords, { min: 9, max: 16 });
assert.match(
  buildNarrationPrompt({ ...request, language: "en" }).system,
  /in English/,
);
assert.deepEqual(parseNarrationResult(result, request), { narration });
for (const invalid of [
  null,
  { ...request, texts: "  " },
  { ...request, texts: "x".repeat(12001) },
  { ...request, language: "fr" },
  { ...request, seconds: 0 },
  { ...request, seconds: 601 },
  { ...request, currentScript: "x".repeat(5001) },
])
  assert.throws(() => buildNarrationPrompt(invalid));
for (const invalid of [
  {},
  { narration: "  " },
  { narration: "x".repeat(1501) },
  { narration: "Too short." },
  { narration: "No punctuation at the end" },
])
  assert.throws(
    () => parseNarrationResult(invalid, request),
    /invalid|short or unfinished/,
  );

const catalog = [
  { providerID: "other", id: "beam-free" },
  { providerID: "opencode-go", id: "beam-free" },
];
const runtime = { environment: {} };
const calls = [];
const fetchImpl = async (input, options) => {
  const req = input instanceof Request ? input : new Request(input, options);
  calls.push(req.url);
  assert.equal(req.headers.get("authorization"), "Bearer test-token");
  if (new URL(req.url).pathname === "/openapi.json")
    return Response.json({
      openapi: "3.1.0",
      paths: { "/api/experimental/generate/text": { post: {} } },
    });
  if (req.method === "GET") {
    assert.equal(req.url, "http://127.0.0.1:4096/api/model");
    return Response.json({ data: catalog });
  }
  assert.equal(req.url, "http://127.0.0.1:4096/api/experimental/generate/text");
  const body = await req.json();
  assert.deepEqual(body.model, { providerID: "opencode-go", id: "beam-free" });
  assert.match(body.prompt, /Rewrite the spoken narration/);
  assert.match(body.prompt, /COBA BACA/);
  return Response.json({
    data: { text: `Result:\n\`\`\`json\n${JSON.stringify(result)}\n\`\`\`` },
  });
};
const service = createSocialService({ fetchImpl, opencodeRuntime: runtime });
const rewritten = await service.dispatch(config, "ai.narration", request);
assert.equal(rewritten.narration, narration);
assert.equal(rewritten.usage, null);
assert.deepEqual(rewritten.model, {
  providerID: "opencode-go",
  id: "beam-free",
});
assert.equal(calls.length, 3);
await assert.rejects(
  generateNarration(
    config,
    { ...request, confirmed: false },
    fetchImpl,
    runtime,
  ),
  /explicitly/,
);
assert.equal(calls.length, 3);
await assert.rejects(
  generateNarration(config, { ...request, texts: "  " }, fetchImpl, runtime),
  /readable text/,
);
assert.equal(calls.length, 3); // Validation fails before any provider call.
console.log(
  "PASS: narration rewrite prompt, validation, dispatch, and no-retry generation (mocked providers).",
);
