// Tebar reports reset as seconds from this response, not a Unix timestamp.
const number = (value) => value !== null && value !== "" && Number.isFinite(Number(value)) ? Number(value) : undefined;
export function captureUsage(provider, response, previous = {}, now = Date.now()) {
  const observedAt = new Date(now).toISOString();
  const limit = number(response.headers.get("RateLimit-Limit"));
  const remaining = number(response.headers.get("RateLimit-Remaining"));
  const reset = number(response.headers.get("RateLimit-Reset"));
  const retry = response.headers.get("Retry-After");
  const seconds = number(retry);
  const retryAt = response.status === 429
    ? seconds !== undefined ? new Date(now + seconds * 1000).toISOString()
      : Number.isFinite(Date.parse(retry)) ? new Date(retry).toISOString() : undefined
    : previous.retryAt && Date.parse(previous.retryAt) > now ? previous.retryAt : undefined;
  const windows = limit !== undefined || remaining !== undefined ? [{
    name: "requests", limit, remaining, windowSeconds: 60, observedAt,
    resetAt: reset === undefined ? undefined : new Date(now + reset * 1000).toISOString(),
  }] : previous.windows || [];
  return { windows, observedAt, retryAt };
}
export function assertRequestBudget(snapshot, now = Date.now()) {
  const exhausted = snapshot?.windows?.find((w) => w.remaining === 0 && Date.parse(w.resetAt) > now);
  const until = Math.max(Date.parse(snapshot?.retryAt) || 0, Date.parse(exhausted?.resetAt) || 0);
  if (until > now) throw Error(`Tebar request limit reached. Retry after ${Math.ceil((until - now) / 1000)} seconds (${new Date(until).toISOString()}).`);
}
