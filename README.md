<div align="center">

<img src="./assets/icon.svg" width="112" height="112" alt="PunPun Logo" />

# PunPun

**轻量高效的一体化截图工具 · 显卡加速离线 OCR · 离线/免费翻译 · 现代标注 · 贴图 · GIF 录屏**

[![Version](https://img.shields.io/badge/version-v0.2.0%20测试版-2563EB?style=flat-square)](https://github.com/xiaoxi303/PunPuin)
[![License](https://img.shields.io/badge/license-GPL--3.0-10B981?style=flat-square)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20x64-0EA5E9?style=flat-square)](https://github.com/xiaoxi303/PunPuin)

[项目主页](https://github.com/xiaoxi303/PunPuin) · [问题反馈](https://github.com/xiaoxi303/PunPuin/issues)

> 本项目基于开源项目 [xushengfeng/eSearch](https://github.com/xushengfeng/eSearch)（GPL-3.0）进行深度定制与二次开发。

</div>

---

## 核心特性

### 1. 现代极简界面与横向悬浮任务栏
- **主界面直达设置**：启动自动打开现代卡片式主界面，支持托盘右键「显示主界面」随时呼出，内置「立即截图」快捷入口，全面支持浅色 / 深色双主题与滑动开关。
- **横向磨砂胶囊任务栏**：框选完成松开鼠标后自动贴边弹出紧凑横向动作栏与标注栏（下方不足自动翻到上方），拖动框选时自动隐藏不遮挡画面，带 2px 主题高亮边框与 8 个控制手柄。
- **实时全局快捷键**：录入即生效并持久化，支持单键（如 `F1`、`F2`、`PrintScreen`）与组合键，带「已生效 / 已被占用」实时状态反馈。

### 2. 显卡加速离线 OCR（内置 PP-OCR v6）
- **开箱即用**：完整内置 PP-OCR v6 本地识别模型，无需联网、无需额外下载。
- **DirectML 显卡加速**：Windows 下默认启用 ONNX Runtime `DirectML (dml)` 硬件加速（支持 NVIDIA / AMD / Intel 显卡），不支持时自动无感回退 CPU。

### 3. 双重免费翻译（免 API Key + 离线可用）
- **Firefox 本地离线翻译（Bergamot）**：内置运行环境与常用 `en → zh-Hans` 离线模型，结合本地 176 语种 `fasttext_wasm` 自动识别截图语言，彻底断网也能翻译；可在「主界面 → 翻译 → 屏幕翻译」自由切换目标语言。
- **内置免费在线翻译（免 API）**：多路免费翻译自动兜底，联网时免配置 API Key 即可翻译多语种，断网自动回退本地离线模型。
- 同时保留对 DeepL、OpenAI / DeepSeek / Gemini 等自定义大模型与翻译 API 的扩展支持。

### 4. 丰富标注、贴图与 GIF 录屏
- **标注工具**：箭头、马赛克（像素化）、模糊、自增序号、矩形、椭圆、画笔、文字、遮罩、高级截屏美化。
- **贴图与长截图**：支持屏幕置顶贴图、窗口动态贴图、万向滚动长截图与剪贴板贴图。
- **录屏与 GIF 导出**：支持区域录屏与鼠标聚焦超级录屏，支持裁剪变速并直接导出 `GIF` / `MP4` / `WebP` / `APNG`。

---

## 免安装单文件版

打包产物为单文件免安装 `.exe`（约 `175 MB`，LZMA 极限压缩，核心离线 OCR 与离线翻译模型全部内置，双击即用）：

```text
build/PunPun-v0.2.0-测试版-免安装.exe
```

---

## 本地开发与构建

```bash
# 安装依赖（需要 Node.js 与 pnpm）
pnpm install

# 本地运行预览
pnpm run start

# 仅构建前端与主进程代码
pnpm run build

# 打包为免安装单文件 .exe（自动拉齐离线模型并极限压缩）
pnpm run dist
```

---

## 致谢与开源协议

- 本项目基于 [xushengfeng/eSearch](https://github.com/xushengfeng/eSearch) 二次开发，特此致谢原作者及所有上游贡献者。
- 离线 OCR 基于 [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR) / [eSearch-OCR](https://github.com/xushengfeng/eSearch-OCR)，离线翻译基于 Mozilla Firefox [Bergamot](https://github.com/browsermt/bergamot-translator)。
- 本项目遵循 [GPL-3.0](LICENSE) 开源协议。
