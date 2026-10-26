import logo from "../../src-tauri/icons/icon.png?inline";
import { variants as tiktok } from "thesvg/tiktok";
import { variants as instagram } from "thesvg/instagram";
import { variants as facebook } from "thesvg/facebook";
import { variants as youtube } from "thesvg/youtube";
import { variants as threads } from "thesvg/threads";

export const projectLogo = logo;
const social = Object.fromEntries(
  Object.entries({ tiktok, instagram, facebook, youtube, threads }).map(
    ([name, variants]) => {
      const svg = variants.mono.replace(
        "<svg ",
        '<svg width="256" height="256" fill="#0a367b" ',
      );
      return [
        name,
        `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
      ];
    },
  ),
);
export function brandImageSource(identifier: string) {
  if (/^siswa-juara-logo-/.test(identifier)) return projectLogo;
  const name =
    /^social-(tiktok|instagram|facebook|youtube|threads)(?:-|$)/.exec(
      identifier,
    )?.[1];
  return name ? social[name] : undefined;
}
