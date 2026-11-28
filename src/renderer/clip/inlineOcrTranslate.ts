import { button, ele, select, txt, view } from "dkh-ui";
import store from "../../../lib/store/renderStore";
import { t } from "../../../lib/translate/translate";
import { writeText } from "../lib/clipboard";
import { FreeTranslator, loadTranslator } from "../lib/translate";
import { defaultOcrId, loadOCR } from "../ocr/ocr";
import { Class } from "../root/root";

export type InlineMode = "none" | "ocr" | "translate";

type OcrParagraph = Awaited<
    ReturnType<import("esearch-ocr").initType["ocr"]>
>["columns"][number]["parragraphs"][number];

type Rect = [number, number, number, number];

type LineEraseInfo = {
    x: number;
    y: number;
    w: number;
    h: number;
    bg: [number, number, number];
};

type TranslatedBlock = {
    paragraph: OcrParagraph;
    sourceText: string;
    translatedText: string;
    x: number;
    y: number;
    w: number;
    h: number;
    bg: [number, number, number];
    fg: [number, number, number];
    bgSpread: number;
    lineErases: LineEraseInfo[];
};

const QUICK_TARGET_LANGS = [
    { value: "zh-Hans", name: "简体中文" },
    { value: "zh-Hant", name: "繁体中文" },
    { value: "en", name: "English" },
    { value: "ja", name: "日本語" },
    { value: "ko", name: "한국어" },
    { value: "de", name: "Deutsch" },
    { value: "fr", name: "Français" },
    { value: "ru", name: "Русский" },
    { value: "es", name: "Español" },
];

const INLINE_FONT_STACK =
    '"Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif';

type HostCallbacks = {
    getFinalRect: () => Rect;
    getClipCanvas: () => HTMLCanvasElement;
    src2screenX: (x: number) => number;
    src2screenY: (y: number) => number;
    onStateChange?: (active: boolean) => void;
    openInEditor: () => void;
};

function rgbLuminance([r, g, b]: [number, number, number]) {
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function pickContrastingColor(
    bg: [number, number, number],
    preferred: [number, number, number],
): [number, number, number] {
    const bgLum = rgbLuminance(bg);
    const fgLum = rgbLuminance(preferred);
    if (Math.abs(bgLum - fgLum) >= 0.36) return preferred;
    return bgLum > 0.54 ? [20, 24, 33] : [248, 250, 252];
}

function boxBounds(box: [number, number][]) {
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const [x, y] of box) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
    }
    return {
        x: minX,
        y: minY,
        w: Math.max(1, maxX - minX),
        h: Math.max(1, maxY - minY),
    };
}

function paragraphBounds(p: OcrParagraph) {
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const line of p.src) {
        const b = boxBounds(line.box);
        if (b.x < minX) minX = b.x;
        if (b.y < minY) minY = b.y;
        if (b.x + b.w > maxX) maxX = b.x + b.w;
        if (b.y + b.h > maxY) maxY = b.y + b.h;
    }
    if (!Number.isFinite(minX)) return boxBounds(p.parse.box);
    return {
        x: minX,
        y: minY,
        w: Math.max(1, maxX - minX),
        h: Math.max(1, maxY - minY),
    };
}

function safeColor(
    c: number[] | undefined,
    fallback: [number, number, number],
): [number, number, number] {
    if (Array.isArray(c) && c.length >= 3) {
        return [
            Math.max(0, Math.min(255, Math.round(c[0]))),
            Math.max(0, Math.min(255, Math.round(c[1]))),
            Math.max(0, Math.min(255, Math.round(c[2]))),
        ];
    }
    return fallback;
}

function toRgbCss([r, g, b]: [number, number, number]) {
    return `rgb(${r}, ${g}, ${b})`;
}

function medianOf(arr: number[], fallback: number): number {
    if (arr.length === 0) return fallback;
    const sorted = [...arr].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
}

/** 从原图文字外沿采样真实背景中位数颜色与纹理波动度，避免假底色形成色块框 */
function samplePerimeterBg(
    img: ImageData | null,
    bx: number,
    by: number,
    bw: number,
    bh: number,
    fallback: [number, number, number],
): { bg: [number, number, number]; spread: number } {
    if (!img || img.width <= 0 || img.height <= 0) {
        return { bg: fallback, spread: 0 };
    }
    const { data, width, height } = img;
    const rs: number[] = [];
    const gs: number[] = [];
    const bs: number[] = [];

    const pushPixel = (px: number, py: number) => {
        const cx = Math.max(0, Math.min(width - 1, Math.round(px)));
        const cy = Math.max(0, Math.min(height - 1, Math.round(py)));
        const idx = (cy * width + cx) * 4;
        rs.push(data[idx]);
        gs.push(data[idx + 1]);
        bs.push(data[idx + 2]);
    };

    const stepX = Math.max(1, Math.floor(bw / 20));
    const stepY = Math.max(1, Math.floor(bh / 8));
    for (let x = bx - 2; x <= bx + bw + 2; x += stepX) {
        pushPixel(x, by - 2);
        pushPixel(x, by + bh + 2);
    }
    for (let y = by; y <= by + bh; y += stepY) {
        pushPixel(bx - 2, y);
        pushPixel(bx + bw + 2, y);
    }

    const rMed = medianOf(rs, fallback[0]);
    const gMed = medianOf(gs, fallback[1]);
    const bMed = medianOf(bs, fallback[2]);

    let diffSum = 0;
    for (let i = 0; i < rs.length; i++) {
        diffSum +=
            (Math.abs(rs[i] - rMed) +
                Math.abs(gs[i] - gMed) +
                Math.abs(bs[i] - bMed)) /
            3;
    }
    const spread = rs.length > 0 ? diffSum / rs.length : 0;
    return { bg: [rMed, gMed, bMed], spread };
}

/** 从行内部采样与背景反差最大的真实字色 */
function sampleInteriorFg(
    img: ImageData | null,
    bx: number,
    by: number,
    bw: number,
    bh: number,
    bg: [number, number, number],
    fallback: [number, number, number],
): [number, number, number] {
    if (!img || img.width <= 0 || img.height <= 0) {
        return pickContrastingColor(bg, fallback);
    }
    const { data, width, height } = img;
    const bgLum = rgbLuminance(bg);
    let bestDist = 0;
    let best: [number, number, number] = fallback;
    const x0 = Math.max(0, Math.round(bx));
    const y0 = Math.max(0, Math.round(by));
    const x1 = Math.min(width - 1, Math.round(bx + bw));
    const y1 = Math.min(height - 1, Math.round(by + bh));
    const stepX = Math.max(1, Math.floor((x1 - x0) / 24));
    const stepY = Math.max(1, Math.floor((y1 - y0) / 8));

    for (let y = y0; y <= y1; y += stepY) {
        for (let x = x0; x <= x1; x += stepX) {
            const idx = (y * width + x) * 4;
            const c: [number, number, number] = [
                data[idx],
                data[idx + 1],
                data[idx + 2],
            ];
            const dist = Math.abs(rgbLuminance(c) - bgLum);
            if (dist > bestDist) {
                bestDist = dist;
                best = c;
            }
        }
    }
    return pickContrastingColor(bg, bestDist >= 0.25 ? best : fallback);
}

function wrapCanvasLines(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
) {
    const lines: string[] = [];
    for (const rawLine of text.split(/\r?\n/)) {
        let cur = "";
        for (const ch of Array.from(rawLine)) {
            if (cur && ctx.measureText(cur + ch).width > maxWidth) {
                lines.push(cur);
                cur = ch;
            } else {
                cur += ch;
            }
        }
        if (cur) lines.push(cur);
    }
    return lines.length > 0 ? lines : [text];
}

function computeTranslatedLayout(
    ctx: CanvasRenderingContext2D,
    blk: TranslatedBlock,
) {
    const lineCount = Math.max(1, blk.paragraph.src.length);
    const baseLineH = blk.h / lineCount;
    const areaFont = Math.sqrt(
        (blk.w * blk.h * 0.8) / Math.max(1, blk.translatedText.length),
    );
    let fontSize = Math.max(
        11,
        Math.min(Math.round(baseLineH * 0.85), Math.round(areaFont), 64),
    );
    ctx.font = `500 ${fontSize}px ${INLINE_FONT_STACK}`;
    let lines = wrapCanvasLines(ctx, blk.translatedText, blk.w);
    while (lines.length * fontSize * 1.2 > blk.h * 1.14 && fontSize > 10) {
        fontSize = Math.max(10, Math.floor(fontSize * 0.9));
        ctx.font = `500 ${fontSize}px ${INLINE_FONT_STACK}`;
        lines = wrapCanvasLines(ctx, blk.translatedText, blk.w);
    }
    return { fontSize, lines };
}

/** 无框自然融合绘制：按每行真实局部底色柔边擦除原文字，再直接原位渲染译文（无矩形框、无阴影贴片） */
function paintSeamlessTranslation(
    ctx: CanvasRenderingContext2D,
    blocks: TranslatedBlock[],
) {
    ctx.save();
    for (const blk of blocks) {
        for (const le of blk.lineErases) {
            const fillCss = toRgbCss(le.bg);
            const feather = Math.max(2, Math.min(6, Math.round(le.h * 0.2)));
            const rx = le.x - 1;
            const ry = le.y - 1;
            const rw = le.w + 2;
            const rh = le.h + 2;
            const radius = Math.min(4, rh / 2);

            ctx.save();
            ctx.fillStyle = fillCss;
            ctx.shadowColor = fillCss;
            ctx.shadowBlur = feather;
            ctx.beginPath();
            ctx.roundRect(rx, ry, rw, rh, radius);
            ctx.fill();
            // 二次填实中心笔划，边缘保持羽化自然过渡不留硬框
            ctx.shadowBlur = Math.max(1, Math.round(feather * 0.5));
            ctx.fill();
            ctx.restore();
        }

        const { fontSize, lines } = computeTranslatedLayout(ctx, blk);
        ctx.font = `500 ${fontSize}px ${INLINE_FONT_STACK}`;
        ctx.textBaseline = "top";
        const lineStep = fontSize * 1.2;
        const totalTextH = lines.length * lineStep;
        const startY = blk.y + Math.max(0, (blk.h - totalTextH) / 2);

        if (blk.bgSpread > 20) {
            ctx.strokeStyle = toRgbCss(blk.bg);
            ctx.lineJoin = "round";
            ctx.lineWidth = Math.max(2, fontSize * 0.16);
            for (let i = 0; i < lines.length; i++) {
                ctx.strokeText(lines[i], blk.x, startY + i * lineStep, blk.w);
            }
        }

        ctx.fillStyle = toRgbCss(blk.fg);
        for (let i = 0; i < lines.length; i++) {
            ctx.fillText(lines[i], blk.x, startY + i * lineStep, blk.w);
        }
    }
    ctx.restore();
}

export function createInlineOcrTranslate(host: HostCallbacks) {
    let mode: InlineMode = "none";
    let showOriginalCompare = false;
    let runSeq = 0;

    let ocrInstance: import("esearch-ocr").initType | null = null;
    let ocrInstanceType = "";

    let cachedRectKey = "";
    let cachedCropW = 0;
    let cachedCropH = 0;
    let cachedCropImageData: ImageData | null = null;
    let cachedParagraphs: OcrParagraph[] = [];
    let translatedBlocks: TranslatedBlock[] = [];
    let activeTargetLang =
        store.get("屏幕翻译.语言.to") || store.get("语言.语言") || "zh-Hans";

    const overlayEl = view().attr({ id: "clip_inline_overlay" }).addInto();
    view().class("inline-scan-beam").addInto(overlayEl);
    const contentEl = view()
        .attr({ id: "clip_inline_content" })
        .addInto(overlayEl);
    const barEl = view()
        .attr({ id: "clip_inline_bar" })
        .class(Class.glassBar)
        .addInto();
    const toastEl = view()
        .attr({ id: "clip_inline_toast" })
        .class(Class.glassBar)
        .addInto();

    let toastTimer: ReturnType<typeof setTimeout> | undefined;
    function showToast(msg: string) {
        toastEl.el.textContent = msg;
        toastEl.el.classList.add("show");
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
            toastEl.el.classList.remove("show");
        }, 1600);
    }

    function stopOverlayPointer(ev: Event) {
        ev.stopPropagation();
    }
    for (const evt of ["mousedown", "pointerdown", "dblclick"]) {
        overlayEl.el.addEventListener(evt, stopOverlayPointer);
        barEl.el.addEventListener(evt, stopOverlayPointer);
    }

    function updatePosition() {
        if (mode === "none") return;
        const r = host.getFinalRect();
        const x0 = host.src2screenX(r[0]);
        const y0 = host.src2screenY(r[1]);
        const x1 = host.src2screenX(r[0] + r[2]);
        const y1 = host.src2screenY(r[1] + r[3]);
        const w = Math.max(1, x1 - x0);
        const h = Math.max(1, y1 - y0);

        overlayEl.style({
            left: `${x0}px`,
            top: `${y0}px`,
            width: `${w}px`,
            height: `${h}px`,
        });

        const barH = barEl.el.offsetHeight || 36;
        const barW = barEl.el.offsetWidth || 320;
        const barTop =
            y0 >= barH + 10
                ? y0 - barH - 8
                : Math.min(y0 + 8, window.innerHeight - barH - 8);
        const barLeft = Math.max(8, Math.min(x0, window.innerWidth - barW - 8));
        barEl.style({
            left: `${Math.round(barLeft)}px`,
            top: `${Math.round(barTop)}px`,
        });
    }

    function clear() {
        const wasActive = mode !== "none";
        runSeq++;
        mode = "none";
        showOriginalCompare = false;
        translatedBlocks = [];
        cachedRectKey = "";
        cachedCropImageData = null;
        cachedParagraphs = [];
        overlayEl.el.classList.remove(
            "active",
            "mode-ocr",
            "mode-translate",
            "comparing",
            "scanning",
        );
        barEl.el.classList.remove("active");
        contentEl.clear();
        barEl.clear();
        window.getSelection()?.removeAllRanges();
        if (wasActive) host.onStateChange?.(false);
    }

    async function ensureLocalOcr(ocrType: string) {
        const type = ocrType || defaultOcrId;
        if (ocrInstance && ocrInstanceType === type) return ocrInstance;
        const loaded = loadOCR(store, type);
        if (!loaded) return null;
        ocrInstance = await loaded.ocr.init(loaded.config);
        ocrInstanceType = type;
        return ocrInstance;
    }

    async function recognizeSelection(ocrType: string) {
        const rect = host.getFinalRect();
        const rectKey = `${rect.join(",")}|${ocrType || defaultOcrId}`;
        if (
            cachedRectKey === rectKey &&
            cachedParagraphs.length > 0 &&
            cachedCropImageData
        ) {
            return {
                paragraphs: cachedParagraphs,
                cropW: cachedCropW,
                cropH: cachedCropH,
                cropImg: cachedCropImageData,
            };
        }

        const lo = await ensureLocalOcr(ocrType);
        if (!lo) return null;

        const canvas = host.getClipCanvas();
        const cropW = canvas.width;
        const cropH = canvas.height;
        const cropImg =
            canvas.getContext("2d")?.getImageData(0, 0, cropW, cropH) ?? null;
        const res = await lo.ocr(canvas.toDataURL("image/png"));
        const paragraphs = res.columns
            .flatMap((c) => c.parragraphs)
            .filter((p) => p.parse.text.trim().length > 0);

        cachedRectKey = rectKey;
        cachedCropW = cropW;
        cachedCropH = cropH;
        cachedCropImageData = cropImg;
        cachedParagraphs = paragraphs;
        return { paragraphs, cropW, cropH, cropImg };
    }

    function renderLoadingBar(label: string) {
        overlayEl.el.classList.add("scanning");
        barEl.clear().add([
            view().class("inline-spinner"),
            txt(label).class("inline-status"),
            button("×")
                .class("inline-btn", "inline-btn-close")
                .attr({ title: t("关闭") })
                .on("click", clear),
        ]);
        barEl.el.classList.add("active");
        updatePosition();
    }

    function renderOcrOverlay(
        paragraphs: OcrParagraph[],
        cropW: number,
        cropH: number,
    ) {
        contentEl.clear();
        overlayEl.el.classList.add("active", "mode-ocr");
        overlayEl.el.classList.remove(
            "mode-translate",
            "comparing",
            "scanning",
        );

        const r = host.getFinalRect();
        const displayW = Math.max(
            1,
            host.src2screenX(r[0] + r[2]) - host.src2screenX(r[0]),
        );
        const displayH = Math.max(
            1,
            host.src2screenY(r[1] + r[3]) - host.src2screenY(r[1]),
        );
        const scaleX = displayW / Math.max(1, cropW);
        const scaleY = displayH / Math.max(1, cropH);

        const measureCanvas = document.createElement("canvas");
        const measureCtx = measureCanvas.getContext("2d");

        let lineCount = 0;
        for (const para of paragraphs) {
            for (const line of para.src) {
                const text = line.text?.trim();
                if (!text) continue;
                lineCount++;
                const b = boxBounds(line.box);
                const angle = Math.atan2(
                    line.box[1][1] - line.box[0][1],
                    line.box[1][0] - line.box[0][0],
                );
                const boxW = b.w * scaleX;
                const boxH = b.h * scaleY;
                const fontSize = Math.max(10, Math.round(boxH * 0.86));

                const lineEl = ele("span")
                    .class("inline-ocr-line")
                    .style({
                        left: `${(b.x / cropW) * 100}%`,
                        top: `${(b.y / cropH) * 100}%`,
                        width: `${(b.w / cropW) * 100}%`,
                        height: `${(b.h / cropH) * 100}%`,
                        fontSize: `${fontSize}px`,
                        lineHeight: `${Math.max(12, boxH)}px`,
                    });
                lineEl.el.textContent = text;

                if (measureCtx && boxW > 4) {
                    measureCtx.font = `${fontSize}px ${INLINE_FONT_STACK}`;
                    const measuredW = measureCtx.measureText(text).width;
                    if (measuredW > 2) {
                        const sx = Math.max(
                            0.55,
                            Math.min(1.45, boxW / measuredW),
                        );
                        const rot =
                            Math.abs(angle) > 0.03
                                ? `rotate(${angle}rad) `
                                : "";
                        lineEl.style({
                            transform: `${rot}scaleX(${sx.toFixed(3)})`,
                            transformOrigin: "left top",
                        });
                    }
                }
                contentEl.add(lineEl);
            }
        }

        const allText = paragraphs.map((p) => p.parse.text).join("\n");
        const copyAllBtn = button(t("复制全部"))
            .class("inline-btn", "inline-btn-primary")
            .on("click", async () => {
                if (!allText) return;
                await writeText(allText);
                showToast(`${t("已复制")} ${allText.length} ${t("字")}`);
            });
        const toTranslateBtn = button(t("原地翻译"))
            .class("inline-btn")
            .on("click", () => {
                void runTranslate();
            });
        const toEditorBtn = button(t("主窗编辑"))
            .class("inline-btn")
            .on("click", () => {
                host.openInEditor();
            });
        const closeBtn = button("×")
            .class("inline-btn", "inline-btn-close")
            .attr({ title: t("关闭") })
            .on("click", clear);

        barEl
            .clear()
            .add([
                txt(
                    lineCount > 0
                        ? `${t("已识别")} ${lineCount} ${t("行文字")}`
                        : t("未识别到文字"),
                ).class("inline-status"),
                ...(lineCount > 0 ? [copyAllBtn, toTranslateBtn] : []),
                toEditorBtn,
                closeBtn,
            ]);
        barEl.el.classList.add("active");
        updatePosition();
    }

    function renderTranslateOverlay(
        blocks: TranslatedBlock[],
        cropW: number,
        cropH: number,
        cropImg: ImageData | null,
    ) {
        contentEl.clear();
        overlayEl.el.classList.add("active", "mode-translate");
        overlayEl.el.classList.remove("mode-ocr", "scanning");
        overlayEl.el.classList.toggle("comparing", showOriginalCompare);

        // 直接在原分辨率画布上做无缝擦除与译文绘制，界面预览与复制/保存导出完全一致、无任何外框
        const trCanvas = document.createElement("canvas");
        trCanvas.className = "inline-tr-canvas";
        trCanvas.width = Math.max(1, cropW);
        trCanvas.height = Math.max(1, cropH);
        const trCtx = trCanvas.getContext("2d");
        if (trCtx) {
            if (cropImg) {
                trCtx.putImageData(cropImg, 0, 0);
            } else {
                trCtx.drawImage(host.getClipCanvas(), 0, 0);
            }
            paintSeamlessTranslation(trCtx, blocks);
        }
        contentEl.el.appendChild(trCanvas);

        const r = host.getFinalRect();
        const displayW = Math.max(
            1,
            host.src2screenX(r[0] + r[2]) - host.src2screenX(r[0]),
        );
        const displayH = Math.max(
            1,
            host.src2screenY(r[1] + r[3]) - host.src2screenY(r[1]),
        );
        const scaleX = displayW / Math.max(1, cropW);
        const scaleY = displayH / Math.max(1, cropH);

        // 透明无边框选字层：支持鼠标划选译文复制，不产生任何视觉方框
        for (const blk of blocks) {
            const boxW = Math.max(16, blk.w * scaleX);
            const boxH = Math.max(14, blk.h * scaleY);
            const lineCount = Math.max(1, blk.paragraph.src.length);
            const baseLineH = boxH / lineCount;
            const charCount = Math.max(1, blk.translatedText.length);
            const areaFont = Math.sqrt((boxW * boxH * 0.78) / charCount);
            const fontSize = Math.max(
                10,
                Math.min(
                    Math.round(baseLineH * 0.82),
                    Math.round(areaFont),
                    40,
                ),
            );

            const selectSpan = view()
                .class("inline-tr-select-span")
                .attr({ title: `${t("原文")}：${blk.sourceText}` })
                .style({
                    left: `${(blk.x / cropW) * 100}%`,
                    top: `${(blk.y / cropH) * 100}%`,
                    width: `${(blk.w / cropW) * 100}%`,
                    minHeight: `${(blk.h / cropH) * 100}%`,
                    fontSize: `${fontSize}px`,
                });
            selectSpan.el.textContent = blk.translatedText;
            contentEl.add(selectSpan);
        }

        const langOptions = QUICK_TARGET_LANGS.map((i) => ({
            value: i.value,
            name: i.name,
        }));
        if (!langOptions.some((o) => o.value === activeTargetLang)) {
            langOptions.unshift({
                value: activeTargetLang,
                name: activeTargetLang,
            });
        }
        const langSelect = select(langOptions)
            .class("inline-lang-select")
            .sv(activeTargetLang)
            .on("change", () => {
                activeTargetLang = langSelect.gv;
                store.set("屏幕翻译.语言.to", activeTargetLang);
                void runTranslate();
            });

        const compareBtn = button(
            showOriginalCompare ? t("显示译文") : t("对照原文"),
        )
            .class("inline-btn")
            .on("click", () => {
                showOriginalCompare = !showOriginalCompare;
                overlayEl.el.classList.toggle("comparing", showOriginalCompare);
                compareBtn.el.textContent = showOriginalCompare
                    ? t("显示译文")
                    : t("对照原文");
            });

        const allTranslated = blocks.map((b) => b.translatedText).join("\n");
        const copyBtn = button(t("复制译文"))
            .class("inline-btn", "inline-btn-primary")
            .on("click", async () => {
                if (!allTranslated) return;
                await writeText(allTranslated);
                showToast(t("已复制全部译文"));
            });

        const ocrBtn = button(t("识别选字"))
            .class("inline-btn")
            .on("click", () => {
                void runOcr();
            });

        const closeBtn = button("×")
            .class("inline-btn", "inline-btn-close")
            .attr({ title: t("关闭") })
            .on("click", clear);

        barEl
            .clear()
            .add([
                langSelect,
                compareBtn,
                ...(blocks.length > 0 ? [copyBtn] : []),
                ocrBtn,
                closeBtn,
            ]);
        barEl.el.classList.add("active");
        updatePosition();
    }

    async function translateTexts(texts: string[], targetLang: string) {
        const fromLang = store.get("屏幕翻译.语言.from") || "auto";
        const configured = loadTranslator(store, targetLang);
        if (configured) {
            try {
                return await configured(texts);
            } catch (error) {
                console.warn("主翻译引擎失败，回退内置免费翻译:", error);
            }
        }
        return await new FreeTranslator().run(texts, fromLang, targetLang);
    }

    async function runOcr(ocrType?: string): Promise<boolean> {
        const mySeq = ++runSeq;
        mode = "ocr";
        showOriginalCompare = false;
        host.onStateChange?.(true);
        overlayEl.el.classList.add("active", "mode-ocr");
        overlayEl.el.classList.remove("mode-translate", "comparing");
        contentEl.clear();
        renderLoadingBar(t("正在识别文字..."));

        try {
            const recognized = await recognizeSelection(
                ocrType ?? store.get("OCR.类型") ?? defaultOcrId,
            );
            if (mySeq !== runSeq) return true;
            if (!recognized) {
                clear();
                return false;
            }
            renderOcrOverlay(
                recognized.paragraphs,
                recognized.cropW,
                recognized.cropH,
            );
            return true;
        } catch (error) {
            if (mySeq !== runSeq) return true;
            console.error("原地 OCR 识别失败", error);
            overlayEl.el.classList.remove("scanning");
            barEl
                .clear()
                .add([
                    txt(`${t("识别失败")}：${String(error)}`).class(
                        "inline-status",
                    ),
                    button("×")
                        .class("inline-btn", "inline-btn-close")
                        .on("click", clear),
                ]);
            updatePosition();
            return true;
        }
    }

    async function runTranslate(ocrType?: string): Promise<void> {
        const mySeq = ++runSeq;
        mode = "translate";
        showOriginalCompare = false;
        host.onStateChange?.(true);
        activeTargetLang =
            store.get("屏幕翻译.语言.to") ||
            store.get("语言.语言") ||
            activeTargetLang ||
            "zh-Hans";
        overlayEl.el.classList.add("active", "mode-translate");
        overlayEl.el.classList.remove("mode-ocr", "comparing");
        contentEl.clear();
        renderLoadingBar(t("正在识别并翻译..."));

        try {
            const recognized = await recognizeSelection(
                ocrType ?? store.get("OCR.类型") ?? defaultOcrId,
            );
            if (mySeq !== runSeq) return;
            if (!recognized || recognized.paragraphs.length === 0) {
                translatedBlocks = [];
                overlayEl.el.classList.remove("scanning");
                barEl
                    .clear()
                    .add([
                        txt(t("未识别到可翻译文字")).class("inline-status"),
                        button("×")
                            .class("inline-btn", "inline-btn-close")
                            .on("click", clear),
                    ]);
                updatePosition();
                return;
            }

            renderLoadingBar(t("正在翻译..."));
            const sources = recognized.paragraphs.map((p) => p.parse.text);
            const results = await translateTexts(sources, activeTargetLang);
            if (mySeq !== runSeq) return;

            const cropImg = recognized.cropImg;
            translatedBlocks = recognized.paragraphs.map((p, idx) => {
                const bounds = paragraphBounds(p);
                const firstStyle = p.src[0]?.style;
                const fallbackBg = safeColor(firstStyle?.bg, [245, 247, 250]);
                const fallbackFg = safeColor(firstStyle?.text, [20, 24, 33]);

                const { bg, spread } = samplePerimeterBg(
                    cropImg,
                    bounds.x,
                    bounds.y,
                    bounds.w,
                    bounds.h,
                    fallbackBg,
                );
                const fg = sampleInteriorFg(
                    cropImg,
                    bounds.x,
                    bounds.y,
                    bounds.w,
                    bounds.h,
                    bg,
                    fallbackFg,
                );
                const lineErases: LineEraseInfo[] = p.src.map((line) => {
                    const lb = boxBounds(line.box);
                    const lineFallbackBg = safeColor(line.style?.bg, bg);
                    const sampledLine = samplePerimeterBg(
                        cropImg,
                        lb.x,
                        lb.y,
                        lb.w,
                        lb.h,
                        lineFallbackBg,
                    );
                    return {
                        ...lb,
                        bg: sampledLine.bg,
                    };
                });

                return {
                    paragraph: p,
                    sourceText: sources[idx],
                    translatedText: results[idx] || sources[idx],
                    ...bounds,
                    bg,
                    fg,
                    bgSpread: spread,
                    lineErases:
                        lineErases.length > 0
                            ? lineErases
                            : [{ ...bounds, bg }],
                };
            });

            renderTranslateOverlay(
                translatedBlocks,
                recognized.cropW,
                recognized.cropH,
                cropImg,
            );
        } catch (error) {
            if (mySeq !== runSeq) return;
            console.error("原地翻译失败", error);
            overlayEl.el.classList.remove("scanning");
            const msg = error instanceof Error ? error.message : String(error);
            barEl.clear().add([
                txt(`${t("翻译失败")}：${msg}`).class("inline-status"),
                button(t("重试"))
                    .class("inline-btn")
                    .on("click", () => void runTranslate(ocrType)),
                button("×")
                    .class("inline-btn", "inline-btn-close")
                    .on("click", clear),
            ]);
            updatePosition();
        }
    }

    function drawOntoCanvas(ctx: CanvasRenderingContext2D) {
        if (
            mode !== "translate" ||
            showOriginalCompare ||
            translatedBlocks.length === 0
        ) {
            return;
        }
        paintSeamlessTranslation(ctx, translatedBlocks);
    }

    function tryCopySelectedText(): boolean {
        if (mode === "none") return false;
        const sel = window.getSelection();
        const text = sel?.toString().trim();
        if (text) {
            void writeText(text);
            showToast(t("已复制选中文字"));
            return true;
        }
        return false;
    }

    return {
        runOcr,
        runTranslate,
        clear,
        updatePosition,
        drawOntoCanvas,
        tryCopySelectedText,
        isActive: () => mode !== "none",
        getMode: () => mode,
    };
}
