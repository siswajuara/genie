import { useEffect, useMemo, useState, type ReactNode } from "react";
import { localStore, useLocalStorageStatus } from "../lib/localStore";
import type { Projects } from "../editor/projects";
import type { Editor } from "../editor/useEditor";
import { Icon, type IconName } from "../components/ui/Icon";
import { CodexPanel, type ChatMode } from "../components/CodexPanel";
import { Dialog } from "./Shared";
import {
  chatDisplayTitle,
  chatEvent,
  conversationPage,
  conversationTitle,
  deleteConversation,
  emptyPost,
  initialSettings,
  pruneEmptyConversations,
  readChatTitles,
  readConversations,
  renameConversation,
  useLocalState,
  type Conversation,
  type Post,
} from "./store";
import { Publish } from "./Publish";
import { Canvases } from "./Canvases";
import { Setting } from "./Modules";
import { Schedule, Insight, Community } from "../social/Views";
import { useSocial } from "../social/client";
import { prepareSocialMedia } from "../social/media";
import { projectLogo } from "../lib/brand";
import "./marketing.css";
import "./chat.css";

export type Module =
  | "Idea"
  | "Canvases"
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
  { name: "Canvases", icon: "layers", description: "Open and manage canvases" },
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
  const social = useSocial();
  const [posts, setPosts] = useState<Post[]>([]),
    [postsError, setPostsError] = useState("");
  const [draft, setDraft] = useState<Post>(() => emptyPost(p.project.id));
  useEffect(() => {
    let live = true;
    setPosts([]);
    void social
      .request<{ posts: Post[] }>("drafts.list")
      .then((result) => {
        if (live) {
          setPosts(result.posts);
          setPostsError("");
        }
      })
      .catch((error) => {
        if (live) setPostsError(String(error));
      });
    return () => {
      live = false;
    };
  }, [social.revision]);
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
  const [titles, setTitles] = useState(() => readChatTitles());
  const [renamingKey, setRenamingKey] = useState(""),
    [renameDraft, setRenameDraft] = useState(""),
    [confirmingKey, setConfirmingKey] = useState("");
  const [conversationRevision, setConversationRevision] = useState(0);

  useEffect(() => {
    const refresh = () => {
      pruneEmptyConversations();
      setChats(readConversations(p.workspace));
      setTitles(readChatTitles());
    };
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
    p.createProject();
    setConversationRevision((n) => n + 1);
    setPromptSeed(undefined);
    navigate("Idea", "new");
  }

  function startCanvas() {
    p.createProject();
    navigate("Canvas");
  }

  function openCanvas(id: string) {
    if (id) p.selectProject(id);
    navigate("Canvas");
  }

  function openChat(id: string) {
    if (id) p.selectProject(id);
    setPromptSeed(undefined);
    setConversationRevision((n) => n + 1);
    navigate("Idea", "conversation");
  }

  function commitChatRename(key: string) {
    renameConversation(key, renameDraft);
    setRenamingKey("");
  }

  function removeChat(chat: Conversation) {
    deleteConversation(chat.key);
    if (chat.key === activeKey) setConversationRevision((n) => n + 1);
    setConfirmingKey("");
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
      localStore.setItem(`genie.chat.${chat.scope}`, JSON.stringify(chat));
      localStore.setItem(
        `genie.chat.${source.project.id}`,
        JSON.stringify(chat),
      );
    } catch {
      setToast(
        "Could not reopen this chat. Check Settings > Storage and retry saving.",
      );
      return;
    }
    p.selectProject(source.project.id);
    p.selectPage(source.page.id);
    setPromptSeed(undefined);
    setConversationRevision((n) => n + 1);
    navigate("Idea", "conversation");
  }

  async function savePost(status: "draft" | "planned") {
    try {
      const media = [];
      for (const item of draft.media) {
        const prepared = await prepareSocialMedia(
          item,
          p.workspace,
          social.config.zernio.configured,
        );
        media.push({
          id: item.id,
          name: item.name,
          kind: prepared.type,
          src: prepared.url,
        });
      }
      const value = {
        id: draft.id,
        caption: draft.caption,
        platforms: draft.platforms,
        accountKeys: draft.accountKeys,
        timing: draft.timing,
        date: draft.date,
        time: draft.time,
        submissionId: draft.submissionId,
        media,
        status,
        updatedAt: new Date().toISOString(),
        title:
          draft.title.trim() ||
          draft.caption.trim().split("\n")[0]?.slice(0, 70) ||
          "Untitled post",
      };
      const saved = await social.request<Post>("drafts.save", { post: value });
      setPosts((old) => [saved, ...old.filter((post) => post.id !== saved.id)]);
      setDraft((old) => ({ ...old, title: saved.title, status: saved.status }));
      setToast(
        status === "planned"
          ? "Saved to your website content plan. Confirm publication in Publish to submit it."
          : "Draft saved to your website.",
      );
      if (status === "planned") setModule("Schedule");
    } catch (error) {
      setToast(`Could not save draft: ${String(error)}`);
    }
  }

  const storageError = settingsError || p.storageError || e.storageError;
  const diskStatus = useLocalStorageStatus();

  const projectChats = useMemo(() => {
    const term = search.trim().toLowerCase();
    return chats
      .filter((chat) => !!conversationPage(p.workspace, chat.scope))
      .filter(
        (chat) =>
          !term ||
          chatDisplayTitle(chat, titles).toLowerCase().includes(term) ||
          chat.messages.some((m) => m.text.toLowerCase().includes(term)),
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [chats, search, p.workspace, p.project.id, titles]);

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
          <img src={projectLogo} alt="Siswa Juara" width={40} height={40} />
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
            <strong>How to use the app</strong>
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
              {storageError
                ? "Could not save"
                : diskStatus.saving
                  ? "Saving…"
                  : "Saved on this device"}
            </span>
            <button onClick={startIdea}>
              <Icon name="add" size={17} /> New Idea
            </button>
            <button className="primary" onClick={startCanvas}>
              <Icon name="layers" size={17} /> Open Canvas
            </button>
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
                <p className="chat-list-head" role="status">
                  <span>Chats</span>
                  <span>{projectChats.length}</span>
                </p>
                {projectChats.length ? (
                  <ul className="chat-list">
                    {projectChats.map((chat) => {
                      const page = conversationPage(p.workspace, chat.scope);
                      const title = chatDisplayTitle(chat, titles);
                      const isActive = chat.key === activeKey;
                      if (confirmingKey === chat.key)
                        return (
                          <li key={chat.key} className="chat-item is-confirming">
                            <span className="chat-confirm-text">
                              Delete this chat?
                            </span>
                            <span className="chat-confirm-actions">
                              <button
                                type="button"
                                className="danger"
                                onClick={() => removeChat(chat)}
                              >
                                Delete
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmingKey("")}
                              >
                                Keep
                              </button>
                            </span>
                          </li>
                        );
                      if (renamingKey === chat.key)
                        return (
                          <li key={chat.key} className="chat-item is-renaming">
                            <input
                              autoFocus
                              aria-label="Chat name"
                              value={renameDraft}
                              placeholder={conversationTitle(chat)}
                              onChange={(ev) => setRenameDraft(ev.target.value)}
                              onKeyDown={(ev) => {
                                if (ev.key === "Enter")
                                  commitChatRename(chat.key);
                                if (ev.key === "Escape") setRenamingKey("");
                              }}
                            />
                            <span className="chat-rename-actions">
                              <button
                                type="button"
                                title="Save name"
                                aria-label="Save name"
                                onClick={() => commitChatRename(chat.key)}
                              >
                                <Icon name="check" size={14} />
                              </button>
                              <button
                                type="button"
                                title="Cancel"
                                aria-label="Cancel"
                                onClick={() => setRenamingKey("")}
                              >
                                <Icon name="close" size={14} />
                              </button>
                            </span>
                          </li>
                        );
                      return (
                        <li
                          key={chat.key}
                          className={`chat-item${isActive ? " is-active" : ""}`}
                        >
                          <button
                            type="button"
                            className="chat-open"
                            aria-current={isActive ? "true" : undefined}
                            onClick={() => openConversation(chat)}
                            title={title}
                          >
                            <strong>{title}</strong>
                            <small>
                              {page
                                ? `${page.project.pages.length} pages`
                                : "Removed canvas"}{" "}
                              ·{" "}
                              {new Date(chat.updatedAt).toLocaleDateString(
                                undefined,
                                { month: "short", day: "numeric" },
                              )}
                            </small>
                          </button>
                          <span className="chat-item-tools">
                            <button
                              type="button"
                              title="Rename chat"
                              aria-label={`Rename ${title}`}
                              onClick={() => {
                                setConfirmingKey("");
                                setRenameDraft(titles[chat.key] ?? "");
                                setRenamingKey(chat.key);
                              }}
                            >
                              <Icon name="rename" size={14} />
                            </button>
                            <button
                              type="button"
                              className="danger-ghost"
                              title="Delete chat"
                              aria-label={`Delete ${title}`}
                              onClick={() => {
                                setRenamingKey("");
                                setConfirmingKey(chat.key);
                              }}
                            >
                              <Icon name="delete" size={14} />
                            </button>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="chat-list-empty">
                    {search
                      ? "No chats match your search."
                      : "Start a chat to create its canvas."}
                  </p>
                )}
              </aside>
              <div className="chat-main">
                <CodexPanel
                  key={`${p.page.id}:${ideaView}:${conversationRevision}`}
                  editor={e}
                  scope={p.project.id}
                  conversationKey={p.project.conversationId}
                  pageId={p.page.id}
                  onRestoreRevision={p.restoreChatRevision}
                  onCanvasRevision={(doc, label) => p.recordVersion(label, doc)}
                  variant="idea"
                  promptSeed={promptSeed}
                  onKeyChange={setActiveKey}
                  headingNote={p.project.name}
                />
              </div>
            </div>
          )}
          {module === "Canvases" && (
            <Canvases
              projects={p}
              onOpen={openCanvas}
              onNew={startCanvas}
              onOpenChat={openChat}
              notify={setToast}
            />
          )}
          {module === "Publish" && (
            <Publish
              projects={p}
              draft={draft}
              setDraft={setDraft}
              settings={settings}
              onSave={savePost}
              onCanvas={startCanvas}
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
            <>
              {postsError && (
                <p role="alert" className="error">
                  {postsError}
                </p>
              )}
              <Schedule
                posts={posts}
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
                onRemove={async (id) => {
                  try {
                    await social.request("drafts.delete", { id });
                    setPosts((old) => old.filter((post) => post.id !== id));
                    setToast(
                      "Draft removed from your website. Provider posts are unaffected.",
                    );
                  } catch (error) {
                    setToast(String(error));
                  }
                }}
                onSettings={() => navigate("Setting")}
              />
            </>
          )}
          {module === "Insight" && (
            <Insight onSettings={() => navigate("Setting")} />
          )}
          {module === "Community" && (
            <Community onSettings={() => navigate("Setting")} />
          )}
          {module === "Setting" && (
            <Setting settings={settings} setSettings={setSettings} />
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
