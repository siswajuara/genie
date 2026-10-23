export function validateApiUrl(value) {
  const url = new URL(value);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    (url.protocol !== "https:" && !(local && url.protocol === "http:")) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw Error(
      "Use an HTTPS website API URL, or HTTP localhost for development.",
    );
  return url.href.replace(/\/$/, "");
}
export async function requestSocialApi(
  config,
  action,
  payload = {},
  fetchImpl = fetch,
) {
  if (!config.url || !config.token)
    throw Error("Connect your website API in Setting → Social accounts first.");
  const url =
    validateApiUrl(config.url) +
    (action === "settings" ? "/settings" : "/request");
  const response = await fetchImpl(url, {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(290000),
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(action === "settings" ? payload : { action, payload }),
  });
  let result;
  try {
    result = await response.json();
  } catch {
    throw Error(
      `The website API returned an invalid response (${response.status}).`,
    );
  }
  if (!response.ok || result.error)
    throw Error(
      String(result.error || `Website API failed (${response.status}).`)
        .split(config.token)
        .join("[redacted]"),
    );
  return result.data;
}
