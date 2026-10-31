import { copy, validateElements, type Element, type Preset } from "./model";
import {
  assetPackRevision,
  hasPresetLibrary,
  loadPackPresetFile,
} from "./assets";
import { localStore } from "../lib/local-store";
import { headerBranding, brandingRole, withSceneSafeLayout } from "./scene-safe-layout.mjs";

type Branding = { version: 1; W: number; H: number; objects: Element[] };
const key = "genie.standard-branding.v1";
export const brandingChanged = "genie-standard-branding-changed";
let bundled: Promise<Branding> | undefined;
let revision = -1;

const role = brandingRole;
const isBrandElement = (o: Element) =>
  ["logo", "handle", "footer"].includes(role(o) || "");
function validate(value: unknown): Branding {
  const b = value as Branding;
  if (
    !b ||
    b.version !== 1 ||
    ![b.W, b.H].every((n) => Number.isFinite(n) && n > 0 && n <= 16000)
  )
    throw Error("Invalid standard frame dimensions.");
  const objects = validateElements(b.objects);
  if (
    !objects.some((o) => o.brandRole === "logo") ||
    !objects.some((o) => ["handle", "footer"].includes(role(o) || "")) ||
    objects.some(
      (o) =>
        !["logo", "handle", "footer"].includes(role(o) || "") ||
        o.t === "frame" ||
        o.fid,
    )
  )
    throw Error("The standard frame needs separate logo and handle elements.");
  return { ...b, objects };
}
export function hasCustomBranding() {
  return !!localStore.getItem(key);
}
export function setStandardFrame(preset: Preset) {
  const objects = preset.objects.filter(isBrandElement).map((o) => {
    const { fid, gid, animation, ...rest } = copy(o);
    return { ...rest, brandRole: role(o), lock: false };
  });
  const b = validate({ version: 1, W: preset.W, H: preset.H, objects });
  localStore.setItem(key, JSON.stringify(b));
  window.dispatchEvent(new Event(brandingChanged));
}
export function resetStandardFrame() {
  localStore.removeItem(key);
  window.dispatchEvent(new Event(brandingChanged));
}
async function standardFrame() {
  const local = localStore.getItem(key);
  if (local) return validate(JSON.parse(local));
  if (revision !== assetPackRevision()) {
    revision = assetPackRevision();
    bundled = undefined;
  }
  if (!bundled) {
    const request = loadPackPresetFile("presets/shared/branding.json")
      .then(async (blob) => validate(JSON.parse(await blob.text())))
      .catch((e) => {
        if (bundled === request) bundled = undefined;
        throw e;
      });
    bundled = request;
  }
  return bundled;
}
export async function withStandardBranding(preset: Preset): Promise<Preset> {
  if (!preset.branding || preset.kind !== "template") return preset;
  // Portable saved/imported templates already contain their branding snapshot.
  if (
    !hasPresetLibrary() &&
    !hasCustomBranding() &&
    preset.objects.some((o) => role(o) === "logo") &&
    preset.objects.some((o) => ["handle", "footer"].includes(role(o) || ""))
  )
    return withSceneSafeLayout({ ...preset, objects: [
      ...preset.objects.filter((o) => !isBrandElement(o)),
      ...headerBranding(preset.objects, preset.W || 1122, preset.H || 1402),
    ] });
  const b = await standardFrame();
  const branding = headerBranding(b.objects, preset.W || b.W, preset.H || b.H);
  const objects = preset.objects.filter((o) => !isBrandElement(o));
  const ids = new Set(objects.map((o) => o.id));
  branding.forEach((o, i) => {
    let id = `standard-brand-${i + 1}`;
    while (ids.has(id)) id += "-brand";
    ids.add(id);
    const element = {
      ...copy(o),
      id,
    };
    objects.push(element);
  });
  // Application snapshots these ordinary elements into the canvas; later standard
  // edits only affect future insertions or an explicit update of the selected frame.
  return withSceneSafeLayout({ ...preset, objects });
}
