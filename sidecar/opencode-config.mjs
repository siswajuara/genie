export function normalizeOpenCode(value = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Invalid OpenCode configuration.");
  const result = {
    url: value.url ?? "",
    token: value.token ?? "",
    model: value.model ?? "",
  };
  if (typeof result.url !== "string" || result.url.length > 2048)
    throw Error("Enter a valid OpenCode service URL.");
  if (result.url.trim()) {
    let url;
    try {
      url = new URL(result.url.trim());
    } catch {
      throw Error("Enter a valid OpenCode service URL.");
    }
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw Error(
        "Use an HTTP(S) service URL without embedded credentials, a query, or a fragment.",
      );
    result.url = url.href.replace(/\/+$/, "");
  } else result.url = "";
  if (
    typeof result.token !== "string" ||
    result.token.length > 8192 ||
    /[\r\n\0]/.test(result.token)
  )
    throw Error("Enter a valid OpenCode service token.");
  result.token = result.token.trim();
  if (typeof result.model !== "string" || result.model.length > 300)
    throw Error("Use provider/model for the OpenCode model.");
  result.model = result.model.trim();
  if (result.model && !/^[\w.-]+\/[^\s\0]+$/.test(result.model))
    throw Error("Use provider/model for the OpenCode model.");
  if (/codex|cloudflare|gpt-oss-120b/i.test(result.model))
    throw Error(
      "Choose an OpenCode model; Codex and Cloudflare generation are disabled.",
    );
  return result;
}
export function saveOpenCodeConfig(config, payload) {
  const current = normalizeOpenCode(config.opencode);
  for (const key of ["url", "model", "token"])
    if (payload[key] !== undefined) current[key] = payload[key];
  if (payload.removeToken === true) current.token = "";
  config.opencode = normalizeOpenCode(current);
}
export function publicOpenCode(value) {
  const settings = normalizeOpenCode(value);
  return {
    url: settings.url,
    model: settings.model,
    tokenConfigured: !!settings.token,
    mode: settings.url ? "url" : "local",
  };
}
