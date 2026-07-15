import type { ClockZone, NexusSettings, SearchEngine, Theme } from "@/src/shared/types";

export function updateSettings(
  current: NexusSettings,
  patch: Partial<NexusSettings>,
): NexusSettings {
  return {
    ...current,
    ...patch,
    username: patch.username === undefined
      ? current.username
      : patch.username.trim().slice(0, 20),
    zones: patch.zones ? [...patch.zones] : [...current.zones],
    searchEngine: patch.searchEngine
      ? { ...patch.searchEngine }
      : { ...current.searchEngine },
  };
}

export function setTheme(settings: NexusSettings, theme: Theme): NexusSettings {
  return updateSettings(settings, { theme });
}

export function addClockZone(
  settings: NexusSettings,
  zone: ClockZone,
): NexusSettings {
  if (!zone.label.trim() || !zone.zone.trim()) return settings;
  if (settings.zones.some((item) => item.zone === zone.zone)) return settings;
  return updateSettings(settings, {
    zones: [...settings.zones, { label: zone.label.trim(), zone: zone.zone.trim() }],
  });
}

export function removeClockZone(
  settings: NexusSettings,
  zoneId: string,
): NexusSettings {
  if (settings.zones.length <= 1) return settings;
  const zones = settings.zones.filter((item) => item.zone !== zoneId);
  return zones.length === settings.zones.length
    ? settings
    : updateSettings(settings, { zones });
}

export function setPrimaryClockZone(
  settings: NexusSettings,
  zoneId: string,
): NexusSettings {
  const selected = settings.zones.find((item) => item.zone === zoneId);
  if (!selected || settings.zones[0]?.zone === zoneId) return settings;
  return updateSettings(settings, {
    zones: [selected, ...settings.zones.filter((item) => item.zone !== zoneId)],
  });
}

export function isValidSearchEngine(engine: SearchEngine): boolean {
  if (!engine.label.trim() || !engine.url.includes("{query}")) return false;
  try {
    const probe = new URL(engine.url.replace("{query}", "nexus"));
    return probe.protocol === "https:" || probe.protocol === "http:";
  } catch {
    return false;
  }
}

export function setSearchEngine(
  settings: NexusSettings,
  engine: SearchEngine,
): NexusSettings {
  if (!isValidSearchEngine(engine)) {
    throw new TypeError("Search engine URL must be HTTP(S) and contain {query}.");
  }
  return updateSettings(settings, {
    searchEngine: { label: engine.label.trim(), url: engine.url.trim() },
  });
}
