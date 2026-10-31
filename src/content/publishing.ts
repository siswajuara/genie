import type { Workspace } from "../editor/projects";
import { emptyPost, type Post, type Media } from "../marketing/store";
import { localStore, flushLocalStore } from "../lib/local-store";
import type { ProviderPost } from "../social/views";
import type { Task, StudioData } from "./types";
import { contentApi, advanceTaskPublication } from "./store";

export function localPublishingPosts(): Post[] {
  return JSON.parse(localStore.getItem("genie.marketing.posts") || "[]");
}
export function taskPublishingPost(taskId: string) {
  return localPublishingPosts().find((post) => post.contentTaskId === taskId);
}
export function taskPost(
  task: Task,
  workspace: Workspace,
  existing?: Post,
): Post {
  if (existing?.contentTaskId === task.id) return existing;
  const link = task.canvasLink;
  const project = workspace.projects.find(
    (project) => project.id === link?.projectId,
  );
  const page = project?.pages.find((page) => page.id === link?.pageId);
  const media: Media[] = (link?.frameIds || []).map((id) => {
    const frame = page?.canvas.elements.find(
      (element) => element.t === "frame" && element.id === id,
    );
    if (!frame)
      throw Error(
        "Frame tugas tidak ditemukan. Perbaiki tautan canvas sebelum membuka Publish.",
      );
    return {
      id: crypto.randomUUID(),
      kind: "frame",
      projectId: project!.id,
      pageId: page!.id,
      frameId: id,
      name: frame.n,
    };
  });
  const platform = /instagram|\big\b/i.test(task.platform)
    ? "instagram"
    : /youtube/i.test(task.platform)
      ? "youtube"
      : /tiktok/i.test(task.platform)
        ? "tiktok"
        : /facebook|\bfb\b/i.test(task.platform)
          ? "facebook"
          : "";
  return {
    ...emptyPost(project?.id || workspace.activeProjectId),
    contentTaskId: task.id,
    title: task.title,
    caption: [task.caption.trim(), task.hashtags.trim()]
      .filter(Boolean)
      .join("\n\n"),
    media,
    platforms: platform ? [platform] : [],
    timing: task.dueDate ? "schedule" : "now",
    date: task.dueDate || undefined,
  };
}
export function publishingLabel(post?: Post) {
  if (!post) return "Belum ada draft Publish";
  const results = post.delivery;
  if (!results?.length)
    return post.status === "planned"
      ? "Rencana lokal · belum dikirim ke Tebar"
      : "Draft lokal · belum dikirim ke Tebar";
  if (results.some((result) => result.uncertain))
    return "Tebar · hasil belum pasti; periksa Schedule";
  if (results.some((result) => !result.success))
    return "Tebar · pengiriman perlu diperiksa";
  if (results.every((result) => result.status === "published"))
    return "Tebar · published";
  if (
    results.every((result) =>
      ["scheduled", "published"].includes(result.status || ""),
    )
  )
    return "Tebar · terjadwal";
  return "Tebar · diterima, menunggu pengiriman";
}
export async function verifyTaskPublication(post: Post, workspace: Workspace) {
  if (!post.contentTaskId) return;
  const data = await contentApi<StudioData>("/data");
  const task = data.tasks.find((task) => task.id === post.contentTaskId);
  if (!task)
    throw Error(
      "Tugas Content sudah dihapus. Buka Content sebelum mengirim posting ini.",
    );
  if (!task.checks.answer)
    throw Error(
      "Verifikasi jawaban / akurasi tugas di Content sebelum mengirim ke Tebar.",
    );
  for (const media of post.media) {
    if (media.kind !== "frame") continue;
    const page = workspace.projects
      .find((project) => project.id === media.projectId)
      ?.pages.find((page) => page.id === media.pageId);
    if (
      !page?.canvas.elements.some(
        (element) => element.t === "frame" && element.id === media.frameId,
      )
    )
      throw Error(
        `Frame “${media.name}” tidak ditemukan. Perbaiki media di Publish sebelum mengirim.`,
      );
  }
}
export async function syncTaskPublication(post: Post) {
  const results = post.delivery;
  if (
    !post.contentTaskId ||
    !results?.length ||
    results.some(
      (result) =>
        result.provider !== "tebar" || !result.success || result.uncertain,
    )
  )
    return;
  if (results.every((result) => result.status === "published"))
    await advanceTaskPublication(post.contentTaskId, "Published");
  else if (
    results.every((result) =>
      ["scheduled", "published"].includes(result.status || ""),
    )
  )
    await advanceTaskPublication(post.contentTaskId, "Scheduled");
}
// Consume only responses already fetched by Schedule; never start provider reads here.
export async function reconcileContentDeliveries(
  providerPosts: ProviderPost[],
) {
  const changed: Post[] = [];
  const posts = localPublishingPosts().map((post) => {
    if (!post.contentTaskId || !post.delivery?.length) return post;
    const delivery = post.delivery.map((result) => {
      const remote = providerPosts.find(
        (remote) =>
          remote.provider === "tebar" &&
          result.provider === "tebar" &&
          remote.id === result.id &&
          !!remote.accountId &&
          result.accountKey === `tebar:${remote.accountId}`,
      );
      if (!remote?.status) return result;
      const success = !["failed", "canceled", "cancelled"].includes(
        remote.status,
      );
      return {
        ...result,
        status: remote.status,
        success,
        uncertain: false,
        error:
          remote.error || (!success ? `Tebar: ${remote.status}` : undefined),
        permalink: remote.permalink,
      };
    });
    if (JSON.stringify(delivery) === JSON.stringify(post.delivery)) return post;
    const updated = { ...post, delivery, updatedAt: new Date().toISOString() };
    changed.push(updated);
    return updated;
  });
  if (changed.length) {
    localStore.setItem("genie.marketing.posts", JSON.stringify(posts));
    await flushLocalStore();
  }
  // Retry a previous local sync failure even when the provider data is unchanged.
  for (const post of posts.filter((post) => post.contentTaskId))
    await syncTaskPublication(post);
  return posts;
}
