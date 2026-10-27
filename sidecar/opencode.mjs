import { OpenCode } from "@opencode/client";
import { access } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { normalizeOpenCode } from "./opencode-config.mjs";

const TEXT_PATH = "/api/experimental/generate/text";
const LEGACY_TEXT_PATH = "/api/experimental/generate";
const serviceUrl = (baseUrl, pathname) =>
  new URL(pathname.slice(1), `${baseUrl.replace(/\/+$/, "")}/`);

async function discoverTextGenerationPath(baseUrl, headers, transport, signal) {
  let response;
  try {
    response = await transport(serviceUrl(baseUrl, "/openapi.json"), {
      headers,
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(30000)])
        : AbortSignal.timeout(30000),
    });
  } catch (error) {
    // Some service proxies hide the schema. The original route works on 2.1
    // and remains an alias on 2.2. Choose it before inference, never on retry.
    if (error.status === 404) return LEGACY_TEXT_PATH;
    throw error;
  }
  let schema;
  try {
    schema = await response.json();
  } catch {
    throw Object.assign(
      Error(
        "OpenCode returned an unreadable API description. Check the service URL.",
      ),
      { code: "OPENCODE_API_UNAVAILABLE" },
    );
  }
  if (schema?.paths?.[TEXT_PATH]?.post) return TEXT_PATH;
  if (schema?.paths?.[LEGACY_TEXT_PATH]?.post) return LEGACY_TEXT_PATH;
  throw Object.assign(
    Error(
      "The OpenCode service does not advertise a stateless text generation API. Check the service URL and installed OpenCode version.",
    ),
    { code: "OPENCODE_API_UNAVAILABLE" },
  );
}

async function localServiceOptions(env) {
  if (env.OPENCODE_BIN)
    return { command: [env.OPENCODE_BIN, "serve", "--service"] };
  // Finder-launched desktop apps often omit the installer's bin directory.
  const binary = path.join(
    homedir(),
    ".opencode",
    "bin",
    process.platform === "win32" ? "opencode.exe" : "opencode",
  );
  try {
    await access(binary);
    return { command: [binary, "serve", "--service"] };
  } catch {
    return {};
  } // Service.ensure uses opencode from PATH by default.
}
export function modelCatalog(value) {
  const rows = Array.isArray(value) ? value : value?.data;
  if (!Array.isArray(rows))
    throw Error("OpenCode returned an unreadable model catalog.");
  return rows.flatMap((row) => {
    const providerID = row?.providerID ?? row?.provider?.id ?? row?.provider;
    if (
      typeof providerID !== "string" ||
      typeof row?.id !== "string" ||
      !providerID ||
      !row.id ||
      /codex|cloudflare|gpt-oss-120b/i.test(`${providerID}/${row.id}`)
    )
      return [];
    return [
      {
        providerID,
        id: row.id,
        name: typeof row.name === "string" ? row.name : row.id,
      },
    ];
  });
}
export function pickModel(models, forced = "") {
  if (forced) {
    const normalized = normalizeOpenCode({ model: forced }).model,
      slash = normalized.indexOf("/");
    const found = models.find(
      (row) =>
        row.providerID === normalized.slice(0, slash) &&
        row.id === normalized.slice(slash + 1),
    );
    if (!found)
      throw Error(
        "The selected OpenCode model is unavailable. Load models in Setting → AI generation and choose an available provider/model.",
      );
    return { providerID: found.providerID, id: found.id };
  }
  const beam = models.filter((row) => row.id.toLowerCase() === "beam-free");
  const selected =
    beam.find((row) => row.providerID === "opencode-go") || beam[0];
  if (!selected)
    throw Error(
      "Beam Free is not in the OpenCode model catalog. Enable it in OpenCode, then load models in Setting → AI generation. No other model was used.",
    );
  return { providerID: selected.providerID, id: selected.id };
}
export async function connectOpenCode(config, fetchImpl = fetch, runtime = {}) {
  const env = runtime.environment ?? process.env;
  const saved = normalizeOpenCode(config.opencode);
  const settings = normalizeOpenCode({
    url: env.OPENCODE_URL || saved.url,
    token: env.OPENCODE_TOKEN || saved.token,
    model: env.OPENCODE_MODEL || saved.model,
  });
  let baseUrl = settings.url,
    headers = {};
  if (baseUrl) {
    if (settings.token) headers.authorization = `Bearer ${settings.token}`;
  } else {
    const service =
      runtime.service || (await import("@opencode/client/service")).Service;
    let endpoint;
    try {
      endpoint = await service.ensure(await localServiceOptions(env));
    } catch {
      throw Error(
        "Could not start or connect to OpenCode. Install OpenCode 2, sign in to OpenCode Go, or set a running service URL in Setting → AI generation.",
      );
    }
    baseUrl = normalizeOpenCode({ url: endpoint.url }).url;
    headers = service.headers(endpoint);
  }
  const transport = async (input, options) => {
    const response = await fetchImpl(input, { ...options, redirect: "error" });
    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      // Keep HTTP status even when an older service returns a non-SDK error body.
      throw Object.assign(Error("OpenCode HTTP request failed."), {
        status: response.status,
        endpoint: new URL(input instanceof Request ? input.url : input)
          .pathname,
      });
    }
    return response;
  };
  let generationPathPromise;
  const textGenerationPath = (signal) =>
    (generationPathPromise ??= discoverTextGenerationPath(
      baseUrl,
      headers,
      transport,
      signal,
    ));
  const sdkTransport = async (input, options) => {
    // Keep the SDK's input/output handling while supporting OpenCode 2.1's
    // original endpoint. API discovery is read-only and precedes the sole POST.
    const url = new URL(input instanceof Request ? input.url : input);
    if (
      options?.method === "POST" &&
      url.pathname === serviceUrl(baseUrl, TEXT_PATH).pathname
    )
      input = serviceUrl(baseUrl, await textGenerationPath(options.signal));
    return transport(input, options);
  };
  return {
    client: OpenCode.make({ baseUrl, headers, fetch: sdkTransport }),
    settings,
    textGenerationPath,
  };
}
export async function listOpenCodeModels(
  config,
  fetchImpl = fetch,
  runtime = {},
) {
  const { client } = await connectOpenCode(config, fetchImpl, runtime);
  try {
    return modelCatalog(
      await client.model.list(undefined, {
        signal: AbortSignal.timeout(30000),
      }),
    );
  } catch (error) {
    throw openCodeError(error, "list models");
  }
}
export function openCodeError(error, operation = "generate content", model) {
  const detail = error?.cause || error;
  if (detail?.code === "OPENCODE_API_UNAVAILABLE") return Error(detail.message);
  const status = error?.status ?? error?.response?.status ?? detail?.status;
  const endpoint = detail?.endpoint || error?.endpoint;
  const modelLabel = model ? ` ${model.providerID}/${model.id}` : "";
  if (status === 401 || status === 403)
    return Error(
      "OpenCode rejected authentication. Check the service token and your OpenCode provider connection.",
    );
  if (status === 429)
    return Error(
      "OpenCode or its model provider reached a usage/rate limit. Try again later; no fallback model was used.",
    );
  if (status === 404 && operation === "list models")
    return Error(
      "OpenCode's model catalog API is unavailable (HTTP 404). Check the service URL in AI generation settings.",
    );
  if (status === 404)
    return Error(
      `OpenCode could not find the selected model${modelLabel} or generation route (HTTP 404${endpoint ? ` at ${endpoint}` : ""}). Reload the model catalog and check the service version. No generation retry was made.`,
    );
  if (status === 422)
    return Error(
      `OpenCode does not support the selected model${modelLabel} for text generation (HTTP 422). Choose a text model from the catalog.`,
    );
  return Error(
    `OpenCode could not ${operation}. Check the service connection${operation === "generate content" ? " and model usage before explicitly retrying" : ""}.`,
  );
}
export function extractJson(text) {
  if (typeof text !== "string" || text.length > 2_000_000)
    throw Error("OpenCode returned unreadable content.");
  const cleaned = text.replace(/^```(?:json)?\s*|\s*```$/gi, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    /* Scan balanced values, respecting quoted brackets and escapes. */
  }
  for (let start = 0; start < cleaned.length; start++) {
    if (!["{", "["].includes(cleaned[start])) continue;
    const stack = [];
    let quoted = false,
      escaped = false;
    for (let i = start; i < cleaned.length; i++) {
      const c = cleaned[i];
      if (quoted) {
        if (escaped) escaped = false;
        else if (c === "\\") escaped = true;
        else if (c === '"') quoted = false;
        continue;
      }
      if (c === '"') quoted = true;
      else if (c === "{" || c === "[") stack.push(c);
      else if (c === "}" || c === "]") {
        if (stack.pop() !== (c === "}" ? "{" : "[")) break;
        if (!stack.length) {
          try {
            return JSON.parse(cleaned.slice(start, i + 1));
          } catch {
            break;
          }
        }
      }
    }
  }
  throw Error(
    "OpenCode did not return valid scene JSON. Generate again explicitly.",
  );
}
