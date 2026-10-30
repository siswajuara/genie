import { Button } from "@/components/ui/button";
import { useEffect, useState, type ReactNode } from "react";
import { flushLocalStore, localStore } from "../lib/local-store";
import type { Projects } from "../editor/projects";
import type { Editor } from "../editor/use-editor";
import { Icon, type IconName } from "../components/ui/icon";
import { Dialog } from "./shared";
import { emptyPost, initialPreferences, useLocalState, type Post } from "./store";
import { Publish } from "./publish";
import { Canvases } from "./canvases";
import { Setting } from "./modules";
import { Schedule } from "../social/views";
import { projectLogo } from "../lib/brand";

export type Module = "Canvases" | "Canvas" | "Publish" | "Schedule" | "Setting";
const navigation: { name: Module; icon: IconName; description: string }[] = [
  { name: "Canvases", icon: "layers", description: "Open and manage canvases" },
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
    initialPreferences,
  );
  const [posts, setPosts, postsError] = useLocalState<Post[]>(
    "genie.marketing.posts",
    [],
    // Persist before updating React state so an effect cannot overwrite a save.
    false,
  );
  const [draft, setDraft] = useState<Post>(() => emptyPost(p.project.id));
  const [help, setHelp] = useState(false);
  const [toast, setToast] = useState("");
  const generatedPost = p.page.canvas.metadata.post;
  useEffect(() => {
    if (module !== "Publish" || !generatedPost) return;
    setDraft((old) =>
      old.title || old.caption || old.media.length
        ? old
        : {
            ...old,
            title: generatedPost.name,
            caption: generatedPost.caption,
            media: generatedPost.frameIds.flatMap((id) => {
              const frame = p.page.canvas.elements.find(
                (o) => o.t === "frame" && o.id === id,
              );
              return frame
                ? [
                    {
                      id: crypto.randomUUID(),
                      kind: "frame" as const,
                      name: frame.n,
                      projectId: p.project.id,
                      pageId: p.page.id,
                      frameId: id,
                    },
                  ]
                : [];
            }),
          },
    );
  }, [module, generatedPost, p.project.id, p.page.id]);

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

  function openCanvas(id: string) {
    if (id) p.selectProject(id);
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
    // Merge into the latest local drafts after asynchronous publishing results.
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

  function readPosts(): Post[] {
    return (
      JSON.parse(localStore.getItem("genie.marketing.posts") || "null") ?? posts
    );
  }

  function removeCanvasProject(id: string) {
    p.deleteProjectById(id);
    setToast("Canvas deleted.");
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
        <Button
          className="marketing-brand"
          aria-label="Siswa Juara home"
          title="Siswa Juara"
          onClick={() => navigate("Canvases")}
        >
          <img src={projectLogo} alt="Siswa Juara" width={40} height={40} />
        </Button>
        <nav aria-label="Main navigation">
          {navigation.map((item) => (
            <Button
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
            </Button>
          ))}
        </nav>
        <Button
          className="rail-button rail-help"
          aria-label="Help"
          onClick={() => setHelp(true)}
        >
          <Icon name="help" size={22} />
          <span className="rail-tooltip">
            <strong>How to use the app</strong>
          </span>
        </Button>
      </aside>

      <div className="marketing-body">
        <header className="marketing-header">
          <div className="marketing-breadcrumb">
            <span className="workspace-label">Siswa Juara</span>
            <Icon name="right" size={14} />
            <span className="marketing-title">{active.name}</span>
          </div>
          <div className="marketing-header-actions">
            <Button className="primary" onClick={startCanvas}>
              <Icon name="layers" size={17} /> New Canvas
            </Button>
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
              onDeleteProject={removeCanvasProject}
              notify={setToast}
            />
          )}
          {module === "Publish" && (
            <Publish
              projects={p}
              draft={draft}
              setDraft={setDraft}
              onSave={savePost}
              onRecord={recordPost}
              onCanvas={startCanvas}
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
                timezone={Intl.DateTimeFormat().resolvedOptions().timeZone}
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
                    const next = readPosts().filter((post) => post.id !== id);
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
          <Button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <Icon name="close" size={15} />
          </Button>
        </div>
      )}
      {help && (
        <Dialog
          title="Create, publish, and schedule"
          onClose={() => setHelp(false)}
        >
          <ol className="help-steps">
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
                publish automatically. Check Tebar usage in Setting and confirm
                publishing through your connected accounts in Publish.
              </p>
            </li>
          </ol>
          <Button className="primary" onClick={() => setHelp(false)}>
            Got it
          </Button>
        </Dialog>
      )}
    </div>
  );
  return content;
}
