import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { Projects } from "../editor/projects";
import { Icon } from "../components/ui/Icon";
import {
  DatePicker,
  NumberField,
  dateISO,
  parseDate,
} from "../components/ui/Controls";
import { Dialog, PageIntro, PlatformIcon } from "./Shared";
import { FramePreview, MediaPreview } from "./FramePreview";
import { platforms, type BrandSettings, type Media, type Post } from "./store";

export function Publish({
  projects: p,
  draft,
  setDraft,
  settings,
  onSave,
  onCanvas,
  onIdea,
  onSettings,
  notify,
}: {
  projects: Projects;
  draft: Post;
  setDraft: Dispatch<SetStateAction<Post>>;
  settings: BrandSettings;
  onSave: (status: "draft" | "planned") => void;
  onCanvas: () => void;
  onIdea: () => void;
  onSettings: () => void;
  notify: (message: string) => void;
}) {
  const file = useRef<HTMLInputElement>(null);
  const [mediaDialog, setMediaDialog] = useState(false),
    [connectionDialog, setConnectionDialog] = useState(false),
    [previewIndex, setPreviewIndex] = useState(0),
    [previewPlatform, setPreviewPlatform] = useState("instagram"),
    [validation, setValidation] = useState("");
  const [picking, setPicking] = useState(false);
  const patch = (value: Partial<Post>) =>
    setDraft((old) => ({
      ...old,
      ...value,
      status: "draft",
      updatedAt: new Date().toISOString(),
    }));
  const selected =
    draft.media[Math.min(previewIndex, Math.max(0, draft.media.length - 1))];
  const frames = p.project.pages.flatMap((page) =>
    page.canvas.elements
      .filter((o) => o.t === "frame")
      .map((frame) => ({ page, frame })),
  );
  async function upload(files: File[]) {
    setPicking(true);
    try {
      const media: Media[] = [];
      for (const file of files) {
        if (
          !file.type.startsWith("image/") &&
          !file.type.startsWith("video/")
        ) {
          notify(`Choose an image or video. ${file.name} was not added.`);
          continue;
        }
        if (file.size > 8 * 1024 * 1024) {
          notify(
            "Choose media under 8 MB while drafts are stored on this device.",
          );
          continue;
        }
        const src = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () =>
            reject(new Error(`Could not read ${file.name}`));
          reader.readAsDataURL(file);
        });
        media.push({
          id: crypto.randomUUID(),
          name: file.name,
          kind: file.type.startsWith("video/") ? "video" : "image",
          src,
        });
      }
      setDraft((old) => ({
        ...old,
        media: [...old.media, ...media],
        status: "draft",
        updatedAt: new Date().toISOString(),
      }));
    } catch (err) {
      notify(String(err));
    } finally {
      setPicking(false);
    }
  }
  function submit() {
    setValidation("");
    if (!draft.media.length && !draft.caption.trim()) {
      setValidation("Add media or write a caption first.");
      return;
    }
    if (!draft.platforms.length) {
      setValidation("Choose at least one social channel.");
      return;
    }
    if (draft.timing === "schedule") {
      if (!draft.date) {
        setValidation("Choose a date for your post.");
        return;
      }
      const localDate = new Date(`${draft.date}T${draft.time}:00`);
      if (
        !Number.isFinite(localDate.getTime()) ||
        localDate.getTime() <= Date.now()
      ) {
        setValidation("Choose a date and time in the future.");
        return;
      }
      onSave("planned");
    } else {
      onSave("draft");
      setConnectionDialog(true);
    }
  }
  function toggleFrame(pageId: string, frameId: string, name: string) {
    const existing = draft.media.find(
      (media) =>
        media.kind === "frame" &&
        media.pageId === pageId &&
        media.frameId === frameId,
    );
    patch({
      media: existing
        ? draft.media.filter((media) => media.id !== existing.id)
        : [
            ...draft.media,
            {
              id: crypto.randomUUID(),
              kind: "frame",
              name,
              projectId: p.project.id,
              pageId,
              frameId,
            },
          ],
    });
  }
  return (
    <>
      <PageIntro
        title="Make your next post ready."
        description="Choose your media, add a caption, and decide when to share."
        action={
          <button
            onClick={() => {
              onSave("draft");
            }}
          >
            Save draft
          </button>
        }
      />
      <div className="publish-layout">
        <section className="publish-editor">
          <div className="publish-step">
            <div className="step-heading">
              <span>1</span>
              <div>
                <h2>What are you sharing?</h2>
                <p>Add a design from Canvas or upload your own media.</p>
              </div>
            </div>
            <input
              ref={file}
              hidden
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={(ev) => {
                void upload(Array.from(ev.target.files || []));
                ev.target.value = "";
              }}
            />
            <div
              className={`media-drop-zone ${draft.media.length ? "has-media" : ""}`}
              onDragOver={(ev) => ev.preventDefault()}
              onDrop={(ev) => {
                ev.preventDefault();
                void upload(Array.from(ev.dataTransfer.files));
              }}
            >
              {draft.media.length ? (
                <>
                  <div className="composer-media-list">
                    {draft.media.map((media, index) => (
                      <div className="composer-media-item" key={media.id}>
                        <button
                          className="composer-media-select"
                          aria-label={`Preview ${media.name}`}
                          aria-pressed={selected?.id === media.id}
                          onClick={() => setPreviewIndex(index)}
                        >
                          <MediaPreview media={media} workspace={p.workspace} />
                          <span>{index + 1}</span>
                        </button>
                        <button
                          className="remove-media"
                          aria-label={`Remove ${media.name}`}
                          onClick={() =>
                            patch({
                              media: draft.media.filter(
                                (m) => m.id !== media.id,
                              ),
                            })
                          }
                        >
                          <Icon name="close" size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="media-add-actions">
                    <button
                      disabled={picking}
                      onClick={() => file.current?.click()}
                    >
                      <Icon name="attach" size={15} /> Upload media
                    </button>
                    <button onClick={() => setMediaDialog(true)}>
                      <Icon name="layers" size={15} /> Add from Canvas
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <span className="media-drop-icon">
                    <Icon name="image" size={30} />
                  </span>
                  <strong>Give your post something to show.</strong>
                  <p>Drop images or videos here, or choose a design.</p>
                  <div className="row">
                    <button
                      className="primary"
                      onClick={() => setMediaDialog(true)}
                    >
                      <Icon name="layers" size={16} /> Choose from Canvas
                    </button>
                    <button
                      disabled={picking}
                      onClick={() => file.current?.click()}
                    >
                      <Icon name="attach" size={16} />
                      {picking ? "Adding media…" : "Upload media"}
                    </button>
                  </div>
                </>
              )}
            </div>
            <label className="marketing-field">
              Post name{" "}
              <span className="field-optional">
                Optional, just for your content plan
              </span>
              <input
                placeholder="For example, Friday product tips"
                value={draft.title}
                onChange={(ev) => patch({ title: ev.target.value })}
              />
            </label>
            <div className="caption-label">
              <label htmlFor="post-caption">Caption</label>
              <button onClick={onIdea}>
                <Icon name="idea" size={15} /> Write with Idea
              </button>
            </div>
            <textarea
              id="post-caption"
              className="caption-input"
              placeholder="What do you want your audience to know?"
              rows={6}
              value={draft.caption}
              onChange={(ev) => patch({ caption: ev.target.value })}
            />
            <div className="caption-meta">
              <span>Make it sound like you. Add a clear next step.</span>
              <span>{draft.caption.length.toLocaleString()} characters</span>
            </div>
            {selected && (
              <label className="marketing-field alt-text-field">
                Media description{" "}
                <span className="field-optional">
                  Helps people using screen readers
                </span>
                <input
                  value={selected.alt || ""}
                  placeholder="Describe what is in this image"
                  onChange={(ev) =>
                    patch({
                      media: draft.media.map((m) =>
                        m.id === selected.id
                          ? { ...m, alt: ev.target.value }
                          : m,
                      ),
                    })
                  }
                />
              </label>
            )}
          </div>
          <div className="publish-step">
            <div className="step-heading">
              <span>2</span>
              <div>
                <h2>Where should it go?</h2>
                <p>Choose one or more channels for this draft.</p>
              </div>
            </div>
            <div className="channel-choices">
              {platforms.map((platform) => (
                <button
                  key={platform.id}
                  className={
                    draft.platforms.includes(platform.id) ? "chosen" : ""
                  }
                  aria-pressed={draft.platforms.includes(platform.id)}
                  onClick={() => {
                    patch({
                      platforms: draft.platforms.includes(platform.id)
                        ? draft.platforms.filter((id) => id !== platform.id)
                        : [...draft.platforms, platform.id],
                    });
                    setPreviewPlatform(platform.id);
                  }}
                >
                  <PlatformIcon id={platform.id} size={20} />
                  <span>{platform.name}</span>
                  {draft.platforms.includes(platform.id) && (
                    <Icon name="check" size={15} />
                  )}
                </button>
              ))}
            </div>
            <div className="connection-inline">
              <Icon name="link" size={16} />
              <span>No accounts connected yet.</span>
              <button onClick={onSettings}>Manage accounts</button>
            </div>
          </div>
          <div className="publish-step">
            <div className="step-heading">
              <span>3</span>
              <div>
                <h2>When would you like to share?</h2>
                <p>Keep a draft for now or put it in your content plan.</p>
              </div>
            </div>
            <div
              className="timing-choices"
              role="group"
              aria-label="Post timing"
            >
              <button
                aria-pressed={draft.timing === "now"}
                onClick={() => patch({ timing: "now" })}
              >
                <Icon name="publish" size={18} />
                <span>
                  <strong>Now</strong>
                  <small>Prepare to publish</small>
                </span>
                <span className="choice-radio" />
              </button>
              <button
                aria-pressed={draft.timing === "schedule"}
                onClick={() => patch({ timing: "schedule" })}
              >
                <Icon name="calendar" size={18} />
                <span>
                  <strong>Schedule</strong>
                  <small>Choose a date and time</small>
                </span>
                <span className="choice-radio" />
              </button>
            </div>
            {draft.timing === "schedule" && (
              <div className="schedule-fields">
                <label className="marketing-field">
                  Date
                  <DatePicker
                    label="Post date"
                    value={parseDate(draft.date)}
                    onChange={(date) =>
                      patch({ date: date ? dateISO(date) : undefined })
                    }
                  />
                </label>
                <div className="marketing-field">
                  <span>Time</span>
                  <div className="time-inputs">
                    <NumberField
                      label="Hour"
                      value={Number(draft.time.split(":")[0])}
                      min={0}
                      max={23}
                      onChange={(hour) =>
                        patch({
                          time: `${String(hour).padStart(2, "0")}:${draft.time.split(":")[1]}`,
                        })
                      }
                    />
                    <span>:</span>
                    <NumberField
                      label="Minute"
                      value={Number(draft.time.split(":")[1])}
                      min={0}
                      max={59}
                      onChange={(minute) =>
                        patch({
                          time: `${draft.time.split(":")[0]}:${String(minute).padStart(2, "0")}`,
                        })
                      }
                    />
                  </div>
                </div>
                <p className="schedule-timezone">
                  <Icon name="clock" size={14} />{" "}
                  {Intl.DateTimeFormat().resolvedOptions().timeZone}{" "}
                  <span>(this device)</span>
                </p>
              </div>
            )}
            <p className="local-plan-note">
              This version saves drafts and planned dates on your device.
              Connecting accounts and sending posts to social media will be
              available in a future update.
            </p>
            {validation && (
              <p className="publish-validation" role="alert">
                {validation}
              </p>
            )}
            <div className="publish-submit">
              <button onClick={() => onSave("draft")}>Save draft</button>
              <button className="primary" onClick={submit}>
                <Icon
                  name={draft.timing === "schedule" ? "calendar" : "publish"}
                  size={17}
                />
                {draft.timing === "schedule"
                  ? "Schedule draft"
                  : "Prepare to publish"}
              </button>
            </div>
          </div>
        </section>
        <aside className="publish-preview">
          <div className="preview-heading">
            <h2>Post preview</h2>
            <span>See it before you share</span>
          </div>
          <div
            className="preview-platforms"
            role="group"
            aria-label="Preview channel"
          >
            {platforms
              .filter(
                (platform) =>
                  !draft.platforms.length ||
                  draft.platforms.includes(platform.id),
              )
              .map((platform) => (
                <button
                  key={platform.id}
                  title={platform.name}
                  aria-label={`Preview on ${platform.name}`}
                  aria-pressed={previewPlatform === platform.id}
                  onClick={() => setPreviewPlatform(platform.id)}
                >
                  <PlatformIcon id={platform.id} />
                </button>
              ))}
          </div>
          <div className="social-preview">
            <div className="social-preview-head">
              <span className="social-avatar">
                {settings.name
                  .trim()
                  .split(/\s+/)
                  .map((word) => word[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase() || "SJ"}
              </span>
              <div>
                <strong>{settings.name || "Your brand"}</strong>
                <small>
                  {platforms.find((p) => p.id === previewPlatform)?.name} ·
                  Preview
                </small>
              </div>
            </div>
            <div className="social-preview-media">
              {selected ? (
                <MediaPreview media={selected} workspace={p.workspace} />
              ) : (
                <div className="preview-placeholder">
                  <Icon name="image" size={38} />
                  <span>Your media will appear here</span>
                </div>
              )}
              {draft.media.length > 1 && (
                <span className="carousel-counter">
                  {Math.min(previewIndex + 1, draft.media.length)} /{" "}
                  {draft.media.length}
                </span>
              )}
            </div>
            {draft.media.length > 1 && (
              <div className="preview-carousel-controls">
                <button
                  aria-label="Previous media"
                  disabled={previewIndex <= 0}
                  onClick={() => setPreviewIndex((i) => i - 1)}
                >
                  <Icon name="left" size={16} />
                </button>
                <span>{draft.media.length} items in this post</span>
                <button
                  aria-label="Next media"
                  disabled={previewIndex >= draft.media.length - 1}
                  onClick={() => setPreviewIndex((i) => i + 1)}
                >
                  <Icon name="right" size={16} />
                </button>
              </div>
            )}
            <div className="social-caption">
              {draft.caption ? (
                <>
                  <strong>{settings.name || "Your brand"} </strong>
                  {draft.caption}
                </>
              ) : (
                <span>Your caption will appear here.</span>
              )}
            </div>
          </div>
          <p className="preview-disclaimer">
            A guide to how your post could look. Each social channel displays
            content a little differently.
          </p>
          <div className="preview-tip">
            <Icon name="check" size={18} />
            <div>
              <strong>A quick check before you share</strong>
              <p>
                Is the message clear? Is the text easy to read? Does your
                audience know what to do next?
              </p>
            </div>
          </div>
        </aside>
      </div>
      {mediaDialog && (
        <Dialog
          title="Choose from Canvas"
          description="Select one or more frames. Multiple frames become a carousel in your draft."
          onClose={() => setMediaDialog(false)}
        >
          {frames.length ? (
            <div className="canvas-media-picker">
              {frames.map(({ page, frame }) => {
                const chosen = draft.media.some(
                  (m) =>
                    m.kind === "frame" &&
                    m.pageId === page.id &&
                    m.frameId === frame.id,
                );
                return (
                  <button
                    className={chosen ? "chosen" : ""}
                    aria-pressed={chosen}
                    key={frame.id}
                    onClick={() => toggleFrame(page.id, frame.id, frame.n)}
                  >
                    <div>
                      <FramePreview
                        document={page.canvas}
                        frameId={frame.id}
                        label={frame.n}
                      />
                      {chosen && (
                        <span className="media-chosen">
                          <Icon name="check" size={16} />
                        </span>
                      )}
                    </div>
                    <strong>{frame.n}</strong>
                    <small>
                      {page.name} · {frame.w} × {frame.h}
                    </small>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="no-canvas-media">
              <Icon name="layers" size={30} />
              <h3>No frames in this project yet</h3>
              <p>Open Canvas to create a design, then add it to your post.</p>
              <button onClick={onCanvas}>Open Canvas</button>
            </div>
          )}
          <div className="dialog-footer">
            <button onClick={onCanvas}>Open Canvas</button>
            <button className="primary" onClick={() => setMediaDialog(false)}>
              Done · {draft.media.filter((m) => m.kind === "frame").length}{" "}
              selected
            </button>
          </div>
        </Dialog>
      )}
      {connectionDialog && (
        <Dialog
          title="Your draft is ready. Connect next."
          description="Your post has been saved. Sending it to social media is not available in this version, so nothing has been published."
          onClose={() => setConnectionDialog(false)}
        >
          <p>You can keep preparing posts and planning dates in Schedule.</p>
          <div className="dialog-footer">
            <button onClick={() => setConnectionDialog(false)}>
              Keep editing
            </button>
            <button className="primary" onClick={onSettings}>
              View social accounts
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}
