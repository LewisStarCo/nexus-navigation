/** Message names are public compatibility contracts with Nexus Save v1.x. */
export const EDGE_EXTENSION_MESSAGE = {
  state: "NEXUS_EXTENSION_STATE",
  webReady: "NEXUS_WEB_READY",
  save: "NEXUS_EXTENSION_SAVE",
  saved: "NEXUS_EXTENSION_SAVED",
  aiRequest: "NEXUS_EXTENSION_AI_REQUEST",
  aiResult: "NEXUS_EXTENSION_AI_RESULT",
} as const;

export const NEXUS_WEB_MESSAGE_SOURCE = "nexus-web" as const;
export const NEXUS_EDGE_MESSAGE_SOURCE = "nexus-edge-extension" as const;

export interface EdgeExtensionCapture {
  id?: string;
  title?: string;
  /** Optional in v1.2+; older queued captures remain valid without it. */
  description?: string;
  url?: string;
  /** v1.x transports a category display name or a reserved collection ID. */
  category?: string;
  createdAt?: number;
  requestAi?: boolean;
}

export function descriptionForEdgeExtension(
  capture: Pick<EdgeExtensionCapture, "description">,
): string {
  return capture.description?.replace(/\s+/g, " ").trim().slice(0, 240)
    || "收藏的网页资源";
}

export interface EdgeExtensionStatePayload {
  categories: string[];
  /** Website URLs from the latest Nexus state, added in the cross-browser bridge. */
  savedUrls?: string[];
  siteUrl: string;
}

export interface EdgeExtensionSavedPayload {
  id?: string;
  url: string;
}

export interface EdgeExtensionAiResultPayload {
  id?: string;
  category: string | null;
  error: string;
}

export type NexusWebBridgeMessage =
  | { source: typeof NEXUS_WEB_MESSAGE_SOURCE; type: typeof EDGE_EXTENSION_MESSAGE.state; payload: EdgeExtensionStatePayload }
  | { source: typeof NEXUS_WEB_MESSAGE_SOURCE; type: typeof EDGE_EXTENSION_MESSAGE.webReady }
  | { source: typeof NEXUS_WEB_MESSAGE_SOURCE; type: typeof EDGE_EXTENSION_MESSAGE.saved; payload: EdgeExtensionSavedPayload }
  | { source: typeof NEXUS_WEB_MESSAGE_SOURCE; type: typeof EDGE_EXTENSION_MESSAGE.aiResult; payload: EdgeExtensionAiResultPayload };

export type EdgeExtensionBridgeMessage =
  | { source: typeof NEXUS_EDGE_MESSAGE_SOURCE; type: typeof EDGE_EXTENSION_MESSAGE.save; payload: EdgeExtensionCapture }
  | { source: typeof NEXUS_EDGE_MESSAGE_SOURCE; type: typeof EDGE_EXTENSION_MESSAGE.aiRequest; payload: EdgeExtensionCapture };

export function isEdgeExtensionBridgeMessage(value: unknown): value is EdgeExtensionBridgeMessage {
  if (!value || typeof value !== "object") return false;
  const input = value as Record<string, unknown>;
  return input.source === NEXUS_EDGE_MESSAGE_SOURCE
    && (input.type === EDGE_EXTENSION_MESSAGE.save || input.type === EDGE_EXTENSION_MESSAGE.aiRequest)
    && Boolean(input.payload)
    && typeof input.payload === "object";
}
