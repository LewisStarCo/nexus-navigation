import type {
  AIPlannerSettings,
  Category,
  ClockZone,
  NexusData,
  NexusEvent,
  NexusSettings,
  Resource,
  SearchEngine,
} from "../../shared/types";
import { CURRENT_SCHEMA_VERSION } from "./schema";

export const DEFAULT_TIMESTAMP = "2026-07-13T00:00:00.000Z";

export const DEFAULT_CLOCK_ZONES: readonly ClockZone[] = [
  { label: "北京时间", zone: "Asia/Shanghai" },
  { label: "旧金山时间", zone: "America/Los_Angeles" },
];

export const DEFAULT_SEARCH_ENGINE: Readonly<SearchEngine> = {
  label: "Google",
  url: "https://www.google.com/search?q={query}",
};

export const DEFAULT_PROVIDER_CONFIGS: Readonly<
  Record<string, Readonly<{ baseUrl: string; model: string }>>
> = {
  OpenAI: { baseUrl: "https://api.openai.com/v1", model: "gpt-4.1-mini" },
  Qwen: {
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen-plus",
  },
  "智谱 AI": {
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    model: "glm-4.5-flash",
  },
  DeepSeek: { baseUrl: "https://api.deepseek.com", model: "deepseek-chat" },
  Claude: {
    baseUrl: "https://api.anthropic.com/v1",
    model: "claude-sonnet-4-5",
  },
  Gemini: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    model: "gemini-2.5-flash",
  },
};

export const DEFAULT_AI_PLANNER: Readonly<AIPlannerSettings> = {
  provider: "OpenAI",
  apiKey: "",
  model: DEFAULT_PROVIDER_CONFIGS.OpenAI.model,
  customProvider: { name: "", baseUrl: "", model: "" },
  permissions: { calendar: true, category: false, planning: false },
};

const CATEGORY_DEFINITIONS = [
  ["category-fudan-study", "复旦学习"],
  ["category-ai-tools", "AI 工具"],
  ["category-coding", "编程开发"],
  ["category-knowledge", "知识资源"],
] as const;

const RESOURCE_DEFINITIONS = [
  ["复旦邮箱", "收发校园邮件", "https://mail.m.fudan.edu.cn/", "category-fudan-study", "邮", "blue"],
  ["复旦 eLearning", "课程资料与在线学习", "https://elearning.fudan.edu.cn/", "category-fudan-study", "课", "indigo"],
  ["网上办事服务大厅", "校园事务一站办理", "https://ehall.fudan.edu.cn/", "category-fudan-study", "办", "violet"],
  ["复旦超星学习平台", "在线课程与教学资源", "https://fudan.mooc.chaoxing.com/portal", "category-fudan-study", "学", "cyan"],
  ["本科教务管理系统", "成绩、课表与教务信息", "https://fdjwgl.fudan.edu.cn/student/", "category-fudan-study", "教", "sky"],
  ["复旦选课系统", "本科生课程选退", "https://xk.fudan.edu.cn/", "category-fudan-study", "选", "teal"],
  ["ChatGPT", "OpenAI 智能助手", "https://www.chatgpt.com/", "category-ai-tools", "G", "emerald"],
  ["Claude", "Anthropic 智能助手", "https://claude.ai/", "category-ai-tools", "C", "amber"],
  ["DeepSeek", "深度求索智能助手", "https://chat.deepseek.com/", "category-ai-tools", "D", "blue"],
  ["Compiler Explorer", "在线编译器与汇编分析", "https://godbolt.org/", "category-coding", "CE", "orange"],
  ["C++ Reference", "C 与 C++ 标准库参考", "https://en.cppreference.com/", "category-coding", "C++", "indigo"],
  ["The Rust Book", "Rust 官方编程语言教程", "https://doc.rust-lang.org/book/?utm_source=chatgpt.com#the-rust-programming-language", "category-coding", "Rs", "rose"],
  ["GitHub", "代码托管与开源协作平台", "https://www.github.com/", "category-coding", "GH", "indigo"],
  ["Z-Library", "数字图书与文献资源", "https://zlib.bz/", "category-knowledge", "Z", "purple"],
  ["Google", "搜索信息与探索互联网", "https://www.google.com/", "category-knowledge", "G", "blue"],
] as const;

function localDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function getDefaultCategories(): Category[] {
  return CATEGORY_DEFINITIONS.map(([id, name], order) => ({
    id,
    name,
    order,
    createdAt: DEFAULT_TIMESTAMP,
    updatedAt: DEFAULT_TIMESTAMP,
  }));
}

export function getDefaultResources(): Resource[] {
  return RESOURCE_DEFINITIONS.map(
    ([name, description, url, categoryId, mark, color], order) => ({
      id: `default-${order}`,
      type: "website" as const,
      name,
      description,
      categoryId,
      order,
      icon: "",
      mark,
      color,
      url,
      createdAt: DEFAULT_TIMESTAMP,
      updatedAt: DEFAULT_TIMESTAMP,
    }),
  );
}

export function getDefaultEvents(now = new Date()): NexusEvent[] {
  const date = localDate(now);
  return [
    {
      id: "event-math",
      title: "Engineering Mathematics",
      category: "数学",
      priority: "High",
      type: "schedule",
      date,
      startTime: "09:00",
      endTime: "10:30",
      duration: 90,
      status: "pending",
      source: "local",
      resources: [],
    },
    {
      id: "event-rust",
      title: "Rust Learning",
      category: "Coding",
      priority: "High",
      type: "task",
      date,
      startTime: "11:00",
      endTime: "12:30",
      duration: 90,
      status: "pending",
      source: "local",
      resources: [],
    },
    {
      id: "event-algebra",
      title: "Linear Algebra",
      category: "数学",
      priority: "Medium",
      type: "task",
      date,
      startTime: "15:00",
      endTime: "16:00",
      duration: 60,
      status: "pending",
      source: "local",
      resources: [],
    },
    {
      id: "event-paper",
      title: "AI Paper Reading",
      category: "科研",
      priority: "Low",
      type: "task",
      date,
      startTime: "21:00",
      endTime: "21:45",
      duration: 45,
      status: "pending",
      source: "local",
      resources: [],
    },
  ];
}

export function getDefaultSettings(): NexusSettings {
  return {
    username: "",
    zones: DEFAULT_CLOCK_ZONES.map((zone) => ({ ...zone })),
    theme: "dark",
    searchEngine: { ...DEFAULT_SEARCH_ENGINE },
    extensionEntryHidden: false,
  };
}

export function getDefaultAIPlanner(): AIPlannerSettings {
  return {
    ...DEFAULT_AI_PLANNER,
    customProvider: { ...DEFAULT_AI_PLANNER.customProvider },
    permissions: { ...DEFAULT_AI_PLANNER.permissions },
  };
}

export function getDefaultNexusData(now = new Date()): NexusData {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    settings: getDefaultSettings(),
    categories: getDefaultCategories(),
    resources: getDefaultResources(),
    events: getDefaultEvents(now),
    aiPlanner: getDefaultAIPlanner(),
  };
}

/** Compatibility alias for callers that prefer an imperative factory name. */
export const createDefaultNexusData = getDefaultNexusData;
