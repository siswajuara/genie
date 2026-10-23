import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import "./components/ui/controls.css";
import App from "./App";
import { initializeLocalStore, prepareLocalSave } from "./lib/localStore";
import { isTauri } from "@tauri-apps/api/core";

const root = createRoot(document.getElementById("root")!);
async function start() {
  try {
    await initializeLocalStore();
    if (isTauri()) {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().onCloseRequested(async (event) => {
        event.preventDefault();
        try {
          await prepareLocalSave();
          await getCurrentWindow().destroy();
        } catch (error) {
          window.alert(
            `Your latest changes could not be saved. The window will stay open. ${String(error)}`,
          );
        }
      });
    }
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  } catch (error) {
    root.render(
      <main style={{ padding: 32, maxWidth: 640 }}>
        <h1>Your local library could not open</h1>
        <p>
          Your existing data has been kept. Check free disk space and folder
          permissions, then retry.
        </p>
        <p role="alert">{String(error)}</p>
        <button onClick={() => void start()}>Retry opening library</button>
      </main>,
    );
  }
}
void start();
