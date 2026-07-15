# Nexus Browser Extension Distribution

Nexus Web 不能在用户第一次打开网页时静默安装浏览器扩展。Chrome、Edge 和 Safari 都要求用户在浏览器或系统提供的确认界面中主动安装并批准权限。

## 推荐发布路线

### 第一阶段：GitHub Releases

适合当前开发测试和愿意开启开发者模式的用户。

1. 打开 GitHub 仓库的 **Releases** 页面。
2. 点击 **Draft a new release**。
3. 创建版本标签，例如 `v18.3`。
4. 上传：
   - `nexus-save-edge-v1.3.zip`
   - `nexus-save-chrome-v1.zip`
   - `nexus-save-safari-v1.zip`
   - 可选：`nexus-navigation-vercel-v18.zip`
5. 在 Release Notes 中说明安装方式和权限用途。

用户从 GitHub 下载后：

- Edge/Chrome：解压 ZIP，在扩展管理页开启开发者模式并加载对应文件夹。
- Safari：macOS 可临时加载源码；长期安装需要 Xcode 包装或 App Store 版本。

GitHub Releases 是下载渠道，不会绕过浏览器的安装确认。

## 第二阶段：官方商店

面向普通用户时，推荐分别发布到：

- Microsoft Edge Add-ons
- Chrome Web Store
- Apple App Store（可使用 Xcode 或 App Store Connect 的 Safari Web Extension Packager）

商店发布后，Nexus 首页可以提供“安装浏览器扩展”入口，根据浏览器显示对应商店按钮。网页仍不能替用户自动点击安装，也不能静默批准权限。

## 为什么不做首次打开自动安装

- 浏览器禁止普通网页写入或启用扩展。
- 用户必须看到扩展申请的权限并明确确认。
- Safari 正式扩展属于签名 App 的一部分，网页不能生成或安装该 App。
- 尝试绕过这些限制会降低安全性，也无法通过官方商店审核。

可以实现的合理体验是：首次打开时显示一次可关闭的安装引导，链接到对应官方商店；用户拒绝后不重复打扰。商店地址尚未创建前，不应在正式网站展示失效按钮。

## 建议的 Release 资产

| 文件 | 用途 |
| --- | --- |
| `nexus-save-edge-v1.3.zip` | Edge 开发者模式安装 |
| `nexus-save-chrome-v1.zip` | Chrome 开发者模式安装 |
| `nexus-save-safari-v1.zip` | Safari 临时测试或 Xcode 转换输入 |
| `nexus-navigation-vercel-v18.zip` | 完整 Nexus Web 源码 |

## 发布前检查

- ZIP 解压后，扩展文件夹根目录直接包含 `manifest.json`。
- 网站与扩展中的 Nexus URL 一致。
- 三个扩展只申请 `activeTab`、`scripting`、`storage` 与 Nexus host permission。
- Chrome/Edge 可以保存、同步分类并处理待同步队列。
- Safari 已测试网站访问授权和手动介绍降级。
- 隐私说明明确：不读取历史、表单、密码或 API Key。
