// Keep provider portals inside the themed desktop workspace. A native dialog
// needs its own portal host because it is rendered in the browser's top layer.
export function portalContainer(anchor?: HTMLElement | null) {
  return anchor?.closest<HTMLElement>("dialog, [data-slot='dialog-content']")
    ?? document.querySelector<HTMLElement>(".studio")
    ?? document.body;
}
