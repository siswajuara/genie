// Semantic identifiers in the user's exported standard frame, never array offsets.
export const brandRole = (o) =>
  o.brandRole === "content"
    ? undefined
    : o.brandRole ||
      (/^siswa-juara-logo-/.test(o.identifier || "")
        ? "logo"
        : /^(footer-pill|website|handle|divider-1|divider-2|social-(tiktok|instagram|facebook|youtube|threads)-)/.test(
              o.identifier || "",
            ) ||
            [
              "footer-pill",
              "website",
              "handle",
              "divider-1",
              "divider-2",
            ].includes(o.identifier)
          ? "footer"
          : undefined);
export function standardBranding(preset) {
  const objects = preset.objects.filter(brandRole).map((o) => {
    const { fid, gid, animation, ...element } = o;
    return { ...element, brandRole: brandRole(o), lock: false };
  });
  if (
    !objects.some((o) => o.brandRole === "logo") ||
    !objects.some((o) => o.brandRole === "footer")
  )
    throw Error(
      "The standard frame needs its logo and footer elements with semantic identifiers.",
    );
  return { version: 1, W: preset.W, H: preset.H, objects };
}
export function withoutLegacyBranding(objects) {
  return objects.filter(
    (o) =>
      !brandRole(o) &&
      !/^(Siswa Juara logo|Footer|Website|Handle|Divider [12]|TikTok|Instagram|Facebook|YouTube|Threads|Brand)$/i.test(
        o.n,
      ),
  );
}
