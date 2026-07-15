# Nexus Save 扩展安装说明

Nexus Save 可以把当前网页保存到 Nexus，并在保存前选择分类、未归类或临时资源。扩展包由 Nexus 页面直接下载，但浏览器不会允许网页静默安装扩展，因此下载后仍需手动完成下面的步骤。

## 下载入口

在 Nexus 首页右上角选择 **获取扩展**。页面会在本地识别浏览器并提供对应 ZIP；也可以在弹窗里下载其他浏览器版本。

## Microsoft Edge

1. 解压 `nexus-save-edge-v1.3.zip`。
2. 在地址栏打开 `edge://extensions`。
3. 打开左侧的 **开发人员模式**。
4. 选择 **加载解压缩的扩展**。
5. 选择刚刚解压得到、内部含有 `manifest.json` 的文件夹。
6. 在扩展列表中将 **Nexus Save** 固定到工具栏。

## Google Chrome

1. 解压 `nexus-save-chrome-v1.zip`。
2. 在地址栏打开 `chrome://extensions`。
3. 打开右上角的 **开发者模式**。
4. 选择 **加载已解压的扩展程序**。
5. 选择刚刚解压得到、内部含有 `manifest.json` 的文件夹。
6. 在扩展菜单中将 **Nexus Save** 固定到工具栏。

## Safari（macOS）

Safari 不能直接加载 Chrome/Edge 扩展文件夹。ZIP 内提供的是 Safari Web Extension 源文件，需要在安装了 Xcode 的 Mac 上转换并签名：

1. 解压 `nexus-save-safari-v1.zip`。
2. 安装并打开最新版 Xcode。
3. 在终端进入解压目录，执行 `xcrun safari-web-extension-converter .`。
4. 在生成的 Xcode 工程中选择自己的开发团队并完成签名。
5. 运行生成的 macOS App。
6. 打开 Safari → 设置 → 扩展，勾选 **Nexus Save**。

如果 Safari 不显示未签名扩展，可在 Safari 的开发菜单中启用允许未签名扩展；不同 macOS/Safari 版本的菜单文字可能略有差异。

## 使用方法

1. 先打开一次 Nexus，让分类数据准备好。
2. 浏览任意网页时点击工具栏中的 **Nexus Save**。
3. 修改名称、说明，并选择目标分类。
4. 点击保存。若网址已经收藏，扩展会提示而不会重复加入。

## 隐藏或恢复首页入口

- 在下载弹窗中选择 **隐藏首页入口**，可以移除右上角的小入口。
- 以后打开 **管理资源 → 浏览器扩展入口**，可重新显示并再次下载。

## 隐私说明

- 扩展只在你主动点击时读取当前标签页的信息。
- Nexus 的 Resource、分类和设置保存在当前浏览器本地。
- 扩展不会读取或保存 AI API Key。
- 下载按钮只根据浏览器 User-Agent 在本地选择文件，不会把浏览记录发送给 Nexus。
