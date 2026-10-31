import { brandingRole, headerBranding } from "../src/editor/scene-safe-layout.mjs";
export const brandRole = brandingRole;
export function standardBranding(preset) {
  return { version: 1, W: preset.W, H: preset.H,
    objects: headerBranding(preset.objects, preset.W, preset.H) };
}
export function withoutLegacyBranding(objects) {
  return objects.filter((o) => !brandRole(o) &&
    !/^(Siswa Juara logo|Footer(?: rule)?|Website|Handle|Divider [12]|TikTok|Instagram|Facebook|YouTube|Threads|Brand)$/i.test(o.n));
}
