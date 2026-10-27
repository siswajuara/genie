import { useEffect, useRef, useState } from "react";
import { useAssetLibrary } from "./assets";
import { loadPresetThumbnail, type PresetSummary } from "./preset-catalog";

export function PresetPreviewImage({
  entry,
  alt,
}: {
  entry: PresetSummary;
  alt: string;
}) {
  const [src, setSrc] = useState("");
  const target = useRef<HTMLSpanElement>(null);
  const { revision } = useAssetLibrary();
  useEffect(() => {
    let live = true,
      url = "";
    setSrc("");
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      void loadPresetThumbnail(entry)
        .then((value) => {
          url = value;
          if (live) setSrc(value);
          else if (value) URL.revokeObjectURL(value);
        })
        .catch(() => {
          /* Leave the placeholder when the pack is unavailable. */
        });
    });
    if (target.current) observer.observe(target.current);
    return () => {
      live = false;
      observer.disconnect();
      if (url) URL.revokeObjectURL(url);
    };
  }, [entry, revision]);
  return (
    <span ref={target}>
      {src ? (
        <img src={src} alt={alt} decoding="async" />
      ) : (
        <span>Preview</span>
      )}
    </span>
  );
}
