import type { Projects } from "../editor/projects";
import type { CanvasDocument } from "../editor/model";
import { Icon } from "./ui/Icon";
import { Accordion } from "./ui/Accordion";

export function CanvasVersions({
  projects: p,
  document,
}: {
  projects: Projects;
  document: CanvasDocument;
}) {
  const versions = p.project.versions || [];
  return (
    <Accordion
      className="workspace-settings canvas-versions"
      triggerClassName="pill-btn"
      triggerTitle="View saved canvas versions"
      title={
        <>
          <Icon name="clock" size={15} />
          <span>Versions ({versions.length})</span>
        </>
      }
    >
      <div className="settings-popover">
        <h2>Canvas versions</h2>
        <p className="hint">
          Includes all pages and frames. Save a checkpoint before making
          changes. The latest 20 versions are kept.
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
    </Accordion>
  );
}
