import { useState, type Dispatch, type SetStateAction } from "react";
import { Connections } from '../social/Connections';
import { invoke, isTauri } from "@tauri-apps/api/core";
import type { Projects, Workspace } from "../editor/projects";
import { Icon } from "../components/ui/Icon";
import {
  DatePicker,
  DateRangePicker,
  SelectField,
  dateISO,
} from "../components/ui/Controls";
import type { DateRange } from "react-day-picker";
import { saveExport, exportMessage } from "../lib/export";
import {
  Dialog,
  EmptyState,
  PageIntro,
  PlatformIcon,
  Segments,
} from "./Shared";
import { MediaPreview } from "./FramePreview";
import { platforms, type BrandSettings, type Post } from "./store";

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
          <button className="primary" onClick={onCreate}>
            <Icon name="add" size={17} /> Create post
          </button>
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
          <strong>
            Your plan is saved here. Connect accounts to share it.
          </strong>
          <p>
            Local drafts stay on this device until you submit them through Publish. Provider-scheduled posts are shown separately above.
          </p>
        </div>
        <button onClick={onSettings}>
          View accounts
          <Icon name="right" size={14} />
        </button>
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
            <label className="marketing-search">
              <Icon name="search" size={16} />
              <input
                aria-label="Search posts"
                placeholder="Find a post"
                value={search}
                onChange={(ev) => setSearch(ev.target.value)}
              />
            </label>
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
                  <button onClick={() => onEdit(post)}>Edit post</button>
                  <button
                    aria-label={`Remove ${post.title}`}
                    onClick={() => setRemove(post)}
                  >
                    <Icon name="delete" size={17} />
                  </button>
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
                <button
                  onClick={() => {
                    setSearch("");
                    setChannel("all");
                    setDate(undefined);
                    setTab("All posts");
                  }}
                >
                  Clear filters
                </button>
              ) : (
                <button className="primary" onClick={onCreate}>
                  <Icon name="add" size={16} /> Create your first post
                </button>
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
            <button onClick={() => setRemove(undefined)}>Keep post</button>
            <button
              className="danger"
              onClick={() => {
                onRemove(remove.id);
                setRemove(undefined);
              }}
            >
              Remove post
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}

export function Insight({ onSettings }: { onSettings: () => void }) {
  const [channel, setChannel] = useState("all");
  const [range, setRange] = useState<DateRange | undefined>(() => {
    const to = new Date(),
      from = new Date();
    from.setDate(to.getDate() - 29);
    return { from, to };
  });
  const [metric, setMetric] = useState("Reach");
  return (
    <>
      <PageIntro
        title="Know what connects."
        description="See how your content performs across your social channels."
      />
      <div className="insight-filters">
        <SelectField
          label="Insight channel"
          value={channel}
          onChange={setChannel}
          options={[
            { value: "all", label: "All channels" },
            ...platforms.map((p) => ({ value: p.id, label: p.name })),
          ]}
        />
        <DateRangePicker
          label="Insight date range"
          value={range}
          onChange={setRange}
        />
      </div>
      <div className="insight-metrics">
        {[
          {
            name: "Reach",
            icon: "view" as const,
            help: "People who saw your content",
          },
          {
            name: "Engagement",
            icon: "community" as const,
            help: "Likes, comments, and shares",
          },
          {
            name: "Followers",
            icon: "community" as const,
            help: "Your growing audience",
          },
          {
            name: "Published posts",
            icon: "publish" as const,
            help: "Content shared with your audience",
          },
        ].map((item) => (
          <div key={item.name}>
            <div>
              <span>{item.name}</span>
              <Icon name={item.icon} size={18} />
            </div>
            <strong>No data</strong>
            <small>{item.help}</small>
          </div>
        ))}
      </div>
      <section className="insight-chart-panel">
        <div className="panel-heading">
          <div>
            <h2>Content performance</h2>
            <p>Spot patterns in what your audience responds to.</p>
          </div>
          <Segments
            label="Performance metric"
            values={["Reach", "Engagement"]}
            value={metric}
            onChange={setMetric}
          />
        </div>
        <div className="chart-empty">
          <div className="chart-grid" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </div>
          <EmptyState
            icon="insight"
            title="Your results will tell a story"
            description="Connect a social account to bring real performance data into this space."
            action={
              <button className="primary" onClick={onSettings}>
                <Icon name="link" size={16} /> View social accounts
              </button>
            }
          />
        </div>
      </section>
      <section className="insight-channels">
        <div className="panel-heading">
          <div>
            <h2>Your channels, side by side</h2>
            <p>Compare results once your accounts are connected.</p>
          </div>
        </div>
        <div className="insight-channel-list">
          {platforms
            .filter((p) => channel === "all" || p.id === channel)
            .map((platform) => (
              <div key={platform.id}>
                <PlatformIcon id={platform.id} size={22} />
                <strong>{platform.name}</strong>
                <span>Not connected</span>
                <button onClick={onSettings}>
                  View account
                  <Icon name="right" size={14} />
                </button>
              </div>
            ))}
        </div>
      </section>
    </>
  );
}

export function Community({ onSettings }: { onSettings: () => void }) {
  const [filter, setFilter] = useState("Needs a reply"),
    [channel, setChannel] = useState("all"),
    [search, setSearch] = useState("");
  return (
    <>
      <PageIntro
        title="Keep the conversation going."
        description="Comments and replies from every channel, in one inbox."
        action={
          <button onClick={onSettings}>
            <Icon name="link" size={16} /> Social accounts
          </button>
        }
      />
      <div className="community-layout">
        <section className="community-inbox">
          <div className="community-inbox-head">
            <label className="marketing-search">
              <Icon name="search" size={17} />
              <input
                aria-label="Search comments"
                placeholder="Search comments or people"
                value={search}
                onChange={(ev) => setSearch(ev.target.value)}
              />
            </label>
            <SelectField
              label="Community channel"
              value={channel}
              onChange={setChannel}
              options={[
                { value: "all", label: "All channels" },
                ...platforms.map((p) => ({ value: p.id, label: p.name })),
              ]}
            />
            <Segments
              label="Comment status"
              values={["Needs a reply", "All", "Saved"]}
              value={filter}
              onChange={setFilter}
            />
          </div>
          <EmptyState
            icon="chat"
            title={
              search ? "No comments found" : "A place for every conversation"
            }
            description={
              search
                ? "There are no connected comments to search yet."
                : "Connect your social accounts to see comments and reply without jumping between apps."
            }
            action={
              <button className="primary" onClick={onSettings}>
                View social accounts
              </button>
            }
          />
        </section>
        <section className="community-thread">
          <div className="community-thread-placeholder">
            <span>
              <Icon name="community" size={36} />
            </span>
            <h2>A thoughtful reply starts here.</h2>
            <p>
              Choose a comment from your inbox to see the post, read the
              conversation, and write a reply.
            </p>
            <div className="community-features">
              <span>
                <Icon name="chat" size={17} /> See the full conversation
              </span>
              <span>
                <Icon name="bookmark" size={17} /> Save comments for later
              </span>
              <span>
                <Icon name="check" size={17} /> Keep track of replies
              </span>
            </div>
          </div>
          <div className="community-reply-preview">
            <label htmlFor="community-reply">Your reply</label>
            <textarea
              id="community-reply"
              disabled
              placeholder="Select a comment to write a reply"
              rows={3}
            />
            <div>
              <span>Replies appear on the original social channel.</span>
              <button className="primary" disabled>
                Send reply
              </button>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

export function Setting({
  settings,
  setSettings,
  projects: p,
  notify,
}: {
  settings: BrandSettings;
  setSettings: Dispatch<SetStateAction<BrandSettings>>;
  projects: Projects;
  notify: (message: string) => void;
}) {
  const [section, setSection] = useState("Social accounts"),
    [checking, setChecking] = useState(false),
    [chatStatus, setChatStatus] = useState(""),
    [cliPath, setCliPath] = useState(
      () => localStorage.getItem("genie.codexPath") || "",
    );
  const update = (key: keyof BrandSettings, value: string) => {
    setSettings((old) => ({ ...old, [key]: value }));
    if (key === "theme") localStorage.setItem("genie.theme", value);
  };
  async function exportBackup() {
    try {
      notify(
        exportMessage(
          await saveExport(
            new Blob([JSON.stringify(p.workspace, null, 2)], {
              type: "application/json",
            }),
            "siswa-juara-projects.json",
          ),
        ),
      );
    } catch (err) {
      notify(`Backup failed: ${String(err)}`);
    }
  }
  return (
    <>
      <PageIntro
        title="Make this workspace yours."
        description="Manage your social accounts, brand details, and preferences."
      />
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings sections">
          {[
            { name: "Social accounts", icon: "link" as const },
            { name: "Brand", icon: "heading" as const },
            { name: "Preferences", icon: "settings" as const },
            { name: "Projects & backup", icon: "layers" as const },
            { name: "Assistant", icon: "chat" as const },
          ].map((item) => (
            <button
              key={item.name}
              aria-current={section === item.name ? "page" : undefined}
              onClick={() => setSection(item.name)}
            >
              <Icon name={item.icon} size={18} />
              {item.name}
              <Icon name="right" size={14} />
            </button>
          ))}
        </nav>
        <section className="settings-content">
          {section === "Social accounts" && (
            <Connections/>
          )}
          {section === "Brand" && (
            <>
              <div className="panel-heading">
                <div>
                  <h2>Your brand</h2>
                  <p>Give your workspace a familiar name and voice.</p>
                </div>
              </div>
              <label className="marketing-field">
                Brand name
                <input
                  value={settings.name}
                  onChange={(ev) => update("name", ev.target.value)}
                  placeholder="Your brand or business"
                />
              </label>
              <label className="marketing-field">
                About your brand
                <textarea
                  rows={5}
                  value={settings.description}
                  onChange={(ev) => update("description", ev.target.value)}
                  placeholder="Who do you help, and what makes your brand different?"
                />
              </label>
              <label className="marketing-field">
                Website
                <input
                  type="url"
                  value={settings.website}
                  onChange={(ev) => update("website", ev.target.value)}
                  placeholder="https://your-website.com"
                />
              </label>
              <p className="settings-autosave">
                <Icon name="check" size={15} /> Changes save automatically on
                this device.
              </p>
            </>
          )}
          {section === "Preferences" && (
            <>
              <div className="panel-heading">
                <div>
                  <h2>Preferences</h2>
                  <p>Set up the workspace in a way that feels comfortable.</p>
                </div>
              </div>
              <div className="settings-preference">
                <div>
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
              <div className="settings-preference">
                <div>
                  <strong>Time zone</strong>
                  <p>Your device’s time zone is used for planned dates.</p>
                </div>
                <span>{Intl.DateTimeFormat().resolvedOptions().timeZone}</span>
              </div>
              <div className="settings-preference">
                <div>
                  <strong>Storage</strong>
                  <p>
                    Projects, drafts, and conversations are saved on this
                    device.
                  </p>
                </div>
                <span className="subtle-badge">Local</span>
              </div>
              <p className="settings-explanation">
                You can download a backup of your Canvas projects under Projects
                & backup. Posts and conversations stay in this app’s local
                storage.
              </p>
            </>
          )}
          {section === "Projects & backup" && (
            <>
              <div className="panel-heading">
                <div>
                  <h2>Projects & backup</h2>
                  <p>Keep each brand or campaign’s Canvas work together.</p>
                </div>
                <button onClick={p.createProject}>
                  <Icon name="add" size={16} /> New project
                </button>
              </div>
              <label className="marketing-field">
                Current project name
                <input
                  value={p.project.name}
                  onChange={(ev) => p.renameProject(ev.target.value)}
                />
              </label>
              <div className="settings-projects">
                {p.workspace.projects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => p.selectProject(project.id)}
                    aria-current={
                      project.id === p.project.id ? "true" : undefined
                    }
                  >
                    <Icon name="layers" size={20} />
                    <span>
                      <strong>{project.name || "Untitled project"}</strong>
                      <small>
                        {project.pages.length}{" "}
                        {project.pages.length === 1 ? "page" : "pages"}
                      </small>
                    </span>
                    {project.id === p.project.id && (
                      <Icon name="check" size={17} />
                    )}
                  </button>
                ))}
              </div>
              <div className="backup-callout">
                <Icon name="export" size={24} />
                <div>
                  <h3>Keep a copy of your designs</h3>
                  <p>
                    Download all Canvas projects and pages as a JSON backup.
                  </p>
                </div>
                <button onClick={() => void exportBackup()}>
                  Download backup
                </button>
              </div>
            </>
          )}
          {section === "Assistant" && (
            <>
              <div className="panel-heading">
                <div>
                  <h2>Your creative assistant</h2>
                  <p>
                    Use Idea to develop posts and create designs with your
                    assistant.
                  </p>
                </div>
              </div>
              <div className="assistant-connection">
                <Icon name="chat" size={26} />
                <div>
                  <strong>
                    {isTauri()
                      ? "Desktop assistant"
                      : "Use the desktop app to chat"}
                  </strong>
                  <p>
                    {isTauri()
                      ? "The desktop app uses the bundled Codex CLI and your existing sign-in."
                      : "Your designs and draft planning work here. Assistant conversations require the desktop app."}
                  </p>
                </div>
              </div>
              <details className="marketing-advanced">
                <summary>Advanced connection settings</summary>
                <label className="marketing-field">
                  Codex executable{" "}
                  <span className="field-optional">
                    Leave empty to use the bundled version
                  </span>
                  <input
                    value={cliPath}
                    onChange={(ev) => {
                      setCliPath(ev.target.value);
                      localStorage.setItem("genie.codexPath", ev.target.value);
                    }}
                    placeholder="Automatic detection"
                  />
                </label>
                <button
                  disabled={!isTauri() || checking}
                  onClick={async () => {
                    setChecking(true);
                    try {
                      const status = await invoke<{
                        ok: boolean;
                        message: string;
                        path?: string;
                      }>("codex_status", {
                        codexPath: cliPath.trim() || undefined,
                      });
                      setChatStatus(
                        status.ok ? "Assistant is ready." : status.message,
                      );
                    } catch (err) {
                      setChatStatus(String(err));
                    } finally {
                      setChecking(false);
                    }
                  }}
                >
                  {checking ? "Checking…" : "Check connection"}
                </button>
                {chatStatus && <p role="status">{chatStatus}</p>}
              </details>
            </>
          )}
        </section>
      </div>
    </>
  );
}
