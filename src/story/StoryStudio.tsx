import { useEffect, useRef, useState } from "react";
import type { Projects } from "../editor/projects";
import type { Editor } from "../editor/useEditor";
import { libraryAssets } from "../editor/assets";
import { socialRequest, useSocial } from "../social/client";
import { emptyPost, type Post } from "../marketing/store";
import { PageIntro } from "../marketing/Shared";
import { Accordion } from "../components/ui/Accordion";
import { exportMessage, saveExport } from "../lib/export";
import { localStore } from "../lib/localStore";
import { PROTOTYPE_VOICE_ID } from "../../sidecar/voice-prototype.mjs";
import {
  SCENE_PRESETS,
  assembleStory,
  scenePresetOf,
  type ScenePreset,
} from "./storyCanvas";
import {
  deriveSpine,
  emptyStory,
  estimateSeconds,
  narrationPrompt,
  parseNarration,
  parseStory,
  sampleStory,
  storyPrompt,
  wordsOf,
  type AIResponse,
  type Brief,
  type GeneratedStory,
  type StoryDraft,
  type StoryScene,
} from "./storyPipeline";
import "./story.css";

type Props = {
  posts: Post[];
  projects: Projects;
  editor: Editor;
  onSave: (post: Post) => Promise<void>;
  onOpenCanvas: (projectId: string, pageId?: string) => void;
  onPublish: (post: Post) => void;
  onSettings: (section: string) => void;
};

const TIMEOUT_MS = 150_000;
const MIN_REQUEST = 12;
const EXAMPLES = [
  "Cara mengenalkan pecahan lewat pizza untuk anak kelas 4",
  "Tiga kebiasaan belajar 15 menit sebelum tidur",
  "Mengapa anak perlu latihan soal cerita, bukan hanya hafalan",
];

/** Everything that ends up on the canvas, so the UI can say when the canvas is out of date. */
const signature = (s: StoryDraft) =>
  JSON.stringify([
    s.preset ?? "",
    s.brief.format,
    s.brief.url,
    s.scenes.map((x) => [
      x.onScreenText,
      x.caption,
      x.narration,
      x.seconds,
      x.preset ?? "",
      x.identifier,
    ]),
  ]);

function friendlyError(message: string): string {
  const t = message.toLowerCase();
  if (
    t.includes("cloudflare rejected") ||
    t.includes("account or token") ||
    t.includes("save your cloudflare")
  )
    return "Cloudflare menolak akun atau token. Buka Pengaturan, bagian Story AI, periksa Account ID dan token, lalu coba lagi.";
  if (t.includes("rate") || t.includes("usage limit"))
    return "Batas pemakaian Cloudflare tercapai. Tunggu sebentar lalu coba lagi. Ide Anda sudah tersimpan.";
  if (t.includes("terlalu lama") || t.includes("timeout"))
    return "AI terlalu lama menjawab. Ide Anda sudah tersimpan, coba lagi atau pakai contoh tanpa AI.";
  if (
    t.includes("interrupted") ||
    t.includes("stopped") ||
    t.includes("berhenti")
  )
    return "Jawaban AI terputus sebelum selesai. Coba lagi, atau pakai contoh tanpa AI.";
  if (
    t.includes("not valid json") ||
    t.includes("no story object") ||
    t.includes("no usable") ||
    t.includes("unreadable") ||
    t.includes("needs")
  )
    return "AI menjawab dengan format yang belum bisa dibaca, bahkan setelah dicoba dua kali. Coba lagi, atau pakai contoh tanpa AI.";
  if (t.includes("social connections are busy"))
    return "Ada proses lain yang sedang berjalan. Tunggu sampai selesai, lalu coba lagi.";
  if (t.includes("desktop app or the local development server"))
    return "Fitur AI hanya berjalan di aplikasi desktop atau saat development server aktif.";
  return message;
}

export function StoryStudio({
  posts,
  projects,
  editor,
  onSave,
  onOpenCanvas,
  onPublish,
  onSettings,
}: Props) {
  const social = useSocial();
  const available = libraryAssets
    .slice(0, 100)
    .map((asset) => asset.identifier);
  const fresh = () => ({
    ...emptyPost(projects.project.id),
    title: "Cerita baru",
    story: emptyStory(),
  });
  const [post, setPost] = useState<Post>(
    () => posts.find((saved) => saved.story?.version === 1) ?? fresh(),
  );
  const [busy, setBusy] = useState(""),
    [detail, setDetail] = useState(""),
    [elapsed, setElapsed] = useState(0),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const current = useRef(post);
  current.current = post;
  const callbacks = useRef({ onSave, projects, editor, onOpenCanvas });
  callbacks.current = { onSave, projects, editor, onOpenCanvas };
  const alive = useRef(true),
    stop = useRef(false),
    running = useRef(false),
    attempt = useRef(0),
    timer = useRef<number | null>(null),
    top = useRef<HTMLElement | null>(null);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      stop.current = true;
      attempt.current++;
      if (timer.current) window.clearInterval(timer.current);
    };
  }, []);
  function latestPost() {
    const saved = JSON.parse(
      localStore.getItem("genie.marketing.posts") || "[]",
    ) as Post[];
    return (
      saved.find((item) => item.id === current.current.id) ?? current.current
    );
  }
  useEffect(() => {
    if (running.current) return;
    const saved = latestPost();
    if (JSON.stringify(saved) !== JSON.stringify(current.current)) {
      current.current = saved;
      setPost(saved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts]);

  const story = post.story!,
    brief = story.brief,
    scenes = story.scenes;
  const configured = social.config.cloudflare?.configured === true;
  const requestReady = brief.objective.trim().length >= MIN_REQUEST;
  const applied = story.applied;
  const stale = !!applied && applied.signature !== signature(story);
  const totalSeconds = scenes.reduce((sum, s) => sum + s.seconds, 0);

  function scrollToTop() {
    window.setTimeout(
      () => top.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      60,
    );
  }
  function clearTimer() {
    if (timer.current) {
      window.clearInterval(timer.current);
      timer.current = null;
    }
  }
  function cancelBusy() {
    attempt.current++;
    stop.current = true;
    running.current = false;
    clearTimer();
    if (alive.current) {
      setBusy("");
      setDetail("");
      setElapsed(0);
      setNotice("Dibatalkan. Ide dan adegan Anda tetap tersimpan.");
    }
  }

  async function persist(next: Post) {
    const saved = { ...next, updatedAt: new Date().toISOString() };
    current.current = saved;
    if (alive.current) setPost(saved);
    await callbacks.current.onSave(saved);
    return saved;
  }
  function patch(change: (value: StoryDraft) => StoryDraft) {
    const saved = latestPost();
    return persist({ ...saved, story: change(saved.story!) });
  }
  function edit(change: (value: StoryDraft) => StoryDraft) {
    void patch(change).catch((err) => {
      if (alive.current) setError(friendlyError(String(err)));
    });
  }
  const editBrief = (change: Partial<Brief>) =>
    edit((value) => ({ ...value, brief: { ...value.brief, ...change } }));
  const setScene = (id: string, change: Partial<StoryScene>) =>
    edit((value) => ({
      ...value,
      scenes: value.scenes.map((s) => (s.id === id ? { ...s, ...change } : s)),
    }));

  /** One guarded operation at a time, with cancel, elapsed time and a hard timeout. */
  async function run(
    label: string,
    first: string,
    task: (isCancelled: () => boolean) => Promise<void>,
  ) {
    if (running.current) {
      setNotice("Masih ada proses berjalan. Tunggu selesai atau tekan Batalkan.");
      return;
    }
    running.current = true;
    stop.current = false;
    const mine = ++attempt.current;
    const isCancelled = () => attempt.current !== mine || stop.current;
    setBusy(label);
    setDetail(first);
    setElapsed(0);
    setError("");
    setNotice("");
    const started = Date.now();
    clearTimer();
    timer.current = window.setInterval(() => {
      if (alive.current && attempt.current === mine)
        setElapsed(Math.floor((Date.now() - started) / 1000));
    }, 500);
    let timeoutId = 0;
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = window.setTimeout(
        () => reject(Error("AI terlalu lama menjawab (timeout 2,5 menit).")),
        TIMEOUT_MS,
      );
    });
    try {
      await Promise.race([task(isCancelled), timeout]);
    } catch (err) {
      if (!isCancelled() && alive.current)
        setError(
          friendlyError(err instanceof Error ? err.message : String(err)),
        );
    } finally {
      window.clearTimeout(timeoutId);
      if (attempt.current === mine) {
        running.current = false;
        clearTimer();
        if (alive.current) {
          setBusy("");
          setDetail("");
          setElapsed(0);
        }
      }
    }
  }

  async function llm(
    prompt: { system: string; user: string },
    isCancelled: () => boolean,
  ) {
    const result = await socialRequest<AIResponse>("cloudflare.chat", {
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
      maxTokens: 8192,
      confirmed: true,
    });
    if (isCancelled()) throw Error("Dibatalkan.");
    await patch((value) => ({ ...value, lastResponse: result }));
    if (result.incomplete)
      throw Error("AI berhenti sebelum jawaban selesai.");
    return result.text;
  }

  /** Writes the whole story in one call; a malformed or cut-off reply gets exactly one automatic retry. */
  async function writeWithAI(
    request: Brief,
    isCancelled: () => boolean,
  ): Promise<GeneratedStory> {
    let lastError: unknown;
    for (let tryNo = 0; tryNo < 2; tryNo++) {
      try {
        const text = await llm(storyPrompt(request), isCancelled);
        return parseStory(text, request.identifiers, {
          title: request.objective.slice(0, 120),
          cta: request.cta,
        });
      } catch (err) {
        if (isCancelled() || (err instanceof Error && err.message === "Dibatalkan."))
          throw err;
        lastError = err;
        if (alive.current && tryNo === 0)
          setDetail("Jawaban AI belum rapi. Mencoba sekali lagi.");
      }
    }
    throw lastError;
  }

  async function commitStory(request: Brief, result: GeneratedStory) {
    const spine = deriveSpine(result);
    await persist({
      ...latestPost(),
      title: result.title,
      caption: result.cta,
      story: {
        ...latestPost().story!,
        brief: { ...request, sceneCount: result.scenes.length },
        spine,
        scenes: result.scenes,
        voiceId: PROTOTYPE_VOICE_ID,
        applied: undefined,
        step: 1,
      },
    });
  }

  /** The main path: request in, story written, canvas project built. */
  function createAll(useAI: boolean) {
    void run(
      useAI ? "Menulis cerita" : "Menyiapkan contoh",
      useAI
        ? "AI menulis adegan dan narasi sekaligus."
        : "Menyusun contoh dari ide Anda.",
      async (isCancelled) => {
        const request: Brief = {
          ...current.current.story!.brief,
          identifiers: available,
        };
        const result = useAI
          ? await writeWithAI(request, isCancelled)
          : sampleStory(request);
        if (isCancelled()) return;
        await commitStory(request, result);
        if (alive.current) setDetail("Menyusun frame di kanvas baru.");
        await apply(false, `${result.scenes.length} adegan siap.`);
      },
    );
  }

  function rewriteNarration(id: string) {
    void run(
      "Menulis ulang narasi",
      "AI menulis ulang satu adegan, adegan lain tetap.",
      async (isCancelled) => {
        const snap = current.current.story!;
        const index = snap.scenes.findIndex((s) => s.id === id);
        if (index < 0) return;
        const next = parseNarration(
          await llm(narrationPrompt(snap.brief, snap.scenes, index), isCancelled),
        );
        if (isCancelled()) return;
        await patch((value) => ({
          ...value,
          scenes: value.scenes.map((s) =>
            s.id === id
              ? { ...s, narration: next, seconds: estimateSeconds(next) }
              : s,
          ),
        }));
        if (alive.current)
          setNotice(`Narasi adegan ${index + 1} diperbarui. Perbarui kanvas bila sudah puas.`);
      },
    );
  }

  async function apply(append: boolean, lead = "") {
    const snapshot = latestPost().story!;
    if (!snapshot.spine || !snapshot.scenes.length)
      throw Error("Belum ada adegan untuk dibuat menjadi kanvas.");
    const activeEditor = callbacks.current.editor,
      targetProject = callbacks.current.projects.project,
      targetPage = callbacks.current.projects.page;
    const base = append ? activeEditor.getDocument() : undefined;
    const result = await assembleStory(snapshot, base);
    if (append && activeEditor.getDocument() !== base)
      throw Error(
        "Kanvas berubah saat frame disiapkan. Edit Anda aman, tambahkan lagi bila sudah siap.",
      );
    let projectId: string, pageId: string;
    if (append) {
      projectId = targetProject.id;
      pageId = targetPage.id;
      activeEditor.change(result.document);
      activeEditor.select([result.frameIds[0]]);
    } else {
      const created = callbacks.current.projects.createProject(
        snapshot.spine.title,
        result.document,
      );
      projectId = created.id;
      pageId = created.pages[0].id;
    }
    const media = result.frameIds.map((frameId, i) => ({
      id: crypto.randomUUID(),
      name: `Adegan ${i + 1}`,
      kind: "frame" as const,
      projectId,
      pageId,
      frameId,
    }));
    const saved = latestPost();
    await persist({
      ...saved,
      projectId,
      media,
      story: {
        ...saved.story!,
        applied: {
          projectId,
          pageId,
          frameIds: result.frameIds,
          at: new Date().toISOString(),
          signature: signature(saved.story!),
        },
      },
    });
    if (alive.current) {
      const gaps = result.missing.length
        ? ` Adegan ${result.missing.join(", ")} belum punya gambar, isi di kanvas.`
        : "";
      setNotice(
        `${lead} Kanvas ${append ? "ditambah" : "baru dibuat"} dengan ${result.frameIds.length} frame.${gaps} Buat suara per frame di Timeline, bagian Voiceover.`.trim(),
      );
      scrollToTop();
    }
  }

  function pickTemplate(id: string) {
    edit((value) => ({
      ...value,
      preset: id,
      scenes: value.scenes.map((s) => ({ ...s, preset: undefined })),
    }));
  }
  function guard(action: () => void) {
    try {
      action();
    } catch (err) {
      setError(friendlyError(err instanceof Error ? err.message : String(err)));
    }
  }

  const drafts = posts.filter((saved) => saved.story?.version === 1);
  const activeTemplate = scenePresetOf({ preset: story.preset });

  return (
    <div className="story-creator">
      <PageIntro
        title="Satu ide, satu video."
        description="Tulis idenya, pilih template. Adegan, narasi, dan kanvas dibuat sekaligus."
        action={
          <button
            disabled={!!busy}
            onClick={() => {
              setError("");
              setNotice("");
              void persist(fresh()).catch((err) =>
                setError(friendlyError(String(err))),
              );
            }}
          >
            Cerita baru
          </button>
        }
      />
      <div className="story-workspace">
        <aside className="story-library" aria-label="Draf cerita tersimpan">
          <strong>Draf saya</strong>
          {drafts.length === 0 && <p>Belum ada draf tersimpan.</p>}
          {drafts.map((saved) => (
            <button
              disabled={!!busy}
              key={saved.id}
              aria-pressed={post.id === saved.id}
              onClick={() => {
                current.current = saved;
                setPost(saved);
                setError("");
                setNotice("");
              }}
            >
              {saved.title || "Cerita tanpa judul"}
              <small>
                {saved.story!.scenes.length} adegan
                {saved.story!.applied ? ", kanvas dibuat" : ""}
              </small>
            </button>
          ))}
          <button
            disabled={!!busy || !scenes.length}
            onClick={() =>
              void run("Mengekspor", "Menyiapkan file cadangan.", async () => {
                setNotice(
                  exportMessage(
                    await saveExport(
                      new Blob(
                        [JSON.stringify(current.current.story, null, 2)],
                        { type: "application/json" },
                      ),
                      `${post.title || "cerita"}.story.json`,
                    ),
                  ),
                );
              })
            }
          >
            Unduh cadangan
          </button>
        </aside>

        <section className="story-editor" aria-label="Pembuat cerita" ref={top}>
          {!configured && (
            <div className="story-callout">
              <strong>AI belum terhubung.</strong> Contoh tanpa AI tetap
              berjalan penuh. Untuk cerita yang ditulis AI, hubungkan
              Cloudflare dulu.
              <div className="story-actions">
                <button onClick={() => onSettings("Story AI")}>
                  Buka pengaturan Story AI
                </button>
              </div>
            </div>
          )}
          {error && (
            <div className="story-error" role="alert">
              <strong>Belum berhasil.</strong> {error}
              <div className="story-actions">
                <button disabled={!!busy} onClick={() => createAll(false)}>
                  Pakai contoh tanpa AI
                </button>
              </div>
            </div>
          )}
          {notice && !busy && (
            <p className="story-callout" role="status">
              {notice}
            </p>
          )}
          {busy && (
            <div
              className="story-callout story-progress"
              role="status"
              aria-live="polite"
            >
              <span className="story-spinner" aria-hidden="true" />
              <div>
                <strong>{busy}</strong>
                <p>
                  {detail}
                  {elapsed > 0 ? ` (${elapsed} dtk)` : ""}
                </p>
              </div>
              <button onClick={cancelBusy}>Batalkan</button>
            </div>
          )}

          <fieldset disabled={!!busy} className="story-fields">
            <section className="story-make" aria-label="Ide cerita">
              <label className="story-field story-prompt">
                <span>Ceritakan videonya</span>
                <textarea
                  aria-label="Ide cerita"
                  rows={4}
                  maxLength={1500}
                  value={brief.objective}
                  placeholder="Tulis dengan bahasa sehari-hari. Contoh: cara mengenalkan pecahan lewat pizza untuk anak kelas 4"
                  onChange={(ev) => editBrief({ objective: ev.target.value })}
                />
              </label>
              {!brief.objective.trim() && (
                <div className="story-examples" role="group" aria-label="Contoh ide">
                  {EXAMPLES.map((example) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => editBrief({ objective: example })}
                    >
                      {example}
                    </button>
                  ))}
                </div>
              )}

              <div className="story-block">
                <h2 id="story-template-label">Template adegan</h2>
                <div
                  className="story-templates"
                  role="radiogroup"
                  aria-labelledby="story-template-label"
                >
                  {SCENE_PRESETS.map((preset) => (
                    <TemplateOption
                      key={preset.id}
                      preset={preset}
                      active={activeTemplate.id === preset.id}
                      onPick={() => pickTemplate(preset.id)}
                    />
                  ))}
                </div>
              </div>

              <div className="story-row">
                <div className="story-field">
                  <span id="story-format-label">Format</span>
                  <div
                    className="story-segment"
                    role="radiogroup"
                    aria-labelledby="story-format-label"
                  >
                    {(
                      [
                        ["video", "Video 9:16"],
                        ["carousel", "Carousel 4:5"],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={brief.format === value}
                        className={brief.format === value ? "is-active" : ""}
                        onClick={() => editBrief({ format: value })}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="story-field">
                  <span id="story-count-label">Jumlah adegan</span>
                  <span className="story-stepper" role="group" aria-labelledby="story-count-label">
                    <button
                      type="button"
                      aria-label="Kurangi adegan"
                      disabled={brief.sceneCount <= 3}
                      onClick={() =>
                        editBrief({ sceneCount: Math.max(3, brief.sceneCount - 1) })
                      }
                    >
                      −
                    </button>
                    <strong aria-live="polite">{brief.sceneCount}</strong>
                    <button
                      type="button"
                      aria-label="Tambah adegan"
                      disabled={brief.sceneCount >= 8}
                      onClick={() =>
                        editBrief({ sceneCount: Math.min(8, brief.sceneCount + 1) })
                      }
                    >
                      +
                    </button>
                  </span>
                </div>
              </div>

              <Accordion title="Opsi tambahan">
                <Field
                  label="Untuk siapa"
                  rows={1}
                  value={brief.audience}
                  onChange={(audience) => editBrief({ audience })}
                />
                <Field
                  label="Ajakan di adegan terakhir"
                  rows={1}
                  value={brief.cta}
                  onChange={(cta) => editBrief({ cta })}
                />
                <Field
                  label="Website (muncul di dua adegan terakhir)"
                  rows={1}
                  value={brief.url}
                  onChange={(url) => editBrief({ url })}
                />
                <p className="hint">
                  Gambar dipilih otomatis dari {available.length} aset
                  terhubung. Adegan tanpa gambar yang cocok tetap punya slot
                  kosong di kanvas.
                </p>
              </Accordion>

              {!requestReady && (
                <p className="story-validate" role="status">
                  Tulis ide minimal {MIN_REQUEST} huruf agar tombol aktif.
                </p>
              )}
              <div className="story-actions">
                <button
                  type="button"
                  className="primary"
                  disabled={!configured || !requestReady}
                  onClick={() => createAll(true)}
                >
                  {scenes.length
                    ? "Buat ulang dari ide ini"
                    : brief.format === "video"
                      ? "Buat video"
                      : "Buat carousel"}
                </button>
                <button
                  type="button"
                  disabled={!requestReady}
                  onClick={() => createAll(false)}
                >
                  Pakai contoh tanpa AI
                </button>
              </div>
            </section>

            {scenes.length > 0 && (
              <section className="story-result" aria-label="Hasil cerita">
                <div className="story-result-head">
                  <div>
                    <h2>{post.title || "Cerita"}</h2>
                    <p className="hint">
                      {scenes.length} adegan, sekitar {totalSeconds} detik,{" "}
                      {brief.format === "video" ? "1080 x 1920" : "1080 x 1350"}.
                      Durasi mengikuti panjang narasi.
                    </p>
                  </div>
                </div>

                {stale && (
                  <div className="story-callout" role="status">
                    <strong>Ada perubahan sejak kanvas dibuat.</strong> Kanvas
                    lama tidak ikut berubah. Buat kanvas baru untuk memakai
                    hasil terbaru.
                  </div>
                )}
                <div className="story-actions">
                  {applied && (
                    <button
                      className={stale ? "" : "primary"}
                      onClick={() =>
                        guard(() => onOpenCanvas(applied.projectId, applied.pageId))
                      }
                    >
                      Buka kanvas
                    </button>
                  )}
                  <button
                    className={!applied || stale ? "primary" : ""}
                    onClick={() =>
                      void run(
                        "Menyusun kanvas",
                        "Membuat project kanvas baru dari adegan.",
                        () => apply(false),
                      )
                    }
                  >
                    {applied ? "Buat kanvas baru" : "Buat kanvas"}
                  </button>
                  <button
                    onClick={() =>
                      void run(
                        "Menambah frame",
                        "Menambahkan adegan ke kanvas yang sedang terbuka.",
                        () => apply(true),
                      )
                    }
                  >
                    Tambah ke {projects.project.name}
                  </button>
                  {applied && (
                    <button onClick={() => guard(() => onPublish(current.current))}>
                      Siapkan di Publish
                    </button>
                  )}
                </div>

                {scenes.map((scene, i) => {
                  const words = wordsOf(scene.onScreenText);
                  return (
                    <article className="story-scene" key={scene.id}>
                      <h3>
                        <span aria-hidden="true">{i + 1}</span>
                        <input
                          aria-label={`Judul di layar adegan ${i + 1}`}
                          value={scene.onScreenText}
                          maxLength={120}
                          onChange={(ev) =>
                            setScene(scene.id, { onScreenText: ev.target.value })
                          }
                        />
                        <small>{scene.seconds} dtk</small>
                      </h3>
                      {words > 12 && (
                        <p className="story-validate" role="status">
                          Judul {words} kata. Pendekkan jadi 12 kata atau
                          kurang agar mudah dibaca.
                        </p>
                      )}
                      <Field
                        label={`Narasi adegan ${i + 1}`}
                        rows={3}
                        value={scene.narration}
                        onChange={(narration) =>
                          setScene(scene.id, {
                            narration,
                            seconds: estimateSeconds(narration),
                          })
                        }
                      />
                      <Field
                        label={`Teks pendukung adegan ${i + 1}`}
                        rows={2}
                        value={scene.caption}
                        onChange={(caption) => setScene(scene.id, { caption })}
                      />
                      <div className="story-row story-scene-tools">
                        <label className="story-field">
                          <span>Template adegan {i + 1}</span>
                          <select
                            value={scene.preset ?? ""}
                            onChange={(ev) =>
                              setScene(scene.id, {
                                preset: ev.target.value || undefined,
                              })
                            }
                          >
                            <option value="">
                              Ikuti template cerita ({activeTemplate.name})
                            </option>
                            {SCENE_PRESETS.map((preset) => (
                              <option key={preset.id} value={preset.id}>
                                {preset.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          type="button"
                          disabled={!configured}
                          onClick={() => rewriteNarration(scene.id)}
                        >
                          Tulis ulang narasi
                        </button>
                        <button
                          type="button"
                          disabled={scenes.length <= 2}
                          onClick={() =>
                            edit((value) => ({
                              ...value,
                              scenes: value.scenes.filter((s) => s.id !== scene.id),
                            }))
                          }
                        >
                          Hapus adegan
                        </button>
                      </div>
                      {scene.visual && (
                        <p className="hint">Gambar yang dicari: {scene.visual}</p>
                      )}
                    </article>
                  );
                })}
                <div className="story-actions">
                  <button
                    onClick={() =>
                      edit((value) => ({
                        ...value,
                        scenes: [
                          ...value.scenes,
                          {
                            id: crypto.randomUUID(),
                            goal: "Adegan baru",
                            narration: "[warmly] Tulis narasi adegan ini.",
                            caption: "",
                            onScreenText: "Judul baru",
                            visual: "",
                            motion: "",
                            seconds: 5,
                            identifier: "",
                            brandElement: "",
                          },
                        ],
                      }))
                    }
                  >
                    Tambah adegan
                  </button>
                </div>
                <p className="hint">
                  Narasi ikut dibawa ke setiap frame sebagai draf voiceover.
                  Suaranya dibuat di Timeline kanvas.
                </p>
              </section>
            )}
          </fieldset>
        </section>
      </div>
    </div>
  );
}

/** Miniature of the real layout, drawn from the preset's own colors, so the choice is visible before building. */
function TemplateOption({
  preset,
  active,
  onPick,
}: {
  preset: ScenePreset;
  active: boolean;
  onPick: () => void;
}) {
  const imageTop = preset.layout === "image-top";
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      className={active ? "story-template is-active" : "story-template"}
      onClick={onPick}
    >
      <span
        className="story-thumb"
        style={{ background: preset.background(0) }}
        aria-hidden="true"
      >
        <i
          className="thumb-art"
          style={{
            background: preset.accent,
            top: imageTop ? "8%" : "52%",
          }}
        />
        <i
          className="thumb-head"
          style={{ background: preset.text, top: imageTop ? "56%" : "12%" }}
        />
        <i
          className="thumb-body"
          style={{ background: preset.sub, top: imageTop ? "70%" : "28%" }}
        />
      </span>
      <strong>{preset.name}</strong>
      <small>{preset.hint}</small>
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
  rows = 2,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <label className="story-field">
      <span>{label}</span>
      <textarea
        aria-label={label}
        value={value}
        rows={rows}
        maxLength={5000}
        onChange={(ev) => onChange(ev.target.value)}
      />
    </label>
  );
}
