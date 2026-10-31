import assert from "node:assert/strict";
import {
  buildScriptPrompt,
  parseGenerationResult,
} from "../sidecar/generate.mjs";
import { generateScript } from "../sidecar/opencode-generation.mjs";
import {
  connectOpenCode,
  extractJson,
  pickModel,
} from "../sidecar/opencode.mjs";
import {
  normalizeOpenCode,
  saveOpenCodeConfig,
} from "../sidecar/opencode-config.mjs";
import { createSocialService, publicConfig } from "../sidecar/social-core.mjs";
import { elevenLabsMedia } from "../sidecar/elevenlabs.mjs";

const config = {
  opencode: { url: "http://127.0.0.1:4096", token: "test-token" },
  tebar: { key: "" },
  elevenlabs: { accounts: [] },
};
const request = {
  content: "Teach parents to ask children about the story they read.",
  language: "en",
  narration: true,
  confirmed: true,
  scenes: [
    {
      useCase: "cover",
      tone: "warm",
      seconds: 6,
      narrate: true,
      note: "Start with a question",
      slots: [
        {
          id: "headline",
          label: "Headline",
          example: "Read together",
          maxChars: 80,
        },
      ],
    },
    {
      useCase: "list",
      tone: "curious",
      seconds: 8,
      narrate: false,
      note: "Three prompts",
      slots: [
        { id: "body", label: "Content", example: "1. Read", maxChars: 200 },
      ],
    },
  ],
};
const result = {
  post: {
    name: "Read together",
    caption: "Ask your child about the story. Try one question today.",
  },
  frames: [
    {
      useCase: "cover",
      title: "Read together",
      texts: [{ id: "headline", text: "What happened in the story?" }],
      narration: "[warm] Let's talk about the story you read together today.",
    },
    {
      useCase: "list",
      title: "Ask three questions",
      texts: [
        {
          id: "body",
          text: "Who was there?\nWhere were they?\nWhat happened?",
        },
      ],
      narration: "Must be removed",
    },
  ],
};
const prompt = buildScriptPrompt(request);
assert.match(prompt.system, /one true process/);
assert.match(prompt.system, /motionPlan/);
for (const motionPlan of ["hold", "build", "focus", "compare", "resolve"]) {
  const directed = structuredClone(result);
  directed.frames[0].motionPlan = motionPlan;
  assert.equal(parseGenerationResult(directed, request).frames[0].motionPlan, motionPlan);
}
for (const motionPlan of ["javascript", { code: "alert(1)" }, null, "constructor"]) {
  const invalid = structuredClone(result);
  invalid.frames[0].motionPlan = motionPlan;
  assert.throws(() => parseGenerationResult(invalid, request), /unsupported scene motion/);
}

assert.match(prompt.system, /English/);
assert.match(prompt.user, /Start with a question/);
assert.match(prompt.user, /curious/);
assert.match(prompt.system, /Never repeat a headline/);
assert.match(prompt.system, /Resolve every question/);
assert.match(
  buildScriptPrompt({
    ...request,
    scenes: [{ ...request.scenes[0], useCase: "image" }],
  }).user,
  /filled manually/,
);
assert.deepEqual(JSON.parse(prompt.user).scenes[0].narrationWords, {
  min: 9,
  max: 16,
});
assert.match(JSON.parse(prompt.user).scenes[1].purpose, /parallel/);
assert.equal(parseGenerationResult(result, request).frames[1].narration, "");
for (const invalid of [
  null,
  { ...request, language: "constructor" },
  { ...request, content: "short" },
  { ...request, scenes: [] },
  { ...request, scenes: [{ ...request.scenes[0], seconds: 0 }] },
])
  assert.throws(() => buildScriptPrompt(invalid));
for (const invalid of [
  { frames: [] },
  { frames: [...result.frames].reverse() },
  {
    frames: [
      { ...result.frames[0], texts: [{ id: "unknown", text: "Oops" }] },
      result.frames[1],
    ],
  },
  { frames: [{ ...result.frames[0], narration: "" }, result.frames[1]] },
  {
    frames: [
      {
        ...result.frames[0],
        texts: [{ id: "headline", text: "x".repeat(81) }],
      },
      result.frames[1],
    ],
  },
])
  assert.throws(() =>
    parseGenerationResult({ ...result, ...invalid }, request),
  );
for (const narration of [
  "[warm] Read together.",
  "[warm] Let's talk about the story you read together today",
]) {
  assert.throws(
    () =>
      parseGenerationResult(
        {
          ...result,
          frames: [{ ...result.frames[0], narration }, result.frames[1]],
        },
        request,
      ),
    /short or unfinished/,
  );
}
const duplicateRequest = structuredClone(request);
duplicateRequest.scenes.forEach((scene) => (scene.slots[0].role = "headline"));
const duplicate = structuredClone(result);
duplicate.frames[1].texts[0].text = result.frames[0].texts[0].text;
assert.throws(
  () => parseGenerationResult(duplicate, duplicateRequest),
  /repeats a headline/,
);
// Omitted physics echoes are repaired from the template; corrupt ones fail.
const withDiagram = {
  ...request,
  scenes: [
    {
      ...request.scenes[0],
      diagrams: [{ id: "swing", example: { kind: "pendulum" } }],
    },
    request.scenes[1],
  ],
};
const repairedPhysics = parseGenerationResult(result, withDiagram);
assert.equal(repairedPhysics.frames[0].physics.length, 1);
assert.equal(repairedPhysics.frames[0].physics[0].id, "swing");
assert.equal(repairedPhysics.frames[0].physics[0].settings.kind, "pendulum");
assert.match(repairedPhysics.repaired.join(" "), /Scene 1.*physics/);
for (const physics of [
  [{ id: "swing", settings: { kind: "spring", mass: 1 } }],
  "not-an-array",
])
  assert.throws(
    () =>
      parseGenerationResult(
        {
          ...result,
          frames: [{ ...result.frames[0], physics }, result.frames[1]],
        },
        withDiagram,
      ),
    /AI changed|invalid physics/,
  );

const calls = [];
const catalog = [
  { providerID: "other", id: "beam-free" },
  { providerID: "opencode-go", id: "beam-free" },
];
const runtime = { environment: {} };
const textPath = "/api/experimental/generate/text";
const legacyPath = "/api/experimental/generate";
const schemaFor = (path) => ({
  openapi: "3.1.0",
  paths: { [path]: { post: {} } },
});
const fetchImpl = async (input, options) => {
  const req = input instanceof Request ? input : new Request(input, options);
  calls.push(req.url);
  assert.equal(req.headers.get("authorization"), "Bearer test-token");
  if (new URL(req.url).pathname === "/openapi.json")
    return Response.json(schemaFor(textPath));
  if (req.method === "GET") {
    assert.equal(req.url, "http://127.0.0.1:4096/api/model");
    return Response.json({ data: catalog });
  }
  assert.equal(req.url, "http://127.0.0.1:4096/api/experimental/generate/text");
  const body = await req.json();
  assert.deepEqual(body.model, { providerID: "opencode-go", id: "beam-free" });
  assert.match(body.prompt, /canvas owns pages/);
  assert.match(body.prompt, /Return JSON only/);
  return Response.json({
    data: {
      text: `Here is the result:\n\`\`\`json\n${JSON.stringify(result)}\n\`\`\``,
    },
  });
};
const service = createSocialService({ fetchImpl, opencodeRuntime: runtime });
const generated = await service.dispatch(config, "ai.generate", request);
assert.equal(generated.usage, null);
assert.deepEqual(generated.model, {
  providerID: "opencode-go",
  id: "beam-free",
});
assert.equal(generated.frames.length, 2);
assert.equal(generated.frames[1].narration, "");
assert.equal(calls.length, 3);
await assert.rejects(
  generateScript(config, { ...request, confirmed: false }, fetchImpl, runtime),
  /explicitly/,
);
assert.equal(calls.length, 3);
assert.deepEqual(
  await service.dispatch(config, "ai.models"),
  catalog.map((m) => ({ ...m, name: m.id })),
);
assert.equal(calls.length, 4); // Catalog checks never invoke generation.
assert.throws(
  () => pickModel([{ providerID: "paid", id: "expensive" }]),
  /Beam Free/,
);
assert.throws(() => pickModel(catalog, "missing/model"), /unavailable/);
assert.deepEqual(pickModel(catalog, "other/beam-free"), catalog[0]);
for (const status of [403, 429, 404]) {
  await assert.rejects(
    generateScript(
      config,
      request,
      async () => new Response("test-token", { status }),
      runtime,
    ),
    status === 403 ? /authentication/ : status === 429 ? /rate limit/ : /API/,
  );
}
await assert.rejects(
  generateScript(
    config,
    request,
    async () => {
      throw Error("test-token");
    },
    runtime,
  ),
  /service connection/,
);
await assert.rejects(
  generateScript(
    config,
    request,
    async () =>
      Response.json({ data: [{ providerID: "paid", id: "expensive" }] }),
    runtime,
  ),
  /No other model/,
);
let failedGenerationCalls = 0;
await assert.rejects(
  generateScript(
    config,
    request,
    async (input, init) => {
      const req = new Request(input, init);
      if (new URL(req.url).pathname === "/openapi.json")
        return Response.json(schemaFor(textPath));
      if (req.method === "GET") return Response.json({ data: catalog });
      failedGenerationCalls++;
      return new Response("provider-private-details", { status: 429 });
    },
    runtime,
  ),
  /no fallback model/,
);
assert.equal(failedGenerationCalls, 1); // No automatic inference retry.
await assert.rejects(
  generateScript(
    config,
    request,
    async (input, init) => {
      const req = new Request(input, init);
      return new URL(req.url).pathname === "/openapi.json"
        ? Response.json(schemaFor(textPath))
        : Response.json({
            data: req.method === "GET" ? catalog : { text: "unfinished JSON" },
          });
    },
    runtime,
  ),
  /valid scene JSON/,
);
// Actual SDK against both real API shapes: 2.1.4 legacy and 2.2 current.
for (const generationPath of [legacyPath, textPath]) {
  for (const basePath of ["", "/opencode"]) {
    const observed = [];
    const response = await generateScript(
      {
        ...config,
        opencode: {
          ...config.opencode,
          url: `http://127.0.0.1:4096${basePath}`,
        },
      },
      request,
      async (input, init) => {
        const req = new Request(input, init),
          pathname = new URL(req.url).pathname;
        observed.push(`${req.method} ${pathname}`);
        assert.equal(req.headers.get("authorization"), "Bearer test-token");
        assert.equal(req.redirect, "error");
        if (pathname === `${basePath}/api/model`)
          return Response.json({ data: catalog });
        if (pathname === `${basePath}/openapi.json`)
          return Response.json(schemaFor(generationPath));
        assert.equal(pathname, `${basePath}${generationPath}`);
        assert.equal(req.method, "POST");
        assert.deepEqual((await req.json()).model, {
          providerID: "opencode-go",
          id: "beam-free",
        });
        return Response.json({ data: { text: JSON.stringify(result) } });
      },
      runtime,
    );
    assert.equal(response.frames.length, 2);
    assert.deepEqual(observed, [
      `GET ${basePath}/api/model`,
      `GET ${basePath}/openapi.json`,
      `POST ${basePath}${generationPath}`,
    ]);
  }
}
for (const scenario of [
  "hidden-schema",
  "no-generation-api",
  "unreadable-schema",
  "model-missing",
  "model-unsupported",
]) {
  let posts = 0;
  const run = () =>
    generateScript(
      config,
      request,
      async (input, init) => {
        const req = new Request(input, init),
          pathname = new URL(req.url).pathname;
        if (pathname === "/api/model") return Response.json({ data: catalog });
        if (pathname === "/openapi.json") {
          if (scenario === "hidden-schema")
            return new Response(null, { status: 404 });
          if (scenario === "no-generation-api")
            return Response.json({ paths: {} });
          if (scenario === "unreadable-schema")
            return new Response("<html>Wrong service</html>");
          return Response.json(schemaFor(textPath));
        }
        posts++;
        if (scenario === "model-missing" || scenario === "model-unsupported")
          return new Response("provider-private-details", {
            status: scenario === "model-missing" ? 404 : 422,
          });
        assert.equal(pathname, legacyPath);
        return Response.json({ data: { text: JSON.stringify(result) } });
      },
      runtime,
    );
  if (scenario === "hidden-schema")
    assert.equal((await run()).frames.length, 2);
  else
    await assert.rejects(
      run(),
      scenario === "no-generation-api"
        ? /does not advertise/
        : scenario === "unreadable-schema"
          ? /unreadable API description/
          : scenario === "model-missing"
            ? /opencode-go\/beam-free.*HTTP 404/
            : /opencode-go\/beam-free.*HTTP 422/,
    );
  assert.equal(
    posts,
    ["hidden-schema", "model-missing", "model-unsupported"].includes(scenario)
      ? 1
      : 0,
  );
}
let ensured = 0;
const local = await connectOpenCode({ opencode: {} }, fetchImpl, {
  environment: {},
  service: {
    ensure: async () => {
      ensured++;
      return { url: "http://127.0.0.1:4096" };
    },
    headers: () => ({ authorization: "Bearer test-token" }),
  },
});
assert.equal(ensured, 1);
await local.client.model.list();
let envAuth = "";
const remote = await connectOpenCode(
  config,
  async (input, init) => {
    const req = new Request(input, init);
    envAuth = req.headers.get("authorization");
    assert.equal(new URL(req.url).host, "example.test");
    return Response.json({ data: catalog });
  },
  {
    environment: {
      OPENCODE_URL: "https://example.test",
      OPENCODE_TOKEN: "override",
      OPENCODE_MODEL: "other/beam-free",
    },
    service: { ensure: () => assert.fail("URL mode must not start a service") },
  },
);
await remote.client.model.list();
assert.equal(envAuth, "Bearer override");
assert.equal(remote.settings.model, "other/beam-free");
for (const model of [
  "codex/model",
  "cloudflare/model",
  "provider/gpt-oss-120b",
  "invalid",
])
  assert.throws(() => normalizeOpenCode({ model }));
for (const url of [
  "file:///tmp",
  "https://user:password@example.test",
  "https://example.test?key=secret",
])
  assert.throws(() => normalizeOpenCode({ url }));
assert.throws(() => normalizeOpenCode({ token: "test\r\nsecret" }));
saveOpenCodeConfig(config, { model: "opencode-go/beam-free" });
assert.equal(config.opencode.token, "test-token");
assert.ok(!JSON.stringify(publicConfig(config, "file")).includes("test-token"));
saveOpenCodeConfig(config, { removeToken: true });
assert.equal(config.opencode.token, "");
assert.deepEqual(
  extractJson(
    'Comment {"answer":"brace } and escaped \\"quote\\""} trailing {bad}',
  ),
  { answer: 'brace } and escaped "quote"' },
);
assert.throws(() => extractJson("no JSON"));

// Selected voices reach the provider; invalid IDs fail before any paid request.
const voiceConfig = {
  elevenlabs: { accounts: [{ id: "studio", key: "audio-key", enabled: true }] },
};
await assert.rejects(
  elevenLabsMedia(
    voiceConfig,
    "elevenlabs.speech",
    {
      accountId: "studio",
      text: "Hello",
      voiceId: "../../bad",
      confirmed: true,
    },
    fetchImpl,
  ),
  /valid ElevenLabs voice/,
);
let voiceCalls = 0;
await elevenLabsMedia(
  voiceConfig,
  "elevenlabs.speech",
  {
    accountId: "studio",
    text: "Hello",
    voiceId: "SelectedVoice123",
    confirmed: true,
  },
  async (url) => {
    voiceCalls++;
    assert.match(url, /text-to-speech\/SelectedVoice123\//);
    return Response.json({
      audio_base64: "AAAA",
      alignment: {
        characters: ["H"],
        character_start_times_seconds: [0],
        character_end_times_seconds: [1],
      },
    });
  },
);
assert.equal(voiceCalls, 1);
console.log(
  "PASS: generation prompts, validation, OpenCode SDK (2.1/2.2 routes, proxy prefixes, and no inference retries), automatic Beam Free selection, local/URL connection, unavailable-model and auth handling, secret handling, and selected voices (mocked providers).",
);
