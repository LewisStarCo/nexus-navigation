import { assertHttpUrl, type PlatformAdapter } from "../PlatformAdapter";

export type DesktopExternalUrlHandler = (url: string) => Promise<void>;

/**
 * Desktop seam for a future Tauri implementation.
 *
 * v18 intentionally contains no Tauri imports and advertises no native
 * capability. A desktop client can supply handlers without changing modules.
 */
export class DesktopPlatformAdapter implements PlatformAdapter {
  readonly kind = "desktop" as const;

  constructor(private readonly openExternal?: DesktopExternalUrlHandler) {}

  async openExternalUrl(value: string): Promise<void> {
    const url = assertHttpUrl(value);
    if (!this.openExternal) {
      throw new Error("Desktop external URL handling has not been configured.");
    }
    await this.openExternal(url);
  }

  supportsApplicationLaunch(): boolean { return false; }
  supportsFileResources(): boolean { return false; }
  supportsFolderResources(): boolean { return false; }
  supportsNotifications(): boolean { return false; }
  supportsGlobalShortcuts(): boolean { return false; }
}
