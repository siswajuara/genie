// Provider requests follow integration-with-buffer-and-zernio-for-social-media.
// Keys stay in the native/dev backend; this module never sends them to the UI.
import { createHash } from "node:crypto";
export const providers = ["buffer", "zernio"];
export const emptyConfig = () => ({
  buffer: { key: "", organizationId: "" },
  zernio: { key: "", profileId: "" },
});
export const publicConfig = (config, storage) => ({
  storage,
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
    const now = Date.now();
    state.bufferCalls = state.bufferCalls.filter(
      (t) => t > now - 30 * 86400000,
    );
    if ((state.blockedUntil || 0) > now)
      throw Error("Buffer rate limit reached. Try again later.");
    for (const [window, limit] of [
      [900000, 100],
      [86400000, 500],
      [30 * 86400000, 10000],
    ])
      if (state.bufferCalls.filter((t) => t > now - window).length >= limit)
        throw Error("Buffer request budget reached. Try again later.");
    state.bufferCalls.push(now);
    await persist(state);
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
    const reset = Number(response.headers.get("retry-after"));
    if (response.status === 429) {
      state.blockedUntil = Date.now() + (reset > 0 ? reset : 900) * 1000;
      await persist(state);
    }
    const rate = response.headers.get("ratelimit") || "";
    for (const match of rate.matchAll(/r=0[^,]*?t=(\d+)/g)) {
      state.blockedUntil = Math.max(
        state.blockedUntil || 0,
        Date.now() + Number(match[1]) * 1000,
      );
      await persist(state);
    }
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
    return read(
      await fetchImpl(url, {
        method: body === undefined ? "GET" : "POST",
        redirect: "error",
        signal: AbortSignal.timeout(45000),
        headers: {
          Authorization: `Bearer ${config.zernio.key}`,
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
          ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
      "Zernio",
    );
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
  async function bufferAccounts(config) {
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
  async function zernioAccounts(config) {
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
  async function accounts(config, only) {
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
              const data = await bufferAccounts(config);
              output.accounts.push(...data.accounts);
              output.organizations = data.organizations;
            } else {
              const [list, profiles] = await Promise.allSettled([
                zernioAccounts(config),
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
    if (action === "accounts") return accounts(config);
    if (action === "test") {
      if (
        !providers.includes(payload.provider) ||
        !config[payload.provider].key
      )
        throw Error("Save a provider API key before testing.");
      const result = await accounts(config, payload.provider);
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
    if (action === "insights") {
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(payload.fromDate || "") ||
        !/^\d{4}-\d{2}-\d{2}$/.test(payload.toDate || "") ||
        payload.fromDate > payload.toDate
      )
        throw Error("Choose a valid date range.");
      const output = { buffer: null, zernio: null, issues: [] };
      await Promise.all(
        providers
          .filter((p) => config[p].key)
          .map(async (provider) => {
            try {
              if (provider === "buffer") {
                const data = await bufferAccounts(config),
                  selected = data.accounts.filter(
                    (a) => !payload.accountKey || a.key === payload.accountKey,
                  );
                if (!selected.length) return;
                const metrics = await buffer(
                  config,
                  "query Metrics($input: AggregatedPostMetricsInput!) { aggregatedPostMetrics(input: $input) { metricsUpdatedAt metrics { type name value unit description } } }",
                  {
                    input: {
                      organizationId: selected[0].organizationId,
                      channelIds: selected.map((a) => a.id),
                      startDateTime: `${payload.fromDate}T00:00:00.000Z`,
                      endDateTime: `${payload.toDate}T23:59:59.999Z`,
                    },
                  },
                );
                output.buffer = metrics.aggregatedPostMetrics;
              } else {
                if (
                  payload.accountKey &&
                  !payload.accountKey.startsWith("zernio:")
                )
                  return;
                output.zernio = await zernio(config, "analytics", undefined, {
                  fromDate: payload.fromDate,
                  toDate: payload.toDate,
                  limit: 50,
                  order: "desc",
                  profileId: config.zernio.profileId || undefined,
                  ...(payload.accountKey
                    ? { accountId: payload.accountKey.slice(7) }
                    : {}),
                });
              }
            } catch (error) {
              output.issues.push({ provider, message: error.message });
            }
          }),
      );
      return output;
    }
    if (action === "inbox")
      return zernio(config, "inbox/comments", undefined, {
        limit: 50,
        sortBy: "date",
        sortOrder: "desc",
        cursor: payload.cursor,
        profileId: config.zernio.profileId || undefined,
        platform: payload.platform === "x" ? "twitter" : payload.platform || undefined,
      });
    if (action === "comments" || action === "reply") {
      const postId = encodeURIComponent(safeId(payload.postId)),
        accountId = safeId(payload.accountId);
      const list = await zernioAccounts(config);
      if (!list.some((a) => a.id === accountId && a.active))
        throw Error("That Zernio account is not connected.");
      if (action === "comments")
        return zernio(config, `inbox/comments/${postId}`, undefined, {
          accountId,
          limit: 50,
          cursor: payload.cursor,
          commentId: payload.commentId,
        });
      safeId(payload.commentId);
      safeId(payload.requestId);
      if (!payload.message?.trim() || payload.message.length > 5000)
        throw Error("Write a reply up to 5,000 characters.");
      return receipt(`reply:${payload.requestId}`, payload, () =>
        zernio(
          config,
          `inbox/comments/${postId}`,
          {
            accountId,
            commentId: payload.commentId,
            message: payload.message.trim(),
          },
          {},
          payload.requestId,
        ),
      );
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
