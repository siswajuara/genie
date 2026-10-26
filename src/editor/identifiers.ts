export function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
const colors =
  "blue-yellow|blue-gold|blue|yellow|gold|gray|grey|red|green|orange|purple|pink|white|black|brown|original";
const facing = "front|back|left|right|up|down";
const suffix = new RegExp(`^(.+?)-(${colors})-(${facing})$`);
function parseAssetIdentifier(value: string) {
  const match = slugify(value).match(suffix);
  return match
    ? {
        name: match[1],
        color: match[2].replace("grey", "gray"),
        facing: match[3],
      }
    : undefined;
}
export function identifierFromAssetFile(file: string) {
  const stem = slugify(file.replace(/\.[^.]+$/, ""));
  const match = stem.match(
    new RegExp(`^(.*?)-(${colors})-(${facing})-[0-9]+(?:-(.*))?$`),
  );
  if (!match) return `${stem.replace(/-v\d+(?=-|$)/g, "")}-original-front`;
  const name = [
    match[1],
    (match[4] || "").replace(/(?:^|-)(?:single|multiple|v\d+)(?=-|$)/g, ""),
  ]
    .filter(Boolean)
    .join("-")
    .replace(/-v\d+(?=-|$)/g, "");
  return `${slugify(name)}-${match[2]}-${match[3]}`;
}
const aliases: Record<string, string> = {
  owls: "owl",
  books: "book",
  icons: "icon",
  mascots: "mascot",
  phones: "phone",
  laptops: "laptop",
  computers: "computer",
  grey: "gray",
  mobile: "phone",
  notebook: "book",
};
const generic = new Set([
  "student",
  "mascot",
  "single",
  "multiple",
  "icon",
  "image",
  "slot",
  "illustration",
]);
function words(value: string) {
  return new Set(
    value
      .split("-")
      .filter(Boolean)
      .map((word) => aliases[word] || word)
      .filter((word) => !generic.has(word)),
  );
}
export function matchAssetIdentifier<
  T extends { identifier: string; file: string },
>(identifier: string, assets: readonly T[]): T | undefined {
  const request = parseAssetIdentifier(identifier);
  if (!request) return;
  const wanted = words(request.name);
  if (!wanted.size) return;
  let best: T | undefined,
    bestScore = -Infinity;
  for (const asset of assets) {
    const candidate = parseAssetIdentifier(asset.identifier);
    if (!candidate) continue;
    const available = words(candidate.name);
    const overlap = [...wanted].filter((word) => available.has(word)).length;
    // Every meaningful subject/action token must match; colors and facing rank similar variants.
    if (overlap !== wanted.size) continue;
    const score =
      (request.name === candidate.name ? 100 : 0) +
      overlap * 10 -
      (available.size - overlap) * 2 +
      (request.color === candidate.color ? 30 : -15) +
      (request.facing === candidate.facing ? 15 : -8) +
      (asset.file.includes("-v") ? -1 : 0);
    if (
      score > bestScore ||
      (score === bestScore && asset.file.localeCompare(best!.file) < 0)
    ) {
      best = asset;
      bestScore = score;
    }
  }
  return best;
}
