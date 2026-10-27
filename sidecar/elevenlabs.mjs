import { createHash } from "node:crypto";
import { elevenLabsAccounts } from "./elevenlabs-config.mjs";
import { SPEECH_MODEL } from "./voice-prototype.mjs";

class ElevenLabsLimitError extends Error {
  constructor(message, retryAfter = 60) {
    super(message);
    this.retryAfter = retryAfter;
  }
}

// These operations run only after an explicit editor action. Never retry a paid request.
export async function elevenLabsMedia(
  config,
  action,
  payload,
  fetchImpl = fetch,
) {
  const accounts = elevenLabsAccounts(config).filter(
    (account) => account.enabled !== false && account.key,
  );
  const account = payload.accountId
    ? accounts.find((item) => item.id === payload.accountId)
    : accounts.length === 1
      ? accounts[0]
      : null;
  if (!account)
    throw Error("Choose an enabled ElevenLabs account in Audio & subtitles.");
  const headers = { "xi-api-key": account.key };
  let path, options;
  if (action === "elevenlabs.voices") {
    path = "/v2/voices?page_size=100";
    options = { method: "GET", headers };
  } else {
    if (payload.confirmed !== true)
      throw Error(
        "Confirm this ElevenLabs operation before using provider credits.",
      );
    if (action === "elevenlabs.speech") {
      if (
        typeof payload.text !== "string" ||
        !payload.text.trim() ||
        payload.text.length > 5000
      )
        throw Error("Enter 1–5,000 characters for the voiceover.");
      if (
        typeof payload.voiceId !== "string" ||
        !/^[a-zA-Z0-9_-]{1,100}$/.test(payload.voiceId)
      )
        throw Error("Choose a valid ElevenLabs voice.");
      path = `/v1/text-to-speech/${encodeURIComponent(payload.voiceId)}/with-timestamps?output_format=mp3_44100_128`;
      options = {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ text: payload.text, model_id: SPEECH_MODEL }),
      };
    } else if (action === "elevenlabs.transcribe") {
      const match =
        typeof payload.src === "string" &&
        /^data:audio\/(mpeg|mp3|wav|x-wav|wave|ogg|mp4|aac|flac|webm|x-m4a);base64,([a-z0-9+/]+=*)$/i.exec(
          payload.src,
        );
      if (!match || match[2].length > 35_000_000)
        throw Error("Choose embedded audio under 25 MB for transcription.");
      const bytes = Buffer.from(match[2], "base64");
      if (!bytes.length || bytes.length > 25 * 1024 * 1024)
        throw Error("Choose embedded audio under 25 MB for transcription.");
      if (
        payload.language &&
        (typeof payload.language !== "string" ||
          !/^[a-z]{2,3}$/.test(payload.language))
      )
        throw Error(
          "Use a two or three letter language code, or leave it blank for automatic detection.",
        );
      const form = new FormData();
      const extension = ["mpeg", "mp3"].includes(match[1])
        ? "mp3"
        : match[1] === "mp4" || match[1] === "x-m4a"
          ? "m4a"
          : match[1];
      form.append(
        "file",
        new Blob([bytes], { type: `audio/${match[1]}` }),
        `audio.${extension}`,
      );
      form.append("model_id", "scribe_v2");
      form.append("timestamps_granularity", "word");
      form.append("tag_audio_events", "false");
      if (payload.language) form.append("language_code", payload.language);
      path = "/v1/speech-to-text";
      options = { method: "POST", headers, body: form };
    } else throw Error("Unknown ElevenLabs operation.");
  }
  let response;
  try {
    response = await fetchImpl(`https://api.elevenlabs.io${path}`, {
      ...options,
      redirect: "error",
      signal: AbortSignal.timeout(180000),
    });
  } catch {
    throw Error(
      action === "elevenlabs.voices"
        ? "Could not load ElevenLabs voices."
        : "The ElevenLabs request was interrupted. It may have used credits; check your provider history before trying again.",
    );
  }
  if (!response.ok) {
    if (response.status === 401)
      throw Error("ElevenLabs rejected this account's API key.");
    if (response.status === 403)
      throw Error(
        "This ElevenLabs key needs permission for the requested voice or transcription operation.",
      );
    if (response.status === 429)
      throw Error(
        "ElevenLabs rate or credit limit reached. Check your account before trying again.",
      );
    throw Error(
      `ElevenLabs could not complete this operation (${response.status}). Check provider history before retrying.`,
    );
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw Error(
      "ElevenLabs returned an unreadable response. Check provider history before retrying.",
    );
  }
  if (action === "elevenlabs.voices") {
    if (!Array.isArray(data?.voices))
      throw Error("ElevenLabs returned an invalid voice list.");
    return {
      voices: data.voices.map((voice) => ({
        id: voice.voice_id,
        name: voice.name,
      })),
      hasMore: data.has_more === true,
    };
  }
  if (action === "elevenlabs.speech") {
    const alignment = data.normalized_alignment || data.alignment;
    if (
      typeof data.audio_base64 !== "string" ||
      !/^[a-z0-9+/]+=*$/i.test(data.audio_base64) ||
      data.audio_base64.length > 35_000_000 ||
      !Array.isArray(alignment?.characters) ||
      !Array.isArray(alignment.character_start_times_seconds) ||
      !Array.isArray(alignment.character_end_times_seconds) ||
      alignment.characters.length !==
        alignment.character_start_times_seconds.length ||
      alignment.characters.length !==
        alignment.character_end_times_seconds.length ||
      !alignment.characters.every((v) => typeof v === "string") ||
      ![
        ...alignment.character_start_times_seconds,
        ...alignment.character_end_times_seconds,
      ].every((v) => Number.isFinite(v) && v >= 0)
    )
      throw Error(
        "ElevenLabs returned invalid audio or timing data. Check provider history before retrying.",
      );
    const cost = response.headers.get("character-cost");
    return {
      src: `data:audio/mpeg;base64,${data.audio_base64}`,
      alignment,
      characterCost: cost !== null && /^\d+$/.test(cost) ? Number(cost) : null,
      accountId: account.id,
    };
  }
  if (!Array.isArray(data?.words))
    throw Error(
      "ElevenLabs returned no word timings. Check provider history before retrying.",
    );
  return {
    words: data.words.map(({ text, start, end, type }) => ({
      text,
      start,
      end,
      type,
    })),
    language: data.language_code,
    accountId: account.id,
  };
}

async function elevenLabsKeyProbe(key, fetchImpl) {
  // A restricted key can be valid for voices/TTS yet blocked from the
  // subscription endpoint. Returns true (valid), false (invalid), or
  // null (probe itself failed; caller keeps its original error).
  let response;
  try {
    response = await fetchImpl(
      "https://api.elevenlabs.io/v1/voices?page_size=1",
      {
        method: "GET",
        headers: { "xi-api-key": key },
        redirect: "error",
        signal: AbortSignal.timeout(30000),
      },
    );
  } catch {
    return null;
  }
  if (response.ok) return true;
  if (response.status === 401 || response.status === 403) return false;
  return null;
}

async function elevenLabsUsage(config, fetchImpl = fetch) {
  const key = config.elevenlabs?.key;
  if (!key) throw Error("Save your ElevenLabs API key first.");
  let response;
  try {
    response = await fetchImpl(
      "https://api.elevenlabs.io/v1/user/subscription",
      {
        method: "GET",
        headers: { "xi-api-key": key },
        redirect: "error",
        signal: AbortSignal.timeout(30000),
      },
    );
  } catch {
    throw Error("Could not reach ElevenLabs. Try refreshing credits again.");
  }
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      const probe = await elevenLabsKeyProbe(key, fetchImpl);
      if (probe === true)
        throw Error(
          "This API key works, but ElevenLabs blocked the credit check. Open the API Keys page, allow User read access for this key, then press Refresh credits.",
        );
      throw Error(
        "ElevenLabs rejected this API key. Check the key and try again.",
      );
    }
    if (response.status === 429) {
      const header = response.headers.get("retry-after");
      const seconds =
        header && /^\d+$/.test(header)
          ? Number(header)
          : header
            ? Math.ceil((Date.parse(header) - Date.now()) / 1000)
            : 60;
      throw new ElevenLabsLimitError(
        "ElevenLabs rate limit reached. Wait before refreshing credits.",
        Number.isFinite(seconds) ? Math.max(1, seconds) : 60,
      );
    }
    throw Error(`Could not read ElevenLabs credits (${response.status}).`);
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw Error("ElevenLabs returned an invalid subscription response.");
  }
  const count = (value) =>
    Number.isSafeInteger(value) && value >= 0 ? value : null;
  const used = count(data?.character_count);
  const limit = count(data?.character_limit);
  const reset = data?.next_character_count_reset_unix;
  const resetDate =
    typeof reset === "number" && reset > 0 ? new Date(reset * 1000) : null;
  return {
    tier: typeof data?.tier === "string" ? data.tier : null,
    used,
    limit,
    remaining:
      used !== null && limit !== null ? Math.max(0, limit - used) : null,
    resetsAt:
      resetDate && Number.isFinite(resetDate.getTime())
        ? resetDate.toISOString()
        : null,
    checkedAt: new Date().toISOString(),
  };
}

export function createElevenLabsPool({
  state = {},
  persist = async () => {},
  fetchImpl = fetch,
  now = Date.now,
} = {}) {
  state.elevenlabs ||= { entries: {}, nextId: null };
  const pool = state.elevenlabs;
  const fingerprint = (account) =>
    createHash("sha256")
      .update(account.key || "")
      .digest("hex");
  function entry(account) {
    const id = `account:${account.id}`;
    if (pool.entries[id]?.fingerprint !== fingerprint(account))
      pool.entries[id] = { fingerprint: fingerprint(account) };
    return pool.entries[id];
  }
  function cached(config) {
    return {
      accounts: elevenLabsAccounts(config).map((account) => {
        const saved = entry(account);
        return {
          accountId: account.id,
          usage: saved.usage || null,
          error: saved.error || "",
          cooldownUntil: saved.cooldownUntil || null,
        };
      }),
    };
  }
  async function usage(config, accountId) {
    const accounts = elevenLabsAccounts(config);
    if (!accountId && accounts.length > 1)
      throw Error("Choose an ElevenLabs account.");
    const account = accountId
      ? accounts.find((value) => value.id === accountId)
      : accounts[0];
    if (!account?.key) throw Error("Save your ElevenLabs API key first.");
    const saved = entry(account);
    if (saved.cooldownUntil > now())
      throw Error(
        "This account is cooling down. Refresh after the displayed time.",
      );
    try {
      saved.usage = await elevenLabsUsage(
        { elevenlabs: { key: account.key } },
        fetchImpl,
      );
      delete saved.error;
      delete saved.cooldownUntil;
    } catch (error) {
      delete saved.usage;
      saved.error = error.message;
      if (error instanceof ElevenLabsLimitError)
        saved.cooldownUntil = now() + error.retryAfter * 1000;
      await persist(state);
      throw error;
    }
    await persist(state);
    return saved.usage;
  }
  async function select(config, minimumCredits = 1) {
    if (!Number.isSafeInteger(minimumCredits) || minimumCredits < 1)
      throw Error("Provide a positive credit estimate.");
    const accounts = elevenLabsAccounts(config).filter(
      (account) => account.enabled !== false && account.key,
    );
    const start = Math.max(
      0,
      accounts.findIndex((account) => account.id === pool.nextId),
    );
    for (let offset = 0; offset < accounts.length; offset++) {
      const index = (start + offset) % accounts.length;
      const account = accounts[index];
      if (entry(account).cooldownUntil > now()) continue;
      let snapshot;
      try {
        snapshot = await usage(config, account.id);
      } catch (error) {
        if (!entry(account).error) throw error;
        continue;
      }
      if (snapshot.remaining === null || snapshot.remaining < minimumCredits)
        continue;
      pool.nextId = accounts[(index + 1) % accounts.length].id;
      await persist(state);
      return { account, usage: snapshot };
    }
    throw Error(
      "No enabled ElevenLabs account has enough verified credits right now. Refresh credits or add another account.",
    );
  }
  return { usage, cached, select };
}
