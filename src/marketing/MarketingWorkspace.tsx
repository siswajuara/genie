import { useEffect, useState, type ReactNode } from "react";
import { flushLocalStore, localStore } from "../lib/localStore";
import type { Projects } from "../editor/projects";
import type { Editor } from "../editor/useEditor";
import { Icon, type IconName } from "../components/ui/Icon";
import { Dialog } from "./Shared";
import { emptyPost, initialSettings, useLocalState, type Post } from "./store";
import { Publish } from "./Publish";
import { Canvases } from "./Canvases";
import { Setting } from "./Modules";
import { Schedule } from "../social/Views";
import { projectLogo } from "../lib/brand";
import { StoryStudio } from "../story/StoryStudio";
import "./marketing.css";

export type Module =
  "Canvases" | "Canvas" | "Story" | "Publish" | "Schedule" | "Setting";
const navigation: { name: Module; icon: IconName; description: string }[] = [
  { name: "Canvases", icon: "layers", description: "Open and manage canvases" },
  {
    name: "Story",
    icon: "film",
    description: "AI Story Creator · brief to canvas",
  },
  { name: "Publish", icon: "publish", description: "Prepare a social post" },
  { name: "Schedule", icon: "calendar", description: "See your content plan" },
  { name: "Setting", icon: "settings", description: "Manage your workspace" },
];

export function MarketingWorkspace({
  projects: p,
  editor: e,
  module,
  setModule,
  renderCanvas,
}: {
  projects: Projects;
  editor: Editor;
  module: Module;
  setModule: (module: Module) => void;
  renderCanvas: (onBack: () => void) => ReactNode;
}) {
  const [settings, setSettings, settingsError] = useLocalState(
    "genie.marketing.settings",
    initialSettings,
  );
  const [posts, setPosts, postsError] = useLocalState<Post[]>(
    "genie.marketing.posts",
    [],
    // recordPost and onRemove persist before updating React state. An effect
    // here could overwrite the next AI result with an earlier rendered draft.
    false,
  );
  const [draft, setDraft] = useState<Post>(() => emptyPost(p.project.id));
  const [help, setHelp] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    document.title = `${module} · Siswa Juara`;
  }, [module]);

  function navigate(next: Module) {
    setModule(next);
    setToast("");
  }

  function startCanvas() {
    p.createProject();
    navigate("Canvas");
  }

  function openCanvas(id: string, pageId?: string) {
    if (id) p.selectProject(id);
    if (pageId) p.selectPage(pageId);
    navigate("Canvas");
  }

  async function recordPost(input: Post) {
    const post = {
      ...input,
      title:
        input.title.trim() ||
        input.caption.trim().split("\n")[0]?.slice(0, 70) ||
        "Untitled post",
    };
    // Async story/voice results merge into the latest local drafts after navigation.
    const latest =
      JSON.parse(localStore.getItem("genie.marketing.posts") || "null") ??
      posts;
    const next = [
      post,
      ...(latest as Post[]).filter((saved) => saved.id !== post.id),
    ];
    localStore.setItem("genie.marketing.posts", JSON.stringify(next));
    await flushLocalStore();
    setPosts(JSON.parse(localStore.getItem("genie.marketing.posts") || "[]"));
  }

  async function savePost(status: "draft" | "planned") {
    try {
      if (status === "planned" && (!draft.date || !draft.time))
        throw Error("Choose a date and time for your local plan.");
      const saved: Post = {
        ...draft,
        status,
        updatedAt: new Date().toISOString(),
        title:
          draft.title.trim() ||
          draft.caption.trim().split("\n")[0]?.slice(0, 70) ||
          "Untitled post",
      };
      await recordPost(saved);
      setDraft((old) => ({ ...old, title: saved.title, status: saved.status }));
      setToast(
        status === "planned"
          ? "Saved to your local content plan. This will not publish automatically."
          : "Draft saved on this device.",
      );
      if (status === "planned") setModule("Schedule");
    } catch (error) {
      setToast(`Could not save draft: ${String(error)}`);
    }
  }

  const storageError =
    postsError || settingsError || p.storageError || e.storageError;

  if (module === "Canvas")
    return <>{renderCanvas(() => navigate("Canvases"))}</>;
  const active = navigation.find((item) => item.name === module)!;

  const content = (
    <div className="studio marketing-workspace" data-theme={settings.theme}>
      <a className="marketing-skip" href="#marketing-main">
        Skip to content
      </a>
      <aside className="marketing-rail">
        <button
          className="marketing-brand"
          aria-label="Siswa Juara home"
          title="Siswa Juara"
          onClick={() => navigate("Canvases")}
        >
          <img src={projectLogo} alt="Siswa Juara" width={40} height={40} />
        </button>
        <nav aria-label="Main navigation">
          {navigation.map((item) => (
            <button
              key={item.name}
              className={`rail-button ${item.name === "Setting" ? "rail-settings" : ""}`}
              aria-label={item.name === "Story" ? "Story Creator" : item.name}
              aria-current={module === item.name ? "page" : undefined}
              onClick={() => navigate(item.name)}
            >
              <Icon name={item.icon} size={22} />
              <span className="rail-tooltip">
                <strong>
                  {item.name === "Story" ? "Story Creator" : item.name}
                </strong>
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
            <span className="marketing-title">{active.name}</span>
          </div>
          <div className="marketing-header-actions">
            <button className="primary" onClick={startCanvas}>
              <Icon name="layers" size={17} /> New Canvas
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
          {module === "Canvases" && (
            <Canvases
              projects={p}
              onOpen={openCanvas}
              onNew={startCanvas}
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
              onRecord={recordPost}
              onCanvas={startCanvas}
              onSettings={() => navigate("Setting")}
              notify={setToast}
            />
          )}
          {module === "Story" && (
            <StoryStudio
              posts={posts}
              projects={p}
              editor={e}
              onSave={recordPost}
              onOpenCanvas={openCanvas}
              onPublish={(post) => {
                setDraft(post);
                navigate("Publish");
              }}
              onSettings={(section) => {
                navigate("Setting");
                window.location.hash = `#setting/${section === "Story AI" ? "story" : section.toLowerCase()}`;
                window.setTimeout(
                  () =>
                    window.dispatchEvent(
                      new CustomEvent("genie:open-settings-section", {
                        detail: section,
                      }),
                    ),
                  0,
                );
              }}
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
                    const next = posts.filter((post) => post.id !== id);
                    localStore.setItem(
                      "genie.marketing.posts",
                      JSON.stringify(next),
                    );
                    await flushLocalStore();
                    setPosts(next);
                    setToast("Draft removed from this device.");
                  } catch (error) {
                    setToast(`Could not remove draft: ${String(error)}`);
                  }
                }}
                onSettings={() => navigate("Setting")}
              />
            </>
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
          title="Create, publish, and schedule"
          onClose={() => setHelp(false)}
        >
          <ol className="help-steps">
            <li>
              <strong>Create a story with AI.</strong>
              <p>
                Open Story Creator, connect Cloudflare under Setting → Story AI,
                and write a brief. Edit the story and scenes in one continuous
                form, then create editable canvas frames. Select a frame and
                open Timeline → Voiceover to generate its narration. Audio,
                captions, SRT and animation are controlled in the frame timeline
                and play in the canvas. Generate buttons use provider credits
                only when clicked.
              </p>
            </li>
            <li>
              <strong>Create in Canvas.</strong>
              <p>
                Open a saved canvas or create a new one. Add pages, frames,
                text, images, video, and templates to build your design. Save
                checkpoints and restore them from Versions.
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
                Drafts and dated plans are saved on this device. Plans do not
                publish automatically. View Buffer and Zernio free-tier limits
                in Setting and confirm publishing through connected providers in
                Publish.
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
  return content;
}
