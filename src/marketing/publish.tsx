import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { Projects } from "../editor/projects";
import { Icon } from "../components/ui/icon";
import { DatePicker } from "../components/ui/date-picker";
import { NumberField } from "../components/ui/number-field";
import { dateISO } from "../components/ui/date";
import { parseDate } from "../components/ui/date";
import { Dialog, PageIntro, PlatformIcon } from "./shared";
import { FramePreview, MediaPreview } from "./frame-preview";
import { platforms, type Media, type Post } from "./store";
import { useSocial, type PublishResult } from "../social/client";
import { prepareSocialMedia } from "../social/media";
import { AccountPublishingOptions } from "../social/publishing-options";

export function Publish({
  projects: p,
  draft,
  setDraft,
  onSave,
  onRecord,
  onCanvas,
  onSettings,
  notify,
}: {
  projects: Projects;
  draft: Post;
  setDraft: Dispatch<SetStateAction<Post>>;
  onSave: (status: "draft" | "planned") => void;
  onRecord: (post: Post) => Promise<void>;
  onCanvas: () => void;
  onSettings: () => void;
  notify: (message: string) => void;
}) {
  const file = useRef<HTMLInputElement>(null);
  const social = useSocial();
  const [sending, setSending] = useState(false),
    [progress, setProgress] = useState(""),
    [results, setResults] = useState<PublishResult[]>(draft.delivery || []),
    [mediaUrl, setMediaUrl] = useState("");
  const uploaded = useRef(
    new Map<string, { id: string; type: "image" | "video" }>(),
  );
  const [mediaDialog, setMediaDialog] = useState(false),
    [connectionDialog, setConnectionDialog] = useState(false),
    [previewIndex, setPreviewIndex] = useState(0),
    [previewPlatform, setPreviewPlatform] = useState("instagram"),
    [validation, setValidation] = useState("");
  const previewAccount = social.accounts.find((account) => draft.accountKeys?.includes(account.key) && account.platform === previewPlatform);
  const previewName = previewAccount?.name || "Your account";
  const [picking, setPicking] = useState(false);
  const patch = (value: Partial<Post>) => {
    setResults([]);
    setDraft((old) => ({
      ...old,
      ...value,
      status: "draft",
      submissionId: undefined,
      delivery: undefined,
      updatedAt: new Date().toISOString(),
    }));
  };
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
          !["image/jpeg", "image/png", "video/mp4", "video/quicktime"].includes(file.type)
        ) {
          notify(`Choose a JPEG, PNG, MP4, or MOV file. ${file.name} was not added.`);
          continue;
        }
        if (file.size > 8 * 1024 * 1024) {
          notify("Choose media under 8 MB for the desktop composer.");
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
        submissionId: undefined,
        delivery: undefined,
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
    if (!draft.accountKeys?.length) {
      setValidation("Choose at least one connected account.");
      return;
    }
    if (
      draft.accountKeys.some(
        (key) =>
          !social.accounts.some(
            (account) => account.key === key && account.active,
          ),
      )
    ) {
      setValidation(
        "A selected account is disconnected. Refresh your accounts in Setting.",
      );
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
    }
    const selected = social.accounts.filter((a) => draft.accountKeys?.includes(a.key));
    if (selected.length > 10 || new Set(selected.map((a) => a.profileId)).size > 1) {
      setValidation("Choose up to 10 accounts from one Tebar workspace per post.");
      return;
    }
    for (const account of selected) {
      const options = draft.accountOptions?.[account.key];
      if (account.platform === "youtube" && (!String(options?.title || "").trim() || typeof options?.made_for_kids !== "boolean")) {
        setValidation("Choose a YouTube title and audience before submitting."); return;
      }
      if (account.platform === "tiktok" && !options?.privacy_level) {
        setValidation("Choose TikTok visibility before submitting."); return;
      }
      if (account.platform === "pinterest" && !String(options?.board_id || "").trim()) {
        setValidation("Enter a Pinterest board ID before submitting."); return;
      }
    }
    if (draft.delivery?.some((result) => result.success || result.uncertain)) {
      setValidation(
        "This draft already has delivery results. Refresh Schedule before starting a new submission.",
      );
      return;
    }
    setConnectionDialog(true);
  }
  async function publish() {
    if (sending) return;
    setSending(true);
    setValidation("");
    setResults([]);
    const requestId = draft.submissionId || crypto.randomUUID();
    setDraft((old) => ({ ...old, submissionId: requestId }));
    try {
      const profileId = social.accounts.find((a) => draft.accountKeys?.includes(a.key))?.profileId || social.config.tebar.profileId;
      await onRecord({ ...draft, submissionId: requestId });
      const media = [];
      for (const [index, item] of draft.media.entries()) {
        setProgress(`Preparing media ${index + 1} of ${draft.media.length}…`);
        const key =
          JSON.stringify([social.revision, profileId, item]) +
          (item.kind === "frame"
            ? p.workspace.projects
                .find((project) => project.id === item.projectId)
                ?.pages.find((page) => page.id === item.pageId)?.canvas.metadata
                .updatedAt
            : "");
        let prepared = uploaded.current.get(key);
        if (!prepared) {
          prepared = await prepareSocialMedia(
            item,
            p.workspace,
            profileId,
          );
          uploaded.current.set(key, prepared);
        }
        media.push(prepared);
      }
      setProgress(
        draft.timing === "now"
          ? "Submitting your post…"
          : "Scheduling your post…",
      );
      const response = await social.request<{ results: PublishResult[] }>(
        "publish",
        {
          requestId,
          confirmed: true,
          accountOptions: draft.accountOptions,
          content: draft.caption,
          mode: draft.timing,
          accountKeys: draft.accountKeys,
          media,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          ...(draft.timing === "schedule"
            ? {
                scheduledFor: new Date(
                  `${draft.date}T${draft.time}:00`,
                ).toISOString(),
              }
            : {}),
        },
      );
      setResults(response.results);
      setDraft((old) => ({ ...old, delivery: response.results }));
      await onRecord({
        ...draft,
        submissionId: requestId,
        delivery: response.results,
        updatedAt: new Date().toISOString(),
      });
      notify(
        response.results.every((r) => r.success)
          ? draft.timing === "now"
            ? "Post accepted by Tebar. Check Schedule for delivery status."
            : "Post scheduled with Tebar."
          : "Some channels need attention. Review the individual results before retrying.",
      );
      setConnectionDialog(false);
    } catch (err) {
      setValidation(String(err));
    } finally {
      setSending(false);
      setProgress("");
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
  const generatedPost = p.page.canvas.metadata.post;
  return (
    <>
      <PageIntro
        title="Make your next post ready."
        description="Choose your media, add a caption, and decide when to share."
        action={
          <Button
            onClick={() => {
              onSave("draft");
            }}
          >
            Save draft
          </Button>
        }
      />
      <div className="publish-layout">
        <section className="publish-editor" inert={sending}>
          <div className="publish-step">
            <div className="step-heading">
              <span>1</span>
              <div>
                <h2>What are you sharing?</h2>
                <p>Add a design from Canvas or upload your own media.</p>
              </div>
            </div>
            <Input
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
                        <Button
                          className="composer-media-select"
                          aria-label={`Preview ${media.name}`}
                          aria-pressed={selected?.id === media.id}
                          onClick={() => setPreviewIndex(index)}
                        >
                          <MediaPreview media={media} workspace={p.workspace} />
                          <span>{index + 1}</span>
                        </Button>
                        <Button
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
                        </Button>
                      </div>
                    ))}
                  </div>
                  <div className="media-add-actions">
                    <Button
                      disabled={picking}
                      onClick={() => file.current?.click()}
                    >
                      <Icon name="attach" size={15} /> Upload media
                    </Button>
                    <Button onClick={() => setMediaDialog(true)}>
                      <Icon name="layers" size={15} /> Add from Canvas
                    </Button>
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
                    <Button
                      className="primary"
                      onClick={() => setMediaDialog(true)}
                    >
                      <Icon name="layers" size={16} /> Choose from Canvas
                    </Button>
                    <Button
                      disabled={picking}
                      onClick={() => file.current?.click()}
                    >
                      <Icon name="attach" size={16} />
                      {picking ? "Adding media…" : "Upload media"}
                    </Button>
                  </div>
                </>
              )}
            </div>
            {generatedPost && (
              <Button
                onClick={() =>
                  patch({
                    title: generatedPost.name,
                    caption: generatedPost.caption,
                  })
                }
              >
                Use generated post details
              </Button>
            )}
            <Label className="marketing-field">
              Post name{" "}
              <span className="field-optional">
                Optional, just for your content plan
              </span>
              <Input
                placeholder="For example, Friday product tips"
                value={draft.title}
                onChange={(ev) => patch({ title: ev.target.value })}
              />
            </Label>
            <div className="caption-label">
              <div className="public-media-url">
                <Input
                  aria-label="Public media URL"
                  type="url"
                  value={mediaUrl}
                  onChange={(ev) => setMediaUrl(ev.target.value)}
                  placeholder="Public HTTPS image/video URL"
                />
                <Button
                  onClick={() => {
                    try {
                      const url = new URL(mediaUrl);
                      if (
                        url.protocol !== "https:" ||
                        url.username ||
                        url.password
                      )
                        throw Error("Use a public HTTPS URL.");
                      patch({
                        media: [
                          ...draft.media,
                          {
                            id: crypto.randomUUID(),
                            kind: /\.(mp4|mov|webm)(?:[?#]|$)/i.test(url.href)
                              ? "video"
                              : "image",
                            src: url.href,
                            name:
                              url.pathname.split("/").at(-1) || "Linked media",
                          },
                        ],
                      });
                      setMediaUrl("");
                    } catch (err) {
                      setValidation(String(err));
                    }
                  }}
                  disabled={!mediaUrl.trim()}
                >
                  Add URL
                </Button>
              </div>
              <Label htmlFor="post-caption">Caption</Label>
            </div>
            <Textarea
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
              <Label className="marketing-field alt-text-field">
                Media description{" "}
                <span className="field-optional">
                  Helps people using screen readers
                </span>
                <Input
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
              </Label>
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
              {social.accounts
                .filter((account) => account.active)
                .map((account) => (
                  <Button
                    key={account.key}
                    className={
                      draft.accountKeys?.includes(account.key) ? "chosen" : ""
                    }
                    aria-pressed={!!draft.accountKeys?.includes(account.key)}
                    onClick={() => {
                      const keys = draft.accountKeys?.includes(account.key)
                        ? draft.accountKeys.filter((key) => key !== account.key)
                        : [...(draft.accountKeys || []), account.key];
                      patch({
                        accountKeys: keys,
                        platforms: [
                          ...new Set(
                            social.accounts
                              .filter((a) => keys.includes(a.key))
                              .map((a) => a.platform),
                          ),
                        ],
                      });
                      setPreviewPlatform(account.platform);
                    }}
                  >
                    <PlatformIcon id={account.platform} size={20} />
                    <span>
                      {account.name}
                      <small className="account-provider-label">
                        {account.platform} · {account.provider}
                      </small>
                    </span>
                    {draft.accountKeys?.includes(account.key) && (
                      <Icon name="check" size={15} />
                    )}
                  </Button>
                ))}
            </div>
            {social.accounts.filter((a) => draft.accountKeys?.includes(a.key)).map((account) => (
              <AccountPublishingOptions key={account.key} account={account} values={draft.accountOptions?.[account.key] || {}} onChange={(values) => patch({ accountOptions: { ...draft.accountOptions, [account.key]: values } })} />
            ))}
            <div className="connection-inline">
              <Icon name="link" size={16} />
              <span>
                {social.accounts.length
                  ? `${social.accounts.filter((a) => a.active).length} connected accounts available.`
                  : "No accounts connected yet."}
              </span>
              <Button onClick={onSettings}>Manage accounts</Button>
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
              <Button
                aria-pressed={draft.timing === "now"}
                onClick={() => patch({ timing: "now" })}
              >
                <Icon name="publish" size={18} />
                <span>
                  <strong>Now</strong>
                  <small>Prepare to publish</small>
                </span>
                <span className="choice-radio" />
              </Button>
              <Button
                aria-pressed={draft.timing === "schedule"}
                onClick={() => patch({ timing: "schedule" })}
              >
                <Icon name="calendar" size={18} />
                <span>
                  <strong>Schedule</strong>
                  <small>Choose a date and time</small>
                </span>
                <span className="choice-radio" />
              </Button>
            </div>
            {draft.timing === "schedule" && (
              <div className="schedule-fields">
                <Label className="marketing-field">
                  Date
                  <DatePicker
                    label="Post date"
                    value={parseDate(draft.date)}
                    onChange={(date) =>
                      patch({ date: date ? dateISO(date) : undefined })
                    }
                  />
                </Label>
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
              Drafts and plans stay on this device. Publishing and scheduling
              send approved content and media directly to Tebar. Tebar runs
              confirmed schedules even when Genie is closed.
            </p>
            {validation && (
              <p className="publish-validation" role="alert">
                {validation}
              </p>
            )}
            <div className="publish-submit">
              <Button onClick={() => onSave("draft")}>Save draft</Button>
              <Button
                disabled={sending || draft.timing !== "schedule"}
                onClick={() => onSave("planned")}
              >
                Save local plan
              </Button>
              <Button className="primary" disabled={sending} onClick={submit}>
                <Icon
                  name={draft.timing === "schedule" ? "calendar" : "publish"}
                  size={17}
                />
                {draft.timing === "schedule" ? "Schedule post" : "Publish now"}
              </Button>
            </div>
            {progress && <p role="status">{progress}</p>}
            {results.length > 0 && (
              <div className="delivery-results" aria-label="Delivery results">
                {results.map((result) => (
                  <div
                    className={result.success ? "success" : "error"}
                    key={result.accountKey}
                  >
                    <strong>
                      {result.accountName} · {result.provider}
                    </strong>
                    <span>
                      {result.success
                        ? `Accepted · ${result.status || "processing"}`
                        : result.error}
                    </span>
                    {result.uncertain && (
                      <p>
                        Result uncertain. Refresh Schedule and check the
                        provider before starting another submission.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
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
                <Button
                  key={platform.id}
                  title={platform.name}
                  aria-label={`Preview on ${platform.name}`}
                  aria-pressed={previewPlatform === platform.id}
                  onClick={() => setPreviewPlatform(platform.id)}
                >
                  <PlatformIcon id={platform.id} />
                </Button>
              ))}
          </div>
          <div className="social-preview">
            <div className="social-preview-head">
              <span className="social-avatar">
                {previewName
                  .trim()
                  .split(/\s+/)
                  .map((word) => word[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase() || "SJ"}
              </span>
              <div>
                <strong>{previewName}</strong>
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
                <Button
                  aria-label="Previous media"
                  disabled={previewIndex <= 0}
                  onClick={() => setPreviewIndex((i) => i - 1)}
                >
                  <Icon name="left" size={16} />
                </Button>
                <span>{draft.media.length} items in this post</span>
                <Button
                  aria-label="Next media"
                  disabled={previewIndex >= draft.media.length - 1}
                  onClick={() => setPreviewIndex((i) => i + 1)}
                >
                  <Icon name="right" size={16} />
                </Button>
              </div>
            )}
            <div className="social-caption">
              {draft.caption ? (
                <>
                  <strong>{previewName} </strong>
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
                  <Button
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
                  </Button>
                );
              })}
            </div>
          ) : (
            <div className="no-canvas-media">
              <Icon name="layers" size={30} />
              <h3>No frames in this canvas yet</h3>
              <p>Open Canvas to create a design, then add it to your post.</p>
              <Button className="primary" onClick={onCanvas}>
                Open Canvas
              </Button>
            </div>
          )}
          <div className="dialog-footer">
            <Button className="primary" onClick={onCanvas}>
              Open Canvas
            </Button>
            <Button className="primary" onClick={() => setMediaDialog(false)}>
              Done · {draft.media.filter((m) => m.kind === "frame").length}{" "}
              selected
            </Button>
          </div>
        </Dialog>
      )}
      {connectionDialog && (
        <Dialog
          title={
            draft.timing === "now"
              ? "Publish this post now?"
              : "Schedule this post?"
          }
          description={
            draft.timing === "now"
              ? "This sends the post to the accounts below now."
              : "Tebar will publish this post at the selected date and time, even when this app is closed."
          }
          onClose={() => {
            if (!sending) setConnectionDialog(false);
          }}
        >
          <p>{draft.caption}</p>
          <ul>
            {social.accounts
              .filter((a) => draft.accountKeys?.includes(a.key))
              .map((account) => (
                <li key={account.key}>
                  {account.name} · {account.platform} · {account.provider}
                </li>
              ))}
          </ul>
          <p>
            {draft.media.length} media items
            {draft.timing === "schedule"
              ? ` · ${draft.date} at ${draft.time} (${Intl.DateTimeFormat().resolvedOptions().timeZone})`
              : ""}
          </p>
          {progress && <p role="status">{progress}</p>}
          {validation && (
            <p className="error" role="alert">
              {validation}
            </p>
          )}
          <div className="dialog-footer">
            <Button
              disabled={sending}
              onClick={() => setConnectionDialog(false)}
            >
              Keep editing
            </Button>
            <Button
              className="primary"
              disabled={sending}
              onClick={() => void publish()}
            >
              {sending
                ? "Sending…"
                : draft.timing === "now"
                  ? "Confirm & publish"
                  : "Confirm & schedule"}
            </Button>
          </div>
        </Dialog>
      )}
    </>
  );
}
