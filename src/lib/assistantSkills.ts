import catalog from "../../sidecar/skills/catalog.json";
export const assistantSkills = catalog;
export function assistantBrand() {
  try {
    const settings = JSON.parse(
      localStorage.getItem("genie.marketing.settings") || "{}",
    );
    return {
      name: settings.name,
      description: settings.description,
      website: settings.website,
    };
  } catch {
    return undefined;
  }
}
