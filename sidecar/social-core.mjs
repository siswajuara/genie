// Tebar is the only social transport. Drafts and delivery receipts stay local.
import { createHash } from "node:crypto";
import { captureUsage, assertRequestBudget } from "./social-usage.mjs";
import { createElevenLabsPool, elevenLabsMedia } from "./elevenlabs.mjs";
import { publicElevenLabs } from "./elevenlabs-config.mjs";
import { generateScript } from "./opencode-generation.mjs";
import { generateNarration } from "./opencode-narration.mjs";
import { listOpenCodeModels } from "./opencode.mjs";
import { publicOpenCode } from "./opencode-config.mjs";
const providers = ["tebar"];
const hash = (value) => createHash("sha256").update(value).digest("hex");
export const publicConfig = (config, storage) => ({
  storage,
  opencode: publicOpenCode(config.opencode),
  elevenlabs: publicElevenLabs(config),
  tebar: { configured: !!config.tebar?.key, profileId: config.tebar?.profileId || "" },
});
const safeId = (value) => {
  if (typeof value !== "string" || !value || value.length > 300 || /[\r\n\0]/.test(value))
    throw Error("A valid Tebar resource ID is required.");
  return value;
};
function publicHttps(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password ||
      /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|\[|172\.(1[6-9]|2\d|3[01])\.)/i.test(url.hostname))
    throw Error("Media and connection URLs must use public HTTPS.");
  return url.href;
}
export function createSocialService({ fetchImpl = fetch, opencodeRuntime = {}, state = {}, persist = async () => {} } = {}) {
  state.receipts ||= {};
  state.usage ||= {};
  state.cache ||= {};
  state.keyHashes ||= {};
  const accountInFlight = new Map();
  function scope(config) {
    const identity = hash(config.tebar?.key || "");
    if (state.keyHashes.tebar !== identity) {
      delete state.usage.tebar;
      state.cache = {};
      state.keyHashes.tebar = identity;
    }
  }
  async function tebar(config, path, { body, query = {}, method, raw = false, contentType, idempotencyKey, profileId = config.tebar?.profileId, owner = false } = {}) {
    if (!config.tebar?.key) throw Error("Save your Tebar API key in Setting first.");
    assertRequestBudget(state.usage.tebar);
    const url = new URL(`https://api.tebar.app/v1/${path}`);
    for (const [key, value] of Object.entries(query))
      if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
    let response;
    try {
      response = await fetchImpl(url, {
        method: method || (body === undefined ? "GET" : "POST"),
        redirect: "error",
        signal: AbortSignal.timeout(raw ? 90000 : 45000),
        headers: {
          Authorization: `Bearer ${config.tebar.key}`,
          ...(!owner && profileId ? { "Tebar-Profile": safeId(profileId) } : {}),
          ...(body === undefined ? {} : { "Content-Type": raw ? contentType : "application/json" }),
          ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
        },
        ...(body === undefined ? {} : { body: raw ? body : JSON.stringify(body) }),
      });
    } catch {
      throw Object.assign(Error("Tebar could not be reached. Check Schedule before starting another submission."), { uncertain: true });
    }
    state.usage.tebar = captureUsage("tebar", response, state.usage.tebar);
    try { await persist(state); }
    catch { throw Object.assign(Error("Could not save the Tebar request history. Check Schedule before retrying."), { uncertain: body !== undefined }); }
    let data;
    try { data = await response.json(); }
    catch { throw Object.assign(Error(`Tebar returned an invalid response (${response.status}).`), { uncertain: response.ok || response.status >= 500 }); }
    if (!response.ok || data.error) {
      const error = data.error || {};
      throw Object.assign(Error(`Tebar: ${error.message || data.message || `request failed (${response.status})`}${error.code ? ` (${error.code})` : ""}`), {
        code: error.code, uncertain: response.status >= 500,
      });
    }
    return data;
  }
  async function discover(config) {
    const output = { accounts: [], profiles: [], issues: [], ownerKey: false };
    if (!config.tebar?.key) return output;
    try {
      const data = await tebar(config, "accounts");
      if (!Array.isArray(data.data)) throw Error("Tebar returned an invalid account list.");
      output.accounts = data.data.map((a) => ({
        id: a.id, key: `tebar:${a.id}`, provider: "tebar", platform: a.platform,
        name: a.display_name || a.username || a.platform, username: a.username || "",
        active: a.status === "active" && !a.plan_suspended, profileId: a.profile_id,
      }));
      let cursor;
      do {
        const page = await tebar(config, "profiles", { owner: true, query: { limit: 100, cursor } });
        if (!Array.isArray(page.data)) throw Error("Tebar returned an invalid workspace list.");
        output.profiles.push(...page.data);
        if (page.next_cursor && page.next_cursor === cursor) throw Error("Tebar repeated a workspace cursor.");
        cursor = page.next_cursor;
        output.ownerKey = true;
      } while (cursor);
    } catch (error) {
      // Profile-scoped keys can publish, but cannot list or create profiles.
      if (error.code !== "owner_key_required") output.issues.push({ provider: "tebar", message: error.message });
    }
    return output;
  }
  async function accounts(config, force = false) {
    const key = JSON.stringify([state.keyHashes.tebar, config.tebar?.profileId || ""]);
    const cached = state.cache[key];
    if (!force && cached && Date.now() - cached.at < 300000) return cached.data;
    if (accountInFlight.has(key)) return accountInFlight.get(key);
    const pending = discover(config).then(async (data) => {
      if (!data.issues.length) { state.cache[key] = { at: Date.now(), data }; await persist(state); }
      return data;
    }).finally(() => accountInFlight.delete(key));
    accountInFlight.set(key, pending);
    return pending;
  }
  async function dispatch(config, action, payload = {}) {
    if (action === "ai.generate")
      return generateScript(config, payload, fetchImpl, opencodeRuntime);
    if (action === "ai.narration")
      return generateNarration(config, payload, fetchImpl, opencodeRuntime);
    if (action === "ai.models")
      return listOpenCodeModels(config, fetchImpl, opencodeRuntime);
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
    if (payload.provider && payload.provider !== "tebar") throw Error("Tebar is the only social provider.");
    if (action === "usage.cached") return { providers: { tebar: state.usage.tebar } };
    if (action === "usage") {
      const issues = [];
      if (config.tebar?.key) {
        try { await tebar(config, "me"); }
        catch (error) { issues.push({ provider: "tebar", message: error.message }); }
      }
      return { providers: { tebar: state.usage.tebar }, issues };
    }
    if (action === "publishingLimit" || action === "accountOptions") {
      const account = (await accounts(config)).accounts.find((a) => a.id === payload.accountId);
      if (!account) throw Error("Refresh your connected Tebar accounts first.");
      const id = encodeURIComponent(safeId(account.id));
      const path = action === "publishingLimit" ? `accounts/${id}/publishing-limit`
        : account.platform === "tiktok" ? `accounts/${id}/tiktok/creator-info`
        : account.platform === "pinterest" ? `accounts/${id}/pinterest/boards` : undefined;
      if (!path) throw Error("This account has no additional publishing choices.");
      return tebar(config, path, { profileId: account.profileId });
    }
    if (action === "accounts") return accounts(config, payload.refresh === true);
    if (action === "test") {
      if (!config.tebar?.key) throw Error("Save your Tebar API key before testing.");
      const result = await accounts(config, true);
      if (result.issues.length) throw Error(result.issues[0].message);
      const me = await tebar(config, "me");
      return { ...result, scopes: me.auth?.scopes || [], testedAt: new Date().toISOString() };
    }
    if (action === "connect") {
      const data = await accounts(config);
      if (!data.ownerKey) return { url: "https://publish.tebar.app" };
      const profileId = config.tebar.profileId || data.profiles.find((p) => p.is_default)?.id;
      if (!profileId) throw Error("Choose a Tebar workspace before connecting an account.");
      const link = await tebar(config, `profiles/${encodeURIComponent(safeId(profileId))}/connect-links`, { body: {}, owner: true });
      const url = publicHttps(link.url);
      if (new URL(url).hostname !== "publish.tebar.app") throw Error("Tebar returned an invalid connect link.");
      return { url, expiresAt: link.expires_at };
    }
    if (action === "createProfile") {
      if (typeof payload.name !== "string" || !payload.name.trim() || payload.name.length > 100) throw Error("Enter a workspace name under 100 characters.");
      const result = await tebar(config, "profiles", { body: { name: payload.name.trim() }, owner: true });
      state.cache = {};
      return result;
    }
    if (action === "posts") {
      const result = { posts: [], issues: [], nextCursor: null };
      if (!config.tebar?.key) return result;
      try {
        const page = await tebar(config, "posts", { query: { limit: 50, cursor: payload.cursor } });
        if (!Array.isArray(page.data)) throw Error("Tebar returned an invalid post list.");
        result.posts = page.data.flatMap((p) => (p.targets?.length ? p.targets : [{}]).map((target) => ({
          id: p.id, provider: "tebar", content: target.content ?? p.content,
          status: p.status === "scheduled" && target.status === "pending" ? "scheduled" : target.status || p.status,
          scheduledFor: p.scheduled_at, publishedAt: target.published_at,
          platform: target.platform, accountId: target.account_id, accountName: target.display_name || target.username,
          permalink: target.permalink, error: target.error_message || target.error_code,
        })));
        result.nextCursor = page.next_cursor || null;
      } catch (error) { result.issues.push({ provider: "tebar", message: error.message }); }
      return result;
    }
    if (action === "upload") {
      if (payload.confirmed !== true) throw Error("Confirm publication before uploading media to Tebar.");
      const profileId = payload.profileId || config.tebar?.profileId;
      let data;
      if (payload.url) {
        data = await tebar(config, "media/from-url", { body: { url: publicHttps(payload.url) }, profileId });
      } else {
        if (typeof payload.data !== "string" || !payload.data || payload.data.length > 48 * 1024 * 1024 ||
            !/^(image\/(jpeg|png)|video\/(mp4|quicktime))$/.test(payload.contentType || ""))
          throw Error("Choose a JPEG, PNG, MP4, or MOV file (images up to 8 MB; composer videos up to 32 MB).");
        const bytes = Buffer.from(payload.data, "base64");
        const limit = payload.contentType.startsWith("image/") ? 8 : 32;
        if (!bytes.length || bytes.length > limit * 1024 * 1024) throw Error(`Media must be between 1 byte and ${limit} MB.`);
        data = await tebar(config, "media/upload", { body: bytes, raw: true, contentType: payload.contentType, profileId });
      }
      if (!data.id || data.status !== "ready") throw Error("Tebar did not return ready media. Check the media in Tebar before retrying.");
      return { id: data.id, type: data.type };
    }
    if (action === "publish") {
      if (payload.confirmed !== true) throw Error("Confirm before publishing or scheduling with Tebar.");
      const media = payload.media || [];
      if (!["now", "schedule"].includes(payload.mode) || typeof payload.content !== "string" ||
          (!payload.content.trim() && !media.length) || payload.content.length > 5000 ||
          !Array.isArray(payload.accountKeys) || !payload.accountKeys.length || payload.accountKeys.length > 10)
        throw Error("Check the content, connected accounts (up to 10), and timing.");
      if (payload.mode === "schedule" && (!Number.isFinite(Date.parse(payload.scheduledFor)) || Date.parse(payload.scheduledFor) <= Date.now()))
        throw Error("Choose a future schedule time.");
      safeId(payload.requestId);
      if (!Array.isArray(media) || media.length > 20 || media.some((m) => !["image", "video"].includes(m.type) || typeof m.id !== "string"))
        throw Error("Choose up to 20 uploaded Tebar media items.");
      const available = await accounts(config);
      const targets = [...new Set(payload.accountKeys)].sort().map((key) => available.accounts.find((a) => a.key === key && a.active));
      if (targets.some((a) => !a)) throw Error("A selected account is disconnected. Refresh your accounts before submitting.");
      const profileIds = new Set(targets.map((a) => a.profileId));
      if (profileIds.size !== 1) throw Error("Choose accounts from one Tebar workspace per post.");
      const profileId = targets[0].profileId;
      const body = {
        content: payload.content.trim(), media_ids: media.map((m) => safeId(m.id)),
        targets: targets.map((account) => {
          const options = payload.accountOptions?.[account.key];
          if (options !== undefined && (!options || typeof options !== "object" || Array.isArray(options))) throw Error("Check the account publishing options.");
          if (account.platform === "youtube" && (!options?.title?.trim() || typeof options.made_for_kids !== "boolean"))
            throw Error("Choose a YouTube title and audience before submitting.");
          if (account.platform === "pinterest" && !options?.board_id?.trim()) throw Error("Choose a Pinterest board before submitting.");
          if (account.platform === "tiktok" && !options?.privacy_level) throw Error("Choose TikTok visibility before submitting.");
          return { account_id: account.id, ...(options ? { options } : {}) };
        }),
        ...(payload.mode === "schedule" ? { scheduled_at: new Date(payload.scheduledFor).toISOString() } : {}),
      };
      const key = `tebar:${hash(JSON.stringify([state.keyHashes.tebar, profileId, payload.requestId]))}`;
      const fingerprint = hash(JSON.stringify(body));
      const previous = state.receipts[key];
      if (previous) {
        if (previous.fingerprint !== fingerprint) throw Error("This submission ID belongs to different content. Start a new submission.");
        if (previous.result) return previous.result;
        throw Error("The previous result is uncertain. Refresh Tebar posts before starting another submission.");
      }
      assertRequestBudget(state.usage.tebar);
      state.receipts[key] = { fingerprint, startedAt: new Date().toISOString() };
      await persist(state);
      let result;
      try {
        const post = await tebar(config, "posts", { body, profileId, idempotencyKey: key.slice(6) });
        if (!post.id || !Array.isArray(post.targets)) throw Object.assign(Error("Tebar returned no post or target IDs. Check Schedule before retrying."), { uncertain: true });
        result = { results: targets.map((a) => {
          const target = post.targets.find((t) => t.account_id === a.id);
          const success = !!target && !["failed", "canceled"].includes(target.status);
          return { provider: "tebar", accountKey: a.key, accountName: a.name, success,
            id: post.id, status: post.status === "scheduled" && target?.status === "pending" ? "scheduled" : target?.status || post.status,
            ...(!success ? { error: target?.error_message || target?.error_code || "Tebar returned no delivery target.", uncertain: !target } : {}) };
        }) };
      } catch (error) {
        result = { results: targets.map((a) => ({ provider: "tebar", accountKey: a.key, accountName: a.name,
          success: false, uncertain: error.uncertain === true, error: error.message })) };
      }
      state.receipts[key].result = result;
      await persist(state);
      return result;
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
