# Nexus Personal Workspace

> Navigation = Access · Workspace = Action

Nexus 是一个简洁、安静且可以高度自定义的个人工作空间。它将常用网站导航、搜索、今日专注、日历和可选 AI 规划整合在同一个网页中，帮助用户回答两个最重要的问题：

- 我要去哪里？
- 我今天要做什么？

在线访问：[nexus-navigation.vercel.app](https://nexus-navigation.vercel.app)

## 设计理念

Nexus 不试图成为展示所有信息的传统 Dashboard。它不会加入天气、新闻、股票、热点或其他与行动无关的信息。

首页分为两个清晰区域：

- **Navigation**：访问网站、工具、学习资源和编程资源。
- **Workspace**：管理任务、固定日程、时间安排和 AI 建议。

整体视觉语言保持 Minimal、Clean、Calm、Elegant 和 Modern，并支持亮色与暗色模式。

## 主要功能

### Personal Navigation

- 按分类展示网站入口。
- 添加、编辑和删除网站。
- 添加、重命名、删除和拖动排序分类。
- 自动读取网站图标。
- 所有网站在浏览器新标签页中打开。
- 顶部小搜索框可筛选导航内容。
- GitHub 图标可快速打开本仓库和功能说明。

默认包含复旦校园服务、AI 工具、编程资源、知识资源、Google 和 GitHub 等入口。默认内容仅用于首次使用，用户可以在页面中自行修改。

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
- 自动计算 Today's Progress。
- 自动计算 Weekly Progress。
- 未完成的历史任务保留并标记为 `Task unfinished`。

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
  source: "local | calendar | google-calendar | outlook-calendar | apple-calendar | microsoft-todo | ai-suggestion"
}
```

当前版本支持从主流日历应用导出的文件中一次性导入日程，不需要登录或 OAuth。账户级自动同步仍需要未来配置 OAuth 开发者凭据。

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

### AI planning workflow

保存 API Key 后，Calendar 右下角会显示机器人入口。用户可以用自然语言描述单次任务或长期目标，例如：

> 我想在未来 8 周学习 Rust，每周安排两次，每次 90 分钟，尽量放在晚上。

AI 会结合近期 Calendar 内容生成结构化草案。用户可以：

- `Ignore`：忽略建议。
- `Adjust`：进入 Event 表单修改日期、时间和重复规则。
- `Add to Calendar`：确认后加入日历。

AI 只提供建议，**不会在没有用户确认的情况下修改日程**。

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
- AI Provider 配置与用户主动保存的 API Key。

这意味着：

- 刷新或关闭浏览器后数据通常仍然存在。
- 数据不会自动同步到其他设备。
- 清除浏览器数据会删除 Nexus 本地数据。
- 公共设备不建议保存 API Key。

## 本地运行

环境要求：Node.js 22 或更高版本。

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
│   └── page.tsx       # Calendar、重复日程与 AI Planner
├── globals.css        # 全站主题、Workspace 与 Calendar 样式
├── layout.tsx         # 页面元数据与全局布局
└── page.tsx           # 首页导航、搜索与 Today's Focus

public/                # 静态资源
package.json           # 项目依赖与运行脚本
next.config.ts         # Next.js 配置
```

## 开发者日志

### v12 · Calendar import

- 增加 Apple Calendar、Google Calendar 和 Outlook ICS 导入。
- 增加 Microsoft To Do CSV、JSON 和兼容 ICS 导入。
- 增加来源选择、预览、重复项过滤和确认导入。
- 文件完全在浏览器本地解析，不上传服务器。

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

Roadmap 仅代表可能的发展方向，不表示已经完成。

## Contributing

欢迎通过 GitHub Issues 提交 Bug、改进建议和功能讨论。提交修改前，请确保：

```bash
npm run build
```

可以成功完成。

---

Made for focused work, thoughtful learning, and a calmer digital life.
