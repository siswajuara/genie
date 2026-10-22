import { useEffect, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import { isTauri } from "@tauri-apps/api/core";
import type { Projects } from "../editor/projects";
import type { Editor } from "../editor/useEditor";
import { Icon, type IconName } from "../components/ui/Icon";
import { SelectField } from "../components/ui/Controls";
import { CodexPanel } from "../components/CodexPanel";
import { FramePreview } from "./FramePreview";
import { Dialog, EmptyState, PageIntro, Segments } from "./Shared";
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
import { Schedule, Insight, Community, Setting } from "./Modules";
import "./marketing.css";

export type Module =
  | "Idea"
  | "Canvas"
  | "Publish"
  | "Schedule"
  | "Insight"
  | "Community"
  | "Setting";
export type IdeaView = "new" | "conversation" | "list";
const navigation: { name: Module; icon: IconName; description: string }[] = [
  {
    name: "Idea",
    icon: "idea",
    description: "New chats and past conversations",
  },
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
  const [promptSeed, setPromptSeed] = useState<{ id: string; text: string }>();
  const [help, setHelp] = useState(false),
    [toast, setToast] = useState("");
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
    const timer = requestAnimationFrame(() =>
      document
        .querySelector<HTMLElement>(".marketing-page-intro h1")
        ?.focus({ preventScroll: true }),
    );
    return () => cancelAnimationFrame(timer);
  }, [module, ideaView]);
  function navigate(next: Module, view?: IdeaView) {
    if (next !== "Idea" || view === "list") setPromptSeed(undefined);
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
      setToast(
        "Could not start a new conversation. Device storage may be full.",
      );
    }
  }
  function ask(text: string) {
    setPromptSeed({ id: crypto.randomUUID(), text });
    navigate("Idea", ideaView === "conversation" ? "conversation" : "new");
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLTextAreaElement>(
          '.idea-conversation textarea[aria-label="Chat message"]',
        )
        ?.focus(),
    );
  }
  function openConversation(
    chat: Conversation,
    destination: "Idea" | "Canvas",
  ) {
    const source = conversationPage(p.workspace, chat.scope);
    if (!source) {
      setToast("The canvas for this conversation is no longer available.");
      return;
    }
    try {
      localStorage.setItem(`genie.chat.${chat.scope}`, JSON.stringify(chat));
    } catch {
      setToast("Could not reopen this conversation. Device storage is full.");
      return;
    }
    p.selectProject(source.project.id);
    p.selectPage(source.page.id);
    setPromptSeed(undefined);
    setConversationRevision((n) => n + 1);
    navigate(destination, destination === "Idea" ? "conversation" : undefined);
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
  if (module === "Canvas") return renderCanvas(() => navigate("Idea"));
  const active = navigation.find((item) => item.name === module)!;
  const allChats = chats.filter(
    (chat) =>
      conversationPage(p.workspace, chat.scope)?.project.id === p.project.id,
  );
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
            <span>{active.name}</span>
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
          {module === "Idea" && ideaView !== "list" && (
            <div className="idea-layout">
              <div className="idea-main">
                <PageIntro
                  title="Good posts start with an idea."
                  description="Think it through here. Bring it to life in Canvas."
                  action={
                    <button onClick={() => navigate("Idea", "list")}>
                      <Icon name="chat" size={16} /> Conversations
                    </button>
                  }
                />
                <div className="idea-starters">
                  <span className="eyebrow">A little help getting started</span>
                  <div>
                    {[
                      {
                        icon: "calendar" as IconName,
                        title: "Plan my content",
                        description: "A week of posts, one clear direction",
                        prompt:
                          "Help me plan a week of social media posts. Start by asking about my audience, my business, and my goal.",
                      },
                      {
                        icon: "layers" as IconName,
                        title: "Create a carousel",
                        description: "Turn one topic into a story",
                        prompt:
                          "Help me turn a topic into a carousel. Ask me about the topic and audience, then suggest a slide outline before creating it.",
                      },
                      {
                        icon: "text" as IconName,
                        title: "Find the right words",
                        description: "A caption that sounds like you",
                        prompt:
                          "Help me write a social media caption. Ask what I am sharing, who it is for, and the tone I want.",
                      },
                    ].map((starter) => (
                      <button
                        key={starter.title}
                        onClick={() => ask(starter.prompt)}
                      >
                        <Icon name={starter.icon} size={21} />
                        <strong>{starter.title}</strong>
                        <span>{starter.description}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <CodexPanel
                  key={`${p.page.id}:${ideaView}:${conversationRevision}`}
                  editor={e}
                  scope={`${p.project.id}-${p.page.id}`}
                  variant="idea"
                  promptSeed={promptSeed}
                  startFresh={ideaView === "new"}
                />
              </div>
              <aside className="idea-context">
                <div className="context-heading">
                  <Icon name="layers" size={18} />
                  <h2>Your Canvas</h2>
                  <span className="subtle-badge">
                    {e.scene.frames.length}{" "}
                    {e.scene.frames.length === 1 ? "frame" : "frames"}
                  </span>
                </div>
                <div className="idea-canvas-preview">
                  {e.scene.frames[0] ? (
                    <FramePreview
                      document={e.committed}
                      frameId={e.scene.frames[0].id}
                      label="Current canvas preview"
                    />
                  ) : (
                    <EmptyState
                      icon="layers"
                      title="Space for your next idea"
                      description="Add a frame in Canvas to start designing."
                    />
                  )}
                </div>
                <div className="canvas-context-copy">
                  <strong>{p.page.name}</strong>
                  <span>{p.project.name}</span>
                </div>
                <button
                  className="primary context-open"
                  onClick={() => navigate("Canvas")}
                >
                  Open Canvas
                  <Icon name="right" size={16} />
                </button>
                <button
                  className="context-publish"
                  onClick={() => navigate("Publish")}
                >
                  Prepare a post
                  <Icon name="publish" size={16} />
                </button>
                <p className="context-note">
                  Your ideas, conversation, and design stay together.
                </p>
                <div className="idea-recent">
                  <div>
                    <h3>Recent conversations</h3>
                    <button onClick={() => navigate("Idea", "list")}>
                      View all
                    </button>
                  </div>
                  {allChats.length ? (
                    allChats.slice(0, 3).map((chat) => (
                      <button
                        key={chat.key}
                        onClick={() => openConversation(chat, "Idea")}
                      >
                        <Icon name="chat" size={16} />
                        <span>{conversationTitle(chat)}</span>
                        <Icon name="right" size={14} />
                      </button>
                    ))
                  ) : (
                    <p>
                      Your conversations will appear here once you start
                      chatting.
                    </p>
                  )}
                </div>
              </aside>
            </div>
          )}
          {module === "Idea" && ideaView === "list" && (
            <ChatHistory
              chats={allChats}
              projects={p}
              onOpen={openConversation}
              onNew={startIdea}
            />
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
              <strong>Start in Idea.</strong>
              <p>
                Talk through a topic, find your message, or plan a carousel.
                Chat runs in the desktop app.
              </p>
            </li>
            <li>
              <strong>Make it in Canvas.</strong>
              <p>
                Open Canvas from Idea or a conversation. Use the back button to
                return.
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
                Drafts and planned posts are saved on this device. Social
                account connections and live publishing are not available yet.
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

function ChatHistory({
  chats,
  projects: p,
  onOpen,
  onNew,
}: {
  chats: Conversation[];
  projects: Projects;
  onOpen: (chat: Conversation, destination: "Idea" | "Canvas") => void;
  onNew: () => void;
}) {
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("All conversations"),
    [selected, setSelected] = useState<string>();
  const filtered = chats.filter(
    (chat) =>
      (filter === "All conversations" ||
        chat.scope === `${p.project.id}-${p.page.id}`) &&
      chat.messages.some((m) =>
        m.text.toLowerCase().includes(search.toLowerCase()),
      ),
  );
  const current = filtered.find((c) => c.key === selected) || filtered[0];
  return (
    <>
      <PageIntro
        title="Pick up where you left off."
        description="Every conversation, including chats from Canvas, in one place."
        action={
          <button className="primary" onClick={onNew}>
            <Icon name="add" size={17} /> New chat
          </button>
        }
      />
      <div className="history-layout">
        <section className="history-list">
          <label className="marketing-search">
            <Icon name="search" size={17} />
            <input
              aria-label="Search conversations"
              placeholder="Search conversations"
              value={search}
              onChange={(ev) => setSearch(ev.target.value)}
            />
          </label>
          <Segments
            label="Conversation scope"
            values={["All conversations", "This canvas"]}
            value={filter}
            onChange={setFilter}
          />
          <div className="history-results">
            {filtered.length ? (
              filtered.map((chat) => {
                const source = conversationPage(p.workspace, chat.scope);
                return (
                  <button
                    className={`history-row ${current?.key === chat.key ? "selected" : ""}`}
                    key={chat.key}
                    onClick={() => setSelected(chat.key)}
                  >
                    <span className="history-row-icon">
                      <Icon name="chat" />
                    </span>
                    <span>
                      <strong>{conversationTitle(chat)}</strong>
                      <small>
                        {source?.page.name || "Removed canvas"} ·{" "}
                        {new Date(chat.updatedAt).toLocaleDateString(
                          undefined,
                          { month: "short", day: "numeric" },
                        )}
                      </small>
                      <p>
                        {chat.messages
                          .filter((m) => m.role !== "tool")
                          .at(-1)
                          ?.text.slice(0, 95)}
                      </p>
                    </span>
                    <Icon name="right" size={15} />
                  </button>
                );
              })
            ) : (
              <EmptyState
                icon="chat"
                title={
                  search
                    ? "No matching conversations"
                    : "Your ideas have a home here"
                }
                description={
                  search
                    ? "Try a different word or clear your search."
                    : "Start in Idea or chat while editing in Canvas. Your conversations will be saved here."
                }
                action={
                  search ? (
                    <button onClick={() => setSearch("")}>Clear search</button>
                  ) : (
                    <button onClick={onNew}>Start an idea</button>
                  )
                }
              />
            )}
          </div>
        </section>
        <section className="history-detail" aria-label="Conversation preview">
          {current ? (
            <>
              <div className="history-detail-head">
                <div>
                  <span className="eyebrow">Conversation</span>
                  <h2>{conversationTitle(current)}</h2>
                </div>
                <div className="row">
                  <button onClick={() => onOpen(current, "Idea")}>
                    Continue in Idea
                  </button>
                  <button
                    className="primary"
                    onClick={() => onOpen(current, "Canvas")}
                  >
                    <Icon name="layers" size={16} /> Open Canvas
                  </button>
                </div>
              </div>
              <div className="history-messages">
                {current.messages
                  .filter((m) => m.role !== "tool")
                  .map((m) => (
                    <article className={`history-message ${m.role}`} key={m.id}>
                      <span>{m.role === "user" ? "You" : "Assistant"}</span>
                      <ReactMarkdown>{m.text}</ReactMarkdown>
                    </article>
                  ))}
              </div>
            </>
          ) : (
            <EmptyState
              icon="idea"
              title="A conversation, with its context"
              description="Choose a conversation to read it or open the Canvas it belongs to."
            />
          )}
        </section>
      </div>
      {!isTauri() && (
        <p className="marketing-footnote">
          You can read saved conversations here. Use the desktop app to chat
          with your assistant.
        </p>
      )}
    </>
  );
}
