import { invoke, isTauri } from "@tauri-apps/api/core";
export type ApiConnection = {
  url: string;
  configured: boolean;
  storage: "keychain" | "memory";
};
let browser = { url: import.meta.env.VITE_SOCIAL_API_URL || "", token: "" };
export async function apiConnection(values?: {
  url?: string;
  token?: string;
  remove?: boolean;
}): Promise<ApiConnection> {
  if (isTauri()) return invoke("social_settings", { payload: values || {} });
  if (values?.remove) browser = { url: "", token: "" };
  else if (values) {
    const url = new URL(values.url || browser.url);
    if (
      url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      )
    )
      throw Error("Use HTTPS or HTTP localhost.");
    if (url.username || url.password || url.search || url.hash)
      throw Error("Use a URL without credentials, query, or fragment.");
    if(browser.token && url.href.replace(/\/$/,'')!==browser.url && !values.token)throw Error('Enter a token for the new API URL.');
    browser = {
      url: url.href.replace(/\/$/, ""),
      token: values.token || browser.token,
    };
  }
  return { url: browser.url, configured: !!browser.token, storage: "memory" };
}
export async function websiteRequest<T>(
  endpoint: string,
  body: unknown,
): Promise<T> {
  if (isTauri())
    return invoke(
      "social_request",
      endpoint === "settings"
        ? { action: "settings", payload: body }
        : (body as Record<string, unknown>),
    );
  if (!browser.url || !browser.token)
    throw Error("Connect your website API in Setting → Social accounts first.");
  const response = await fetch(`${browser.url}/${endpoint}`, {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(290000),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${browser.token}`,
    },
    body: JSON.stringify(body),
  });
  let result;
  try {
    result = await response.json();
  } catch {
    throw Error(
      `Website API returned an invalid response (${response.status}).`,
    );
  }
  if (!response.ok || result.error)
    throw Error(
      String(result.error || "Website API request failed.")
        .split(browser.token)
        .join("[redacted]"),
    );
  return result.data as T;
}
