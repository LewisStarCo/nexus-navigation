import { assertHttpUrl, type PlatformAdapter } from "../PlatformAdapter";

export type BrowserUrlOpener = (url: string) => Window | null | void;

/** Web implementation. Native resources deliberately remain unavailable. */
export class BrowserPlatformAdapter implements PlatformAdapter {
  readonly kind = "browser" as const;

  constructor(private readonly openWindow?: BrowserUrlOpener) {}

  async openExternalUrl(value: string): Promise<void> {
    const url = assertHttpUrl(value);
    const opener = this.openWindow ?? ((target: string) => {
      if (typeof window === "undefined") {
        throw new Error("External URLs can only be opened in a browser context.");
      }
      return window.open(target, "_blank", "noopener,noreferrer");
    });
    opener(url);
  }

  supportsApplicationLaunch(): boolean { return false; }
  supportsFileResources(): boolean { return false; }
  supportsFolderResources(): boolean { return false; }
  supportsNotifications(): boolean { return false; }
  supportsGlobalShortcuts(): boolean { return false; }
}

export const browserPlatform = new BrowserPlatformAdapter();
