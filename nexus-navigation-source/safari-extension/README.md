# Nexus Save for Safari

这是 Nexus Resource Workspace 的 Safari Web Extension 源码。功能与 Chrome/Edge 版一致：读取当前 Website、编辑名称和介绍、选择正式分类/未归类/临时资源、保存本机待同步队列，以及由用户主动请求 AI 分类建议。

## 先了解 Safari 的安装方式

Safari Web Extension 的 HTML、CSS、JavaScript 和 `manifest.json` 可以与 Chrome/Edge 共用，但正式长期安装时必须通过 Apple 的扩展打包与签名流程。可以使用 Xcode，也可以使用 App Store Connect 的 Safari Web Extension Packager。源码文件夹本身适合开发、临时测试和作为打包输入；它不是可直接双击安装的 `.safariextz`。

## macOS Safari 临时测试

Safari 14 或更新版本可以临时加载 Web Extension 文件夹：

1. 打开 Safari → 设置 → 高级，启用网页开发者功能；新版本可直接使用“开发者”设置页。
2. 在 Safari → 设置 → 开发者中启用允许未签名扩展所需的选项。
3. 点击“Add Temporary Extension…”（添加临时扩展）。
4. 选择本项目中的 `safari-extension` 文件夹或 `nexus-save-safari-v1.zip`。
5. 在 Safari → 设置 → 扩展中启用 **Nexus Save for Safari**。
6. 为 Nexus 网站授予访问权限，并把扩展按钮加入工具栏。

临时扩展会在退出 Safari或最长约 24 小时后移除；这是 Safari 的测试机制，不是 Nexus 的限制。

## 使用 Xcode 生成可长期安装版本

需要完整 Xcode，而不是只有 Command Line Tools。打开 Terminal，在项目目录运行：

```bash
xcrun safari-web-extension-converter safari-extension \
  --app-name "Nexus Save" \
  --bundle-identifier "com.yourname.nexus-save" \
  --project-location ./safari-xcode \
  --copy-resources
```

然后：

1. 用 Xcode 打开生成的项目。
2. 在 Signing & Capabilities 中选择自己的 Team，并把 `com.yourname.nexus-save` 换成属于自己的唯一 Bundle Identifier。
3. 选择 macOS Scheme，点击 Product → Run。
4. 启动生成的容器 App。
5. 在 Safari → 设置 → 扩展中启用 Nexus Save。

发布到 App Store 或测试真实 iPhone/iPad 需要 Apple Developer Program。仅在 Mac 上本地开发时，可以按 Safari/Xcode 的未签名扩展流程测试。

如果不使用 Mac 或 Xcode，可以登录 App Store Connect，使用 **Safari Web Extension Packager** 上传此源码文件夹、生成可测试构建并通过 TestFlight/App Store 分发；这一途径同样需要 Apple Developer Program。

## 使用方式

1. 打开普通 HTTP(S) 网页并点击 Nexus Save。
2. 检查自动读取的网页名称与公开介绍，也可以手动修改。
3. 选择正式分类、未归类或临时资源。
4. 可选：Nexus 已打开且允许 `Used in Category` 时主动点击“AI 推荐”。
5. 点击“完成”；同步不需要 AI，也不会自动决定分类。

## 权限与隐私

- `activeTab`：用户点击时临时访问当前标签页。
- `scripting`：尝试读取公开的描述元数据；若 Safari 版本不支持该调用，介绍字段保持可手动填写，收藏功能仍可使用。
- `storage`：在本机保存分类缓存与待同步队列。
- Nexus host permission：只与 `https://nexus-navigation.vercel.app/` 交换 Resource 数据。

Safari 可能要求用户在扩展设置中单独批准网站访问权限。扩展不读取浏览历史、表单、密码或 Nexus API Key。

## 兼容性说明

- macOS Safari 14+ 支持 Safari Web Extensions。
- iOS/iPadOS Safari 15+ 支持 Safari Web Extensions，但必须通过包含扩展的 iOS App 安装。
- 当前源码使用 Manifest V3 与 `chrome.*` 兼容命名空间；Safari 不支持的元数据读取会安全降级为手动输入。
- 内部消息名沿用 Edge v1.x 兼容契约，从而与同一个 Nexus Web 接收端通信。
