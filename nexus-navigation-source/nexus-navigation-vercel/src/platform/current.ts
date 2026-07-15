import type { PlatformAdapter } from "./PlatformAdapter";
import { browserPlatform } from "./browser/BrowserPlatformAdapter";

/**
 * The only platform selection point used by shared UI.
 * A future Desktop entry can replace this binding without adding Tauri checks
 * throughout Navigation, Focus or Calendar components.
 */
export const platformAdapter: PlatformAdapter = browserPlatform;
