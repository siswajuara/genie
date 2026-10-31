// Adapted for Genie's editable scene renderer from Animate's craft.md and
// grammar/{STORY,FRAME}.md. See licenses/Animate.LICENSE and docs/ai-generation.md.
export const motionPlans = ["hold", "build", "focus", "compare", "resolve"];
export const storyDirection = [
  "Plan this as an animated explainer, using one true process in its real order. Keep one recurring subject, example, or visual identity across scenes; reserve each semantic colour for the same meaning. Make the ending answer or revisit the opening idea with what the learner now understands.",
  "Give each scene one readable idea. Show causes, changes and comparisons using the supplied editable diagrams and assets where available. Do not merely repeat the narration as a wall of labels. Template geometry, logo at top left, handle at top right, and bottom caption space belong to the editor; never add footer text or duplicate branding to editable slots.",
  "Narration is the clock: keep scripts within the supplied duration and leave complete thoughts readable. A question needs a pause before the answer. Motion should support that reasoning and settle early enough to read the final state. Supplied source facts and accuracy notes take precedence over dramatic storytelling. Do not claim that unseen media, sound, beat alignment, loudness or a rendered movie have been inspected. Audio generation stays an explicit app operation; do not invent audio assets or calls to tools.",
].join("\n");
export const animationDirection = [storyDirection,
  "For every frame return motionPlan, exactly one of: hold (a question or quiet reading pause), build (reveal connected steps together), focus (bring attention to one idea or visual), compare (reveal two sides in order), resolve (a measured answer or recap). Choose it for the scene's meaning rather than repeating one effect everywhere. The app maps these plans to supported, deterministic layer animations; it owns timing, grouped cards, IDs and geometry. Never return executable animation code, arbitrary effects, cameras, or a replacement renderer.",
].join("\n");
export function parseMotionPlan(value) {
  if (value === undefined) return undefined; // Older providers/reviews remain readable.
  if (!motionPlans.includes(value)) throw Error("AI returned an unsupported scene motion plan.");
  return value;
}
