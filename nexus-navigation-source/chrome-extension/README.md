# Nexus Save for Google Chrome

这是 Nexus Resource Workspace 的 Chrome Website 捕获扩展。它与 Edge 版使用同一套本地同步协议，支持：

- 读取当前网页标题、网址和公开简介。
- 保存前修改名称与介绍。
- 保存到正式分类、未归类或临时资源。
- Nexus 已打开时立即同步；未打开时进入本机待同步队列。
- 在用户主动点击时请求 AI 推荐现有分类，最终仍由用户选择。
- 再次收藏同一网址时更新名称、介绍和分类，并保留 Resource ID、顺序与 Event 关联。

扩展只创建 Website Resource，不扫描应用、文件或文件夹，也不会读取 Nexus 的 API Key。

## 在 Chrome 中安装

1. 解压 `nexus-save-chrome-v1.zip`。
2. 在 Chrome 地址栏打开 `chrome://extensions/`。
3. 打开右上角“开发者模式”。
4. 点击“加载已解压的扩展程序”。
5. 选择解压后的 `chrome-extension` 文件夹；该文件夹内应直接看到 `manifest.json`。
6. 在扩展菜单中固定 **Nexus Save for Chrome**。

更新开发版时，用新文件覆盖原文件夹，然后在 `chrome://extensions/` 中点击该扩展的“重新加载”。

## 使用方式

1. 打开一个普通 HTTP(S) 网页。
2. 点击 Nexus Save 图标。
3. 检查名称和介绍。介绍会优先读取 `meta description`、`og:description` 或 `twitter:description`，也可以手动修改。
4. 选择分类。默认“未归类”；“临时网页”不会显示在主页导航中。
5. 可选：在 Nexus 已打开、已配置 BYOK 且允许 `Used in Category` 时点击“AI 推荐”。
6. 点击“完成”。

## 权限与隐私

- `activeTab`：只在用户点击扩展时访问当前标签页。
- `scripting`：只读取当前网页公开的描述元数据，不读取表单、密码或浏览历史。
- `storage`：在本机保存分类缓存和待同步队列。
- `https://nexus-navigation.vercel.app/*`：用于与 Nexus 网页交换分类、Resource 和用户主动发起的 AI 分类请求。

Chrome Manifest V3 使用 `activeTab + scripting` 为当前标签页提供临时权限，不申请所有网站的永久访问权。

## 兼容性

- Google Chrome 88 或更新版本。
- Nexus Web v18.2 或更新版本可保存可编辑介绍；旧版 Nexus 会忽略新字段。
- 内部消息名继续沿用 Edge v1.x 的兼容契约，避免拆分 Nexus Web 的接收逻辑。

