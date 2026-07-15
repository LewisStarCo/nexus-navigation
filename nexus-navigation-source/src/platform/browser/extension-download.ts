export type BrowserExtensionTarget = "edge" | "chrome" | "safari";

export interface BrowserExtensionDownload {
  target: BrowserExtensionTarget;
  label: string;
  fileName: string;
  downloadPath: string;
}

export const EXTENSION_INSTALLATION_GUIDE = "/extension-installation.md";

export const browserExtensionDownloads: Readonly<
  Record<BrowserExtensionTarget, BrowserExtensionDownload>
> = {
  edge: {
    target: "edge",
    label: "Microsoft Edge",
    fileName: "nexus-save-edge-v1.3.zip",
    downloadPath: "/downloads/nexus-save-edge-v1.3.zip",
  },
  chrome: {
    target: "chrome",
    label: "Google Chrome",
    fileName: "nexus-save-chrome-v1.zip",
    downloadPath: "/downloads/nexus-save-chrome-v1.zip",
  },
  safari: {
    target: "safari",
    label: "Safari",
    fileName: "nexus-save-safari-v1.zip",
    downloadPath: "/downloads/nexus-save-safari-v1.zip",
  },
};

/** Chooses a package locally from the browser user agent. No browsing data is sent. */
export function detectBrowserExtensionTarget(userAgent: string): BrowserExtensionTarget {
  if (/Edg\//i.test(userAgent)) return "edge";
  if (/Chrome\//i.test(userAgent) || /Chromium\//i.test(userAgent) || /CriOS\//i.test(userAgent)) return "chrome";
  if (/Safari\//i.test(userAgent) && !/Chrome\//i.test(userAgent)) return "safari";
  return "chrome";
}
