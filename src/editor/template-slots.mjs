// Persist roles in prepared packs; infer them for older external packs as well.
export function withGenerationSlots(preset) {
  const objects = preset.objects.map((object) => {
    if (object.t !== "text" || object.generationRole) return { ...object };
    const text = (object.text || "").trim();
    const page = /^\d{1,2}\s*\/\s*\d{1,2}$/.test(text);
    const fixed =
      object.brandRole === "logo" ||
      object.brandRole === "footer" ||
      object.brandRole === "handle" ||
      /SISWA\s+JUARA|siswajuara\.com|@siswajuara/i.test(
        text + " " + object.n,
      ) ||
      /^(Brand|Use case|Call to action)$/i.test(object.n) ||
      /^(KUIS MINI|MINI QUIZ)$/i.test(text) ||
      (/^(?:\d{1,2}|[A-D])[.)]?$/.test(text) &&
        object.w < (preset.W || 1122) * 0.2) ||
      /^[→←↑↓•]+$/.test(text) ||
      (text === "?" && object.w < (preset.W || 1122) * 0.15);
    return {
      ...object,
      generationRole: page ? "page-number" : fixed ? "fixed" : "editable",
    };
  });
  const headlineSize = Math.min(60, Math.max(1, ...objects
    .filter((o) => o.t === "text" && o.generationRole === "editable" && !o.hide && o.y < (preset.H || 1402) * 0.4)
    .map((o) => (o.size || 0) * 0.75)));
  const headlines = objects
    .filter(
      (o) =>
        o.t === "text" &&
        o.generationRole === "editable" &&
        !o.hide &&
        (o.size || 0) >= headlineSize &&
        o.y < (preset.H || 1402) * 0.4,
    )
    .sort((a, b) => a.y - b.y || a.x - b.x);
  // A vertical stack forms one headline. Side-by-side cards remain separate slots.
  let group = 0;
  for (let i = 0; i < headlines.length; i++) {
    const current = headlines[i],
      previous = headlines[i - 1];
    if (
      !previous ||
      Math.abs(current.x - previous.x) > 120 ||
      current.y - previous.y > previous.h + 100 ||
      current.y <= previous.y
    )
      group++;
    if (!current.generationGroup) current.generationGroup = `headline-${group}`;
  }
  return { ...preset, objects };
}
