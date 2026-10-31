import assert from "node:assert/strict";
import {
  buildContentDraftPrompt,
  parseContentDraft,
  generateContentDraft,
} from "../sidecar/opencode-generation.mjs";
import { createSocialService } from "../sidecar/social-core.mjs";
const request = {
  confirmed: true,
  framework: "PAS",
  material: JSON.stringify({
    title: "Belajar pecahan kelas 6",
    answer: "B",
    explanation: "Dua dari empat sama dengan setengah.",
  }),
};
const output = {
  script: {
    Problem: "Sulit memahami pecahan?",
    Agitate: "Bagi menjadi bagian yang sama.",
    Solve: "Dua dari empat sama dengan setengah.",
  },
  caption: "Belajar bersama.",
  hashtags: "#Belajar",
};
assert.match(buildContentDraftPrompt(request), /reference data/);
assert.deepEqual(parseContentDraft(output, request), output);
for (const invalid of [
  {},
  { ...output, script: {} },
  { ...output, script: { ...output.script, other: "extra" } },
  { ...output, caption: 1 },
])
  assert.throws(() => parseContentDraft(invalid, request));
for (const invalid of [
  {},
  { ...request, framework: "unknown" },
  { ...request, material: "x".repeat(100001) },
])
  assert.throws(() => buildContentDraftPrompt(invalid));
const calls = [];
const fetchImpl = async (input, options) => {
  const req = input instanceof Request ? input : new Request(input, options);
  calls.push(req);
  if (new URL(req.url).pathname === "/openapi.json")
    return Response.json({
      paths: { "/api/experimental/generate/text": { post: {} } },
    });
  if (req.method === "GET")
    return Response.json({
      data: [{ providerID: "opencode-go", id: "beam-free" }],
    });
  const body = await req.json();
  assert.deepEqual(body.model, { providerID: "opencode-go", id: "beam-free" });
  assert.match(body.prompt, /Problem · Agitate · Solve/);
  assert.match(body.prompt, /Dua dari empat/);
  return Response.json({ data: { text: JSON.stringify(output) } });
};
const config = { opencode: { url: "http://localhost:4096" } };
const runtime = { env: {} };
const service = createSocialService({ fetchImpl, opencodeRuntime: runtime });
const result = await service.dispatch(config, "ai.content-draft", request);
assert.deepEqual(result.script, output.script);
assert.equal(result.usage, null);
assert.equal(calls.filter((r) => r.method === "POST").length, 1);
const count = calls.length;
await assert.rejects(
  generateContentDraft(
    config,
    { ...request, confirmed: false },
    fetchImpl,
    runtime,
  ),
  /explicitly/,
);
assert.equal(calls.length, count);
console.log(
  "PASS: Content Studio drafts use validated framework JSON, the stateless SDK, Beam Free, and explicit generation (mocked).",
);
