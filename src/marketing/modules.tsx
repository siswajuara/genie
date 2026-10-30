import { Segments } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { Connections } from "../social/connections";
import { AudioConnections } from "../social/audio-connections";
import { AIConnection } from "../social/ai-connection";
import { UpdateSettings } from "../components/app-updates";
import { StorageSettings } from "../components/storage-settings";
import { AssetPackSettings } from "../editor/asset-pack-settings";
import type { Workspace } from "../editor/projects";
import { Icon } from "../components/ui/icon";
import { DatePicker } from "../components/ui/date-picker";
import { SelectField } from "../components/ui/select";
import { dateISO } from "../components/ui/date";
import { Dialog, EmptyState, PageIntro, PlatformIcon } from "./shared";
import { MediaPreview } from "./frame-preview";
import { platforms, type WorkspacePreferences, type Post } from "./store";

export function Schedule({
  posts,
  workspace,
  timezone,
  onCreate,
  onEdit,
  onRemove,
  onSettings,
}: {
  posts: Post[];
  workspace: Workspace;
  timezone: string;
  onCreate: () => void;
  onEdit: (post: Post) => void;
  onRemove: (id: string) => void;
  onSettings: () => void;
}) {
  const [tab, setTab] = useState("All posts"),
    [search, setSearch] = useState(""),
    [channel, setChannel] = useState("all"),
    [date, setDate] = useState<Date>(),
    [remove, setRemove] = useState<Post>();
  const filtered = posts
    .filter(
      (post) =>
        (tab === "All posts" ||
          post.status === (tab === "Drafts" ? "draft" : "planned")) &&
        (!date || post.date === dateISO(date)) &&
        (channel === "all" || post.platforms.includes(channel)) &&
        `${post.title} ${post.caption}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort(
      (a, b) =>
        (a.date || "9999").localeCompare(b.date || "9999") ||
        a.time.localeCompare(b.time),
    );
  const planned = posts.filter((p) => p.status === "planned").length;
  return (
    <>
      <PageIntro
        title="A little planning goes a long way."
        description="Your drafts and planned posts, together in one place."
        action={
          <Button className="primary" onClick={onCreate}>
            <Icon name="add" size={17} /> Create post
          </Button>
        }
      />
      <div className="schedule-summary">
        <div>
          <Icon name="calendar" size={20} />
          <span>
            <strong>{planned}</strong> planned
          </span>
        </div>
        <div>
          <Icon name="bookmark" size={20} />
          <span>
            <strong>{posts.length - planned}</strong> drafts
          </span>
        </div>
        <p>
          <Icon name="clock" size={15} />
          {timezone}
        </p>
      </div>
      <div className="plan-connection-note">
        <Icon name="link" size={19} />
        <div>
          <strong>Your content plan stays on this device.</strong>
          <p>
            Local plans do not publish automatically. Open Publish to confirm a
            direct provider submission. Provider posts appear separately above.
          </p>
        </div>
        <Button onClick={onSettings}>
          Usage & limits
          <Icon name="right" size={14} />
        </Button>
      </div>
      <section className="schedule-panel">
        <div className="schedule-toolbar">
          <Segments
            label="Post status"
            values={["All posts", "Planned", "Drafts"]}
            value={tab}
            onChange={setTab}
          />
          <div className="schedule-filters">
            <Label className="marketing-search">
              <Icon name="search" size={16} />
              <Input
                aria-label="Search posts"
                placeholder="Find a post"
                value={search}
                onChange={(ev) => setSearch(ev.target.value)}
              />
            </Label>
            <SelectField
              label="Filter posts by channel"
              value={channel}
              onChange={setChannel}
              options={[
                { value: "all", label: "All channels" },
                ...platforms.map((p) => ({ value: p.id, label: p.name })),
              ]}
            />
            <DatePicker
              label="Filter posts by date"
              value={date}
              onChange={setDate}
            />
          </div>
        </div>
        {filtered.length ? (
          <div className="scheduled-list">
            {filtered.map((post) => (
              <article className="scheduled-post" key={post.id}>
                <div className="post-date-block">
                  {post.date ? (
                    <>
                      <span>
                        {new Date(`${post.date}T12:00`).toLocaleDateString(
                          undefined,
                          { month: "short" },
                        )}
                      </span>
                      <strong>
                        {new Date(`${post.date}T12:00`).getDate()}
                      </strong>
                      <small>{post.time}</small>
                    </>
                  ) : (
                    <>
                      <Icon name="bookmark" size={22} />
                      <small>No date</small>
                    </>
                  )}
                </div>
                <div className="post-list-thumbnail">
                  {post.media[0] ? (
                    <MediaPreview media={post.media[0]} workspace={workspace} />
                  ) : (
                    <Icon name="text" size={25} />
                  )}
                </div>
                <div className="post-list-copy">
                  <div>
                    <span className={`post-status ${post.status}`}>
                      {post.status === "planned" ? "Planned draft" : "Draft"}
                    </span>
                    {post.media.length > 1 && (
                      <span className="post-media-count">
                        {post.media.length} media
                      </span>
                    )}
                  </div>
                  <h2>{post.title}</h2>
                  <p>{post.caption || "No caption yet"}</p>
                  <div className="post-list-channels">
                    {post.platforms.length ? (
                      post.platforms.map((id) => (
                        <PlatformIcon key={id} id={id} size={15} />
                      ))
                    ) : (
                      <span>No channels chosen</span>
                    )}
                  </div>
                </div>
                <div className="scheduled-post-actions">
                  <Button onClick={() => onEdit(post)}>Edit post</Button>
                  <Button
                    aria-label={`Remove ${post.title}`}
                    onClick={() => setRemove(post)}
                  >
                    <Icon name="delete" size={17} />
                  </Button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            icon="calendar"
            title={
              posts.length
                ? "No posts match these filters"
                : "Your next post starts here"
            }
            description={
              posts.length
                ? "Try another channel, date, or search term."
                : "Create a post, save a draft, or choose a date. Your content plan will grow from here."
            }
            action={
              posts.length ? (
                <Button
                  onClick={() => {
                    setSearch("");
                    setChannel("all");
                    setDate(undefined);
                    setTab("All posts");
                  }}
                >
                  Clear filters
                </Button>
              ) : (
                <Button className="primary" onClick={onCreate}>
                  <Icon name="add" size={16} /> Create your first post
                </Button>
              )
            }
          />
        )}
      </section>
      {remove && (
        <Dialog
          title="Remove this post from your plan?"
          description={remove.title}
          onClose={() => setRemove(undefined)}
        >
          <p>
            This removes the saved post. Your original Canvas designs stay
            available.
          </p>
          <div className="dialog-footer">
            <Button onClick={() => setRemove(undefined)}>Keep post</Button>
            <Button
              className="danger"
              onClick={() => {
                onRemove(remove.id);
                setRemove(undefined);
              }}
            >
              Remove post
            </Button>
          </div>
        </Dialog>
      )}
    </>
  );
}

export function Setting({
  settings,
  setSettings,
}: {
  settings: WorkspacePreferences;
  setSettings: Dispatch<SetStateAction<WorkspacePreferences>>;
}) {
  const [section, setSection] = useState(() =>
    window.location.hash.toLowerCase().includes("assets")
      ? "Assets"
      : "Social accounts",
  );
  useEffect(() => {
    const openAssets = (event: Event) => {
      if (
        ["Assets", "Audio", "AI generation"].includes(
          (event as CustomEvent).detail,
        )
      )
        setSection((event as CustomEvent).detail);
    };
    window.addEventListener(
      "genie:open-settings-section",
      openAssets as EventListener,
    );
    return () =>
      window.removeEventListener(
        "genie:open-settings-section",
        openAssets as EventListener,
      );
  }, []);
  const update = (key: keyof WorkspacePreferences, value: string) => {
    setSettings((old) => ({ ...old, [key]: value }));
    if (key === "theme") localStorage.setItem("genie.theme", value);
  };
  return (
    <>
      <PageIntro
        title="Your preferences and connections."
        description="Manage your social accounts, assets, and preferences."
      />
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings sections">
          {[
            {
              name: "Social accounts",
              icon: "link" as const,
              hint: "Keys & channels",
            },
            {
              name: "Audio",
              icon: "link" as const,
              hint: "ElevenLabs & credits",
            },
            {
              name: "AI generation",
              icon: "settings" as const,
              hint: "OpenCode & writing",
            },
            {
              name: "Assets",
              icon: "image" as const,
              hint: "Library folder",
            },
            {
              name: "Preferences",
              icon: "settings" as const,
              hint: "Theme & updates",
            },
            { name: "Storage", icon: "layers" as const, hint: "Local library" },
          ].map((item) => (
            <Button
              key={item.name}
              aria-current={section === item.name ? "page" : undefined}
              onClick={() => setSection(item.name)}
            >
              <span className="settings-nav-icon">
                <Icon name={item.icon} size={18} />
              </span>
              <span className="settings-nav-text">
                <span className="settings-nav-name">{item.name}</span>
                <span className="settings-nav-hint">{item.hint}</span>
              </span>
              <Icon name="right" size={14} />
            </Button>
          ))}
        </nav>
        <section className="settings-content">
          {section === "Social accounts" && <Connections />}
          {section === "Audio" && <AudioConnections />}
          {section === "AI generation" && <AIConnection />}
          {section === "Assets" && <AssetPackSettings />}
          {section === "Storage" && <StorageSettings />}
          {section === "Preferences" && (
            <div className="settings-stack">
              <div className="panel-heading settings-panel-head">
                <div>
                  <p className="settings-eyebrow">Workspace</p>
                  <h2>Preferences</h2>
                  <p>Set up the workspace in a way that feels comfortable.</p>
                </div>
              </div>
              <section
                className="settings-card"
                aria-label="Workspace preferences"
              >
                <div className="settings-row">
                  <span className="settings-row-icon" aria-hidden="true">
                    <Icon
                      name={settings.theme === "dark" ? "moon" : "sun"}
                      size={18}
                    />
                  </span>
                  <div className="settings-row-text">
                    <strong>Appearance</strong>
                    <p>Choose the theme you prefer.</p>
                  </div>
                  <Segments
                    label="Workspace theme"
                    values={["Light", "Dark"]}
                    value={settings.theme === "dark" ? "Dark" : "Light"}
                    onChange={(theme) => update("theme", theme.toLowerCase())}
                  />
                </div>
                <div className="settings-row">
                  <span className="settings-row-icon" aria-hidden="true">
                    <Icon name="clock" size={18} />
                  </span>
                  <div className="settings-row-text">
                    <strong>Time zone</strong>
                    <p>Your device’s time zone is used for planned dates.</p>
                  </div>
                  <span className="settings-value-pill">
                    {Intl.DateTimeFormat().resolvedOptions().timeZone}
                  </span>
                </div>
                <div className="settings-row">
                  <span className="settings-row-icon" aria-hidden="true">
                    <Icon name="layers" size={18} />
                  </span>
                  <div className="settings-row-text">
                    <strong>Storage</strong>
                    <p>
                      Canvases, versions, saved drafts, and content plans stay
                      on this device. Publishing connects directly to Tebar.
                    </p>
                  </div>
                  <span className="settings-value-pill is-accent">
                    <span className="storage-status-dot" aria-hidden="true" />
                    Local
                  </span>
                </div>
              </section>
              <p className="settings-note">
                <Icon name="help" size={15} />
                <span>
                  Export designs from Canvases and manage disk space under
                  Storage. Drafts and plans save locally without provider
                  requests.
                </span>
              </p>
              <UpdateSettings />
            </div>
          )}
        </section>
      </div>
    </>
  );
}
