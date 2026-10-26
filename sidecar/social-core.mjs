// Direct Buffer and Zernio transport; all app drafts and receipts stay local.
// Keys stay in the native/dev backend; this module never sends them to the UI.
import { createHash } from "node:crypto";
import { captureUsage, assertRequestBudget } from "./social-usage.mjs";
import { createElevenLabsPool, elevenLabsMedia } from "./elevenlabs.mjs";
import { publicElevenLabs } from "./elevenlabs-config.mjs";
const providers = ["buffer", "zernio"];
export const publicConfig = (config, storage) => ({
  storage,
  elevenlabs: publicElevenLabs(config),
  buffer: {
    configured: !!config.buffer.key,
    organizationId: config.buffer.organizationId || "",
  },
  zernio: {
    configured: !!config.zernio.key,
    profileId: config.zernio.profileId || "",
  },
});
const safeId = (value) => {
  if (typeof value !== "string" || !value || value.length > 300)
    throw Error("A valid provider resource ID is required.");
  return value;
};
function https(value) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|\[|172\.(1[6-9]|2\d|3[01])\.)/i.test(
      url.hostname,
    )
  )
    throw Error("Media and connection URLs must use public HTTPS.");
  return url.href;
}
export function createSocialService({
  fetchImpl = fetch,
  state = { receipts: {}, bufferCalls: [], blockedUntil: 0 },
  persist = async () => {},
} = {}) {
  state.receipts ||= {};
  state.bufferCalls ||= [];
  state.usage ||= {};
  state.cache ||= {};
  state.keyHashes ||= {};
  const accountInFlight = new Map();
  function scope(config) {
    for (const provider of providers) {
      const hash = createHash("sha256")
        .update(config[provider].key || "")
        .digest("hex");
      if (state.keyHashes[provider] !== hash) {
        delete state.usage[provider];
        state.cache = {};
        if (provider === "buffer") {
          state.bufferCalls = [];
          state.blockedUntil = 0;
        }
        state.keyHashes[provider] = hash;
      }
    }
  }
  async function record(provider, response, analytics = false) {
    state.usage[provider] = captureUsage(
      provider,
      response,
      state.usage[provider],
      Date.now(),
      analytics,
    );
    await persist(state);
  }

  async function read(response, provider) {
    let body;
    try {
      body = await response.json();
    } catch {
      throw Error(
        `${provider} returned an invalid response (${response.status}).`,
      );
    }
    if (!response.ok || body.errors?.length)
      throw Error(
        `${provider}: ${body.errors?.[0]?.message || body.error || body.message || `request failed (${response.status})`}`,
      );
    return body;
  }
  async function buffer(config, query, variables) {
    if (!config.buffer.key)
      throw Error("Save your Buffer API key in Setting first.");
    assertRequestBudget(state.usage.buffer);
    const response = await fetchImpl("https://api.buffer.com", {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(30000),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.buffer.key}`,
      },
      body: JSON.stringify({ query, variables }),
    });
    await record("buffer", response);
    const body = await read(response, "Buffer");
    if (!body.data)
      throw Error("Buffer returned no data. Check your key permissions.");
    return body.data;
  }
  async function zernio(config, path, body, query = {}, idempotencyKey) {
    if (!config.zernio.key)
      throw Error("Save your Zernio API key in Setting first.");
    const url = new URL(`https://zernio.com/api/v1/${path}`);
    for (const [key, value] of Object.entries(query))
      if (value !== undefined && value !== "")
        url.searchParams.set(key, String(value));
    const analytics = path === "analytics" || path.startsWith("analytics/");
    assertRequestBudget(state.usage.zernio, analytics);
    const response = await fetchImpl(url, {
      method: body === undefined ? "GET" : "POST",
      redirect: "error",
      signal: AbortSignal.timeout(45000),
      headers: {
        Authorization: `Bearer ${config.zernio.key}`,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    await record("zernio", response, analytics);
    return read(response, "Zernio");
  }
  async function organizations(config) {
    return (
      (
        await buffer(
          config,
          "query Organizations { account { organizations { id name } } }",
        )
      ).account?.organizations || []
    );
  }
  function cachedAccounts(config, provider) {
    for (const only of [provider, "all"]) {
      const key = JSON.stringify([
        config.buffer.organizationId,
        config.zernio.profileId,
        only,
      ]);
      const cached = state.cache[key];
      if (cached && Date.now() - cached.at < 300000)
        return {
          ...cached.data,
          accounts: cached.data.accounts.filter(
            (account) => account.provider === provider,
          ),
        };
    }
  }
  async function bufferAccounts(config, force = false) {
    const cached = !force && cachedAccounts(config, "buffer");
    if (cached) return cached;
    const orgs = await organizations(config),
      organizationId = config.buffer.organizationId || orgs[0]?.id;
    if (!organizationId) return { accounts: [], organizations: orgs };
    if (!orgs.some((org) => org.id === organizationId))
      throw Error(
        "The selected Buffer organization is not available to this key.",
      );
    const data = await buffer(
      config,
      "query Channels($organizationId: OrganizationId!) { channels(input: { organizationId: $organizationId }) { id name service } }",
      { organizationId },
    );
    return {
      organizations: orgs,
      accounts: (data.channels || []).map((a) => ({
        id: a.id,
        key: `buffer:${a.id}`,
        provider: "buffer",
        platform: a.service === "twitter" ? "x" : a.service,
        name: a.name,
        username: a.name,
        active: true,
        organizationId,
      })),
    };
  }
  async function zernioAccounts(config, force = false) {
    const cached = !force && cachedAccounts(config, "zernio");
    if (cached) return cached.accounts;
    const data = await zernio(config, "accounts", undefined, {
      profileId: config.zernio.profileId || undefined,
    });
    return (data.accounts || []).map((a) => ({
      id: a._id || a.id,
      key: `zernio:${a._id || a.id}`,
      provider: "zernio",
      platform: a.platform === "twitter" ? "x" : a.platform,
      name: a.displayName || a.username || a.platform,
      username: a.username || "",
      active: a.isActive !== false,
      profileId:
        typeof a.profileId === "object" ? a.profileId?._id : a.profileId,
    }));
  }
  async function accounts(config, only, force = false) {
    const cacheKey = JSON.stringify([
      config.buffer.organizationId,
      config.zernio.profileId,
      only || "all",
    ]);
    const cached = state.cache[cacheKey];
    if (!force && cached && Date.now() - cached.at < 300000) return cached.data;
    const requestKey = cacheKey + JSON.stringify(state.keyHashes);
    if (accountInFlight.has(requestKey)) return accountInFlight.get(requestKey);
    const pending = discoverAccounts(config, only, cacheKey, force).finally(
      () => accountInFlight.delete(requestKey),
    );
    accountInFlight.set(requestKey, pending);
    return pending;
  }
  async function discoverAccounts(config, only, cacheKey, force) {
    const output = {
      accounts: [],
      organizations: [],
      profiles: [],
      issues: [],
    };
    await Promise.all(
      providers
        .filter((p) => (!only || only === p) && config[p].key)
        .map(async (provider) => {
          try {
            if (provider === "buffer") {
              const data = await bufferAccounts(config, force);
              output.accounts.push(...data.accounts);
              output.organizations = data.organizations;
            } else {
              const [list, profiles] = await Promise.allSettled([
                zernioAccounts(config, force),
                zernio(config, "profiles"),
              ]);
              if (list.status === "fulfilled")
                output.accounts.push(...list.value);
              else
                output.issues.push({ provider, message: list.reason.message });
              if (profiles.status === "fulfilled")
                output.profiles = profiles.value.profiles || [];
              else
                output.issues.push({
                  provider,
                  message: profiles.reason.message,
                });
            }
          } catch (error) {
            output.issues.push({ provider, message: error.message });
          }
        }),
    );
    if (!output.issues.length) {
      state.cache[cacheKey] = { at: Date.now(), data: output };
      await persist(state);
    }
    return output;
  }
  async function receipt(key, payload, run) {
    const fingerprint = createHash("sha256")
        .update(JSON.stringify(payload))
        .digest("hex"),
      old = state.receipts[key];
    if (old) {
      if (old.fingerprint !== fingerprint)
        throw Error(
          "This request ID belongs to different content. Start a new submission.",
        );
      if (old.result) return old.result;
      throw Error(
        "The previous result is uncertain. Refresh provider posts before trying a new submission.",
      );
    }
    state.receipts[key] = { fingerprint, startedAt: new Date().toISOString() };
    await persist(state);
    const result = await run();
    state.receipts[key].result = result;
    await persist(state);
    return result;
  }
  async function dispatch(config, action, payload = {}) {
    const pool = createElevenLabsPool({ state, persist, fetchImpl });
    if (action === "elevenlabs.usage")
      return pool.usage(config, payload.accountId);
    if (action === "elevenlabs.cached") return pool.cached(config);
    if (
      [
        "elevenlabs.voices",
        "elevenlabs.speech",
        "elevenlabs.transcribe",
      ].includes(action)
    ) {
      try {
        return await elevenLabsMedia(config, action, payload, fetchImpl);
      } finally {
        if (action !== "elevenlabs.voices" && payload.confirmed === true) {
          // A paid or interrupted request makes the old credit snapshot stale.
          for (const saved of Object.values(state.elevenlabs.entries))
            delete saved.usage;
          await persist(state);
        }
      }
    }
    if (action === "elevenlabs.select") {
      const { account, usage } = await pool.select(
        config,
        payload.minimumCredits,
      );
      return { accountId: account.id, name: account.name, usage };
    }
    scope(config);
    if (action === "usage.cached") return { providers: state.usage };
    if (action === "usage") {
      const issues = [];
      const selected = payload.provider ? [payload.provider] : providers;
      if (selected.some((provider) => !providers.includes(provider)))
        throw Error("Choose a provider.");
      for (const provider of selected.filter(
        (provider) => config[provider].key,
      )) {
        try {
          if (provider === "buffer")
            await buffer(config, "query Usage { account { id } }");
          else {
            const data = await zernio(config, "usage");
            state.usage.zernio = {
              ...state.usage.zernio,
              fetchedAt: new Date().toISOString(),
              planName: data.planName,
              billingPeriod: data.billingPeriod,
              hasAccess: data.hasAccess,
              limits: data.limits,
              usage: data.usage,
              spend: data.spend,
            };
            await persist(state);
          }
        } catch (error) {
          issues.push({ provider, message: error.message });
        }
      }
      return { providers: state.usage, issues };
    }
    if (action === "accounts")
      return accounts(config, undefined, payload.refresh === true);
    if (action === "test") {
      if (
        !providers.includes(payload.provider) ||
        !config[payload.provider].key
      )
        throw Error("Save a provider API key before testing.");
      const result = await accounts(config, payload.provider, true);
      if (result.issues.length) throw Error(result.issues[0].message);
      return {
        ...result,
        provider: payload.provider,
        testedAt: new Date().toISOString(),
      };
    }
    if (action === "connect") {
      if (payload.provider === "buffer")
        return { url: "https://publish.buffer.com/channels" };
      const profileId = payload.profileId || config.zernio.profileId;
      if (!profileId)
        throw Error("Choose a Zernio profile before connecting a channel.");
      if (!/^[a-z]+$/.test(payload.platform || ""))
        throw Error("Choose a social platform.");
      const data = await zernio(
        config,
        `connect/${payload.platform === "x" ? "twitter" : payload.platform}`,
        undefined,
        { profileId },
      );
      return { url: https(data.authUrl) };
    }
    if (action === "createProfile") {
      if (!payload.name?.trim()) throw Error("Enter a profile name.");
      return zernio(config, "profiles", { name: payload.name.trim() });
    }
    if (action === "posts") {
      const result = { posts: [], issues: [], nextCursor: undefined };
      await Promise.all(
        providers
          .filter((p) => config[p].key)
          .map(async (provider) => {
            try {
              if (provider === "buffer") {
                const data = await bufferAccounts(config);
                if (!data.accounts.length) return;
                const org = data.accounts[0].organizationId;
                const response = await buffer(
                  config,
                  "query Posts($organizationId: OrganizationId!, $channelIds: [ChannelId!]) { posts(first: 50, input: { organizationId: $organizationId, filter: { channelIds: $channelIds } }) { edges { node { id text status dueAt sentAt channelId channelService } } } }",
                  {
                    organizationId: org,
                    channelIds: data.accounts.map((a) => a.id),
                  },
                );
                result.posts.push(
                  ...(response.posts?.edges || []).map(({ node: p }) => ({
                    id: p.id,
                    provider,
                    content: p.text,
                    status: p.status,
                    scheduledFor: p.dueAt,
                    publishedAt: p.sentAt,
                    platform: p.channelService,
                    accountId: p.channelId,
                  })),
                );
              } else {
                const data = await zernio(config, "posts", undefined, {
                  limit: 50,
                  page: payload.zernioPage || 1,
                  sortBy: "scheduled-desc",
                  profileId: config.zernio.profileId || undefined,
                });
                result.posts.push(
                  ...(data.posts || []).map((p) => ({
                    id: p._id || p.id,
                    provider,
                    content: p.content,
                    status: p.status,
                    scheduledFor: p.scheduledFor,
                    publishedAt: p.publishedAt,
                    platform: p.platforms?.map((a) => a.platform).join(", "),
                    accountId: p.platforms?.[0]?.accountId,
                    platforms: p.platforms,
                  })),
                );
                result.zernioHasMore = !!(
                  data.pagination?.hasMore ||
                  data.pagination?.page < data.pagination?.pages
                );
              }
            } catch (error) {
              result.issues.push({ provider, message: error.message });
            }
          }),
      );
      return result;
    }
    if (action === "upload") {
      if (
        typeof payload.data !== "string" ||
        payload.data.length > 48 * 1024 * 1024 ||
        !payload.data ||
        !/^(image|video)\/[a-z0-9.+-]+$/i.test(payload.contentType || "")
      )
        throw Error("Choose a supported media file under 32 MB.");
      const bytes = Buffer.from(payload.data, "base64");
      if (!bytes.length || bytes.length > 32 * 1024 * 1024)
        throw Error("Media must be between 1 byte and 32 MB.");
      const presign = await zernio(config, "media/presign", {
        filename: String(payload.filename || "media").slice(0, 150),
        contentType: payload.contentType,
        size: bytes.length,
      });
      const uploadUrl = https(presign.uploadUrl),
        url = https(presign.publicUrl);
      const response = await fetchImpl(uploadUrl, {
        method: "PUT",
        redirect: "error",
        signal: AbortSignal.timeout(90000),
        headers: { "Content-Type": payload.contentType },
        body: bytes,
      });
      if (!response.ok)
        throw Error(`Media upload failed (${response.status}).`);
      return {
        url,
        type: payload.contentType.startsWith("video/") ? "video" : "image",
      };
    }
    if (action === "publish") {
      if (
        !["now", "schedule", "draft"].includes(payload.mode) ||
        typeof payload.content !== "string" ||
        !payload.content.trim() ||
        payload.content.length > 5000 ||
        !Array.isArray(payload.accountKeys) ||
        !payload.accountKeys.length
      )
        throw Error("Check the caption, connected channels, and timing.");
      if (
        payload.mode === "schedule" &&
        (!Number.isFinite(Date.parse(payload.scheduledFor)) ||
          Date.parse(payload.scheduledFor) <= Date.now())
      )
        throw Error("Choose a future schedule time.");
      safeId(payload.requestId);
      const media = payload.media || [];
      if (
        !Array.isArray(media) ||
        media.length > 20 ||
        media.some((m) => !["image", "video"].includes(m.type))
      )
        throw Error("Choose up to 20 valid media items.");
      for (const item of media) https(item.url);
      const available = await accounts(config);
      const targets = [...new Set(payload.accountKeys)].map((key) =>
        available.accounts.find((a) => a.key === key && a.active),
      );
      if (targets.some((a) => !a))
        throw Error(
          "A selected channel is disconnected. Refresh your accounts before submitting.",
        );
      const results = [];
      for (const account of targets) {
        const key = `post:${payload.requestId}:${account.key}`;
        try {
          results.push(
            await receipt(
              key,
              {
                content: payload.content,
                media,
                mode: payload.mode,
                scheduledFor: payload.scheduledFor,
                account: account.key,
              },
              async () => {
                if (account.provider === "buffer") {
                  const data = await buffer(
                    config,
                    "mutation CreateSocialPost($input: CreatePostInput!) { createPost(input: $input) { ... on PostActionSuccess { post { id status dueAt } } ... on MutationError { message } } }",
                    {
                      input: {
                        text: payload.content.trim(),
                        channelId: account.id,
                        schedulingType: "automatic",
                        mode:
                          payload.mode === "now"
                            ? "shareNow"
                            : payload.mode === "schedule"
                              ? "customScheduled"
                              : "addToQueue",
                        ...(payload.mode === "schedule"
                          ? {
                              dueAt: new Date(
                                payload.scheduledFor,
                              ).toISOString(),
                            }
                          : {}),
                        ...(payload.mode === "draft"
                          ? { saveToDraft: true }
                          : {}),
                        ...(media.length
                          ? {
                              assets: media.map((m) =>
                                m.type === "image"
                                  ? { image: { url: m.url } }
                                  : { video: { url: m.url } },
                              ),
                            }
                          : {}),
                      },
                    },
                  );
                  const post = data.createPost?.post;
                  return {
                    provider: "buffer",
                    accountKey: account.key,
                    accountName: account.name,
                    success: !!post,
                    id: post?.id,
                    status: post?.status,
                    ...(!post
                      ? {
                          error:
                            data.createPost?.message ||
                            "Buffer did not accept this post.",
                        }
                      : {}),
                  };
                }
                const data = await zernio(
                  config,
                  "posts",
                  {
                    content: payload.content.trim(),
                    platforms: [
                      {
                        platform:
                          account.platform === "x"
                            ? "twitter"
                            : account.platform,
                        accountId: account.id,
                      },
                    ],
                    ...(payload.mode === "now"
                      ? { publishNow: true }
                      : payload.mode === "schedule"
                        ? {
                            scheduledFor: new Date(
                              payload.scheduledFor,
                            ).toISOString(),
                          }
                        : { isDraft: true }),
                    ...(payload.timezone ? { timezone: payload.timezone } : {}),
                    ...(media.length ? { mediaItems: media } : {}),
                  },
                  {},
                  `${payload.requestId}-${account.id}`,
                );
                const post = data.post;
                if (!post?._id && !post?.id)
                  throw Error(
                    "Zernio returned no post ID. Check provider posts before retrying.",
                  );
                return {
                  provider: "zernio",
                  accountKey: account.key,
                  accountName: account.name,
                  success: true,
                  id: post._id || post.id,
                  status: post.status,
                };
              },
            ),
          );
        } catch (error) {
          results.push({
            provider: account.provider,
            accountKey: account.key,
            accountName: account.name,
            success: false,
            uncertain: !!state.receipts[key] && !state.receipts[key].result,
            error: error.message,
          });
        }
      }
      return { results };
    }
    throw Error("Unknown social action.");
  }
  function redact(value, config) {
    if (typeof value === "string") {
      for (const p of providers)
        if (config[p]?.key)
          value = value.split(config[p].key).join("[redacted]");
      return value;
    }
    if (Array.isArray(value)) return value.map((item) => redact(item, config));
    if (value && typeof value === "object")
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, redact(item, config)]),
      );
    return value;
  }
  return {
    async dispatch(config, action, payload) {
      try {
        return redact(await dispatch(config, action, payload), config);
      } catch (error) {
        throw Error(
          redact(
            error instanceof Error
              ? error.message
              : "The social provider request failed.",
            config,
          ),
        );
      }
    },
  };
}
