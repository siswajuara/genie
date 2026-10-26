// Read authoritative rate windows from provider responses, including HTTP errors.
const number = (value) =>
  value !== null &&
  value !== undefined &&
  value !== "" &&
  Number.isFinite(Number(value))
    ? Number(value)
    : undefined;
const entries = (value) =>
  [...(value || "").matchAll(/"([^"]+)"([^,]*)/g)].map(([, name, params]) => ({
    name,
    ...Object.fromEntries(
      [...params.matchAll(/;\s*(\w+)\s*=\s*([^;\s]+)/g)].map(
        ([, key, value]) => [key, value],
      ),
    ),
  }));
export function captureUsage(
  provider,
  response,
  previous = {},
  now = Date.now(),
  analytics = false,
) {
  const observedAt = new Date(now).toISOString();
  let windows = [];
  if (provider === "buffer") {
    const policies = entries(response.headers.get("ratelimit-policy"));
    windows = entries(response.headers.get("ratelimit")).map((entry) => {
      const policy = policies.find((item) => item.name === entry.name);
      const seconds = number(entry.t);
      return {
        name: entry.name,
        limit: number(policy?.q),
        windowSeconds: number(policy?.w),
        remaining: number(entry.r),
        resetAt:
          seconds === undefined
            ? undefined
            : new Date(now + seconds * 1000).toISOString(),
        observedAt,
      };
    });
  } else {
    const limit = number(response.headers.get("x-ratelimit-limit"));
    const remaining = number(response.headers.get("x-ratelimit-remaining"));
    const reset = number(response.headers.get("x-ratelimit-reset"));
    if (limit !== undefined || remaining !== undefined)
      windows = [
        {
          name: analytics ? "analytics" : "requests",
          limit,
          remaining,
          windowSeconds: analytics ? 1 : 60,
          resetAt:
            reset === undefined
              ? undefined
              : new Date(reset * 1000).toISOString(),
          observedAt,
        },
      ];
  }
  const identity = (item) =>
    item.windowSeconds ? `seconds:${item.windowSeconds}` : item.name;
  const byName = new Map(
    (previous.windows || []).map((item) => [identity(item), item]),
  );
  for (const item of windows) byName.set(identity(item), item);
  const retry = response.headers.get("retry-after");
  const retrySeconds = number(retry);
  const retryAt =
    response.status === 429
      ? retrySeconds !== undefined
        ? new Date(now + retrySeconds * 1000).toISOString()
        : Number.isFinite(Date.parse(retry))
          ? new Date(retry).toISOString()
          : undefined
      : previous.retryAt && Date.parse(previous.retryAt) > now
        ? previous.retryAt
        : undefined;
  return { ...previous, windows: [...byName.values()], observedAt, retryAt };
}
export function assertRequestBudget(
  snapshot,
  analytics = false,
  now = Date.now(),
) {
  const exhausted = snapshot?.windows?.find(
    (w) =>
      w.remaining === 0 &&
      Date.parse(w.resetAt) > now &&
      (w.name !== "analytics" || analytics) &&
      (w.name !== "requests" || !analytics),
  );
  const until = Math.max(
    Date.parse(snapshot?.retryAt) || 0,
    Date.parse(exhausted?.resetAt) || 0,
  );
  if (until > now)
    throw Error(
      `Provider request limit reached. Retry after ${Math.ceil((until - now) / 1000)} seconds (${new Date(until).toISOString()}).`,
    );
}
