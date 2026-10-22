import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Projects } from "../editor/projects";
import type { Editor } from "../editor/useEditor";
import { Icon, type IconName } from "../components/ui/Icon";
import { SelectField } from "../components/ui/Controls";
import { CodexPanel, type ChatMode } from "../components/CodexPanel";
import { Dialog } from "./Shared";
import {
  chatEvent,
  conversationPage,
  conversationTitle,
  emptyPost,
  initialSettings,
  readConversations,
  useLocalState,
  type Conversation,
  type Post,
} from "./store";
import { Publish } from "./Publish";
import { Setting } from "./Modules";
import { Schedule, Insight, Community } from "../social/Views";
import "./marketing.css";
import "./chat.css";

export type Module =
  | "Idea"
  | "Canvas"
  | "Publish"
  | "Schedule"
  | "Insight"
  | "Community"
  | "Setting";
/** "list" is kept so existing callers compile; history now lives in the sidebar. */
export type IdeaView = "new" | "conversation" | "list";

const navigation: { name: Module; icon: IconName; description: string }[] = [
  { name: "Idea", icon: "idea", description: "Chat, discuss, and draw" },
  { name: "Publish", icon: "publish", description: "Prepare a social post" },
  { name: "Schedule", icon: "calendar", description: "See your content plan" },
  { name: "Insight", icon: "insight", description: "Understand your results" },
  {
    name: "Community",
    icon: "community",
    description: "Manage comments and replies",
  },
  { name: "Setting", icon: "settings", description: "Manage your workspace" },
];

export function MarketingWorkspace({
  projects: p,
  editor: e,
  module,
  setModule,
  renderCanvas,
  ideaView,
}: {
  projects: Projects;
  editor: Editor;
  module: Module;
  setModule: (module: Module, view?: IdeaView) => void;
  ideaView: IdeaView;
  renderCanvas: (onBack: () => void) => ReactNode;
}) {
  const [settings, setSettings, settingsError] = useLocalState(
    "genie.marketing.settings",
    initialSettings,
  );
  const [posts, setPosts, postsError] = useLocalState<Post[]>(
    "genie.marketing.posts",
    [],
  );
  const [draft, setDraft, draftError] = useLocalState<Post>(
    `genie.marketing.composer.${p.project.id}`,
    emptyPost(p.project.id),
  );
  const [promptSeed, setPromptSeed] = useState<{
    id: string;
    text: string;
    mode?: ChatMode;
  }>();
  const [help, setHelp] = useState(false),
    [toast, setToast] = useState(""),
    [search, setSearch] = useState(""),
    [activeKey, setActiveKey] = useState("");
  const [chats, setChats] = useState(() => readConversations(p.workspace));
  const [conversationRevision, setConversationRevision] = useState(0);

  useEffect(() => {
    const refresh = () => setChats(readConversations(p.workspace));
    refresh();
    window.addEventListener(chatEvent, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(chatEvent, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [p.workspace]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    document.title = `${module} · Siswa Juara`;
  }, [module]);

  function navigate(next: Module, view?: IdeaView) {
    if (next !== "Idea") setPromptSeed(undefined);
    setModule(next, view);
    setToast("");
  }

  function startIdea() {
    const scope = `${p.project.id}-${p.page.id}`;
    try {
      const existing = JSON.parse(
        localStorage.getItem(`genie.chat.${scope}`) || "null",
      );
      if (existing?.key && existing.messages?.length)
        localStorage.setItem(
          `genie.conversation.${existing.key}`,
          JSON.stringify({
            ...existing,
            scope,
            updatedAt: new Date().toISOString(),
          }),
        );
      localStorage.setItem(
        `genie.chat.${scope}`,
        JSON.stringify({ key: crypto.randomUUID(), messages: [] }),
      );
      setConversationRevision((n) => n + 1);
      setPromptSeed(undefined);
      window.dispatchEvent(new Event(chatEvent));
      navigate("Idea", "new");
    } catch {
      setToast("Could not start a new chat. Device storage may be full.");
    }
  }

  function startCanvas() {
    p.createPage();
    navigate("Canvas");
  }

  function ask(text: string) {
    setPromptSeed({ id: crypto.randomUUID(), text, mode: "discuss" });
    navigate("Idea", "conversation");
  }

  function openConversation(chat: Conversation) {
    const source = conversationPage(p.workspace, chat.scope);
    if (!source) {
      setToast("The canvas for this conversation is no longer available.");
      return;
    }
    try {
      localStorage.setItem(`genie.chat.${chat.scope}`, JSON.stringify(chat));
    } catch {
      setToast("Could not reopen this chat. Device storage is full.");
      return;
    }
    p.selectProject(source.project.id);
    p.selectPage(source.page.id);
    setPromptSeed(undefined);
    setConversationRevision((n) => n + 1);
    navigate("Idea", "conversation");
  }

  function savePost(status: "draft" | "planned") {
    const value = {
      ...draft,
      status,
      updatedAt: new Date().toISOString(),
      title:
        draft.title.trim() ||
        draft.caption.trim().split("\n")[0]?.slice(0, 70) ||
        "Untitled post",
    };
    setPosts((old) => [value, ...old.filter((post) => post.id !== value.id)]);
    setDraft(value);
    setToast(
      status === "planned"
        ? "Added to your local content plan. Social publishing is not connected yet."
        : "Draft saved on this device.",
    );
    if (status === "planned") setModule("Schedule");
  }

  const storageError =
    settingsError ||
    postsError ||
    draftError ||
    p.storageError ||
    e.storageError;

  const projectChats = useMemo(() => {
    const term = search.trim().toLowerCase();
    return chats
      .filter(
        (chat) =>
          conversationPage(p.workspace, chat.scope)?.project.id ===
          p.project.id,
      )
      .filter(
        (chat) =>
          !term ||
          conversationTitle(chat).toLowerCase().includes(term) ||
          chat.messages.some((m) => m.text.toLowerCase().includes(term)),
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [chats, search, p.workspace, p.project.id]);

  if (module === "Canvas") return renderCanvas(() => navigate("Idea"));
  const active = navigation.find((item) => item.name === module)!;

  return (
    <div className="studio marketing-workspace" data-theme={settings.theme}>
      <a className="marketing-skip" href="#marketing-main">
        Skip to content
      </a>
      <aside className="marketing-rail">
        <button
          className="marketing-brand"
          aria-label="Siswa Juara home"
          title="Siswa Juara"
          onClick={() => navigate("Idea")}
        >
          SJ
        </button>
        <nav aria-label="Main navigation">
          {navigation.map((item) => (
            <button
              key={item.name}
              className={`rail-button ${item.name === "Setting" ? "rail-settings" : ""}`}
              aria-label={item.name}
              aria-current={module === item.name ? "page" : undefined}
              onClick={() => navigate(item.name)}
            >
              <Icon name={item.icon} size={22} />
              <span className="rail-tooltip">
                <strong>{item.name}</strong>
                <span>{item.description}</span>
              </span>
            </button>
          ))}
        </nav>
        <button
          className="rail-button rail-help"
          aria-label="Help"
          onClick={() => setHelp(true)}
        >
          <Icon name="help" size={22} />
          <span className="rail-tooltip">
            <strong>How to use this workspace</strong>
          </span>
        </button>
      </aside>

      <div className="marketing-body">
        <header className="marketing-header">
          <div className="marketing-breadcrumb">
            <span className="workspace-label">Siswa Juara</span>
            <Icon name="right" size={14} />
            <h1 className="marketing-title">{active.name}</h1>
          </div>
          <div className="marketing-header-actions">
            <span className="device-save">
              <Icon name={storageError ? "help" : "check"} size={14} />
              {storageError ? "Could not save" : "Saved on this device"}
            </span>
            <SelectField
              label="Current project"
              value={p.project.id}
              onChange={p.selectProject}
              options={p.workspace.projects.map((project) => ({
                value: project.id,
                label: project.name || "Untitled project",
              }))}
            />
            <button onClick={startIdea}>
              <Icon name="add" size={17} /> New chat
            </button>
            <button onClick={startCanvas}>
              <Icon name="add" size={17} /> New canvas
            </button>
            {module !== "Publish" && (
              <button className="primary" onClick={() => navigate("Publish")}>
                <Icon name="add" size={17} /> Create post
              </button>
            )}
          </div>
        </header>
        {storageError && (
          <div className="marketing-storage-error" role="alert">
            {storageError}
          </div>
        )}

        <main
          id="marketing-main"
          className={`marketing-main module-${module.toLowerCase()}`}
        >
          {module === "Idea" && (
            <div className="chat-layout">
              <aside className="chat-sidebar" aria-label="Conversations">
                <label className="chat-search">
                  <Icon name="search" size={15} />
                  <input
                    aria-label="Search conversations"
                    placeholder="Search"
                    value={search}
                    onChange={(ev) => setSearch(ev.target.value)}
                  />
                </label>
                {projectChats.length ? (
                  <ul className="chat-list">
                    {projectChats.map((chat) => {
                      const page = conversationPage(p.workspace, chat.scope);
                      return (
                        <li key={chat.key}>
                          <button
                            aria-current={
                              chat.key === activeKey ? "true" : undefined
                            }
                            onClick={() => openConversation(chat)}
                          >
                            <strong>{conversationTitle(chat)}</strong>
                            <small>
                              {page?.page.name || "Removed canvas"} ·{" "}
                              {new Date(chat.updatedAt).toLocaleDateString(
                                undefined,
                                { month: "short", day: "numeric" },
                              )}
                            </small>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="chat-list-empty">
                    {search
                      ? "No chats match your search."
                      : "Your chats appear here once you send a message."}
                  </p>
                )}
              </aside>
              <div className="chat-main">
                <CodexPanel
                  key={`${p.page.id}:${ideaView}:${conversationRevision}`}
                  editor={e}
                  scope={`${p.project.id}-${p.page.id}`}
                  variant="idea"
                  promptSeed={promptSeed}
                  startFresh={ideaView === "new"}
                  onKeyChange={setActiveKey}
                  onOpenCanvas={() => navigate("Canvas")}
                />
              </div>
            </div>
          )}
          {module === "Publish" && (
            <Publish
              projects={p}
              draft={draft}
              setDraft={setDraft}
              settings={settings}
              onSave={savePost}
              onCanvas={() => navigate("Canvas")}
              onIdea={() =>
                ask(
                  `Help me write a caption for this post${draft.caption ? `: ${draft.caption}` : ". Ask me what I want to share."}`,
                )
              }
              onSettings={() => navigate("Setting")}
              notify={setToast}
            />
          )}
          {module === "Schedule" && (
            <Schedule
              posts={posts.filter((post) => post.projectId === p.project.id)}
              workspace={p.workspace}
              timezone={settings.timezone}
              onCreate={() => {
                setDraft(emptyPost(p.project.id));
                navigate("Publish");
              }}
              onEdit={(post) => {
                setDraft(post);
                navigate("Publish");
              }}
              onRemove={(id) => {
                setPosts((old) => old.filter((post) => post.id !== id));
                setToast("Post removed from your plan.");
              }}
              onSettings={() => navigate("Setting")}
            />
          )}
          {module === "Insight" && (
            <Insight onSettings={() => navigate("Setting")} />
          )}
          {module === "Community" && (
            <Community onSettings={() => navigate("Setting")} />
          )}
          {module === "Setting" && (
            <Setting
              settings={settings}
              setSettings={setSettings}
              projects={p}
              notify={setToast}
            />
          )}
        </main>
      </div>

      {toast && (
        <div className="marketing-toast" role="status">
          <Icon name="check" size={18} />
          <span>{toast}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <Icon name="close" size={15} />
          </button>
        </div>
      )}
      {help && (
        <Dialog
          title="From first idea to finished post"
          onClose={() => setHelp(false)}
        >
          <ol className="help-steps">
            <li>
              <strong>Chat in Idea.</strong>
              <p>
                Pick <b>Discuss</b> to talk through topics and captions. Pick{" "}
                <b>Draw</b> to have the assistant build on your canvas. Chat
                runs in the desktop app.
              </p>
            </li>
            <li>
              <strong>Review the canvas.json revision.</strong>
              <p>
                Each Draw reply ends with a revision you can preview, restore,
                or download.
              </p>
            </li>
            <li>
              <strong>Prepare it in Publish.</strong>
              <p>
                Choose frames or upload media, write your caption, and choose
                where and when to share.
              </p>
            </li>
            <li>
              <strong>Keep track in Schedule.</strong>
              <p>
                Drafts are saved on this device. Connect Buffer or Zernio in
                Setting to publish and schedule posts. Provider queues and
                delivery statuses appear in Schedule.
              </p>
            </li>
          </ol>
          <button className="primary" onClick={() => setHelp(false)}>
            Got it
          </button>
        </Dialog>
      )}
    </div>
  );
}