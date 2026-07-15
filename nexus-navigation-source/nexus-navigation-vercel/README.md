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
- 无版本的 v17 数据会按 `0 → 1 → 2` 顺序迁移。迁移会保留 Resource ID、Event、分类、设置、BYOK 与未知但有效的关联 ID。
- 非法 JSON 或高于当前版本的数据不会被默认值覆盖；旧客户端也不会把未来数据降级写回。
- Website/Application 使用可辨识联合类型；Event 只保存 Resource ID，不复制 Resource 内容。
- 浏览器能力由 `BrowserPlatformAdapter` 提供；Desktop Adapter 目前只是无 Tauri 依赖的接口占位。
- AI Provider 客户端没有数据写入能力。AI 仍是 Advisor，任何建议都必须由用户确认。

开发和回归说明见 [`docs/V18_REGRESSION_CHECKLIST.md`](docs/V18_REGRESSION_CHECKLIST.md)。

### v18.1 · Schedule conflict advisory

- 首页 Today’s Focus 与 Calendar 在新增或修改 Event 时会检测时间重叠，并显示非阻断式提醒。
- 提醒只提供“返回调整”和“仍然保存”；Nexus 不禁止用户同时安排两件事情。
- Calendar AI 可以针对突发安排建议移动已有 Event，并展示原时间、建议时间与原因。
- AI 只能引用真实存在的 Event ID，且建议中只允许调整日期、开始时间和结束时间。
- 新日程与所有调整都可在预览中修改；只有用户点击“确认并应用”后才会保存。
- AI 不会自动删除、完成、改名或移动 Event，继续遵守 **AI Advisor, Not Decision Maker**。

## 设计理念

Nexus 不试图成为展示所有信息的传统 Dashboard。它不会加入天气、新闻、股票、热点或其他与行动无关的信息。

首页分为两个清晰区域：

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
- 自动读取网站图标。
- 所有网站在浏览器新标签页中打开。
- 顶部小搜索框可筛选导航内容。
- GitHub 图标可快速打开本仓库和功能说明。

默认包含复旦校园服务、AI 工具、编程资源、知识资源、Google 和 GitHub 等入口。默认内容仅用于首次使用，用户可以在页面中自行修改。

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

- 在首页直接进行互联网搜索。
- 支持 Google、百度、Bing 和 DuckDuckGo。
- 支持自定义搜索引擎。
- 自定义搜索地址使用 `{query}` 表示搜索关键词。
- 搜索结果在新标签页打开。
- 使用 `⌘ K` 或 `Ctrl K` 快速聚焦搜索框。

### Personalization

- 自定义用户名和首页问候语。
- 根据主时区显示早上好、中午好、下午好或晚上好。
- 同时显示多个时区。
- 设置任意时区为主时区。
- 亮色和暗色主题切换。
- 所有个性化内容保存在当前浏览器。

### Today's Focus

Today's Focus 不是独立的 Todo List，而是统一 Event 系统的首页时间线。

- 同时展示 Task 和固定 Schedule。
- 按开始时间排列今日内容。
- 添加、修改、完成和删除 Event。
- 设置标题、分类、日期、开始时间、结束时间和优先级。
- 添加或修改 Event 时，可以关联一个或多个 Resource。
- Today's Focus 会显示关联资源；Website 可以直接打开，Application 当前只显示名称和标识。
- 自动计算 Today's Progress。
- 自动计算 Weekly Progress。
- 未完成的历史任务保留并标记为 `Task unfinished`。
- 首页添加器支持每 X 周、每 X 月和自定义重复次数。

### Nexus Calendar

Calendar 页面位于 `/calendar`。

- 日视图和周视图。
- 08:00–22:00 时间轴。
- 查看 Task 与固定 Schedule。
- 拖动 Task 调整日期和时间。
- 固定 Schedule 不允许被拖动，避免误操作。
- 点击 Event 可修改或删除。
- 支持每 X 周重复。
- 支持每 X 月重复。
- 支持设置重复次数，最多生成 52 次。
- 从 Apple Calendar、Google Calendar 和 Outlook 导入 `.ics` 日历文件。
- 从 Microsoft To Do 导入 `.csv`、`.json` 或兼容的 `.ics` 文件。
- 导入前预览内容并过滤重复项目。

### Unified Event Model

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

当前版本支持 Google Calendar、Outlook Calendar 和 Microsoft To Do 的账户授权与日期范围导入。文件导入同样会询问开始和结束日期，只保留范围内项目。Apple Calendar 无法从普通网页通过 OAuth 连接；Mac 可导出 ICS，iPhone/iPad 自带日历没有导出全部日程的功能。

账户连接需要在 Vercel 配置 `NEXT_PUBLIC_GOOGLE_CLIENT_ID` 与 `NEXT_PUBLIC_MICROSOFT_CLIENT_ID`。示例见 `.env.example`。

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

Apple 没有为普通网页提供 iCloud Calendar OAuth 接口，因此 Nexus Web 不能像 Google 或 Microsoft 那样直接连接 Apple Calendar。

- **Mac**：打开 Calendar，选择 `文件 → 导出 → 导出`，保存 ICS，然后使用 Nexus 的 Import File。
- **iPhone/iPad**：自带 Calendar 没有导出全部日程的功能，无法直接生成 ICS。
- iPhone/iPad 若要一键读取，需要未来使用 EventKit 的原生 iOS/macOS 应用；纯网页无法取得该权限。

文件会在当前浏览器内解析，不会上传到 Nexus 服务器。预览、范围筛选和重复项过滤完成后，只有用户点击确认才会写入 Calendar。

## AI Planner

AI Planner 是可选功能，不是 Nexus 的核心依赖。用户不配置 AI 时，导航、任务、进度和 Calendar 仍可完整使用。

### BYOK

Nexus 采用 BYOK（Bring Your Own Key）：

- 每位用户使用自己的 API Key。
- 不在 GitHub 源代码或 Vercel 构建中放置共享 Key。
- Provider 配置和 Key 只保存在当前浏览器。
- 返回首页不会清除 Calendar 中的 BYOK 设置。
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
- `Adjust`：进入 Event 表单修改日期、时间和重复规则。
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

本地保存的数据包括：

- 网站和导航分类。
- 分类顺序。
- 用户名。
- 时区。
- 主题。
- 默认搜索引擎。
- Event 和重复日程。
- Resource、资源顺序及 Website/Application 信息。
- Event 与 Resource 之间的 ID 关联。
- AI Provider 配置与用户主动保存的 API Key。
- AI 在 Calendar、Category 与 Planning 中的使用权限。
- 未归类网页与临时网页。

这意味着：

- 刷新或关闭浏览器后数据通常仍然存在。
- 数据不会自动同步到其他设备。
- 清除浏览器数据会删除 Nexus 本地数据。
- 公共设备不建议保存 API Key。

Edge 扩展仅申请 `activeTab` 与 `storage`，站点访问范围仅限 `https://nexus-navigation.vercel.app/*`。它只在用户点击扩展时读取当前标签页的标题和地址，不读取浏览历史，也不读取 Nexus 中保存的 API Key。只有用户主动请求 AI 分类推荐时，网页信息和分类名才会由 Nexus 发送给用户选择的 Provider。

## 本地运行

环境要求：Node.js 22.13 或更高版本。

```bash
npm install
npm run dev
```

打开终端显示的本地地址即可使用。

正式构建检查：

```bash
npm run build
```

## 部署到 Vercel

1. 将项目文件上传到 GitHub 仓库。
2. 在 Vercel 中导入该仓库。
3. 如果仓库外层还有其他目录，将 Root Directory 设置为实际包含 `package.json` 的目录。
4. Framework Preset 使用 Next.js 或让 Vercel 自动识别。
5. 点击 Deploy。

连接 GitHub 后，每次更新主分支，Vercel 会自动重新部署。

## 项目结构

```text
app/
├── calendar/
│   └── page.tsx       # Calendar 路由与交互层
├── globals.css        # 全站主题、Workspace 与 Calendar 样式
├── layout.tsx         # 页面元数据与全局布局
└── page.tsx           # 首页路由与交互层

src/
├── app/hooks/         # React 与统一数据仓库的边界
├── core/
│   ├── config/        # 当前 schema、默认值和稳定存储键
│   ├── migrations/    # 0 → 1 → 2 顺序迁移
│   └── storage/       # NexusStorage、LocalStorageAdapter、Repository
├── modules/
│   ├── settings/      # 用户名、时区、主题和搜索引擎规则
│   ├── resources/     # Website/Application 领域逻辑
│   ├── navigation/    # 分类、排序、未归类和临时资源
│   ├── calendar/      # Event、重复、编辑当前项和拖动改期
│   ├── focus/         # Today/Weekly 选择器与进度
│   ├── ai-planner/    # Provider、权限、请求和建议校验
│   └── import-export/ # ICS/CSV/JSON、筛选、去重和备份
├── platform/
│   ├── browser/       # Web 平台能力与 Edge Bridge 协议
│   └── desktop/       # Desktop 接口占位；没有 Tauri API
└── shared/types/      # 唯一 NexusData 与核心模型

public/                # 静态资源
edge-extension/        # Microsoft Edge 的 Nexus Save 扩展
tests/                 # 数据迁移、领域规则和平台回归测试
package.json           # 项目依赖与运行脚本
next.config.ts         # Next.js 配置
```

## 开发者日志

### v18.1 · Conflict warning and advisory rescheduling

- 新增集中式 Event overlap 检测；相邻但不重叠的日程不会误报。
- 首页与 Calendar 共用非阻断冲突规则，用户仍可明确选择保留重叠安排。
- AI Calendar 建议支持受限的已有 Event 改期草案；Event ID、日期和时间均在客户端校验。
- AI 方案在确认前只存在于预览状态，不写入 Storage，也不能修改标题、状态、Resource 或 Navigation。
- 自动回归测试增加到 46 项，并加入冲突边界和 AI 伪造 Event ID 防护测试。

### v18 · Core architecture refactor

- 建立唯一 `NexusData`、共享 Resource/Event/Settings/AI 类型与稳定 Category ID。
- 增加内部 `schemaVersion = 2`，并建立无版本旧数据的 `0 → 1 → 2` 顺序迁移。
- 保留 `nexus-data-v1`，迁移失败或遇到未来 schema 时不覆盖原始数据。
- 建立 Promise 化 `NexusStorage`、`LocalStorageAdapter` 与串行 `NexusDataRepository`。
- 移除首页和 Calendar 对 `localStorage` 的直接调用。
- 将 Settings、Resources、Navigation、Calendar、Focus、AI Planner、Import/Export 的核心规则抽成可测试模块。
- 建立 Browser Platform Adapter、Desktop 占位接口及 Edge v1.x 协议映射层；未引入 Tauri 或 SQLite。
- AI 请求、权限判断和建议校验统一进入 AI Planner 模块，继续遵守 Advisor, Not Decision Maker。
- 新增领域、迁移与数据安全自动测试，以及完整 v17 手动回归清单。
- 保持 v17 的 UI、重复日程特征、导入确认、BYOK、本地数据和 Edge 扩展消息兼容。

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

- 重新设计首页 Today's Focus 添加表单。
- 增加每 X 周、每 X 月、重复间隔与重复次数。
- 优化信息层级、按钮状态和重复规则预览。

### v14 · Visible date-range import

- 文件导入页面增加可见的开始与结束日期控件。
- Google/Microsoft 账户连接与文件导入共用日期范围逻辑。
- 增加导入帮助链接和 Apple Calendar 平台限制说明。

### v12 · Calendar import

- 增加 Apple Calendar、Google Calendar 和 Outlook ICS 导入。
- 增加 Microsoft To Do CSV、JSON 和兼容 ICS 导入。
- 增加来源选择、预览、重复项过滤和确认导入。
- 文件完全在浏览器本地解析，不上传服务器。
- 增加日期范围筛选、Google/Microsoft 账户连接和 README 帮助链接。

### v11 · Documentation entry

- 在首页顶部增加 GitHub 仓库入口。
- 让用户可以快速访问 README、功能说明和项目源码。

### v10 · AI planning and recurring events

- Calendar 增加配置 Key 后才显示的 AI 机器人。
- 增加自然语言规划对话框。
- AI 可以结合近期日程生成结构化 Event 草案。
- 增加 Ignore、Adjust 和 Add to Calendar 决策流程。
- New Event 增加每 X 周和每 X 月重复。
- 增加重复间隔与重复次数。
- Provider 正式增加 Qwen。

### v9 · BYOK persistence fix

- 修复首页保存数据时覆盖 AI Planner 设置的问题。
- 增加“保存到本地”按钮和保存状态提示。
- 增加“删除密钥”按钮。
- Provider、模型、自定义地址和 Key 可以在重新进入 Calendar 后恢复。

### v8 · Navigation category fix

- 修复分类拖动后，新网址仍默认进入“复旦学习”的问题。
- 添加网址的默认分类现在跟随用户排序后的第一个分类。
- 补充分组删除、重命名、恢复数据时的分类同步。

### v7 · Provider customization and visual states

- 增加智谱 AI。
- 增加自定义 Provider、Base URL 和模型 ID。
- 加深亮色主题中的紫蓝色按钮，强化可点击状态。

### v6 · From Navigation to Workspace

- Nexus 从 Personal Start Page 升级为 Personal Workspace。
- 首页升级为 Navigation + Workspace 双区域布局。
- 将旧版 Today’s Focus 迁移到统一 Event 模型。
- 增加 Today's Progress 与 Weekly Progress。
- 新增 Nexus Calendar 日视图、周视图和拖动改期。
- 预留外部日历与 AI Suggestion 数据来源。

### v5 · Today's Focus

- 首页增加轻量任务区域。
- 支持任务名称、分类、预计时间和优先级。
- 支持完成、删除和本地保存。
- 增加今日完成度进度条。

### v4 · Search and personalization

- 增加 Google 风格的主搜索栏。
- 支持 Google、百度、Bing、DuckDuckGo 和自定义搜索引擎。
- 分类管理移动至右上角辅助入口。
- 支持分类拖动排序。
- 增加亮色与暗色主题。

### v3 · Editable navigation

- 支持页面内添加、编辑和删除网址。
- 支持页面内添加、重命名和删除分类。
- 网站图标改为读取站点 favicon，并保留文字回退。

### v2 · Personal time and greeting

- 增加用户自定义姓名。
- 根据主时区显示早上好、中午好、下午好或晚上好。
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
