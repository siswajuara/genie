import test from "node:test";
import assert from "node:assert/strict";
import {
  createSocialService,
  emptyConfig,
  publicConfig,
} from "../sidecar/social-core.mjs";

const config = () => ({
  buffer: { key: "buffer-secret", organizationId: "" },
  zernio: { key: "zernio-secret", profileId: "profile" },
});
const json = (value, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
function fixture(overrides = {}) {
  const calls = [];
  const service = createSocialService({
    fetchImpl: async (input, options = {}) => {
      const url = new URL(input),
        body =
          options.body && typeof options.body === "string"
            ? JSON.parse(options.body)
            : undefined;
      calls.push({ url, options, body });
      const overridden = await overrides.respond?.(url, options, body);
      if (overridden) return overridden;
      if (url.hostname === "api.buffer.com") {
        if (body.query.includes("query Organizations"))
          return json({
            data: {
              account: { organizations: [{ id: "org", name: "School" }] },
            },
          });
        if (body.query.includes("query Channels"))
          return json({
            data: {
              channels: [
                { id: "buffer-account", name: "School", service: "instagram" },
              ],
            },
          });
        if (body.query.includes("mutation CreateSocialPost"))
          return json({
            data: {
              createPost: { post: { id: "buffer-post", status: "scheduled" } },
            },
          });
        if (body.query.includes("query Posts"))
          return json({ data: { posts: { edges: [] } } });
      }
      if (url.pathname === "/api/v1/accounts")
        return json({
          accounts: [
            {
              _id: "zernio-account",
              platform: "instagram",
              displayName: "School",
              isActive: true,
            },
          ],
        });
      if (url.pathname === "/api/v1/profiles")
        return json({ profiles: [{ _id: "profile", name: "School" }] });
      if (url.pathname === "/api/v1/posts" && options.method === "POST")
        return json({ post: { _id: "zernio-post", status: "scheduled" } });
      throw Error(`Unexpected mocked request ${url}`);
    },
  });
  return { service, calls };
}
const post = {
  requestId: "submission-1",
  content: "Open day",
  accountKeys: ["buffer:buffer-account", "zernio:zernio-account"],
  mode: "schedule",
  scheduledFor: "2099-01-01T10:00:00Z",
  media: [{ type: "image", url: "https://media.example.org/photo.png" }],
};

test("public settings never expose keys; account discovery is read-only", async () => {
  assert.ok(
    !JSON.stringify(publicConfig(config(), "keychain")).includes("secret"),
  );
  const { service, calls } = fixture();
  const result = await service.dispatch(config(), "accounts");
  assert.equal(result.accounts.length, 2);
  assert.equal(result.issues.length, 0);
  assert.ok(
    calls.every(
      (call) =>
        call.options.method === "GET" || call.body.query.startsWith("query "),
    ),
  );
});
test("partial permission failures retain accounts and redact credentials", async () => {
  const { service } = fixture({
    respond: (url) =>
      url.pathname === "/api/v1/profiles"
        ? json({ error: "denied zernio-secret" }, 403)
        : undefined,
  });
  const result = await service.dispatch(config(), "accounts");
  assert.equal(result.accounts.length, 2);
  assert.match(result.issues[0].message, /\[redacted\]/);
  assert.ok(!JSON.stringify(result).includes("zernio-secret"));
});
test("scheduled payloads follow reference contracts and repeated submissions do not create duplicates", async () => {
  const { service, calls } = fixture();
  assert.ok(
    (await service.dispatch(config(), "publish", post)).results.every(
      (result) => result.success,
    ),
  );
  await service.dispatch(config(), "publish", post);
  const writes = calls.filter(
    (call) =>
      call.body?.query?.startsWith("mutation") ||
      call.url.pathname === "/api/v1/posts",
  );
  assert.equal(writes.length, 2);
  assert.equal(writes[0].body.variables.input.mode, "customScheduled");
  assert.equal(writes[0].body.variables.input.channelId, "buffer-account");
  assert.deepEqual(writes[1].body.platforms, [
    { platform: "instagram", accountId: "zernio-account" },
  ]);
  assert.equal(
    writes[1].options.headers["Idempotency-Key"],
    "submission-1-zernio-account",
  );
});
test("uncertain provider writes are not automatically retried", async () => {
  let writes = 0;
  const { service } = fixture({
    respond: (url, options) => {
      if (url.pathname === "/api/v1/posts" && options.method === "POST") {
        writes++;
        throw Error("connection lost zernio-secret");
      }
    },
  });
  const payload = { ...post, accountKeys: ["zernio:zernio-account"] };
  const result = await service.dispatch(config(), "publish", payload);
  assert.equal(result.results[0].uncertain, true);
  assert.ok(!result.results[0].error.includes("zernio-secret"));
  await service.dispatch(config(), "publish", payload);
  assert.equal(writes, 1);
});
test("media storage receives bytes without provider authorization", async () => {
  const { service, calls } = fixture({
    respond: (url, options) => {
      if (url.pathname === "/api/v1/media/presign")
        return json({
          uploadUrl: "https://storage.example.org/upload",
          publicUrl: "https://media.example.org/photo.png",
        });
      if (url.hostname === "storage.example.org")
        return new Response("", { status: 200 });
    },
  });
  const result = await service.dispatch(config(), "upload", {
    filename: "photo.png",
    contentType: "image/png",
    data: Buffer.from("mock bytes").toString("base64"),
  });
  assert.equal(result.type, "image");
  const upload = calls.find((call) => call.options.method === "PUT");
  assert.equal(upload.options.headers.Authorization, undefined);
  assert.equal(upload.options.body.toString(), "mock bytes");
});
test("replies are scoped to connected accounts and protected against duplicates", async () => {
  let writes = 0;
  const { service } = fixture({
    respond: (url, options) => {
      if (
        url.pathname === "/api/v1/inbox/comments/post" &&
        options.method === "POST"
      ) {
        writes++;
        return json({ success: true });
      }
    },
  });
  const payload = {
    requestId: "reply-1",
    postId: "post",
    accountId: "zernio-account",
    commentId: "comment",
    message: "Thank you",
  };
  await service.dispatch(config(), "reply", payload);
  await service.dispatch(config(), "reply", payload);
  assert.equal(writes, 1);
  await assert.rejects(
    service.dispatch(config(), "reply", { ...payload, accountId: "other" }),
    /not connected/,
  );
  await assert.rejects(
    service.dispatch(emptyConfig(), "publish", post),
    /disconnected/,
  );
});
