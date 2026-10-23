import type { Projects } from "../editor/projects";
import type { CanvasDocument } from "../editor/model";
import { Icon } from "./ui/Icon";

export function CanvasVersions({
  projects: p,
  document,
}: {
  projects: Projects;
  document: CanvasDocument;
}) {
  const versions = p.project.versions || [];
  return (
    <details className="workspace-settings canvas-versions">
      <summary>
        <Icon name="clock" size={16} /> Versions ({versions.length})
      </summary>
      <div className="settings-popover">
        <h2>Canvas versions</h2>
        <p className="hint">
          Includes all pages and frames. Chat edits save a version
          automatically. The latest 20 versions are kept.
        </p>
        <button onClick={() => p.recordVersion("Saved manually", document)}>
          Save current version
        </button>
        {!versions.length && <p>No saved versions yet.</p>}
        {[...versions].reverse().map((version) => (
          <article key={version.id}>
            <strong>
              v{version.number} · {version.name}
            </strong>
            <small>
              {new Date(version.at).toLocaleString()} · {version.pages.length}{" "}
              pages
            </small>
            <button onClick={() => p.restoreVersion(version.id)}>
              Restore v{version.number}
            </button>
          </article>
        ))}
      </div>
    </details>
  );
}
