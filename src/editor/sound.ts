import type { Element } from "./model";
import { buildSequence } from "./animation";

export type AudioTrack = {
  id: string;
  name: string;
  src: string;
  role: "voiceover" | "music" | "sound";
  start: number;
  end: number;
  trimStart: number;
  sourceDuration: number;
  volume: number;
  loop: boolean;
  muted: boolean;
  fadeIn: number;
  fadeOut: number;
};
export type VoiceoverDraft = {
  script: string;
  voiceId: string;
  accountId: string;
  language: string;
  subtitles: boolean;
};

export function validateAudio(frame: Element) {
  if (frame.voiceoverDraft !== undefined) {
    const draft = frame.voiceoverDraft;
    if (
      frame.t !== "frame" ||
      !draft ||
      typeof draft.script !== "string" ||
      draft.script.length > 5000 ||
      typeof draft.voiceId !== "string" ||
      draft.voiceId.length > 100 ||
      typeof draft.accountId !== "string" ||
      draft.accountId.length > 80 ||
      typeof draft.language !== "string" ||
      draft.language.length > 3 ||
      typeof draft.subtitles !== "boolean"
    )
      throw Error("Invalid saved voiceover draft.");
  }
  if (frame.audioTracks === undefined) return;
  if (
    frame.t !== "frame" ||
    !Array.isArray(frame.audioTracks) ||
    frame.audioTracks.length > 32
  )
    throw Error("Use at most 32 audio tracks per frame.");
  const ids = new Set<string>();
  for (const track of frame.audioTracks) {
    if (
      !track ||
      typeof track.id !== "string" ||
      !track.id ||
      ids.has(track.id) ||
      typeof track.name !== "string" ||
      track.name.length > 200 ||
      typeof track.src !== "string" ||
      !/^data:audio\/(mpeg|mp3|wav|x-wav|wave|ogg|mp4|aac|flac|webm|x-m4a);base64,[a-z0-9+/]+=*$/i.test(
        track.src,
      ) ||
      !["voiceover", "music", "sound"].includes(track.role) ||
      ![
        track.start,
        track.end,
        track.trimStart,
        track.sourceDuration,
        track.volume,
        track.fadeIn,
        track.fadeOut,
      ].every(Number.isFinite) ||
      track.start < 0 ||
      track.end <= track.start ||
      track.end > 600 ||
      track.trimStart < 0 ||
      track.sourceDuration <= track.trimStart ||
      track.sourceDuration > 3600 ||
      track.volume < 0 ||
      track.volume > 1 ||
      track.fadeIn < 0 ||
      track.fadeOut < 0 ||
      track.fadeIn > 600 ||
      track.fadeOut > 600 ||
      typeof track.loop !== "boolean" ||
      typeof track.muted !== "boolean"
    )
      throw Error("Invalid embedded audio track or timing.");
    ids.add(track.id);
  }
}

export function audioPosition(track: AudioTrack, time: number) {
  if (track.muted || time < track.start || time >= track.end) return undefined;
  const length = track.sourceDuration - track.trimStart;
  if (length <= 0) return undefined;
  const elapsed = time - track.start;
  if (!track.loop && elapsed >= length) return undefined;
  return track.trimStart + (track.loop ? elapsed % length : elapsed);
}
export function audioGain(track: AudioTrack, time: number) {
  if (audioPosition(track, time) === undefined) return 0;
  const end = track.loop
    ? track.end
    : Math.min(track.end, track.start + track.sourceDuration - track.trimStart);
  return (
    track.volume *
    Math.min(
      1,
      track.fadeIn ? (time - track.start) / track.fadeIn : 1,
      track.fadeOut ? (end - time) / track.fadeOut : 1,
    )
  );
}

export async function readAudio(file: File) {
  if (file.size > 25 * 1024 * 1024)
    throw Error("Choose audio under 25 MB to keep local canvases manageable.");
  const context = new AudioContext();
  try {
    const bytes = await file.arrayBuffer();
    const decoded = await context.decodeAudioData(bytes.slice(0));
    if (
      !Number.isFinite(decoded.duration) ||
      decoded.duration <= 0 ||
      decoded.duration > 3600
    )
      throw Error("Choose an audio file up to one hour long.");
    const mime = /\.(mp3)$/i.test(file.name)
      ? "audio/mpeg"
      : /\.m4a$/i.test(file.name)
        ? "audio/mp4"
        : /\.wav$/i.test(file.name)
          ? "audio/wav"
          : file.type;
    const src = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(Error("Could not read the audio file."));
      reader.readAsDataURL(new Blob([bytes], { type: mime }));
    });
    return { src, duration: decoded.duration };
  } catch (error) {
    throw Error(
      error instanceof Error
        ? error.message
        : "This audio format cannot be decoded. Try MP3 or WAV.",
    );
  } finally {
    await context.close();
  }
}

export function audioToWav(buffer: AudioBuffer): Blob {
  const channels = Math.min(2, buffer.numberOfChannels);
  const samples = Array.from({ length: channels }, (_, channel) =>
    buffer.getChannelData(channel),
  );
  const bytes = new ArrayBuffer(44 + buffer.length * channels * 2),
    view = new DataView(bytes);
  const ascii = (at: number, text: string) => {
    for (let i = 0; i < text.length; i++)
      view.setUint8(at + i, text.charCodeAt(i));
  };
  ascii(0, "RIFF");
  view.setUint32(4, bytes.byteLength - 8, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  ascii(36, "data");
  view.setUint32(40, buffer.length * channels * 2, true);
  for (let i = 0; i < buffer.length; i++)
    for (let channel = 0; channel < channels; channel++) {
      const sample = Math.min(1, Math.max(-1, samples[channel][i]));
      view.setInt16(
        44 + (i * channels + channel) * 2,
        Math.round(sample * (sample < 0 ? 32768 : 32767)),
        true,
      );
    }
  return new Blob([bytes], { type: "audio/wav" });
}

export async function extractVideoAudio(
  src: string,
  start = 0,
  maxDuration = 600,
) {
  const { Input, BlobSource, ALL_FORMATS, AudioBufferSink } =
    await import("mediabunny");
  const response = await fetch(src);
  if (!response.ok)
    throw Error(
      "Could not read the video audio. Import a local video file or use a URL that allows CORS.",
    );
  const input = new Input({
    source: new BlobSource(await response.blob()),
    formats: ALL_FORMATS,
  });
  try {
    const track = await input.getPrimaryAudioTrack();
    if (!track) throw Error("This video does not contain an audio track.");
    if (!(await track.canDecode()))
      throw Error(
        "This video’s audio codec cannot be decoded. Try MP4 with AAC audio.",
      );
    const duration = Math.min(
      maxDuration,
      (await track.computeDuration()) - start,
    );
    if (duration <= 0)
      throw Error("There is no audio after the selected video trim point.");
    const context = new OfflineAudioContext(
      1,
      Math.ceil(duration * 16000),
      16000,
    );
    const sink = new AudioBufferSink(track);
    for await (const chunk of sink.buffers(start, start + duration)) {
      const offset = Math.max(0, start - chunk.timestamp);
      const length = Math.min(
        chunk.buffer.duration - offset,
        duration - Math.max(0, chunk.timestamp - start),
      );
      if (length <= 0) continue;
      const source = context.createBufferSource();
      source.buffer = chunk.buffer;
      source.connect(context.destination);
      source.start(Math.max(0, chunk.timestamp - start), offset, length);
    }
    const buffer = await context.startRendering();
    return readAudio(
      new File([audioToWav(buffer)], "Video audio.wav", { type: "audio/wav" }),
    );
  } finally {
    input.dispose();
  }
}

/** Offline mixing follows the same frame overlaps, trim, loop and fades as preview. */
export async function mixAudio(
  frames: Element[],
  signal: AbortSignal,
): Promise<AudioBuffer | undefined> {
  const sequence = buildSequence(frames);
  const audible = sequence.flatMap((entry) =>
    (entry.frame.audioTracks ?? [])
      .filter(
        (track) =>
          !track.muted &&
          track.volume > 0 &&
          track.start < entry.end - entry.start,
      )
      .map((track) => ({ entry, track })),
  );
  if (!audible.length) return;
  const sampleRate = 44100;
  const context = new OfflineAudioContext(
    2,
    Math.ceil(sequence.at(-1)!.end * sampleRate),
    sampleRate,
  );
  const buffers = new Map<string, AudioBuffer>();
  for (const { entry, track } of audible) {
    signal.throwIfAborted();
    let buffer = buffers.get(track.src);
    if (!buffer) {
      const response = await fetch(track.src, { signal });
      buffer = await context.decodeAudioData(await response.arrayBuffer());
      buffers.set(track.src, buffer);
    }
    const available = buffer.duration - track.trimStart;
    if (available <= 0) continue;
    const length =
      Math.min(
        track.end,
        entry.end - entry.start,
        track.loop ? Infinity : track.start + available,
      ) - track.start;
    if (length <= 0) continue;
    const source = context.createBufferSource(),
      gain = context.createGain();
    source.buffer = buffer;
    source.loop = track.loop;
    source.loopStart = track.trimStart;
    source.loopEnd = buffer.duration;
    source.connect(gain).connect(context.destination);
    const start = entry.start + track.start;
    // Sample the envelope to preserve overlapping fades exactly as preview.
    const curve = new Float32Array(Math.max(2, Math.ceil(length * 100) + 1));
    for (let i = 0; i < curve.length; i++)
      curve[i] = audioGain(
        track,
        track.start + (i / (curve.length - 1)) * length,
      );
    gain.gain.setValueCurveAtTime(curve, start, length);
    source.start(start, track.trimStart, length);
  }
  signal.throwIfAborted();
  const result = await context.startRendering();
  signal.throwIfAborted();
  return result;
}
