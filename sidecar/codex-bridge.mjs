import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import {
  resolveCodexExecutable,
  codexEnvironment,
} from "./codex-executable.mjs";
if (process.argv[2] === "--status") {
  try {
    console.log(
      JSON.stringify({
        ok: true,
        path: await resolveCodexExecutable(process.argv[3]),
        message: "CLI found. macOS signature checked when applicable.",
      }),
    );
  } catch (error) {
    console.log(JSON.stringify({ ok: false, message: error.message }));
  }
  process.exit(0);
}
const send = (value) => process.stdout.write(JSON.stringify(value) + "\n");
const rl = readline.createInterface({ input: process.stdin });
const abort = new AbortController();
let started = false;
rl.on("line", async (line) => {
  let request;
  try {
    request = JSON.parse(line);
  } catch {
    return;
  }
  if (request.type === "cancel") {
    abort.abort();
    return;
  }
  if (started) return;
  started = true;
  try {
    const { Codex } = await import("@openai/codex-sdk");
    const workspace = request.workingDirectory;
    const canvasPath = path.join(workspace, "canvas.json");
    await fs.writeFile(canvasPath, JSON.stringify(request.canvas, null, 2));
    await fs.copyFile(
      new URL("./canvas.schema.json", import.meta.url),
      path.join(workspace, "canvas.schema.json"),
    );
    const instructions = `You are editing a Siswa Juara canvas. The live document is canvas.json in your working directory. Read it and edit it directly to fulfill the user's request. Preserve version:1, metadata.name and elements. Each element has a unique string id, t (frame/text/rect/ellipse/line/img), n (name), x,y,w,h. Coordinates are absolute. fid links a child to a frame id; gid groups elements. Frame objects define artboards (fill,w,h). Text properties: text,size,font,weight,color,align,curve,ls,lh,tstroke,tsw. Use [c=#hex]text[/c] for inline color. Shapes: fill,fill2,stroke,lw,r. Lines: stroke,lw,bend,dash. Images: src (image data URL or HTTPS),fit (contain/cover),r,label. Common properties: rot,op,hide,lock,sh,shc,shx,shy. Do not remove existing IDs unless deleting the element. New elements need unique IDs. Keep frame children inside their frame; all dimensions must be positive except line dimensions. Selected IDs: ${JSON.stringify(request.selection || [])}. You may create image files in this workspace and set src to their relative path; the bridge embeds them into the JSON. Do not use paths outside this workspace. Explain the changes briefly when finished.`;
    const identifierInstructions =
      "\nElements also have an optional editable identifier slug. Preserve stable id values and fid/gid references when renaming identifiers. Image identifiers use searchable-name-color-facing, such as laptop-computer-blue-front or owl-student-mascot-using-laptop-happy-blue-front. Preset loading and the Inspector use these names to match local library assets. Preserve existing embedded src images unless the user requests replacing them.";
    await fs.writeFile(
      path.join(workspace, "CANVAS.md"),
      instructions + identifierInstructions,
    );
    const executable = await resolveCodexExecutable(request.codexPath);
    const codex = new Codex({
      codexPathOverride: executable,
      env: codexEnvironment(executable),
    });
    const options = {
      workingDirectory: workspace,
      skipGitRepoCheck: true,
      sandboxMode: "workspace-write",
      approvalPolicy: "never",
      ...(request.model ? { model: request.model } : {}),
    };
    const thread = request.codexThreadId
      ? codex.resumeThread(request.codexThreadId, options)
      : codex.startThread(options);
    const { events } = await thread.runStreamed(
      instructions +
        identifierInstructions +
        "\n\nUser request: " +
        request.prompt,
      { signal: abort.signal },
    );
    let threadId = request.codexThreadId;
    for await (const event of events) {
      if (event.type === "thread.started") threadId = event.thread_id;
      send({ type: "event", event });
    }
    const canvas = JSON.parse(await fs.readFile(canvasPath, "utf8"));
    for (const element of canvas.elements || []) {
      if (
        element.t !== "img" ||
        !element.src ||
        /^(data:|https?:|asset:)/.test(element.src)
      )
        continue;
      const target = await fs.realpath(path.resolve(workspace, element.src));
      const root = await fs.realpath(workspace);
      if (!target.startsWith(root + path.sep))
        throw new Error("Image path must stay inside the workspace.");
      const ext = path.extname(target).slice(1).toLowerCase();
      const mime = {
        png: "png",
        jpg: "jpeg",
        jpeg: "jpeg",
        webp: "webp",
        gif: "gif",
        svg: "svg+xml",
      }[ext];
      if (!mime) throw new Error("Unsupported image file: " + element.src);
      element.src = `data:image/${mime};base64,${(await fs.readFile(target)).toString("base64")}`;
    }
    await fs.writeFile(canvasPath, JSON.stringify(canvas, null, 2));
    send({
      type: "canvas",
      canvas,
      baseUpdatedAt: request.canvas.metadata.updatedAt,
    });
    send({ type: "done", codexThreadId: threadId || thread.id });
  } catch (err) {
    if (abort.signal.aborted) send({ type: "done", cancelled: true });
    else
      send({
        type: "error",
        message: err instanceof Error ? err.message : String(err),
      });
  } finally {
    rl.close();
  }
});
