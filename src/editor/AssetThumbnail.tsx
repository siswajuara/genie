import { useEffect, useState } from "react";
import { loadAssetThumbnail, type LibraryAsset } from "./assets";
import { Icon } from "../components/ui/Icon";
export function AssetThumbnail({
  asset,
  size = 96,
}: {
  asset: LibraryAsset;
  size?: number;
}) {
  const [src, setSrc] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setSrc("");
    setFailed(false);
    void loadAssetThumbnail(asset)
      .then((src) => {
        if (active) setSrc(src);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [asset]);
  return src ? (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      decoding="async"
      draggable={false}
    />
  ) : (
    <span title={failed ? "Thumbnail unavailable" : "Loading thumbnail"}>
      <Icon
        name={asset.type === "video" ? "video" : "image"}
        size={size > 36 ? 24 : 18}
      />
    </span>
  );
}
