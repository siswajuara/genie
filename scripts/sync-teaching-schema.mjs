import fs from "node:fs/promises";
import path from "node:path";
import { learningModels } from "../sidecar/learning.mjs";
import { physicsModels } from "../sidecar/science.mjs";
const file = path.resolve(import.meta.dirname, "../sidecar/canvas.schema.json");
const modelSchema = (models, physics) => ({
  oneOf: Object.entries(models).map(([kind, m]) => {
    const properties = {
      kind: { const: kind },
      ...(physics
        ? { loop: { type: "boolean" }, trail: { type: "boolean" } }
        : { animate: { type: "boolean" } }),
    };
    for (const [key, value] of Object.entries(m.defaults))
      properties[key] =
        m.fields?.[key] ||
        (typeof value === "number"
          ? {
              type: m.integers?.includes(key) ? "integer" : "number",
              minimum: m.ranges[key][0],
              maximum: m.ranges[key][1],
            }
          : typeof value === "string"
            ? { type: "string", minLength: 1, maxLength: 64 }
            : {
                type: "array",
                minItems: 1,
                maxItems: 8,
                items:
                  typeof value[0] === "number"
                    ? { type: "number", minimum: 0, maximum: 100 }
                    : { type: "string", minLength: 1, maxLength: 64 },
              });
    return {
      type: "object",
      required: ["kind"],
      description: m.description || m.label,
      properties,
      additionalProperties: false,
    };
  }),
});
let source = await fs.readFile(file, "utf8");
for (const [name, models, physics, next] of [
  ["physicsSpec", physicsModels, true, "learningSpec"],
  ["learningSpec", learningModels, false, "element"],
]) {
  const begin = source.indexOf(`    "${name}": {`),
    end = source.indexOf(`    "${next}": {`, begin);
  if (begin < 0 || end < 0) throw Error("Missing teaching schema section.");
  source =
    source.slice(0, begin) +
    `    "${name}": {\n      "oneOf": [\n${modelSchema(models, physics)
      .oneOf.map((v) => "        " + JSON.stringify(v))
      .join(",\n")}\n      ]\n    },\n` +
    source.slice(end);
}
if (!JSON.parse(source).$defs.element.properties.aiDescription)
  source = source.replace(
    '        "latex": {',
    '        "aiDescription": { "type": "string", "maxLength": 4000 },\n        "latex": {',
  );
JSON.parse(source);
await fs.writeFile(file, source);
console.log("Synchronized teaching schema with model catalogs.");
