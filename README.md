<div align="center">

<img src="./assets/icon.svg" width="112" height="112" alt="PunPun Logo" />

# PunPun

**跨平台一体化截图工具 · Liquid Glass 液态玻璃界面 · 显卡加速离线 OCR · 无框原地翻译 · 多引擎以图搜图 · 贴图 · 录屏**

[![Version](https://img.shields.io/badge/version-v0.2.3%20正式版-2563EB?style=flat-square)](https://github.com/Kian0-cell/PunPuin/releases/latest)
[![Platform](https://img.shields.io/badge/platform-Windows%20x64%20%7C%20macOS%20(Apple%20Silicon%20%26%20Intel)-0EA5E9?style=flat-square)](https://github.com/Kian0-cell/PunPuin/releases/latest)
[![Packages](https://img.shields.io/badge/GitHub%20Packages-ghcr.io%2Fkian0--cell%2Fpunpuin-8B5CF6?style=flat-square)](https://github.com/Kian0-cell/PunPuin/pkgs/container/punpuin)
[![License](https://img.shields.io/badge/license-GPL--3.0-10B981?style=flat-square)](LICENSE)

[下载正式版](https://github.com/Kian0-cell/PunPuin/releases/latest) · [历史发行版](https://github.com/Kian0-cell/PunPuin/releases) · [GitHub 软件包](https://github.com/Kian0-cell/PunPuin/pkgs/container/punpuin) · [问题反馈](https://github.com/Kian0-cell/PunPuin/issues)

> 本项目基于开源项目 [xushengfeng/eSearch](https://github.com/xushengfeng/eSearch)（GPL-3.0）深度重构与二次开发。

</div>

---

## 核心亮点（v0.2.3 正式版）

### 1. Apple Liquid Glass 液态玻璃控制中心（Windows & macOS 双端适配）
- **真·桌面实时透射**：Windows 11 原生接入 DWM `Acrylic / Mica` 硬件实时透射，macOS 原生接入 `under-window / sidebar` 透明毛玻璃与交通灯安全区；支持顶栏一键切换 **`清透` / `液态` / `雾面`** 三档通透度。
- **Bento Studio 交互工作台**：独立悬浮液态侧栏与弹性滑移胶囊指示器、实时硬件遥测徽章、6 格一键快捷启动卡、首页高频功能开关与全局无滚动条沉浸界面。

### 2. `F1` 零闪烁秒出截屏 + 智能窗口/控件识别
- **0ms 无闪唤起 & 混合高分屏支持**：消除窗口弹跳与缩放闪烁，支持 1080P 笔记本屏 + 2K/4K 外接屏混合 DPI（含 124%/125%/150% 非整数缩放）1:1 原画直出；内置「渲染模式 / 硬件加速」设置（默认 `D3D11` 固定渲染），避免双显卡切换首帧延迟。
- **Windows UI Automation 智能识别**：自动精准吸附应用窗口与内部按钮/卡片/面板边界，配合 Z 序遮挡剔除与 DWM 阴影裁剪，滚轮顺滑切换识别层级。
- **双胶囊悬浮任务栏**：标注栏与动作栏采用独立全圆角液态玻璃双胶囊布局，任何缩放比例下零接缝断裂；按 **`H`** 或 **`?`** 可呼出液态玻璃画布与快捷键提示浮窗。

### 3. 全息激光扫描 · 无框原地 OCR & 原地翻译
- **全息双向激光扫描动效**：识别与翻译期间呈现往复白芯棱镜激光、流动微格点阵与呼吸光谱边环。
- **纯净原地选字（OCR）**：识别后在原图位置生成无边框透明可选文字层，鼠标划选即可复制，不破坏原图观感。
- **无框像素融合翻译**：自动采样文字外沿真实背景中位数色彩与原字色，柔边擦除原文并原位渲染译文，显示与导出图片 1:1 一致。
- **离线 + 免 API 双引擎**：内置 **PP-OCR v6** 离线模型（Windows 支持 **DirectML** 显卡加速）与 **Firefox Bergamot** 本地离线翻译模型（`en → zh-Hans`）+ 免 API 多语种在线兜底。

### 4. 多引擎真实以图搜图工作台（Image Search Studio）
- **7 大引擎直连检索**：支持必应识图、Yandex、Google Lens、360 识图、百度识图（内置页自动注入原图提交）、SauceNAO 与 AI 视觉识图；支持**三引擎一键对比**、同图切换零重复上传与故障自动回退。
- **便捷导入**：截屏一键直达，或直接在工作台内拖拽本地图片、`Ctrl+V` 粘贴剪贴板图片秒搜。

### 5. 微信风格标注、高级图片美化、贴图与录屏工作室
- **现代标注与美化**：内置微信红（`#FA5151`）矩形框、圆环、箭头、画笔、马赛克、模糊、自增序号与文字标注；高级图片编辑器支持渐变背景、圆角阴影与多格式导出（`PNG` / `JPG` / `WebP` / `AVIF`）。
- **贴图与超级录屏**：支持置顶静态/动态贴图、滚动长截屏、普通录屏与鼠标跟踪超级录屏（`GIF` / `MP4` / `WebP` / `APNG`），以及精简系统托盘与便携版静默开机自启动。

---

## 默认快捷键（支持设置内自由修改）

| 功能 | Windows / Linux | macOS |
| :--- | :--- | :--- |
| **区域截图** | `F1` | `F1` |
| **自动识别** | `Alt + V` | `Control + Command + V`（`⌃⌘V`） |
| **截屏画布 / 快捷键提示** | `H` 或 `?` | `H` 或 `?` |
| **复制选区 / 保存截图** | `Ctrl + C` / `Ctrl + S` | `Command + C` / `Command + S` |
| **确认 OCR / 关闭** | `Enter` / `Esc` | `Return` / `Esc` |
| **设置搜索** | `Ctrl + K` | `Command + K`（`⌘K`） |

---

## 下载与安装说明

前往 [**Releases 最新正式版**](https://github.com/Kian0-cell/PunPuin/releases/latest)（或查看 [全部历史发行版](https://github.com/Kian0-cell/PunPuin/releases)）下载对应系统安装包：

| 系统与芯片 | 推荐下载文件 | 说明 |
| :--- | :--- | :--- |
| **Windows 10 / 11 (x64)** | `PunPun-v0.2.3-win-x64.exe` | 免安装单文件便携版（首次运行建立本地缓存，后续秒开） |
| **macOS Apple Silicon (M1~M5)** | `PunPun-0.2.3-darwin-arm64.dmg` | Apple 芯片原生安装包（亦提供 `.zip` 免安装压缩包） |
| **macOS Intel (x64)** | `PunPun-0.2.3-darwin-x64.dmg` | Intel 芯片 Mac 安装包 |

### macOS 首次运行提示
1. 因未接入 Apple 付费开发者公证，首次打开如提示“无法验证开发者”或“已损坏”，可在「系统设置 → 隐私与安全性」点击「仍要打开」，或在终端执行一次：
   ```bash
   xattr -cr /Applications/PunPun.app
   ```
2. 首次截图时请按系统提示在「系统设置 → 隐私与安全性 → 录屏与系统录音 / 辅助功能」中勾选允许 **PunPun**。

---

## 自动化打包与本地开发

仓库已配置 [GitHub Actions 自动构建发布流水线](.github/workflows/build.yml)：每次推送到 `main` 分支（或手动触发）均会自动构建 Windows `.exe` 与 macOS `arm64`/`x64` 安装包，并同步发布至 **GitHub Releases（发行版，自动附带结构化中文更新日志）** 与 **GitHub Packages（软件包 `ghcr.io/kian0-cell/punpuin`）**。

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

# 构建本地安装包
pnpm run dist
```

---

## 致谢与许可

- 本项目基于 [xushengfeng/eSearch](https://github.com/xushengfeng/eSearch) 二次开发，延续 **GNU General Public License v3.0 (GPL-3.0)** 开源协议。
- 详见 [LICENSE](LICENSE) 与 [NOTICE](NOTICE)。
