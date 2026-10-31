import type { GeneratedFrame } from "../../sidecar/generate.mjs";
import type { CompositionStory } from "../../sidecar/scene-composition.mjs";

export function StoryReview({
  story,
  frames,
  seconds,
}: {
  story: CompositionStory;
  frames: GeneratedFrame[];
  seconds: number[];
}) {
  return (
    <section className="generate-story-review" aria-label="Story review">
      <h3>The story before the animation</h3>
      <p className="generate-hint">
        Check the true process, the visual thread, and the ending. Source facts
        still need your review.
      </p>
      {(
        [
          ["idea", "One-line idea"],
          ["format", "Story format"],
          ["device", "Recurring visual device"],
          ["look", "Visual direction"],
        ] as const
      ).map(([key, label]) => (
        <div className="generate-story-detail" key={key}>
          <strong>{label}</strong>
          <p>{story[key]}</p>
        </div>
      ))}
      <div className="generate-palette" aria-label="Story palette">
        {story.palette.map((color, i) => (
          <span key={i} style={{ background: color }} title={color} />
        ))}
      </div>
      <h3>Beat by beat</h3>
      <ol className="generate-beats">
        {frames.map((frame, i) => (
          <li key={i}>
            <div>
              <strong>
                {i + 1}. {frame.title}
              </strong>
              <small>
                {seconds[i]}s · {frame.direction?.framing}
              </small>
            </div>
            <p>{frame.direction?.action}</p>
            <p>
              <strong>Bridge:</strong> {frame.direction?.bridge}
            </p>
            {frame.narration && (
              <p>
                <strong>Voice:</strong> {frame.narration}
              </p>
            )}
          </li>
        ))}
      </ol>
      <p className="generate-hint">
        Use Edit setup to revise the brief or scene directions and regenerate.
        Individual layers and narration can be edited in the storyboard.
      </p>
    </section>
  );
}
