# Nexus Personal Workspace

> Navigation = Access · Workspace = Action

Nexus 是一个简洁、安静且可以高度自定义的个人工作空间。它将常用网站导航、搜索、今日专注、日历和可选 AI 规划整合在同一个网页中，帮助用户回答两个最重要的问题：

- 我要去哪里？
- 我今天要做什么？

在线访问：[nexus-navigation.vercel.app](https://nexus-navigation.vercel.app)

## v18 架构说明

v18 是一次面向未来 Nexus Desktop（Tauri）的内部重构，不新增大型产品功能，也不改变 v17 的视觉语言。首页、Calendar、Edge 扩展、导入和 AI 确认流程保持原有使用方式。

所有核心数据现在由唯一的 `NexusData` 管理：

```ts
interface NexusData {
  schemaVersion: number;
  settings: NexusSettings;
  categories: Category[];
  resources: Resource[];
  events: NexusEvent[];
  aiPlanner: AIPlannerSettings;
}
```

- 浏览器页面不再直接读写 `localStorage`，统一通过异步 `NexusStorage` 与 `LocalStorageAdapter`。
- 本地键仍为 `nexus-data-v1`；内部结构版本由独立的 `schemaVersion` 管理，两者不是同一概念。
- 无版本的 v17 数据会按 `0 → 1 → 2` 顺序迁移，并尽可能保留所有有效内容。
- 非法 JSON 或未来 schema 不会被默认值覆盖，也不会被旧客户端降级写回。
- Website/Application 使用可辨识联合类型；Event 只保存 Resource ID。
- Browser 与未来 Desktop 的差异集中在 Platform Adapter；当前版本没有引入 Tauri 或 SQLite。
- AI 仍是 Advisor。建议必须由用户确认，AI 服务本身没有保存用户数据的能力。

开发者可使用 `docs/V18_REGRESSION_CHECKLIST.md` 完成发布前回归。

### v18.1 · Schedule conflict advisory

- 首页 Today’s Focus 与 Calendar 在新增或修改 Event 时会检测时间重叠，并显示非阻断式提醒。
- 用户可以返回修改，也可以明确选择“仍然保存”；重叠不会被系统禁止。
- Calendar AI 可以为突发安排建议移动已有 Event，所有建议时间均可由用户修改。
- 只有用户点击“确认并应用”才会保存；AI 不会自动删除、完成、改名或移动 Event。
- AI 调整只能引用真实 Event ID，并继续遵守 **AI Advisor, Not Decision Maker**。

## 产品理念

Nexus 不试图成为展示所有信息的传统 Dashboard。它不会加入天气、新闻、股票、热点或其他与行动无关的信息。

首页分为两个区域：

- **Navigation**：访问网站、工具、学习资源和编程资源。
- **Workspace**：管理任务、固定日程、时间安排和 AI 建议。

从 v17 开始，Navigation 中的入口统一视为 **Resource**。资源可以与 Event 关联，让 Nexus 不只记录“今天要做什么”，也能记住“完成它需要使用什么”。

整体视觉语言保持 Minimal、Clean、Calm、Elegant 和 Modern，并支持亮色与暗色模式。

## 主要功能

### Personal Navigation

- 按分类展示网站入口。
- 添加、编辑和删除网站。
- 添加、重命名、删除和拖动排序分类。
- 一键清空某个分类中的全部网页，同时保留分类本身。
- “未归类”用于稍后整理，“临时网页”用于短期收藏；两者都以独立入口管理，不占用主页分类标签。
- 自动读取网站 favicon。
- 所有网站在浏览器新标签页中打开。
- 顶部搜索框可筛选导航内容。
- GitHub 图标可快速打开本仓库和功能说明。

默认包含复旦校园服务、AI 工具、编程资源、知识资源、Google 和 GitHub 等入口。默认内容只用于首次使用，用户可以在页面中自行修改。

### Resource Workspace

Nexus 使用统一的 Resource 模型管理数字资源。目前界面支持两种类型：

- **Website**：保存标题、网址、图标和分类；点击后在浏览器新标签页打开，也可以由 Edge 扩展捕获。
- **Application**：由用户手动保存应用名称、图标、分类与 `appIdentifier`，用于记录任务所需的软件。当前网页只保存和展示这些信息，不会扫描或启动本地应用。

Resource 使用可辨识联合类型：

```ts
interface BaseResource {
  id: string;
  type: "website" | "application";
  name: string;
  description?: string;
  categoryId?: string;
  order: number;
  icon?: string;
  mark?: string;
  color?: string;
  createdAt: string;
  updatedAt: string;
}

type Resource =
  | (BaseResource & {
      type: "website";
      url: string;
      faviconUrl?: string;
    })
  | (BaseResource & {
      type: "application";
      appIdentifier?: string;
    });
```

数据模型为未来的 `file`、`folder` 和 `shortcut` 预留扩展空间，但当前网页没有实现这些类型。Nexus 也不会扫描设备、自动发现应用、启动应用、自动整理资源、自动分类或自动排序。所有新增、分类与顺序变化都由用户确认。

### Microsoft Edge 快速收藏

Nexus 提供桌面版 Microsoft Edge 扩展 `Nexus Save`。点击 Edge 工具栏中的扩展按钮后，可以直接读取当前网页标题和地址、修改名称，并选择：

- **未归类**：默认选项，进入 Nexus 顶部“未归类”入口，方便稍后整理。
- **临时网页**：只在短期内保留，不显示在主页导航卡片中。
- **已有分类**：直接保存到从 Nexus 同步的正式分类。

点击“完成”后，收藏先进入 Edge 本机队列。Nexus 已打开时会立即同步；没有打开时，会在下次进入 Nexus 后自动同步，不需要回到网站二次确认。

#### 在 Edge 中安装

1. 解压下载的 Nexus 项目包。
2. 在 Edge 地址栏打开 `edge://extensions/`。
3. 开启“开发人员模式”。
4. 点击“加载解压缩的扩展”。
5. 选择解压后的 **`edge-extension` 文件夹**；该文件夹内应直接看到 `manifest.json`。
6. 打开 Edge 的扩展菜单，将 **Nexus Save** 固定到工具栏。

当前版本先支持桌面版 Microsoft Edge。Chrome 与 Safari 适配尚未发布。

Microsoft 官方参考：[在 Edge 中旁加载扩展](https://learn.microsoft.com/microsoft-edge/extensions/getting-started/extension-sideloading)。

#### AI 分类推荐

当 Nexus 已打开、已保存 BYOK，并允许 `Used in Category` 时，可以在扩展中主动点击“AI 推荐”。AI 只从现有正式分类中返回一个建议并回填下拉框；用户仍可修改，只有点击“完成”才会保存。AI 不会创建分类，也不会替用户做最终决定。

### Search Engine

- 在首页直接搜索互联网。
- 支持 Google、百度、Bing 和 DuckDuckGo。
- 支持自定义搜索引擎。
- 自定义搜索地址使用 `{query}` 表示关键词。
- 搜索结果在新标签页打开。
- 使用 `⌘ K` 或 `Ctrl K` 快速聚焦搜索框。

### Personalization

- 自定义用户名和首页问候语。
- 根据主时区显示早上好、中午好、下午好或晚上好。
- 同时显示多个时区。
- 设置任意时区为主时区。
- 亮色和暗色主题切换。
- 个性化内容保存在当前浏览器。

### Today's Focus

Today's Focus 不是独立的 Todo List，而是统一 Event 系统的首页时间线。

- 同时展示 Task 和固定 Schedule。
- 按开始时间排列今日内容。
- 添加、修改、完成和删除 Event。
- 设置标题、分类、日期、开始时间、结束时间和优先级。
- 添加或修改 Event 时，可以关联一个或多个 Resource。
- Today's Focus 会显示关联资源；Website 可以直接打开，Application 当前只显示名称和标识。
- 自动计算 Today's Progress 与 Weekly Progress。
- 未完成的历史任务保留并标记为 `Task unfinished`。
- 首页添加器支持每 X 周、每 X 月和自定义重复次数。

### Nexus Calendar

Calendar 页面位于 `/calendar`。

- 日视图和周视图。
- 时间轴展示 Task 与固定 Schedule。
- 拖动 Task 调整日期和时间。
- 固定 Schedule 不允许被拖动，避免误操作。
- 点击 Event 可修改或删除。
- 支持每 X 周重复。
- 支持每 X 月重复。
- 支持设置重复间隔与重复次数。
- 从 Apple Calendar、Google Calendar 和 Outlook 导入 `.ics` 日历文件。
- 从 Microsoft To Do 导入 `.csv`、`.json` 或兼容的 `.ics` 文件。
- 导入前预览日程并自动过滤重复项目。
- 文件在浏览器本地解析，不上传到 Nexus 服务器。

## Unified Event Model

Task 和 Schedule 使用统一的数据结构，为未来外部日历接入保留扩展能力：

```ts
{
  title: "",
  category: "",
  priority: "High | Medium | Low",
  type: "task | schedule",
  date: "YYYY-MM-DD",
  startTime: "HH:mm",
  endTime: "HH:mm",
  duration: 90,
  status: "pending | completed | unfinished",
  source: "local | calendar | google-calendar | outlook-calendar | apple-calendar | microsoft-todo | ai-suggestion",
  resources: ["resource-id"]
}
```

`Event.resources` 保存 Resource ID，而不是复制资源本身。一个 Event 可以关联多个 Website 或 Application；资源名称或图标更新后，Event 仍引用同一项资源。

当前版本支持 Google 和 Microsoft 账户授权导入，也保留本地文件导入。账户连接只读取用户选择的日期范围；文件导入会在读取后按开始日期和结束日期筛选。

### 从外部应用导入

打开 Nexus Calendar 并点击 `Import`。导入窗口提供两种方式：

- **Connect Account**：连接 Google 或 Microsoft，选择开始与结束日期，再自动读取该范围。
- **Import File**：先选择开始与结束日期，再上传 ICS、CSV 或 JSON；Nexus 只保留范围内的项目。

#### Google Calendar

选择 Google Calendar，设置日期范围，点击 `Connect Google & Preview`，在 Google 官方窗口授权只读访问，然后确认预览。也可以从 Google Calendar 导出 ICS 后使用文件模式。

#### Outlook Calendar

选择 Outlook，设置日期范围，点击 `Connect Microsoft & Preview`，授权 Calendar 只读权限，然后确认预览。Outlook 导出的 ICS 也可以通过文件模式导入。

#### Microsoft To Do

选择 Microsoft To Do，设置到期日期范围，连接 Microsoft 并授权 Tasks 只读权限。Nexus 会读取各个任务列表，仅保留到期日期位于范围内的任务。也支持 Microsoft 账户数据导出中的 CSV 或 JSON。

#### Apple Calendar

Apple 没有为普通网页提供 iCloud Calendar OAuth 接口，因此 Nexus 网页不能像 Google 或 Microsoft 那样直接连接 Apple Calendar。

- **Mac**：打开 Calendar，选择 `文件 → 导出 → 导出`，保存 ICS，然后使用 Nexus 的 Import File。
- **iPhone/iPad**：自带 Calendar 没有导出全部日程的功能，无法直接生成 ICS。
- iPhone/iPad 若要一键读取，需要未来开发使用 EventKit 的原生 iOS/macOS 应用；纯网页无法取得该权限。

Nexus 会尝试识别标题、日期、时间、分类、完成状态和常见重复规则，并过滤范围外和重复的项目。导入窗口底部提供本 README 的帮助链接。

### 配置账户连接

Google 和 Microsoft 登录需要仓库维护者创建 OAuth 应用，并在 Vercel Project Settings → Environment Variables 中添加：

```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID=你的_Google_Web_Client_ID
NEXT_PUBLIC_MICROSOFT_CLIENT_ID=你的_Microsoft_Entra_Client_ID
```

Google OAuth 应用需要启用 Google Calendar API，并允许 Calendar 只读 Scope。Microsoft Entra 应用需要将部署地址的 `/calendar` 加入 SPA Redirect URI，并允许委托权限 `Calendars.Read` 和 `Tasks.Read`。修改环境变量后需要重新部署。

如果没有配置 Client ID，Nexus 会显示管理员尚未配置的提示，文件导入仍然可以正常使用。

## AI Planner

AI Planner 是可选功能，不是 Nexus 的核心依赖。用户不配置 AI 时，导航、任务、进度和 Calendar 仍可完整使用。

### BYOK

Nexus 采用 BYOK（Bring Your Own Key）：

- 每位用户使用自己的 API Key。
- GitHub 源代码和 Vercel 构建中不包含共享 Key。
- Provider 配置和 Key 只保存在当前浏览器。
- 支持主动删除本地保存的 Key。

建议仅在可信设备上使用，并在 Provider 控制台设置额度限制或消费预警。清除浏览器网站数据、使用无痕模式或更换设备后，本地 Key 不会保留。

### Provider

当前界面支持：

- Qwen
- OpenAI
- 智谱 AI
- DeepSeek
- Gemini
- Claude
- OpenAI-compatible 自定义 Provider

自定义 Provider 可以填写名称、HTTPS API Base URL 和模型 ID。

### AI 使用权限

主页和 Calendar 共用同一套 AI Planner 设置。用户可以分别控制：

- **Used in Calendar**：允许用户主动询问 AI，并结合近期日程生成可编辑草案。
- **Used in Category**：允许用户主动请求 AI，根据 Resource 名称、类型、地址或 App Identifier、说明和现有分类推荐一个分类。
- **Used in Planning**：允许用户主动请求 AI，在规划建议中参考 Event，并从已有 Website 与 Application 中建议可关联的 Resource。
- **Do not use AI in any situation**：同时关闭上述三项，不发起任何 AI 请求。

关闭 AI 权限不会删除 Provider 或 API Key。Calendar 与 Planning 建议仍需用户确认后才会写入计划或日程；分类建议仍需用户点击“完成”后才会保存。

在 New Event 或 Edit Event 中，启用 `Used in Planning` 后可以主动点击 `Suggest Resources`。AI 只能从用户已经保存的 Resource ID 中推荐，界面会展示原因与候选项：

- `Accept`：把建议作为当前 Event 的 Resource 选择，但仍需用户点击 `Save Event` 才会保存。
- `Modify`：把建议加入选择区，由用户继续勾选或取消。
- `Ignore`：丢弃建议，不改变 Event。

AI 不会创建 Resource、启动 Application、保存 Event 或修改 Navigation。

### AI planning workflow

保存 API Key 后，Calendar 右下角会显示机器人入口。用户可以用自然语言描述单次任务或长期目标，例如：

> 我想在未来 8 周学习 Rust，每周安排两次，每次 90 分钟，尽量放在晚上。

AI 会结合近期 Calendar 内容生成结构化草案。用户可以：

- `Ignore`：忽略建议。
- `Adjust`：修改日期、时间和重复规则。
- `Add to Calendar`：确认后加入日历。

AI 只提供建议，**不会在没有用户确认的情况下修改日程**。

### AI Advisor, Not Decision Maker

Nexus 中的 AI 始终是 Advisor，而不是 Decision Maker。它可以建议时间、分类、资源关联或长期计划，但不会：

- 自动创建、修改、完成或删除 Event。
- 自动采用分类或资源关联。
- 自动整理或重新排序 Resource。
- 扫描设备中的应用、文件或文件夹。
- 启动本地 Application。

每一项建议都必须由用户查看、调整并明确接受。即使启用了 `Used in Planning`，最终决定权仍属于用户。

部分 Provider 可能不允许浏览器直接跨域调用。如果出现跨域错误，后续可以增加 Vercel Serverless 中转接口。

## 数据与隐私

当前版本不需要账户和数据库，数据保存在浏览器 `localStorage` 中，存储键为：

```text
nexus-data-v1
```

本地保存的数据包括导航内容、分类顺序、未归类网页、临时网页、用户名、时区、主题、搜索引擎、Resource、Website/Application 信息、Event、Event 与 Resource 的 ID 关联、重复日程、用户主动保存的 BYOK 设置和 AI 使用权限。

- 刷新或关闭浏览器后数据通常仍然存在。
- 数据不会自动同步到其他设备。
- 清除浏览器数据会删除 Nexus 本地数据。
- 公共设备不建议保存 API Key。

Edge 扩展仅申请 `activeTab` 与 `storage`，站点访问范围仅限 `https://nexus-navigation.vercel.app/*`。它只在用户点击扩展时读取当前标签页的标题和地址，不读取浏览历史，也不读取 Nexus 中保存的 API Key。只有用户主动请求 AI 分类推荐时，网页信息和分类名才会由 Nexus 发送给用户选择的 Provider。

## 本地运行

需要 Node.js 22.13 或更高版本。

```bash
npm install
npm run dev
```

正式构建检查：

```bash
npm run build
```

## 部署到 Vercel

1. 将项目文件上传到 GitHub。
2. 在 Vercel 中导入该仓库。
3. 将 Root Directory 设置为实际包含 `package.json` 的目录。
4. Framework Preset 使用 Next.js 或让 Vercel 自动识别。
5. 点击 Deploy。

连接 GitHub 后，每次更新主分支，Vercel 会自动重新部署。

## 项目结构

```text
nexus-navigation-vercel-v18/
├── app/                  # Next.js 路由与现有 UI
├── src/
│   ├── app/hooks/        # React 数据边界
│   ├── core/
│   │   ├── config/       # schema、默认值与存储键
│   │   ├── migrations/   # 0 → 1 → 2
│   │   └── storage/      # 异步 Adapter 与 Repository
│   ├── modules/          # 各业务领域、服务与纯函数
│   ├── platform/         # Browser 与 Desktop 占位接口
│   └── shared/types/     # 唯一 NexusData 与核心类型
├── tests/                # 自动回归测试
├── docs/                 # v18 手动回归清单
├── public/
├── edge-extension/       # Microsoft Edge 的 Nexus Save 扩展
├── package.json
└── next.config.ts
```

## 开发者日志

### v18.1 · Conflict warning and advisory rescheduling

- 新增 Event overlap 检测，相邻但不重叠的日程不会误报。
- 首页和 Calendar 增加非阻断冲突确认流程。
- AI Calendar 增加可编辑的已有 Event 改期草案，并限制为日期、开始和结束时间。
- AI 方案确认前不写入本地数据；客户端拒绝伪造 Event ID 与无效时间段。
- 自动回归测试增加到 46 项。

### v18 · Core architecture refactor

- 建立唯一 `NexusData`、共享 Resource/Event/Settings/AI 类型与稳定 Category ID。
- 增加内部 `schemaVersion = 2` 与无版本旧数据的 `0 → 1 → 2` 顺序迁移。
- 保留 `nexus-data-v1`；迁移失败或未来 schema 不会覆盖用户原始数据。
- 建立 Promise 化 `NexusStorage`、`LocalStorageAdapter` 与串行 Repository。
- 移除首页和 Calendar 对 `localStorage` 的直接调用。
- 将 Settings、Resources、Navigation、Calendar、Focus、AI Planner、Import/Export 规则迁入独立模块。
- 建立 Browser Platform Adapter、Desktop 占位接口及 Edge v1.x 分类映射；未引入 Tauri 或 SQLite。
- AI Provider、权限和建议校验集中管理，继续遵守 Advisor, Not Decision Maker。
- 新增领域、迁移与数据安全自动测试，以及完整 v17 手动回归清单。
- 保留 v17 UI、BYOK、重复日程、导入确认、本地数据和 Edge 消息兼容。

### v17 · Resource Workspace

- 将网站入口升级为统一 Resource 模型，当前支持 Website 与 Application。
- Application 当前只保存用户填写的信息与 `appIdentifier`，不扫描设备，也不启动本地应用。
- Event 新增 `resources` 字段，以 Resource ID 关联一个或多个数字资源。
- Today's Focus 支持在任务与日程中关联并展示 Resource。
- AI Planner 增加 `Used in Planning` 权限。
- 明确 AI Advisor, Not Decision Maker 原则；AI 不会自动整理、分类、排序或修改用户数据。
- Resource 模型为未来 `file`、`folder`、`shortcut` 与原生 macOS App 兼容预留空间。
- Edge 扩展继续只捕获 Website，不捕获 Application 或本地文件。

### v16 · Edge capture and AI permissions

- 新增桌面版 Microsoft Edge 扩展 Nexus Save。
- 支持从当前标签页读取标题和网址，并直接保存到正式分类、未归类或临时网页。
- 增加本机待同步队列；Nexus 下次打开后自动同步。
- 增加可选 AI 分类推荐，结果只回填分类，必须由用户点击“完成”。
- 首页增加 AI Planner 入口。
- 增加 Used in Calendar、Used in Category 与 Do not use AI in any situation 权限控制。
- 增加“清空分类内全部网页”、独立未归类入口与独立临时网页入口。
- 扩展采用 `activeTab`、`storage` 与限定 Nexus 域名的最小权限设计。

### v15 · Focus composer redesign

- 重新整理首页 Today's Focus 添加界面。
- 表单划分为安排内容、时间、属性和重复四个区块。
- 首页直接支持不重复、每 X 周和每 X 月。
- 支持自定义重复间隔与重复次数，最多生成 52 项。
- 增加重复规则文字预览、取消操作和更明确的提交按钮。
- 编辑已有 Event 时只修改当前项，避免意外生成重复系列。

### v14 · Visible date-range import

- Import File 页面增加与账户连接一致的开始日期和结束日期控件。
- ICS、CSV 和 JSON 只预览并导入用户选择范围内的项目。
- 移除选择文件后的临时日期输入弹窗，减少重复操作。
- 增加 Google Calendar、Outlook Calendar 和 Microsoft To Do 的账户授权入口。
- Import 界面增加 README 教程链接。
- 明确说明 Mac、iPhone 和 iPad 的 Apple Calendar 导入限制。

### v12 · Calendar import

- Calendar 增加外部日程导入入口。
- 支持 Apple Calendar、Google Calendar 和 Outlook 的 ICS 文件。
- 支持 Microsoft To Do 的 CSV、JSON 和兼容 ICS 文件。
- 增加来源选择、文件预览、重复项过滤和确认导入。
- 支持解析 ICS 中常见的每周与每月重复规则。
- 导入完全在浏览器本地完成，不上传文件。
- ICS、CSV 和 JSON 文件可以选择希望导入的开始与结束日期。
- 增加 Google Calendar、Outlook Calendar 与 Microsoft To Do 的账户连接入口。
- 增加 README 导入教程链接，并说明 Apple Calendar 的网页端限制。

### v11 · GitHub documentation entry

- 首页顶部增加 GitHub 仓库入口。
- 用户可以快速访问 README、功能说明和源码。

### v10 · AI planning and recurring events

- Calendar 增加配置 API Key 后才显示的 AI 机器人。
- 增加自然语言规划对话框。
- AI 可以结合近期日程生成 Event 草案。
- 增加 Ignore、Adjust 和 Add to Calendar 决策流程。
- New Event 增加每 X 周和每 X 月重复。
- 增加重复间隔与重复次数。
- Provider 正式增加 Qwen。

### v9 · BYOK persistence fix

- 修复首页保存数据时覆盖 AI Planner 设置的问题。
- 增加“保存到本地”状态提示。
- 增加“删除密钥”按钮。
- Provider、模型、自定义地址和 Key 可以在重新进入 Calendar 后恢复。

### v8 · Navigation category fix

- 修复分类拖动后，新网址仍默认进入“复旦学习”的问题。
- 添加网址的默认分类现在跟随用户排序后的第一个分类。
- 补充分组删除、重命名和恢复数据时的分类同步。

### v7 · Provider customization and visual states

- 增加智谱 AI。
- 增加自定义 Provider、Base URL 和模型 ID。
- 加深亮色主题中的紫蓝色按钮，强化可点击状态。

### v6 · From Navigation to Workspace

- Nexus 从 Personal Start Page 升级为 Personal Workspace。
- 首页升级为 Navigation + Workspace 双区域布局。
- 将旧版 Today's Focus 迁移到统一 Event 模型。
- 增加 Today's Progress 与 Weekly Progress。
- 新增 Nexus Calendar 日视图、周视图和拖动改期。
- 预留外部日历与 AI Suggestion 数据来源。

### v5 · Today's Focus

- 首页增加轻量任务区域。
- 支持任务名称、分类、预计时间和优先级。
- 支持完成、删除和本地保存。
- 增加今日完成度进度条。

### v4 · Search and personalization

- 增加主搜索栏和自定义搜索引擎。
- 分类管理移动至右上角辅助入口。
- 支持分类拖动排序。
- 增加亮色与暗色主题。

### v3 · Editable navigation

- 支持页面内添加、编辑和删除网址。
- 支持页面内添加、重命名和删除分类。
- 网站图标改为读取 favicon，并保留文字回退。

### v2 · Personal time and greeting

- 增加用户自定义姓名。
- 根据主时区显示问候语。
- 支持同时显示北京时间、旧金山时间及其他时区。

### v1 · Nexus Navigation

- 建立 Nexus 个人导航页。
- 增加复旦学习、AI 工具、编程开发和知识资源等默认分类。
- 所有导航链接在新标签页打开。
- 完成首次 GitHub 与 Vercel 部署。

## Roadmap

- Google Calendar、Outlook Calendar 和 Apple Calendar 的 OAuth 持续同步。
- Event 系列级别的批量编辑与删除。
- 可选的 Vercel AI 请求中转层。
- Calendar 冲突检测与更细粒度拖动。
- 用户主动选择的数据导入与导出。
- Microsoft Edge 扩展稳定后适配 Google Chrome。
- 将现有扩展转换为 Safari Web Extension。
- 探索原生 macOS App；未来可使用 `appIdentifier` 与系统能力安全连接 Application，同时保持网页端数据模型兼容。

Roadmap 仅代表可能的发展方向，不表示已经完成。

## Contributing

欢迎通过 GitHub Issues 提交 Bug、改进建议和功能讨论。提交修改前，请确保：

```bash
npm run build
```

可以成功完成。

---

Made for focused work, thoughtful learning, and a calmer digital life.
