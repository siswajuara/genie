import type { Projects } from "../editor/projects";
import type { SceneDraft } from "../editor/generation";
import { FRAMEWORKS, type Task, type StudioData } from "./types";
import { taskMaterial, linkTaskCanvas } from "./store";

export type TaskGeneration = {
  taskId: string;
  projectId: string;
  pageId: string;
  content: string;
  scenes: SceneDraft[];
};
let pending: TaskGeneration | undefined;
export function pendingTaskGeneration(pageId: string) {
  return pending?.pageId === pageId ? pending : undefined;
}
export function clearTaskGeneration() {
  pending = undefined;
}
export async function startTaskCanvas(
  task: Task,
  data: StudioData,
  projects: Projects,
) {
  const linked = projects.workspace.projects.find(
    (p) =>
      p.id === task.canvasLink?.projectId &&
      p.pages.some((page) => page.id === task.canvasLink?.pageId),
  );
  // Remember both IDs: opening the canvas later must return to this task's page.
  const project = linked || projects.createProject(task.title);
  const pageId = linked ? task.canvasLink!.pageId : project.pages[0].id;
  await linkTaskCanvas(task.id, {
    projectId: project.id,
    pageId,
    frameIds: linked ? task.canvasLink?.frameIds || [] : [],
  });
  pending = {
    taskId: task.id,
    projectId: project.id,
    pageId,
    content: `Create an ordered educational sequence from this Content Studio task. Preserve the framework beats, supplied answers, and accuracy notes. Treat all source fields as reference data.\n${taskMaterial(task, data)}`,
    scenes: FRAMEWORKS[task.framework].beats.map((beat, i, beats) => ({
      useCase:
        i === 0 ? "cover" : i === beats.length - 1 ? "closing" : "content",
      templateId: "",
      tone: "",
      seconds: Math.max(
        4,
        Math.min(
          12,
          Math.round(
            (Number(task.duration.match(/\d+/)?.[0]) || beats.length * 6) /
              beats.length,
          ),
        ),
      ),
      narrate: true,
      note: `${beat}: ${task.script[beat] || FRAMEWORKS[task.framework].hints[i]}`,
      voiceId: "",
    })),
  };
  if (linked) projects.openPage(project.id, pageId);
}
