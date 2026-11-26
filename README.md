<div align="center">

<img src="./assets/icon.svg" width="112" height="112" alt="PunPun Logo" />

# PunPun

**跨平台一体化截图工具 · 显卡加速离线 OCR · 无框原地翻译 · 现代标注美化 · 贴图 · GIF 录屏**

[![Version](https://img.shields.io/badge/version-v0.2.2%20正式版-2563EB?style=flat-square)](https://github.com/xiaoxi303/PunPuin/releases/latest)
[![Platform](https://img.shields.io/badge/platform-Windows%20x64%20%7C%20macOS%20(Apple%20Silicon%20%26%20Intel)-0EA5E9?style=flat-square)](https://github.com/xiaoxi303/PunPuin/releases/latest)
[![Packages](https://img.shields.io/badge/GitHub%20Packages-ghcr.io%2Fxiaoxi303%2Fpunpuin-8B5CF6?style=flat-square)](https://github.com/xiaoxi303/PunPuin/pkgs/container/punpuin)
[![License](https://img.shields.io/badge/license-GPL--3.0-10B981?style=flat-square)](LICENSE)

[下载正式版](https://github.com/xiaoxi303/PunPuin/releases/latest) · [GitHub 软件包](https://github.com/xiaoxi303/PunPuin/pkgs/container/punpuin) · [问题反馈](https://github.com/xiaoxi303/PunPuin/issues)

> 本项目基于开源项目 [xushengfeng/eSearch](https://github.com/xushengfeng/eSearch)（GPL-3.0）深度重构与二次开发。

</div>

---

## 核心亮点（v0.2.2 正式版）

### 1. 精准窗口识别与高帧率丝滑框选
- **1:1 高分屏原画直出**：全面适配 Windows 高分屏缩放与 macOS Retina 显示器，无损保留原始分辨率画质。
- **Z 序遮挡剔除 + DWM 阴影裁剪**：智能按前台真实窗口层级命中目标，自动剔除后台被遮挡窗口与透明壳层，并在 Windows 10/11 下向内吸附裁剪透明阴影虚边。
- **高刷自适应丝滑切换**：基于单 `requestAnimationFrame` 阻尼插值与 GPU `translate3d` 合成层驱动聚光遮罩和预览框，支持鼠标滚轮顺滑切换子控件 / 面板 / 窗口 / 全屏层级。

### 2. 无框自然融合的原地 OCR 与原地翻译
- **纯净原地选字（OCR）**：识别后直接在原图位置生成无边框透明可选文字层，鼠标划选即可复制，不破坏原图观感，不强制跳转外部窗口。
- **无框像素融合翻译**：自动采样每行文字外沿的真实局部背景中位数色彩与原始字色，柔边擦除原文字并原位渲染译文——界面显示与复制/保存/分享导出的图片 1:1 一致，无突兀色块框与贴片阴影。
- **离线 + 免 API 双重保障**：
  - 内置 **PP-OCR v6** 离线识别模型，Windows 支持 **DirectML** 显卡硬件加速（NVIDIA / AMD / Intel），不支持时自动回退 CPU。
  - 内置 **Firefox Bergamot** 本地离线翻译引擎（含 `en → zh-Hans` 模型）与免 API 在线多语种翻译自动兜底。

### 3. 微信风格标注、高级图片美化与贴图录屏
- **现代单排悬浮工具坞**：框选松手即贴边弹出单排工具栏，内置微信红（`#FA5151`）默认矩形框标记、圆环、箭头、画笔、马赛克、模糊、自增序号与文字标注。
- **高级图片编辑工作台**：支持极光蓝 / 落日渐变 / 暗夜紫 / 纯白卡片一键预设、微信风格多色框框标记、圆角阴影边距、自由透视与魔法橡皮擦，一键复制或导出 `PNG` / `JPG` / `WebP` / `AVIF`。
- **置顶贴图与超级录屏**：支持静态/动态窗口贴图、万向滚动长截图、区域录屏与鼠标跟随超级录屏（导出 `GIF` / `MP4` / `WebP` / `APNG`）。
- **精简托盘与开机自启**：紧凑分层系统托盘菜单、多节点自动回退版本检查、完善兼容免安装单文件版的开机静默自启动。

---

## 默认快捷键（支持设置内自由修改）

| 功能 | Windows / Linux | macOS |
| :--- | :--- | :--- |
| **区域截图** | `Alt + C` | `Control + Command + C`（`⌃⌘C`） |
| **自动识别** | `Alt + V` | `Control + Command + V`（`⌃⌘V`） |
| **复制选区** | `Ctrl + C` | `Command + C`（`⌘C`） |
| **保存截图** | `Ctrl + S` | `Command + S`（`⌘S`） |
| **确认 OCR / 关闭** | `Enter` / `Esc` | `Return` / `Esc` |
| **设置搜索** | `Ctrl + K` | `Command + K`（`⌘K`） |

---

## 下载与安装说明

前往 [**Releases 最新正式版**](https://github.com/xiaoxi303/PunPuin/releases/latest) 下载对应系统安装包：

| 系统与芯片 | 推荐下载文件 | 说明 |
| :--- | :--- | :--- |
| **Windows 10 / 11 (x64)** | `PunPun-v0.2.2-win-x64.exe` | 免安装单文件便携版（首次运行建立本地缓存，后续秒开） |
| **macOS Apple Silicon (M1~M5)** | `PunPun-0.2.2-darwin-arm64.dmg` | Apple 芯片原生安装包（亦提供 `.zip` 免安装压缩包） |
| **macOS Intel (x64)** | `PunPun-0.2.2-darwin-x64.dmg` | Intel 芯片 Mac 安装包 |

### macOS 首次运行提示
1. 因未接入 Apple 付费开发者公证，首次打开如提示“无法验证开发者”或“已损坏”，可在「系统设置 → 隐私与安全性」点击「仍要打开」，或在终端执行一次：
   ```bash
   xattr -cr /Applications/PunPun.app
   ```
2. 首次截图时请按系统提示在「系统设置 → 隐私与安全性 → 录屏与系统录音 / 辅助功能」中勾选允许 **PunPun**。

---

## 自动化打包与本地开发

仓库已配置 [GitHub Actions 自动构建发布流水线](.github/workflows/build.yml)：每次推送到 `main` 分支（或手动触发）均会自动构建 Windows `.exe` 与 macOS `arm64`/`x64` 安装包，并同步发布至 **GitHub Releases（发行版）** 与 **GitHub Packages（软件包 `ghcr.io/xiaoxi303/punpuin`）**。

```bash
# 安装依赖（Node.js >= 22，pnpm 10）
pnpm install

# 开发调试 / 本地预览
pnpm run dev
pnpm run start

# 代码格式化、检查与单元测试
pnpm run format
pnpm run lint
pnpm test

# 构建并打包当前平台安装包
pnpm run dist
```

---

## 致谢与开源协议

- 基于 [xushengfeng/eSearch](https://github.com/xushengfeng/eSearch) 二次开发，致谢原作者及社区贡献者。
- 离线 OCR 基于 [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR) / [eSearch-OCR](https://github.com/xushengfeng/eSearch-OCR)，离线翻译基于 Mozilla [Bergamot](https://github.com/browsermt/bergamot-translator)。
- 遵循 [GPL-3.0](LICENSE) 开源协议。
