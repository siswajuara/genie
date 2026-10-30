import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createSocialService, publicConfig } from "../sidecar/social-core.mjs";
import { captureUsage, assertRequestBudget } from "../sidecar/social-usage.mjs";
import { readConfig, jsonWriter } from "../sidecar/local-json.mjs";

const config = (profileId = "workspace-1", key = "private-tebar-key") => ({ tebar: { key, profileId }, elevenlabs: {}, opencode: {} });
const account = (id = "account-1", overrides = {}) => ({ id, profile_id: "workspace-1", platform: "threads", display_name: "Studio", username: "studio", status: "active", plan_suspended: false, ...overrides });
const profile = { id: "workspace-1", name: "Studio", is_default: true };
function harness(handler, { state = {}, persist = async () => {} } = {}) {
  const calls = [];
  const service = createSocialService({ state, persist, fetchImpl: async (input, init = {}) => {
    const url = new URL(input);
    assert.equal(url.origin, "https://api.tebar.app");
    assert.equal(init.headers.Authorization?.startsWith("Bearer "), true);
    assert.equal(init.redirect, "error");
    const call = { url, ...init }; calls.push(call);
    const result = await handler(call, calls);
    if (result) return result;
    if (url.pathname === "/v1/accounts") return Response.json({ data: [account()] });
    if (url.pathname === "/v1/profiles") return Response.json({ data: [profile], next_cursor: null });
    if (url.pathname === "/v1/me") return Response.json({ user: { id: "user" }, auth: { scopes: ["read", "write"] } });
    throw Error(`Unexpected request ${url}`);
  } });
  return { service, calls, state };
}
const publish = (overrides = {}) => ({ confirmed: true, requestId: "submission-1", mode: "now", content: "Hello", accountKeys: ["tebar:account-1"], media: [], ...overrides });
const accepted = (body, status = "publishing") => Response.json({ id: "post-1", status, targets: body.targets.map((t) => ({ ...t, status: "pending" })) }, { status: 201 });

test("only Tebar is public; config preserves unrelated settings without using legacy providers", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "genie-social-test-"));
  try {
    const filename = path.join(directory, "config.json");
    const original = { buffer: { key: "old-key" }, zernio: { key: "old-key-2" }, soniox: { key: "reserved" }, custom: { retained: true } };
    await jsonWriter(filename)(original);
    const settings = await readConfig(filename);
    assert.equal(settings.tebar.key, "");
    assert.deepEqual(settings.custom, original.custom);
    const publicSettings = publicConfig({ ...settings, tebar: config().tebar }, "file");
    assert.deepEqual(publicSettings.tebar, { configured: true, profileId: "workspace-1" });
    assert.equal("buffer" in publicSettings, false);
    assert.equal("zernio" in publicSettings, false);
    assert.equal(JSON.stringify(publicSettings).includes("private-tebar-key"), false);
    const h = harness(() => { throw Error("No legacy requests allowed"); });
    assert.deepEqual((await h.service.dispatch(settings, "accounts")).accounts, []);
    await assert.rejects(h.service.dispatch(settings, "usage", { provider: "buffer" }), /only social provider/);
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});

test("owner discovery maps status and suspension, paginates workspaces, caches and refreshes", async () => {
  const h = harness(({ url }) => {
    if (url.pathname === "/v1/accounts") return Response.json({ data: [account(), account("expired", { status: "expired" }), account("suspended", { plan_suspended: true })] });
    if (url.pathname === "/v1/profiles") return Response.json({ data: url.searchParams.has("cursor") ? [{ id: "workspace-2", name: "Team" }] : [profile], next_cursor: url.searchParams.has("cursor") ? null : "page-2" });
  });
  const data = await h.service.dispatch(config(), "accounts");
  assert.deepEqual(data.accounts.map((a) => a.active), [true, false, false]);
  assert.equal(data.accounts[0].key, "tebar:account-1");
  assert.equal(data.profiles.length, 2);
  assert.equal(data.ownerKey, true);
  assert.equal(h.calls[0].headers["Tebar-Profile"], "workspace-1");
  assert.equal(h.calls[1].headers["Tebar-Profile"], undefined);
  await h.service.dispatch(config(), "accounts"); assert.equal(h.calls.length, 3);
  await h.service.dispatch(config(), "accounts", { refresh: true }); assert.equal(h.calls.length, 6);
  await h.service.dispatch(config("workspace-2"), "accounts"); assert.equal(h.calls.length, 9);
  await h.service.dispatch(config("workspace-2", "changed-key"), "accounts"); assert.equal(h.calls.length, 12);
});

test("profile keys tolerate owner_key_required and still verify and publish", async () => {
  const h = harness(({ url, body, headers }) => {
    if (url.pathname === "/v1/profiles") return Response.json({ error: { code: "owner_key_required", message: "Owner only" } }, { status: 403 });
    if (url.pathname === "/v1/posts") { assert.equal(headers["Tebar-Profile"], "workspace-1"); return accepted(JSON.parse(body)); }
  });
  const result = await h.service.dispatch(config(""), "test", { provider: "tebar" });
  assert.equal(result.issues.length, 0); assert.equal(result.ownerKey, false); assert.deepEqual(result.scopes, ["read", "write"]);
  assert.equal((await h.service.dispatch(config(""), "publish", publish())).results[0].success, true);
  assert.equal((await h.service.dispatch(config(""), "connect")).url, "https://publish.tebar.app");
});

test("media uploads send raw bytes or import a URL and return media IDs", async () => {
  const bytes = Buffer.from("mock image bytes");
  const h = harness(({ url, body, headers }) => {
    assert.equal(headers["Tebar-Profile"], "workspace-1");
    if (url.pathname === "/v1/media/upload") { assert.deepEqual(body, bytes); assert.equal(headers["Content-Type"], "image/png"); }
    else { assert.equal(url.pathname, "/v1/media/from-url"); assert.deepEqual(JSON.parse(body), { url: "https://example.com/image.png" }); }
    return Response.json({ id: "media-1", type: "image", status: "ready" }, { status: 201 });
  });
  const payload = { confirmed: true, data: bytes.toString("base64"), contentType: "image/png" };
  assert.deepEqual(await h.service.dispatch(config(), "upload", payload), { id: "media-1", type: "image" });
  assert.deepEqual(await h.service.dispatch(config(), "upload", { confirmed: true, url: "https://example.com/image.png" }), { id: "media-1", type: "image" });
  await assert.rejects(h.service.dispatch(config(), "upload", { ...payload, confirmed: false }), /Confirm/);
  await assert.rejects(h.service.dispatch(config(), "upload", { ...payload, contentType: "image/svg+xml" }), /JPEG/);
  await assert.rejects(h.service.dispatch(config(), "upload", { ...payload, data: Buffer.alloc(8 * 1024 * 1024 + 1).toString("base64") }), /8 MB/);
  await assert.rejects(h.service.dispatch(config(), "upload", { confirmed: true, url: "https://127.0.0.1/image.png" }), /public HTTPS/);
  assert.equal(h.calls.length, 2);
});

test("publishing sends one ordered multi-target post with workspace, schedule, options, and stable idempotency", async () => {
  let writes = 0;
  const h = harness(({ url, body, headers }) => {
    if (url.pathname === "/v1/accounts") return Response.json({ data: [account(), account("account-2", { platform: "youtube" })] });
    if (url.pathname === "/v1/posts") {
      writes++;
      const parsed = JSON.parse(body);
      assert.deepEqual(parsed.media_ids, ["media-2", "media-1"]);
      assert.equal(parsed.scheduled_at, "2099-01-01T02:00:00.000Z");
      assert.deepEqual(parsed.targets[1], { account_id: "account-2", options: { title: "Learning", made_for_kids: true } });
      assert.match(headers["Idempotency-Key"], /^[a-f0-9]{64}$/);
      assert.equal(headers["Tebar-Profile"], "workspace-1");
      return accepted(parsed, "scheduled");
    }
  });
  const payload = publish({ mode: "schedule", scheduledFor: "2099-01-01T09:00:00+07:00", accountKeys: ["tebar:account-2", "tebar:account-1"], media: [{ id: "media-2", type: "image" }, { id: "media-1", type: "image" }], accountOptions: { "tebar:account-2": { title: "Learning", made_for_kids: true } } });
  const result = await h.service.dispatch(config(), "publish", payload);
  assert.equal(result.results.length, 2); assert.equal(result.results[0].status, "scheduled");
  assert.deepEqual(await h.service.dispatch(config(), "publish", payload), result); assert.equal(writes, 1);
  await assert.rejects(h.service.dispatch(config(), "publish", { ...payload, content: "changed" }), /different content/);
});

test("confirmation, local-only drafts, invalid channels and mixed workspaces never create posts", async () => {
  const h = harness(({ url }) => url.pathname === "/v1/accounts" ? Response.json({ data: [account(), account("other", { profile_id: "workspace-2" }), account("inactive", { status: "expired" })] }) : undefined);
  for (const payload of [publish({ confirmed: false }), publish({ mode: "draft" }), publish({ accountKeys: ["buffer:old"] }), publish({ accountKeys: ["tebar:inactive"] }), publish({ accountKeys: ["tebar:account-1", "tebar:other"] }), publish({ mode: "schedule", scheduledFor: "2000-01-01T00:00:00Z" })]) await assert.rejects(h.service.dispatch(config(""), "publish", payload));
  assert.equal(h.calls.some((c) => c.method === "POST"), false);
});

test("uncertain submissions and saved receipts survive service restarts without duplicate writes", async () => {
  let persisted, writes = 0;
  const h = harness(({ url }) => {
    if (url.pathname === "/v1/posts") { writes++; throw Error("network timeout"); }
  }, { persist: async (state) => { persisted = structuredClone(state); } });
  const result = await h.service.dispatch(config(), "publish", publish());
  assert.equal(result.results[0].uncertain, true);
  const restarted = harness(() => { throw Error("No requests after restart"); }, { state: persisted });
  assert.deepEqual(await restarted.service.dispatch(config(), "publish", publish()), result);
  assert.equal(writes, 1);
  const pending = structuredClone(persisted); delete Object.values(pending.receipts)[0].result;
  await assert.rejects(harness(() => {}, { state: pending }).service.dispatch(config(), "publish", publish()), /previous result is uncertain/);
});

test("HTTP validation errors are definite and provider secrets are redacted", async () => {
  const h = harness(({ url }) => url.pathname === "/v1/posts" ? Response.json({ error: { code: "caption_too_long", message: "private-tebar-key" } }, { status: 400 }) : undefined);
  const result = await h.service.dispatch(config(), "publish", publish());
  assert.equal(result.results[0].success, false); assert.equal(result.results[0].uncertain, false);
  assert.match(result.results[0].error, /caption_too_long/); assert.equal(JSON.stringify(result).includes("private-tebar-key"), false);
});

test("posts use cursor pagination, snake_case timestamps, target errors and permalinks", async () => {
  const h = harness(({ url }) => {
    assert.equal(url.searchParams.get("cursor"), "cursor-2");
    return Response.json({ data: [{ id: "post-1", content: "Shared", status: "partial", scheduled_at: "2099-01-01T00:00:00Z", targets: [
      { account_id: "account-1", platform: "threads", status: "published", permalink: "https://threads.net/post/1", published_at: "2026-10-31T00:00:00Z" },
      { account_id: "account-2", platform: "instagram", status: "failed", error_code: "media_invalid_format", error_message: "Wrong aspect ratio" },
    ] }], next_cursor: "cursor-3" });
  });
  const data = await h.service.dispatch(config(), "posts", { cursor: "cursor-2" });
  assert.equal(data.nextCursor, "cursor-3"); assert.equal(data.posts.length, 2);
  assert.equal(data.posts[0].permalink, "https://threads.net/post/1"); assert.equal(data.posts[1].error, "Wrong aspect ratio");
});

test("connect links and workspace creation use owner endpoints and documented response shapes", async () => {
  const h = harness(({ url, body }) => {
    if (url.pathname.endsWith("/connect-links")) { assert.deepEqual(JSON.parse(body), {}); return Response.json({ url: "https://publish.tebar.app/connect/s/private", expires_at: "2099-01-01" }); }
    if (url.pathname === "/v1/profiles" && body) { assert.deepEqual(JSON.parse(body), { name: "Team" }); return Response.json({ id: "new-profile", name: "Team" }); }
  });
  assert.match((await h.service.dispatch(config(), "connect")).url, /connect\/s\//);
  assert.equal((await h.service.dispatch(config(), "createProfile", { name: " Team " })).id, "new-profile");
});

test("Tebar usage reads relative RateLimit-Reset and blocks exhausted shared request windows", async () => {
  const now = Date.parse("2026-10-31T00:00:00Z");
  const snapshot = captureUsage("tebar", new Response("", { headers: { "RateLimit-Limit": "70", "RateLimit-Remaining": "0", "RateLimit-Reset": "30" } }), {}, now);
  assert.equal(snapshot.windows[0].resetAt, "2026-10-31T00:00:30.000Z");
  assert.throws(() => assertRequestBudget(snapshot, now), /30 seconds/);
  assert.doesNotThrow(() => assertRequestBudget(snapshot, now + 31000));
  const cooldown = captureUsage("tebar", new Response("", { status: 429, headers: { "Retry-After": "45" } }), {}, now);
  assert.equal(cooldown.retryAt, "2026-10-31T00:00:45.000Z");
  const h = harness(({ url }) => { assert.equal(url.pathname, "/v1/me"); return Response.json({}, { headers: { "RateLimit-Limit": "70", "RateLimit-Remaining": "0", "RateLimit-Reset": "30" } }); });
  await h.service.dispatch(config(), "usage");
  await h.service.dispatch(config(), "usage.cached"); assert.equal(h.calls.length, 1);
  const limited = await h.service.dispatch(config(), "posts"); assert.match(limited.issues[0].message, /limit reached/); assert.equal(h.calls.length, 1);
});
