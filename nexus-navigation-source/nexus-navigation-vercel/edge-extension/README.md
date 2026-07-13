# Nexus Save for Microsoft Edge

这是 Nexus Resource Workspace 的 Website 捕获扩展。它只在你点击按钮时读取当前 Website，并将它作为 Website Resource 保存在本机同步队列中。Nexus 已打开时会立即同步；没有打开时，会在你下次进入 Nexus 后自动同步。

扩展当前**只捕获 Website**。Application Resource 需要用户在 Nexus 中手动创建；扩展不会扫描、识别或启动本地 Application，也不会捕获文件、文件夹或快捷方式。

## 在 Edge 中安装

1. 打开 `edge://extensions/`。
2. 打开左侧的“开发人员模式”。
3. 点击“加载解压缩的扩展”。
4. 选择本项目里的 **`edge-extension` 文件夹**。
5. 在 Edge 工具栏的扩展菜单中，将 **Nexus Save** 固定到工具栏。

## 使用方式

1. 打开想要保存为 Website Resource 的普通网页。
2. 点击工具栏中的 Nexus Save。
3. 修改 Website 名称并选择 Resource 分类。
4. 点击“完成”。无需跳转；扩展会自动同步。

分类下拉框的前两项是特殊入口：

- **未归类**：默认选择。Website Resource 不会进入普通分类，而是显示在 Nexus 顶部的独立入口里。
- **临时网页**：用于短期保存，Website Resource 不会显示在主页导航卡片中。

打开一次 Nexus 后，扩展会自动同步你最新的普通分类。

## AI 推荐

当 Nexus 已经打开、AI Key 已配置，并允许 `Used in Category` 时，可以点击“AI 推荐”。推荐结果只会回填 Website Resource 的分类下拉框，不会自动保存；你可以修改或忽略，最终以点击“完成”时的分类为准。

AI 在这里是 Advisor，而不是 Decision Maker。扩展不会使用 `Used in Planning` 自动规划任务，也不会自动整理、分类或排序 Resource。

## 隐私与权限

- `activeTab`：仅在你点击扩展时读取当前标签页的标题和地址。
- `storage`：在本机保存 Resource 分类缓存和等待 Nexus 同步的 Website 队列。
- `https://nexus-navigation.vercel.app/*`：只用于和 Nexus 网页交换 Resource 分类、Website 与 AI 推荐请求。

扩展不会读取浏览历史，不会在后台批量收集 Website，也不会读取或保存 API Key。

未来若开发原生 macOS App，可以沿用 Nexus 的 Resource 模型与 `appIdentifier` 连接系统中的 Application；这不属于当前 Edge 扩展的能力。

## 与 Nexus 的消息协议

网页向扩展广播：

- `NEXUS_WEB_READY`：Nexus 已可以接收 Website Resource 同步队列。
- `NEXUS_EXTENSION_STATE`：包含 `categories` 与 `siteUrl`，供扩展同步 Resource 分类。
- `NEXUS_EXTENSION_SAVED`：按 `id` 确认 Website Resource 已保存，扩展随后从 `queuedCaptures` 删除该项。
- `NEXUS_EXTENSION_AI_RESULT`：返回 Website Resource 的推荐分类或错误信息。

扩展向网页广播：

- `NEXUS_EXTENSION_SAVE`：逐条发送 `queuedCaptures` 中 Website 的 `id`、`title`、`url`、`category` 与 `createdAt`。
- `NEXUS_EXTENSION_AI_REQUEST`：请求 Nexus 使用已经保存的 AI 配置为 Website Resource 生成分类建议。

特殊分类值：

- `__nexus_unclassified__` → 未归类
- `__nexus_temporary__` → 临时网页

所有网页消息都带有明确的 `source`，并仅在 Nexus 自身 origin 内传递。
