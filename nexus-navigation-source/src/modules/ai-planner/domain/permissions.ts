import type { AIUsagePermissions } from "@/src/shared/types";

export type AIUsagePurpose = keyof AIUsagePermissions;

export function canUseAI(
  permissions: AIUsagePermissions,
  purpose: AIUsagePurpose,
): boolean {
  return permissions[purpose] === true;
}

export function setAIUsagePermission(
  permissions: AIUsagePermissions,
  purpose: AIUsagePurpose,
  enabled: boolean,
): AIUsagePermissions {
  return { ...permissions, [purpose]: enabled };
}

export function disableAIInAllSituations(): AIUsagePermissions {
  return { calendar: false, category: false, planning: false };
}

export function isAICompletelyDisabled(permissions: AIUsagePermissions): boolean {
  return !permissions.calendar && !permissions.category && !permissions.planning;
}
