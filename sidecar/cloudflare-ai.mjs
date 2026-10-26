const STORY_MODEL = "@cf/openai/gpt-oss-120b";

export function publicCloudflare(config) {
  const c = config.cloudflare || {};
  return {
    configured: !!(c.accountId && (c.key || c.authToken)),
    accountId: c.accountId || "",
    gatewayId: c.gatewayId || "",
    model: STORY_MODEL,
  };
}
export function saveCloudflare(config, payload) {
  const next = { ...config.cloudflare, model: STORY_MODEL };
  if (payload.removeKey === true) {
    next.key = "";
    delete next.authToken;
  } else if (payload.key !== undefined) {
    if (
      typeof payload.key !== "string" ||
      !payload.key.trim() ||
      payload.key.length > 8192 ||
      /[\r\n]/.test(payload.key)
    )
      throw Error("Enter a valid Cloudflare API token.");
    next.key = payload.key.trim();
    delete next.authToken;
  }
  if (payload.accountId !== undefined) {
    if (
      typeof payload.accountId !== "string" ||
      !/^[a-f0-9]{32}$/i.test(payload.accountId.trim())
    )
      throw Error(
        "Cloudflare account ID must contain 32 hexadecimal characters.",
      );
    next.accountId = payload.accountId.trim();
  }
  if (payload.gatewayId !== undefined) {
    if (
      typeof payload.gatewayId !== "string" ||
      !/^[a-zA-Z0-9_-]{0,64}$/.test(payload.gatewayId.trim())
    )
      throw Error(
        "Use a gateway ID containing up to 64 letters, numbers, hyphens or underscores.",
      );
    next.gatewayId = payload.gatewayId.trim();
  }
  config.cloudflare = next;
}
export function extractCloudflareText(result) {
  if (typeof result?.response === "string") return result.response;
  if (typeof result?.output_text === "string") return result.output_text;
  const content = result?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  return (Array.isArray(result?.output) ? result.output : [])
    .filter((item) => item.type === "message")
    .flatMap((item) => (Array.isArray(item.content) ? item.content : []))
    .filter(
      (item) => item.type === "output_text" && typeof item.text === "string",
    )
    .map((item) => item.text)
    .join("\n");
}
export async function cloudflareChat(config, payload, fetchImpl = fetch) {
  if (payload.confirmed !== true)
    throw Error("Confirm generation before using Cloudflare inference.");
  const c = config.cloudflare || {},
    token = c.key || c.authToken;
  if (
    !token ||
    typeof token !== "string" ||
    /[\r\n]/.test(token) ||
    !/^[a-f0-9]{32}$/i.test(c.accountId || "")
  )
    throw Error(
      "Save your Cloudflare account ID and API token in Setting → Story AI.",
    );
  if (c.gatewayId && !/^[a-zA-Z0-9_-]{1,64}$/.test(c.gatewayId))
    throw Error("Invalid Cloudflare gateway ID.");
  if (
    !Array.isArray(payload.messages) ||
    payload.messages.length < 1 ||
    payload.messages.length > 8 ||
    payload.messages.some(
      (message) =>
        !message ||
        !["system", "user", "assistant"].includes(message.role) ||
        typeof message.content !== "string" ||
        !message.content.trim() ||
        message.content.length > 40000,
    )
  )
    throw Error(
      "Provide up to eight text messages under 40,000 characters each.",
    );
  const maxTokens = payload.maxTokens ?? 8192;
  if (!Number.isInteger(maxTokens) || maxTokens < 512 || maxTokens > 16384)
    throw Error("Output token limit must be between 512 and 16,384.");
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  if (c.gatewayId) headers["cf-aig-gateway-id"] = c.gatewayId;
  let response;
  try {
    response = await fetchImpl(
      `https://api.cloudflare.com/client/v4/accounts/${c.accountId}/ai/run/${STORY_MODEL}`,
      {
        method: "POST",
        headers,
        redirect: "error",
        signal: AbortSignal.timeout(180000),
        body: JSON.stringify({
          messages: payload.messages.map(({ role, content }) => ({
            role,
            content,
          })),
          max_tokens: maxTokens,
          stream: false,
          response_format: { type: "json_object" },
        }),
      },
    );
  } catch {
    throw Error(
      "Cloudflare generation was interrupted and may have used inference credits. Your draft was kept. Check the gateway before retrying.",
    );
  }
  if (!response.ok) {
    if ([401, 403].includes(response.status))
      throw Error(
        "Cloudflare rejected this account or token. Check Workers AI permissions and gateway access in Story AI settings.",
      );
    if (response.status === 429)
      throw Error(
        "Cloudflare rate or usage limit reached. Your draft was kept; nothing was retried.",
      );
    throw Error(
      `Cloudflare generation failed (${response.status}). Check provider usage before retrying.`,
    );
  }
  let body;
  try {
    body = await response.json();
  } catch {
    throw Error(
      "Cloudflare returned an unreadable response. Your draft was kept; check provider usage before retrying.",
    );
  }
  if (body?.success === false)
    throw Error(
      "Cloudflare could not complete generation. Check your account and gateway; your draft was kept.",
    );
  const result = body?.result ?? body;
  const text = extractCloudflareText(result);
  if (!text || text.length > 200000)
    throw Error(
      "Cloudflare returned no usable story text. Your draft was kept; check provider usage before retrying.",
    );
  const usage = result?.usage;
  const count = (...values) =>
    values.find((v) => Number.isSafeInteger(v) && v >= 0) ?? null;
  return {
    text,
    usage: usage
      ? {
          inputTokens: count(usage.input_tokens, usage.prompt_tokens),
          outputTokens: count(usage.output_tokens, usage.completion_tokens),
          totalTokens: count(usage.total_tokens),
        }
      : null,
    model: STORY_MODEL,
    requestId:
      response.headers.get("cf-aig-log-id") ||
      response.headers.get("cf-ray") ||
      null,
    incomplete:
      result?.status === "incomplete" ||
      result?.choices?.[0]?.finish_reason === "length",
    checkedAt: new Date().toISOString(),
  };
}
