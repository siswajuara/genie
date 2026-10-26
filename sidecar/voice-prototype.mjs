// Keep prototype generation aligned with test.ts, across the editor and sidecar.
export const PROTOTYPE_VOICE_ID = "CwhRBWXzGAHq8TQ4Fs17";
export const PROTOTYPE_VOICE_NAME = "Roger";
export const SPEECH_MODEL = "eleven_v4";

export const VOICE_DIRECTIONS = {
  emotion: ["curious", "playful", "excited", "tired", "angry", "bored"],
  vocalization: [
    "chuckling",
    "sighing",
    "laughing",
    "gasping",
    "clears throat",
    "sharp exhale",
  ],
  delivery: ["whispering", "slowly", "softly", "pause", "voice breaking"],
  character: ["sleepy drowsy voice", "witch voice"],
  sound: ["bell ringing", "applause", "rain falling", "knocking on door"],
};

export function spokenText(script) {
  return script
    .replace(/\[[^\]\n]+\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
