export type PlatformCapability =
  | "application-launch"
  | "file-resources"
  | "folder-resources"
  | "notifications"
  | "global-shortcuts";

/**
 * Boundary for operating-system capabilities used by Nexus.
 *
 * Feature modules depend on this contract instead of checking for a browser,
 * Tauri, or a particular operating system themselves.
 */
export interface PlatformAdapter {
  readonly kind: "browser" | "desktop";
  openExternalUrl(url: string): Promise<void>;
  supportsApplicationLaunch(): boolean;
  supportsFileResources(): boolean;
  supportsFolderResources(): boolean;
  supportsNotifications(): boolean;
  supportsGlobalShortcuts(): boolean;
}

export class UnsupportedPlatformCapabilityError extends Error {
  constructor(
    readonly capability: PlatformCapability,
    message = `The current platform does not support ${capability}.`,
  ) {
    super(message);
    this.name = "UnsupportedPlatformCapabilityError";
  }
}

export function assertHttpUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new TypeError("Nexus can only open HTTP or HTTPS URLs.");
  }
  return url.toString();
}
