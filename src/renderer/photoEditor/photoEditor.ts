import chroma from "chroma-js";
import {
    addStyle,
    button,
    check,
    type ElType,
    ele,
    frame,
    image,
    input,
    label,
    noI18n,
    select,
    setTranslate,
    trackPoint,
    txt,
    view,
} from "dkh-ui";
import store from "../../../lib/store/renderStore";
import type { setting } from "../../ShareTypes";
import { writeImage } from "../lib/clipboard";
import { colorPicker } from "../lib/colorPicker";
import {
    clipboardImageFormat,
    encodeCanvasImage,
    type ImageFormat,
    imageFormatMime,
    isImageFormatSupported,
} from "../lib/imageExport";
import { Class, getImgUrl, initStyle, setTitle } from "../root/root";

const { existsSync, writeFileSync } = require("node:fs") as typeof import("fs");
const { join } = require("node:path") as typeof import("path");

import { renderOn, renderSend, renderSendSync } from "../../../lib/ipc";
import { t } from "../../../lib/translate/translate";
import type { IconType } from "../../iconTypes";
import { getOrt, getOrtSessionOptions } from "../lib/ort";
import removeobj from "../lib/removeObj";

function icon(src: IconType, size = 15) {
    return ele("span")
        .class("pun-icon-wrap")
        .style({ width: `${size}px`, height: `${size}px` })
        .add(image(getImgUrl(`${src}.svg`), noI18n("icon")).class("icon"));
}

function alert(m: string) {
    const d = ele("dialog")
        .add(
            view("y")
                .add([
                    txt(t(m), true),
                    button(t("确定"))
                        .class("pun-btn-primary")
                        .on("click", () => {
                            d.remove();
                        })
                        .style({ width: "auto", alignSelf: "flex-end" }),
                ])
                .class(Class.gap),
        )
        .class(Class.glassBar)
        .addInto();
    d.el.showModal();
}

initStyle(store);
setTranslate(t);
setTitle(t("高级编辑"));

type BoxAnnotation = {
    x: number;
    y: number;
    w: number;
    h: number;
    color: string;
    sw: number;
    radius: number;
};

const WECHAT_COLORS = [
    { color: "#fa5151", name: "微信红" },
    { color: "#ffc300", name: "明黄" },
    { color: "#07c160", name: "微信绿" },
    { color: "#10aeff", name: "微信蓝" },
    { color: "#8b5cf6", name: "亮紫" },
    { color: "#111827", name: "深黑" },
    { color: "#ffffff", name: "纯白" },
] as const;

const maskPens: Map<string, { w: number; ps: { x: number; y: number }[] }> =
    new Map();
const boxAnnotations: BoxAnnotation[] = [];
let activeBoxDraft: BoxAnnotation | null = null;
let boxDragOrigin = { x: 0, y: 0 };
let boxColor = "#fa5151";
let boxStrokeWidth = 4;
let boxRadius = 6;
let boxMarkMode = false;

let maskOrt: Awaited<
    ReturnType<typeof import("onnxruntime-node").InferenceSession.create>
> | null = null;

const pz = store.get("高级图片编辑.配置");
const defaultConfig: typeof styleData = {
    name: "0",
    raduis: 0,
    outerRadius: false,
    bgType: "color",
    bgColor: "",
    bgUrl: "",
    "bg.gradient.angle": 0,
    "bg.gradient.repeat": false,
    "bg.gradient.repeatSize": 0,
    "bg.gradient.x": 0,
    "bg.gradient.y": 0,
    "bg.gradient": [],
    "shadow.x": 0,
    "shadow.y": 0,
    "shadow.blur": 0,
    "shadow.color": "",
    "padding.x": 0,
    "padding.y": 0,
    autoPadding: false,
    "transform.rotate": 0,
    "transform.flipX": false,
    "transform.flipY": false,
    "transform.quad": [0, 0, 1, 0, 1, 1, 0, 1],
};
let styleData: setting["高级图片编辑"]["配置"][0] = getStyleData(
    store.get("高级图片编辑.默认配置"),
);

type BuiltinPreset = {
    label: string;
    patch: Partial<typeof defaultConfig>;
};

const BUILTIN_PRESETS: BuiltinPreset[] = [
    {
        label: "原图无框",
        patch: {
            raduis: 0,
            outerRadius: false,
            bgType: "color",
            bgColor: "",
            "shadow.x": 0,
            "shadow.y": 0,
            "shadow.blur": 0,
            "shadow.color": "",
            "padding.x": 0,
            "padding.y": 0,
        },
    },
    {
        label: "极光蓝",
        patch: {
            raduis: 14,
            outerRadius: true,
            bgType: "linear-gradient",
            "bg.gradient.angle": 135,
            "bg.gradient.x": 0.5,
            "bg.gradient.y": 0.5,
            "bg.gradient": [
                { offset: 0, color: "#3b82f6" },
                { offset: 0.55, color: "#6366f1" },
                { offset: 1, color: "#06b6d4" },
            ],
            "shadow.x": 0,
            "shadow.y": 24,
            "shadow.blur": 48,
            "shadow.color": "rgba(15, 23, 42, 0.38)",
            "padding.x": 56,
            "padding.y": 56,
        },
    },
    {
        label: "落日渐变",
        patch: {
            raduis: 14,
            outerRadius: true,
            bgType: "linear-gradient",
            "bg.gradient.angle": 135,
            "bg.gradient.x": 0.5,
            "bg.gradient.y": 0.5,
            "bg.gradient": [
                { offset: 0, color: "#fb7185" },
                { offset: 0.5, color: "#f97316" },
                { offset: 1, color: "#facc15" },
            ],
            "shadow.x": 0,
            "shadow.y": 22,
            "shadow.blur": 44,
            "shadow.color": "rgba(15, 23, 42, 0.32)",
            "padding.x": 52,
            "padding.y": 52,
        },
    },
    {
        label: "暗夜紫",
        patch: {
            raduis: 16,
            outerRadius: true,
            bgType: "linear-gradient",
            "bg.gradient.angle": 145,
            "bg.gradient.x": 0.5,
            "bg.gradient.y": 0.5,
            "bg.gradient": [
                { offset: 0, color: "#0f172a" },
                { offset: 0.55, color: "#312e81" },
                { offset: 1, color: "#7c3aed" },
            ],
            "shadow.x": 0,
            "shadow.y": 26,
            "shadow.blur": 56,
            "shadow.color": "rgba(0, 0, 0, 0.55)",
            "padding.x": 60,
            "padding.y": 60,
        },
    },
    {
        label: "纯白卡片",
        patch: {
            raduis: 12,
            outerRadius: true,
            bgType: "color",
            bgColor: "#f1f5f9",
            "shadow.x": 0,
            "shadow.y": 14,
            "shadow.blur": 32,
            "shadow.color": "rgba(15, 23, 42, 0.16)",
            "padding.x": 40,
            "padding.y": 40,
        },
    },
];

function normalizeStyleData(
    data: setting["高级图片编辑"]["配置"][0] | undefined,
) {
    if (!data) return structuredClone(defaultConfig);
    for (const key in defaultConfig) {
        if (!(key in data)) {
            // @ts-expect-error
            data[key] = structuredClone(defaultConfig[key]);
        }
    }
    return data;
}

function getStyleData(id: string) {
    const data = pz.find((i) => i.name === id);
    return normalizeStyleData(data ? structuredClone(data) : undefined);
}

function sameColor(a: string, b: string) {
    try {
        return (
            chroma(a).hex("rgba").toLowerCase() ===
            chroma(b).hex("rgba").toLowerCase()
        );
    } catch {
        return false;
    }
}

addStyle({
    body: {
        display: "flex",
        height: "100vh",
        overflow: "hidden",
        backgroundColor: "var(--bg)",
        color: "var(--font-color)",
    },
    canvas: {
        maxWidth: "100%",
        maxHeight: "100%",
        transition: "var(--transition)",
    },
    ".pe-sidebar": {
        width: "352px",
        minWidth: "320px",
        maxWidth: "380px",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        backgroundColor: "var(--surface)",
        borderRight: "1px solid var(--border-subtle)",
    },
    ".pe-header": {
        padding: "12px 14px 10px",
        borderBottom: "1px solid var(--border-subtle)",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        flexShrink: 0,
    },
    ".pe-scroll": {
        flex: "1 1 0",
        minHeight: 0,
        overflowY: "auto",
        overflowX: "hidden",
        padding: "10px 12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
    },
    ".pe-footer": {
        padding: "10px 12px 12px",
        borderTop: "1px solid var(--border-subtle)",
        backgroundColor: "var(--surface)",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        flexShrink: 0,
    },
    ".pe-card": {
        backgroundColor: "var(--surface-2)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "12px",
        padding: "10px 11px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
    },
    ".pe-card-head": {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "8px",
    },
    ".pe-card-title": {
        fontSize: "12px",
        fontWeight: 600,
        color: "var(--font-color)",
        letterSpacing: "0.02em",
    },
    ".pe-grid-2": {
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "8px",
    },
    ".pe-grid-3": {
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: "6px",
    },
    ".pe-field": {
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        minWidth: 0,
    },
    ".pe-field-label": {
        fontSize: "11px",
        color: "var(--font-color-l)",
        lineHeight: "1.2",
    },
    ".pe-sidebar input[type='number'], .pe-sidebar input[type='text'], .pe-sidebar select":
        {
            width: "100% !important",
            minWidth: 0,
            height: "30px !important",
            fontSize: "12px",
            borderRadius: "8px",
        },
    ".pe-sidebar .group": {
        width: "100% !important",
        height: "30px !important",
        borderRadius: "8px",
    },
    ".pe-sidebar .group button": {
        width: "30px !important",
        height: "30px !important",
    },
    ".pe-chip": {
        height: "24px !important",
        paddingInline: "8px !important",
        fontSize: "11px !important",
        borderRadius: "999px !important",
        backgroundColor: "var(--surface) !important",
    },
    ".pe-chip.active": {
        backgroundColor: "var(--accent-soft) !important",
        color: "var(--emphasis-color) !important",
        outlineColor: "var(--emphasis-color) !important",
        fontWeight: 600,
    },
    ".pe-dot": {
        width: "20px",
        height: "20px",
        borderRadius: "999px",
        border: "1.5px solid color-mix(in srgb, var(--font-color) 20%, transparent)",
        cursor: "pointer",
        flexShrink: 0,
        transition: "transform 0.14s ease, box-shadow 0.14s ease",
    },
    ".pe-dot:hover": {
        transform: "scale(1.14)",
    },
    ".pe-dot.active": {
        borderColor: "#ffffff",
        boxShadow: "0 0 0 2px var(--emphasis-color)",
        transform: "scale(1.12)",
    },
    ".pe-preview-stage": {
        flex: "1 1 0",
        minWidth: 0,
        position: "relative",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        padding: "56px 28px 24px",
        backgroundImage:
            "radial-gradient(circle at 50% 42%, color-mix(in srgb, var(--emphasis-color) 9%, transparent), transparent 68%)",
    },
    ".pe-stage-bar": {
        position: "absolute",
        top: "14px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 4,
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "5px 12px",
        borderRadius: "999px",
        fontSize: "12px",
        backgroundColor: "var(--bar-bg)",
        backdropFilter: "var(--blur)",
        border: "1px solid var(--glass-border)",
        boxShadow: "var(--shadow-sm)",
        whiteSpace: "nowrap",
    },
    ".pe-canvas-board": {
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        maxWidth: "100%",
        maxHeight: "100%",
        borderRadius: "10px",
        backgroundImage:
            "conic-gradient(color-mix(in srgb, var(--font-color) 7%, transparent) 25%, transparent 0 50%, color-mix(in srgb, var(--font-color) 7%, transparent) 0 75%, transparent 0)",
        backgroundSize: "18px 18px",
        boxShadow: "var(--shadow-lg)",
    },
    ".pe-toggle-pill": {
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        fontSize: "12px",
        cursor: "pointer",
        userSelect: "none",
    },
    ".transform-handle": {
        position: "absolute",
        width: "12px",
        height: "12px",
        borderRadius: "50%",
        border: "2px solid var(--emphasis-color)",
        background: "#ffffff",
        boxSizing: "border-box",
        transform: "translate(-50%, -50%)",
        pointerEvents: "auto",
        cursor: "grab",
        zIndex: 5,
        boxShadow: "0 1px 4px rgba(0, 0, 0, 0.35)",
    },
    ".transform-handle.edge": {
        width: "10px",
        height: "10px",
    },
});

const previewStage = view().class("pe-preview-stage");
const stageTopBar = view("x").class("pe-stage-bar").addInto(previewStage);
const stageDimText = txt(noI18n("0 × 0 px"))
    .style({ fontFamily: "var(--monospace)", fontWeight: 600 })
    .addInto(stageTopBar);
const stageModePill = txt("")
    .class("pun-pill")
    .style({ display: "none" })
    .addInto(stageTopBar);

const canvasBoard = view().class("pe-canvas-board").addInto(previewStage);

const avifSupported = await isImageFormatSupported("avif");

function labeledField(title: string, control: ElType<HTMLElement>) {
    return view("y")
        .class("pe-field")
        .add([txt(title, true).class("pe-field-label"), control]);
}

const boxCustomColorEl = colorPicker({
    width: "100%",
    alpha: false,
    live: true,
}).sv(boxColor);

const els = {
    select: pzSelect().sv(pz.map((i) => getStyleData(i.name))),
    raduis: input("number").attr({ min: "0", step: "1" }),
    outerRadius: label([check(""), "外圆角跟随"]).class("pe-toggle-pill"),
    bgType: select<(typeof styleData)["bgType"]>([
        { value: "color", name: "纯色" },
        { value: "image", name: "图片" },
        { value: "linear-gradient", name: "线性渐变" },
        { value: "radial-gradient", name: "径向渐变" },
        { value: "conic-gradient", name: "圆锥渐变" },
    ])
        .on("input", (_, el) => {
            setBgUI(el.gv);
        })
        .bindSet((v: (typeof styleData)["bgType"], el) => {
            setBgUI(v);
            el.value = v;
        }),
    bgColor: colorPicker({ width: "100%", live: true }),
    bgUrl: input().attr({ placeholder: t("输入图片路径或链接") }),
    bgGradient: flexLayout("y"),
    angle: input("number"),
    gx: input("number").attr({ max: "1", min: "0", step: "0.01" }),
    gy: input("number").attr({ max: "1", min: "0", step: "0.01" }),
    gColors: gColors(),
    sx: input("number"),
    sy: input("number"),
    blur: input("number").attr({ min: "0" }),
    scolor: colorPicker({ width: "100%", live: true }),
    px: input("number").attr({ min: "0" }),
    py: input("number").attr({ min: "0" }),
    rotate: input("number").attr({ step: "1" }),
    flipX: check(""),
    flipY: check(""),
    freeBtn: button("自由透视")
        .class("pe-chip")
        .on("click", () => enterTransformMode()),
    cancelBtn: button("取消")
        .class("pe-chip")
        .style({ display: "none" })
        .on("click", () => cancelTransformMode()),
    applyBtn: button("应用")
        .class("pe-chip", "active")
        .style({ display: "none" })
        .on("click", () => applyTransformMode()),
    resetBtn: button("重置变换")
        .class("pe-chip")
        .on("click", () => resetTransform()),
    transformHint: txt("拖动预览画面四周控制点可进行透视变形").style({
        fontSize: "11px",
        color: "var(--emphasis-color)",
        display: "none",
    }),
    magicPen: label([check(""), "开启魔法橡皮"]).class("pe-toggle-pill"),
    magicPenList: flexLayout("x").style({
        "max-height": "140px",
        "overflow-y": "auto",
    }),
    formart: select([
        { value: "png", name: noI18n("PNG") },
        { value: "jpg", name: noI18n("JPEG") },
        { value: "webp", name: noI18n("WebP") },
        { value: "bmp", name: noI18n("BMP") },
        ...(avifSupported
            ? [{ value: "avif" as const, name: noI18n("AVIF") }]
            : []),
    ]).sv(
        (() => {
            const format = store.get("保存.默认格式");
            if (format === "svg") return "png";
            if (format === "avif" && !avifSupported) return "png";
            return format;
        })(),
    ),
    quality: input("number").attr({ max: "1", min: "0", step: "0.1" }).sv("1"),
    photoW: input("number").attr({ min: "1" }),
    photoH: input("number").attr({ min: "1" }),
};

const boxToggleBtn = button("开启框框标记")
    .class("pe-chip")
    .on("click", () => toggleBoxMarkMode(!boxMarkMode));
const boxUndoBtn = button("撤销框")
    .class("pe-chip")
    .on("click", () => {
        if (boxAnnotations.length === 0) return;
        boxAnnotations.pop();
        updateBoxCountLabel();
        updatePreview();
    });
const boxClearBtn = button("清空")
    .class("pe-chip")
    .on("click", () => {
        if (boxAnnotations.length === 0) return;
        boxAnnotations.length = 0;
        updateBoxCountLabel();
        updatePreview();
    });
const boxCountTxt = txt(noI18n("0 个标记")).style({
    fontSize: "11px",
    color: "var(--font-color-l)",
});

function updateBoxCountLabel() {
    boxCountTxt.sv(noI18n(`${boxAnnotations.length} 个标记`));
}

const boxColorDotEls = WECHAT_COLORS.map((item) => {
    const d = view()
        .class("pe-dot")
        .style({ backgroundColor: item.color })
        .attr({ title: t(item.name) })
        .on("click", () => {
            setBoxColor(item.color);
        });
    return { color: item.color, el: d };
});
function syncBoxColorDots() {
    for (const d of boxColorDotEls) {
        d.el.el.classList.toggle("active", sameColor(d.color, boxColor));
    }
}
function setBoxColor(v: string) {
    boxColor = v;
    boxCustomColorEl.sv(v);
    syncBoxColorDots();
}
boxCustomColorEl.on("input", () => {
    boxColor = boxCustomColorEl.gv;
    syncBoxColorDots();
});
syncBoxColorDots();

const boxWidthBtns = [2, 4, 7].map((sw) => {
    const b = button(noI18n(`${sw}px`))
        .class("pe-chip")
        .on("click", () => {
            boxStrokeWidth = sw;
            syncBoxWidthBtns();
        });
    return { sw, el: b };
});
function syncBoxWidthBtns() {
    for (const item of boxWidthBtns) {
        item.el.el.classList.toggle("active", item.sw === boxStrokeWidth);
    }
}
syncBoxWidthBtns();

const boxRadiusBtns = [0, 6, 12].map((r) => {
    const b = button(noI18n(r === 0 ? "直角" : `R${r}`))
        .class("pe-chip")
        .on("click", () => {
            boxRadius = r;
            syncBoxRadiusBtns();
        });
    return { r, el: b };
});
function syncBoxRadiusBtns() {
    for (const item of boxRadiusBtns) {
        item.el.el.classList.toggle("active", item.r === boxRadius);
    }
}
syncBoxRadiusBtns();

function syncModePills() {
    boxToggleBtn.el.classList.toggle("active", boxMarkMode);
    boxToggleBtn.sv(boxMarkMode ? "标记中（拖拽画框）" : "开启框框标记");
    magicPenPreview.style({
        pointerEvents: els.magicPen.gv || boxMarkMode ? "auto" : "none",
        cursor: boxMarkMode
            ? "crosshair"
            : els.magicPen.gv
              ? "crosshair"
              : "default",
    });
    if (boxMarkMode) {
        stageModePill
            .sv("框框标记中 · 在右侧图片上拖拽添加矩形框")
            .style({ display: "" });
    } else if (transformMode) {
        stageModePill.sv("自由透视变换中").style({ display: "" });
    } else if (els.magicPen.gv) {
        stageModePill.sv("魔法橡皮涂抹中").style({ display: "" });
    } else {
        stageModePill.style({ display: "none" });
    }
}

function toggleBoxMarkMode(next: boolean) {
    boxMarkMode = next;
    if (next) {
        if (transformMode) cancelTransformMode();
        if (els.magicPen.gv) {
            els.magicPen.sv(false);
        }
    }
    updateHandles();
    syncModePills();
}

const controls = frame("sidebar", {
    _: view("y").class("pe-sidebar", Class.smallSize),
    header: {
        _: view("y").class("pe-header"),
        topRow: view("x")
            .style({
                alignItems: "center",
                justifyContent: "space-between",
                gap: "8px",
            })
            .add([
                view("x")
                    .style({ alignItems: "center", gap: "8px" })
                    .add([
                        icon("super_edit", 16),
                        txt("图片高级编辑", true).style({
                            fontSize: "14px",
                            fontWeight: 700,
                        }),
                    ]),
                button([icon("add", 13), txt("存为预设", true)])
                    .class("pe-chip", "pun-no-icon-box")
                    .style({
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                    })
                    .on("click", () => {
                        const id = `${t("预设")}-${crypto.randomUUID().slice(0, 4)}`;
                        const newData = structuredClone(styleData);
                        newData.name = id;
                        pz.unshift(newData);
                        store.set("高级图片编辑.配置", pz);
                        store.set("高级图片编辑.默认配置", id);
                        els.select.sv(pz);
                        applyStyle(newData);
                    }),
            ]),
        builtinRow: view("x", "wrap")
            .style({ gap: "5px" })
            .add(
                BUILTIN_PRESETS.map((preset) =>
                    button(preset.label)
                        .class("pe-chip")
                        .on("click", () => {
                            const merged = normalizeStyleData({
                                ...structuredClone(defaultConfig),
                                ...structuredClone(preset.patch),
                                "transform.rotate":
                                    styleData["transform.rotate"],
                                "transform.flipX": styleData["transform.flipX"],
                                "transform.flipY": styleData["transform.flipY"],
                                "transform.quad": [
                                    ...styleData["transform.quad"],
                                ],
                            });
                            applyStyle(merged);
                        }),
                ),
            ),
        customRow: els.select,
    },
    controls: {
        _: view("y").class("pe-scroll"),
        boxMark: view("y")
            .class("pe-card")
            .add([
                view("x")
                    .class("pe-card-head")
                    .add([
                        txt("框框标记（微信风格）", true).class(
                            "pe-card-title",
                        ),
                        boxCountTxt,
                    ]),
                view("x", "wrap")
                    .style({ gap: "6px", alignItems: "center" })
                    .add([boxToggleBtn, boxUndoBtn, boxClearBtn]),
                view("x")
                    .style({
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "6px",
                    })
                    .add(boxColorDotEls.map((d) => d.el)),
                labeledField("自定义框颜色", boxCustomColorEl),
                view("x")
                    .style({ gap: "10px", flexWrap: "wrap" })
                    .add([
                        view("x")
                            .style({ gap: "4px", alignItems: "center" })
                            .add([
                                txt("粗细", true).class("pe-field-label"),
                                ...boxWidthBtns.map((b) => b.el),
                            ]),
                        view("x")
                            .style({ gap: "4px", alignItems: "center" })
                            .add([
                                txt("角", true).class("pe-field-label"),
                                ...boxRadiusBtns.map((b) => b.el),
                            ]),
                    ]),
            ]),
        appearance: view("y")
            .class("pe-card")
            .add([
                view("x")
                    .class("pe-card-head")
                    .add([
                        txt("圆角与边距", true).class("pe-card-title"),
                        els.outerRadius,
                    ]),
                view()
                    .class("pe-grid-2")
                    .add([
                        labeledField("图片圆角 (px)", els.raduis),
                        view("y")
                            .class("pe-field")
                            .add([
                                txt("快捷圆角", true).class("pe-field-label"),
                                view("x")
                                    .style({ gap: "4px" })
                                    .add(
                                        [0, 12, 24].map((r) =>
                                            button(noI18n(`${r}`))
                                                .class("pe-chip")
                                                .on("click", () => {
                                                    styleData.raduis = r;
                                                    els.raduis.sv(String(r));
                                                    updatePreview();
                                                }),
                                        ),
                                    ),
                            ]),
                    ]),
                view()
                    .class("pe-grid-2")
                    .add([
                        labeledField("左右边距 (X)", els.px),
                        labeledField("上下边距 (Y)", els.py),
                    ]),
                view("x")
                    .style({ gap: "4px", alignItems: "center" })
                    .add([
                        txt("快捷边距", true).class("pe-field-label"),
                        ...[0, 32, 64, 96].map((padVal) =>
                            button(noI18n(`${padVal}`))
                                .class("pe-chip")
                                .on("click", () => {
                                    styleData["padding.x"] = padVal;
                                    styleData["padding.y"] = padVal;
                                    els.px.sv(String(padVal));
                                    els.py.sv(String(padVal));
                                    updatePreview();
                                }),
                        ),
                    ]),
            ]),
        background: view("y")
            .class("pe-card")
            .add([
                view("x")
                    .class("pe-card-head")
                    .add([txt("背景画布", true).class("pe-card-title")]),
                labeledField("填充模式", els.bgType),
                els.bgColor,
                els.bgUrl,
                els.bgGradient.add([
                    view()
                        .class("pe-grid-3")
                        .add([
                            labeledField("角度", els.angle),
                            labeledField("中心 X", els.gx),
                            labeledField("中心 Y", els.gy),
                        ]),
                    els.gColors,
                ]),
            ]),
        shadow: view("y")
            .class("pe-card")
            .add([
                view("x")
                    .class("pe-card-head")
                    .add([txt("投影与阴影", true).class("pe-card-title")]),
                view()
                    .class("pe-grid-2")
                    .add([
                        labeledField("水平 X", els.sx),
                        labeledField("垂直 Y", els.sy),
                        labeledField("模糊半径", els.blur),
                        labeledField("阴影颜色", els.scolor),
                    ]),
            ]),
        transform: view("y")
            .class("pe-card")
            .add([
                view("x")
                    .class("pe-card-head")
                    .add([
                        txt("旋转与透视", true).class("pe-card-title"),
                        view("x")
                            .style({ gap: "4px" })
                            .add([
                                button(noI18n("↺"))
                                    .class("pe-chip")
                                    .attr({ title: "逆时针旋转90°" })
                                    .on("click", () => addRotate(-90)),
                                button(noI18n("↻"))
                                    .class("pe-chip")
                                    .attr({ title: "顺时针旋转90°" })
                                    .on("click", () => addRotate(90)),
                            ]),
                    ]),
                view()
                    .class("pe-grid-2")
                    .add([
                        labeledField("旋转角度 (°)", els.rotate),
                        view("y")
                            .style({ gap: "5px", justifyContent: "flex-end" })
                            .add([
                                label([els.flipX, "水平翻转"]).class(
                                    "pe-toggle-pill",
                                ),
                                label([els.flipY, "垂直翻转"]).class(
                                    "pe-toggle-pill",
                                ),
                            ]),
                    ]),
                view("x", "wrap")
                    .style({ gap: "6px" })
                    .add([
                        els.freeBtn,
                        els.cancelBtn,
                        els.applyBtn,
                        els.resetBtn,
                    ]),
                els.transformHint,
            ]),
        magic: view("y")
            .class("pe-card")
            .add([
                view("x")
                    .class("pe-card-head")
                    .add([
                        txt("魔法消除", true).class("pe-card-title"),
                        els.magicPen,
                    ]),
                els.magicPenList,
            ]),
    },
    export: {
        _: view("y").class("pe-footer"),
        formatRow: view()
            .class("pe-grid-2")
            .add([
                labeledField("导出格式", els.formart),
                labeledField("图像质量", els.quality),
            ]),
        sizeRow: view("x")
            .style({ gap: "6px", alignItems: "flex-end" })
            .add([
                labeledField("输出宽", els.photoW).style({ flex: "1 1 0" }),
                txt(noI18n("×")).style({
                    paddingBottom: "6px",
                    opacity: 0.6,
                }),
                labeledField("输出高", els.photoH).style({ flex: "1 1 0" }),
                button("等比")
                    .class("pe-chip")
                    .attr({ title: "按当前宽高比匹配高度" })
                    .style({ marginBottom: "3px" })
                    .on("click", () => autoScale("height")),
            ]),
        scaleRow: view("x", "wrap")
            .style({ gap: "4px" })
            .add([
                button("原始")
                    .class("pe-chip")
                    .on("click", () => scale(1)),
                button(noI18n("3/4"))
                    .class("pe-chip")
                    .on("click", () => scale(0.75)),
                button(noI18n("1/2"))
                    .class("pe-chip")
                    .on("click", () => scale(0.5)),
                button(noI18n("1/3"))
                    .class("pe-chip")
                    .on("click", () => scale(0.333)),
                button(noI18n("1/4"))
                    .class("pe-chip")
                    .on("click", () => scale(0.25)),
            ]),
        actionRow: view("x")
            .style({ gap: "8px", marginTop: "2px" })
            .add([
                button([icon("save", 15), txt("保存文件", true)])
                    .class("pun-no-icon-box")
                    .style({
                        flex: "1 1 0",
                        height: "36px",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px",
                        fontWeight: 500,
                    })
                    .on("click", async () => {
                        const path = renderSendSync("save_file_path", [
                            els.formart.gv,
                        ]);
                        if (!path) return;
                        try {
                            writeFileSync(path, await getImgBytes());
                        } catch (e) {
                            console.error("保存失败", e);
                            return;
                        }
                        renderSend("ok_save", [path]);
                        renderSend("windowClose", []);
                    }),
                button([icon("copy", 15), txt("复制完成", true)])
                    .class("pun-no-icon-box", "pun-btn-primary")
                    .style({
                        flex: "1.2 1 0",
                        height: "36px",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px",
                    })
                    .on("click", async () => {
                        const format = clipboardImageFormat(
                            els.formart.gv as ImageFormat,
                        );
                        try {
                            const img = await getImgBytes(format);
                            await writeImage(
                                new Blob([img], {
                                    type: imageFormatMime[format],
                                }),
                            );
                        } catch (e) {
                            console.error("复制失败", e);
                            return;
                        }
                        renderSend("windowClose", []);
                    }),
            ]),
    },
});

function flexLayout(a: "x" | "y") {
    return (a === "x" ? view(a, "wrap") : view(a)).class(Class.gap);
}

function pzSelect() {
    const el = flexLayout("x").style({ gap: "5px" });
    return el.bindSet((pz: setting["高级图片编辑"]["配置"]) => {
        el.clear().add(
            pz.map((i) =>
                view("x")
                    .style({
                        alignItems: "center",
                        gap: "2px",
                        backgroundColor: "var(--surface-2)",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: "999px",
                        paddingLeft: "8px",
                        paddingRight: "2px",
                        height: "24px",
                    })
                    .add(
                        txt(i.name)
                            .style({ fontSize: "11px", cursor: "pointer" })
                            .on("click", () => {
                                applyStyle(i);
                            }),
                    )
                    .add(
                        button(icon("close", 11))
                            .class("pun-no-icon-box")
                            .style({
                                width: "20px",
                                height: "20px",
                                padding: 0,
                                borderRadius: "999px",
                                background: "transparent",
                                outline: "none",
                                border: "none",
                            })
                            .on("click", () => {
                                pz.splice(
                                    pz.findIndex((x) => x.name === i.name),
                                    1,
                                );
                                store.set("高级图片编辑.配置", pz);
                                store.set(
                                    "高级图片编辑.默认配置",
                                    pz[0]?.name ?? "",
                                );
                                els.select.sv(pz);
                            }),
                    ),
            ),
        );
    });
}

function applyStyle(i: setting["高级图片编辑"]["配置"][0]) {
    exitTransformMode();
    styleData = normalizeStyleData(structuredClone(i));
    setConfig();
    updatePreview();
}

function setBgUI(type: (typeof styleData)["bgType"]) {
    if (type === "image") {
        els.bgUrl.style({ display: "" });
        els.bgGradient.style({ display: "none" });
        els.bgColor.style({ display: "none" });
    } else if (type === "color") {
        els.bgUrl.style({ display: "none" });
        els.bgGradient.style({ display: "none" });
        els.bgColor.style({ display: "" });
    } else {
        els.bgUrl.style({ display: "none" });
        els.bgGradient.style({ display: "" });
        els.bgColor.style({ display: "none" });
    }
}

function scale(num: number) {
    els.photoH.sv(String(Math.round(canvas.el.height * num)));
    els.photoW.sv(String(Math.round(canvas.el.width * num)));
}

function autoScale(type: "width" | "height") {
    const sw = canvas.el.width;
    const sh = canvas.el.height;
    const wEl = els.photoW;
    const hEl = els.photoH;
    if (type === "width") {
        wEl.sv(String(Math.round((Number(hEl.gv) / sh) * sw)));
    } else {
        hEl.sv(String(Math.round((Number(wEl.gv) / sw) * sh)));
    }
}

function getImgBytes(format: ImageFormat = els.formart.gv as ImageFormat) {
    const x = ele("canvas").attr({
        width: Number(els.photoW.gv),
        height: Number(els.photoH.gv),
    }).el;
    const ctx = x.getContext("2d");
    if (!ctx) throw new Error("canvas context is null");
    ctx.drawImage(
        canvas.el,
        0,
        0,
        canvas.el.width,
        canvas.el.height,
        0,
        0,
        x.width,
        x.height,
    );
    return encodeCanvasImage(x, format, Number(els.quality.gv));
}

function gColors() {
    const div = flexLayout("y");
    const list = flexLayout("y");
    const add = button(noI18n("+ 添加渐变色标")).class("pe-chip");
    const rows = new Map<
        HTMLElement,
        {
            color: ReturnType<typeof colorPicker>;
            offset: ReturnType<typeof input>;
        }
    >();

    function createI(color: string, offset: number) {
        const colorEl = colorPicker({
            width: "100%",
            live: true,
        }).sv(color);
        const offsetEl = input("number")
            .attr({ max: "1", min: "0", step: "0.01" })
            .sv(String(offset));
        const el = view("x")
            .style({ gap: "5px", alignItems: "center", width: "100%" })
            .add([
                view().style({ flex: "1.4 1 0", minWidth: 0 }).add(colorEl),
                view().style({ flex: "0.8 1 0", minWidth: 0 }).add(offsetEl),
                button(noI18n("×"))
                    .style({ width: "28px", height: "28px", padding: 0 })
                    .on("click", () => {
                        rows.delete(el.el);
                        el.remove();
                        binput();
                    }),
            ]);
        colorEl.on("input", binput);
        offsetEl.on("input", binput);
        rows.set(el.el, { color: colorEl, offset: offsetEl });
        return el;
    }

    add.on("click", () => {
        list.add(createI("#3b82f6", 0.5));
    });

    function binput() {
        div.el.dispatchEvent(new Event("input"));
    }

    return div
        .add([list, add])
        .bindGet(() => {
            return Array.from(rows.values()).map(({ color, offset }) => ({
                offset: Number(offset.gv),
                color: color.gv,
            }));
        })
        .bindSet((v: (typeof styleData)["bg.gradient"]) => {
            rows.clear();
            list.clear();
            for (const item of v) {
                list.add(createI(item.color, item.offset));
            }
        });
}

const canvas = ele("canvas");
const magicPenPreview = ele("canvas").style({
    pointerEvents: "none",
    transition: "none",
    boxShadow: "none",
});
const magicPenPreviewCtx = magicPenPreview.el.getContext("2d")!;

canvasBoard.add([canvas, magicPenPreview]);

const handlesEl = view().style({
    position: "absolute",
    inset: "0",
    pointerEvents: "none",
});
const handleEls = Array.from({ length: 8 }, (_, i) => {
    const kind = i < 4 ? "corner" : "edge";
    const index = i < 4 ? i : i - 4;
    const el = view()
        .class("transform-handle")
        .class(kind === "edge" ? "edge" : "")
        .style({ display: "none" });
    trackPoint(el, {
        start: (e) => {
            const state = beginCornerDrag(kind, index);
            if (!state) return null;
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            return { x: e.clientX, y: e.clientY, data: state };
        },
        ing: (point, _e, { startData }) => {
            moveCornerDrag(startData, point.x, point.y);
        },
        end: () => {
            endCornerDrag();
        },
    });
    handlesEl.add(el);
    return el;
});
previewStage.add(handlesEl);

window.addEventListener("resize", () => syncOverlayPositions());
new ResizeObserver(() => syncOverlayPositions()).observe(canvas.el);
window.addEventListener("pointercancel", () => {
    if (activeDrag) endCornerDrag();
});
window.addEventListener("blur", () => {
    if (activeDrag) endCornerDrag();
});
els.magicPen.on("input", () => {
    if (els.magicPen.gv && boxMarkMode) {
        boxMarkMode = false;
    }
    updateHandles();
    syncModePills();
});

const configMap: Partial<
    Record<
        keyof typeof els,
        {
            path: keyof typeof styleData;
            parse?: (v: string) => unknown;
            init?: (v: unknown) => string;
        }
    >
> = {
    raduis: { path: "raduis", parse: Number },
    outerRadius: { path: "outerRadius" },
    bgType: { path: "bgType" },
    bgColor: { path: "bgColor" },
    bgUrl: { path: "bgUrl" },
    angle: { path: "bg.gradient.angle", parse: Number },
    gx: { path: "bg.gradient.x", parse: Number },
    gy: { path: "bg.gradient.y", parse: Number },
    gColors: { path: "bg.gradient" },
    sx: { path: "shadow.x", parse: Number },
    sy: { path: "shadow.y", parse: Number },
    blur: { path: "shadow.blur", parse: Number },
    scolor: { path: "shadow.color" },
    px: { path: "padding.x", parse: Number },
    py: { path: "padding.y", parse: Number },
    rotate: { path: "transform.rotate", parse: Number },
    flipX: { path: "transform.flipX" },
    flipY: { path: "transform.flipY" },
};

let photoSrc: HTMLImageElement | null = null;
let photo: HTMLImageElement | null = null;
let lastCanvasWidth = 0;
let lastCanvasHeight = 0;
let bgImgCache: HTMLImageElement | null = null;
let bgImgCacheUrl = "";
let bgImgLoadingUrl = "";
let bgImgFailedUrl = "";

let photoLayer: HTMLCanvasElement | null = null;
let photoLayerPhoto: HTMLImageElement | null = null;
let photoLayerRadius = -1;
let photoLayerMarkKey = "";

function drawAnnotationsOnLayer(ctx: CanvasRenderingContext2D) {
    for (const box of boxAnnotations) {
        ctx.save();
        ctx.strokeStyle = box.color;
        ctx.lineWidth = box.sw;
        ctx.lineJoin = "round";
        ctx.beginPath();
        if (box.radius > 0) {
            ctx.roundRect(box.x, box.y, box.w, box.h, box.radius);
        } else {
            ctx.rect(box.x, box.y, box.w, box.h);
        }
        ctx.stroke();
        ctx.restore();
    }
}

function getPhotoLayer(img: HTMLImageElement, radius: number) {
    const markKey = JSON.stringify(boxAnnotations);
    if (
        photoLayer &&
        photoLayerPhoto === img &&
        photoLayerRadius === radius &&
        photoLayerMarkKey === markKey
    ) {
        return photoLayer;
    }
    const layer = document.createElement("canvas");
    layer.width = img.naturalWidth;
    layer.height = img.naturalHeight;
    const ctx = layer.getContext("2d");
    if (!ctx) throw new Error("canvas context is null");
    ctx.beginPath();
    ctx.roundRect(0, 0, layer.width, layer.height, radius);
    ctx.clip();
    ctx.drawImage(img, 0, 0);
    if (boxAnnotations.length > 0) {
        drawAnnotationsOnLayer(ctx);
    }
    photoLayer = layer;
    photoLayerPhoto = img;
    photoLayerRadius = radius;
    photoLayerMarkKey = markKey;
    return layer;
}

function setConfig() {
    if (configMap === undefined) return;
    for (const key in configMap) {
        const k = key as keyof typeof configMap;
        const el = els[k];
        // @ts-ignore
        const value = configMap[k].init
            ? // @ts-ignore
              configMap[k].init(styleData[configMap[k].path])
            : // @ts-ignore
              styleData[configMap[k].path];
        // @ts-ignore
        el.sv(value);
    }
}

function getBaseMatrix(photoWidth: number, photoHeight: number) {
    return new DOMMatrix()
        .translate(photoWidth / 2, photoHeight / 2)
        .rotate(styleData["transform.rotate"])
        .scale(
            styleData["transform.flipX"] ? -1 : 1,
            styleData["transform.flipY"] ? -1 : 1,
        );
}

function getTransformMatrix(photoWidth: number, photoHeight: number) {
    return getBaseMatrix(photoWidth, photoHeight).translate(
        -photoWidth / 2,
        -photoHeight / 2,
    );
}

function getQuadPx(photoWidth: number, photoHeight: number) {
    const q = styleData["transform.quad"];
    return [
        new DOMPoint(q[0] * photoWidth, q[1] * photoHeight),
        new DOMPoint(q[2] * photoWidth, q[3] * photoHeight),
        new DOMPoint(q[4] * photoWidth, q[5] * photoHeight),
        new DOMPoint(q[6] * photoWidth, q[7] * photoHeight),
    ];
}

function getStageQuad(photoWidth: number, photoHeight: number) {
    const matrix = getTransformMatrix(photoWidth, photoHeight);
    return getQuadPx(photoWidth, photoHeight).map((p) =>
        matrix.transformPoint(p),
    );
}

function isParallelogram(q: DOMPoint[]) {
    const x = Math.abs(q[0].x + q[2].x - q[1].x - q[3].x);
    const y = Math.abs(q[0].y + q[2].y - q[1].y - q[3].y);
    return x < 0.1 && y < 0.1;
}

function getAffineDraw(
    photoWidth: number,
    photoHeight: number,
    quad: DOMPoint[],
) {
    const [p0, p1, , p3] = quad;
    return new DOMMatrix([
        (p1.x - p0.x) / photoWidth,
        (p1.y - p0.y) / photoWidth,
        (p3.x - p0.x) / photoHeight,
        (p3.y - p0.y) / photoHeight,
        p0.x,
        p0.y,
    ]);
}

function getPhotoLayout(
    photoWidth: number,
    photoHeight: number,
    padX: number,
    padY: number,
) {
    const stageQuad = getStageQuad(photoWidth, photoHeight);
    const finalWidth = Math.max(1, Math.ceil(photoWidth + 2 * padX));
    const finalHeight = Math.max(1, Math.ceil(photoHeight + 2 * padY));
    const offX = padX;
    const offY = padY;
    const canvasQuad = stageQuad.map(
        (p) => new DOMPoint(p.x + offX, p.y + offY),
    );
    const affineDraw = isParallelogram(canvasQuad)
        ? getAffineDraw(photoWidth, photoHeight, canvasQuad)
        : null;
    return {
        canvasQuad,
        affineDraw,
        offX,
        offY,
        finalWidth,
        finalHeight,
    };
}

type CornerDragState = {
    kind: "corner" | "edge";
    index: number;
    quad: number[];
    matrixInverse: DOMMatrix;
    rect: DOMRect;
    scaleX: number;
    scaleY: number;
    offX: number;
    offY: number;
    photoWidth: number;
    photoHeight: number;
    edge: [number, number] | null;
};

let activeDrag: CornerDragState | null = null;

function getPad() {
    return styleData.autoPadding
        ? { x: 0, y: 0 }
        : { x: styleData["padding.x"], y: styleData["padding.y"] };
}

function canvasPointToPhotoPoint(canvasX: number, canvasY: number) {
    if (!photo) return null;
    const w = photo.naturalWidth;
    const h = photo.naturalHeight;
    const pad = getPad();
    const layout = getPhotoLayout(w, h, pad.x, pad.y);
    const matrix = layout.affineDraw;
    if (!matrix) {
        return {
            x: Math.max(0, Math.min(w, canvasX - layout.offX)),
            y: Math.max(0, Math.min(h, canvasY - layout.offY)),
        };
    }
    const pt = matrix.inverse().transformPoint(new DOMPoint(canvasX, canvasY));
    return {
        x: Math.max(0, Math.min(w, pt.x)),
        y: Math.max(0, Math.min(h, pt.y)),
    };
}

function beginCornerDrag(
    kind: "corner" | "edge",
    index: number,
): CornerDragState | null {
    if (!photo) return null;
    const photoWidth = photo.naturalWidth;
    const photoHeight = photo.naturalHeight;
    const pad = getPad();
    const layout = getPhotoLayout(photoWidth, photoHeight, pad.x, pad.y);
    const rect = canvas.el.getBoundingClientRect();
    const scaleX = rect.width / canvas.el.width;
    const scaleY = rect.height / canvas.el.height;

    const matrix = getTransformMatrix(photoWidth, photoHeight);
    const det = matrix.a * matrix.d - matrix.b * matrix.c;
    if (Math.abs(det) < 1e-9) return null;

    const state: CornerDragState = {
        kind,
        index,
        quad: [...styleData["transform.quad"]],
        matrixInverse: matrix.inverse(),
        rect,
        scaleX,
        scaleY,
        offX: layout.offX,
        offY: layout.offY,
        photoWidth,
        photoHeight,
        edge: kind === "edge" ? [index, (index + 1) % 4] : null,
    };
    activeDrag = state;
    return state;
}

function moveCornerDrag(
    state: CornerDragState,
    clientX: number,
    clientY: number,
) {
    const canvasX = (clientX - state.rect.left) / state.scaleX;
    const canvasY = (clientY - state.rect.top) / state.scaleY;
    const point = state.matrixInverse.transformPoint(
        new DOMPoint(canvasX - state.offX, canvasY - state.offY),
    );
    const x = point.x / state.photoWidth;
    const y = point.y / state.photoHeight;
    const quad = [...state.quad];

    if (state.kind === "corner") {
        quad[state.index * 2] = round(x);
        quad[state.index * 2 + 1] = round(y);
    } else {
        const edge = state.edge;
        if (!edge) return;
        const [a, b] = edge;
        const mx = (quad[a * 2] + quad[b * 2]) / 2;
        const my = (quad[a * 2 + 1] + quad[b * 2 + 1]) / 2;
        const dx = x - mx;
        const dy = y - my;
        quad[a * 2] = round(quad[a * 2] + dx);
        quad[a * 2 + 1] = round(quad[a * 2 + 1] + dy);
        quad[b * 2] = round(quad[b * 2] + dx);
        quad[b * 2 + 1] = round(quad[b * 2 + 1] + dy);
    }
    if (quad.some((v) => !Number.isFinite(v) || v < -4 || v > 5)) return;
    if (!isConvexQuad(quad)) return;

    styleData["transform.quad"] = quad as (typeof styleData)["transform.quad"];
    updatePreview();
}

function endCornerDrag() {
    activeDrag = null;
    updatePreview();
}

function isConvexQuad(quad: number[]) {
    const p = [0, 1, 2, 3].map(
        (i) => new DOMPoint(quad[i * 2], quad[i * 2 + 1]),
    );
    let sign = 0;
    for (let i = 0; i < 4; i++) {
        const a = p[i];
        const b = p[(i + 1) % 4];
        const c = p[(i + 2) % 4];
        const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
        if (Math.abs(cross) < 1e-9) return false;
        const s = Math.sign(cross);
        if (sign === 0) sign = s;
        else if (s !== sign) return false;
    }
    return true;
}

type Homography = [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
];

function getQuadHomography(quad: DOMPoint[]): Homography {
    const [p0, p1, p2, p3] = quad;
    const dx1 = p1.x - p2.x;
    const dx2 = p3.x - p2.x;
    const dx3 = p0.x - p1.x + p2.x - p3.x;
    const dy1 = p1.y - p2.y;
    const dy2 = p3.y - p2.y;
    const dy3 = p0.y - p1.y + p2.y - p3.y;
    if (Math.abs(dx3) < 1e-9 && Math.abs(dy3) < 1e-9) {
        return [
            p1.x - p0.x,
            p3.x - p0.x,
            p0.x,
            p1.y - p0.y,
            p3.y - p0.y,
            p0.y,
            0,
            0,
        ];
    }
    const den = dx1 * dy2 - dx2 * dy1;
    if (Math.abs(den) < 1e-12) {
        return [
            p1.x - p0.x,
            p3.x - p0.x,
            p0.x,
            p1.y - p0.y,
            p3.y - p0.y,
            p0.y,
            0,
            0,
        ];
    }
    const h31 = (dx3 * dy2 - dx2 * dy3) / den;
    const h32 = (dx1 * dy3 - dx3 * dy1) / den;
    return [
        p1.x - p0.x + h31 * p1.x,
        p3.x - p0.x + h32 * p3.x,
        p0.x,
        p1.y - p0.y + h31 * p1.y,
        p3.y - p0.y + h32 * p3.y,
        p0.y,
        h31,
        h32,
    ];
}

function applyHomography(h: Homography, u: number, v: number) {
    const w = h[6] * u + h[7] * v + 1;
    return new DOMPoint(
        (h[0] * u + h[1] * v + h[2]) / w,
        (h[3] * u + h[4] * v + h[5]) / w,
    );
}

function drawPerspective(
    targetCtx: CanvasRenderingContext2D,
    quad: DOMPoint[],
    layer: HTMLCanvasElement,
    sourceWidth: number,
    sourceHeight: number,
    targetWidth: number,
    targetHeight: number,
    shadowScale: number,
) {
    warpCanvas.width = targetWidth;
    warpCanvas.height = targetHeight;
    const ctx = warpCanvas.getContext("2d");
    if (!ctx) throw new Error("canvas context is null");
    ctx.clearRect(0, 0, targetWidth, targetHeight);

    const n = Math.min(
        24,
        Math.max(8, Math.ceil(Math.max(targetWidth, targetHeight) / 64)),
    );
    meshWarp(
        ctx,
        layer,
        [sourceWidth, 0, 0, 0, sourceHeight, 0, 0, 0],
        getQuadHomography(quad),
        n,
    );

    targetCtx.save();
    targetCtx.globalCompositeOperation = "source-over";
    targetCtx.shadowColor = styleData["shadow.color"] || "transparent";
    targetCtx.shadowOffsetX = styleData["shadow.x"] * shadowScale;
    targetCtx.shadowOffsetY = styleData["shadow.y"] * shadowScale;
    targetCtx.shadowBlur = styleData["shadow.blur"] * shadowScale;
    targetCtx.drawImage(warpCanvas, 0, 0);
    targetCtx.restore();
}

function meshWarp(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    img: HTMLCanvasElement | OffscreenCanvas,
    srcH: Homography,
    dstH: Homography,
    n: number,
) {
    const srcPoints: DOMPoint[][] = [];
    const dstPoints: DOMPoint[][] = [];
    for (let j = 0; j <= n; j++) {
        const srcRow: DOMPoint[] = [];
        const dstRow: DOMPoint[] = [];
        for (let i = 0; i <= n; i++) {
            const u = i / n;
            const v = j / n;
            srcRow.push(applyHomography(srcH, u, v));
            dstRow.push(applyHomography(dstH, u, v));
        }
        srcPoints.push(srcRow);
        dstPoints.push(dstRow);
    }
    for (let j = 0; j < n; j++) {
        for (let i = 0; i < n; i++) {
            const s00 = srcPoints[j][i];
            const s10 = srcPoints[j][i + 1];
            const s01 = srcPoints[j + 1][i];
            const s11 = srcPoints[j + 1][i + 1];
            const d00 = dstPoints[j][i];
            const d10 = dstPoints[j][i + 1];
            const d01 = dstPoints[j + 1][i];
            const d11 = dstPoints[j + 1][i + 1];
            drawTriangle(ctx, img, s00, s10, s01, d00, d10, d01);
            drawTriangle(ctx, img, s10, s11, s01, d10, d11, d01);
        }
    }
}

function drawTriangle(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    img: HTMLCanvasElement | OffscreenCanvas,
    s0: DOMPoint,
    s1: DOMPoint,
    s2: DOMPoint,
    d0: DOMPoint,
    d1: DOMPoint,
    d2: DOMPoint,
) {
    const minX = Math.max(0, Math.floor(Math.min(s0.x, s1.x, s2.x)));
    const minY = Math.max(0, Math.floor(Math.min(s0.y, s1.y, s2.y)));
    const maxX = Math.min(img.width, Math.ceil(Math.max(s0.x, s1.x, s2.x)));
    const maxY = Math.min(img.height, Math.ceil(Math.max(s0.y, s1.y, s2.y)));
    if (maxX <= minX || maxY <= minY) return;

    const x1 = s1.x - s0.x;
    const y1 = s1.y - s0.y;
    const x2 = s2.x - s0.x;
    const y2 = s2.y - s0.y;
    const det = x1 * y2 - x2 * y1;
    if (Math.abs(det) < 1e-9) return;
    const X1 = d1.x - d0.x;
    const Y1 = d1.y - d0.y;
    const X2 = d2.x - d0.x;
    const Y2 = d2.y - d0.y;
    const a = (X1 * y2 - X2 * y1) / det;
    const c = (X2 * x1 - X1 * x2) / det;
    const b = (Y1 * y2 - Y2 * y1) / det;
    const d = (Y2 * x1 - Y1 * x2) / det;
    const e = d0.x - a * s0.x - c * s0.y;
    const f = d0.y - b * s0.x - d * s0.y;

    const [e0, e1, e2] = expandTriangle(d0, d1, d2, 0.75);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(e0.x, e0.y);
    ctx.lineTo(e1.x, e1.y);
    ctx.lineTo(e2.x, e2.y);
    ctx.closePath();
    ctx.clip();
    ctx.transform(a, b, c, d, e, f);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(
        img,
        minX,
        minY,
        maxX - minX,
        maxY - minY,
        minX,
        minY,
        maxX - minX,
        maxY - minY,
    );
    ctx.restore();
}

function expandTriangle(
    p0: DOMPoint,
    p1: DOMPoint,
    p2: DOMPoint,
    amount: number,
) {
    const cx = (p0.x + p1.x + p2.x) / 3;
    const cy = (p0.y + p1.y + p2.y) / 3;
    return [p0, p1, p2].map((p) => {
        const dx = p.x - cx;
        const dy = p.y - cy;
        const len = Math.hypot(dx, dy);
        if (!len) return p;
        return new DOMPoint(
            p.x + (dx / len) * amount,
            p.y + (dy / len) * amount,
        );
    });
}

const warpCanvas = document.createElement("canvas");

function round(n: number) {
    return Math.round(n * 1e4) / 1e4;
}

function addRotate(deg: number) {
    styleData["transform.rotate"] =
        (((styleData["transform.rotate"] + deg) % 360) + 360) % 360;
    els.rotate.sv(String(styleData["transform.rotate"]));
    updatePreview();
}

let transformMode = false;
let transformSnapshot: {
    rotate: number;
    flipX: boolean;
    flipY: boolean;
    quad: (typeof styleData)["transform.quad"];
} | null = null;

function enterTransformMode() {
    if (transformMode) return;
    boxMarkMode = false;
    transformMode = true;
    transformSnapshot = {
        rotate: styleData["transform.rotate"],
        flipX: styleData["transform.flipX"],
        flipY: styleData["transform.flipY"],
        quad: [
            ...styleData["transform.quad"],
        ] as (typeof styleData)["transform.quad"],
    };
    syncTransformModeUI();
    updateHandles();
    syncModePills();
}

function cancelTransformMode() {
    if (!transformMode) return;
    if (transformSnapshot) {
        styleData["transform.rotate"] = transformSnapshot.rotate;
        styleData["transform.flipX"] = transformSnapshot.flipX;
        styleData["transform.flipY"] = transformSnapshot.flipY;
        styleData["transform.quad"] = [
            ...transformSnapshot.quad,
        ] as (typeof styleData)["transform.quad"];
    }
    transformMode = false;
    transformSnapshot = null;
    syncTransformModeUI();
    setConfig();
    updatePreview();
    syncModePills();
}

function applyTransformMode() {
    if (!transformMode) return;
    transformMode = false;
    transformSnapshot = null;
    syncTransformModeUI();
    updateHandles();
    syncModePills();
}

function exitTransformMode() {
    transformMode = false;
    transformSnapshot = null;
    syncTransformModeUI();
    syncModePills();
}

function syncTransformModeUI() {
    els.freeBtn.style({ display: transformMode ? "none" : "" });
    els.cancelBtn.style({ display: transformMode ? "" : "none" });
    els.applyBtn.style({ display: transformMode ? "" : "none" });
    els.resetBtn.style({ display: transformMode ? "none" : "" });
    els.transformHint.style({ display: transformMode ? "" : "none" });
}

function resetTransform() {
    styleData["transform.rotate"] = 0;
    styleData["transform.flipX"] = false;
    styleData["transform.flipY"] = false;
    styleData["transform.quad"] = [0, 0, 1, 0, 1, 1, 0, 1];
    setConfig();
    updatePreview();
}

function updatePreview() {
    if (!photo) return;
    const ctx = canvas.el.getContext("2d");
    if (!ctx) throw new Error("canvas context is null");

    const { naturalWidth: photoWidth, naturalHeight: photoHeight } = photo;
    const raduis = styleData.raduis;
    const {
        bgType,
        bgColor,
        bgUrl,
        "bg.gradient.angle": gAngle,
        "bg.gradient.x": gx,
        "bg.gradient.y": gy,
        "bg.gradient": gradient,
    } = styleData;
    const {
        "shadow.x": x,
        "shadow.y": y,
        "shadow.blur": blur,
        "shadow.color": color,
    } = styleData;
    const pad = getPad();
    const padX = pad.x;
    const padY = pad.y;

    const outerRadius = styleData.outerRadius
        ? raduis + Math.min(padX, padY)
        : 0;

    const layout = getPhotoLayout(photoWidth, photoHeight, padX, padY);
    const finalWidth = layout.finalWidth;
    const finalHeight = layout.finalHeight;
    const canvasQuad = layout.canvasQuad;
    const affineDraw = layout.affineDraw;

    if (lastCanvasWidth !== finalWidth || lastCanvasHeight !== finalHeight) {
        lastCanvasWidth = finalWidth;
        lastCanvasHeight = finalHeight;
        els.photoW.sv(finalWidth.toString()).attr({
            max: finalWidth.toString(),
        });
        els.photoH.sv(finalHeight.toString()).attr({
            max: finalHeight.toString(),
        });
    }
    stageDimText.sv(noI18n(`${finalWidth} × ${finalHeight} px`));

    canvas.el.width = finalWidth;
    canvas.el.height = finalHeight;

    magicPenPreview.attr({ width: finalWidth, height: finalHeight });
    syncOverlayPositions();

    if (outerRadius) {
        ctx.beginPath();
        ctx.roundRect(0, 0, finalWidth, finalHeight, outerRadius);
        ctx.clip();
    }

    if (bgType === "color") {
        ctx.fillStyle = bgColor || "#0000";
        ctx.fillRect(0, 0, finalWidth, finalHeight);
    } else if (bgType === "image") {
        const drawBg = (bgImg: HTMLImageElement) => {
            let scale = finalWidth / bgImg.naturalWidth;
            if (bgImg.naturalHeight * scale < finalHeight) {
                scale = finalHeight / bgImg.naturalHeight;
            }

            const w = bgImg.naturalWidth * scale;
            const h = bgImg.naturalHeight * scale;
            const x = (finalWidth - w) / 2;
            const y = (finalHeight - h) / 2;

            ctx.drawImage(bgImg, x, y, w, h);
            setPhoto();
        };
        if (!bgUrl || bgImgFailedUrl === bgUrl) {
            setPhoto();
        } else if (bgImgCache && bgImgCacheUrl === bgUrl) {
            drawBg(bgImgCache);
        } else if (bgImgLoadingUrl !== bgUrl) {
            bgImgLoadingUrl = bgUrl;
            const bgImg = new Image();
            bgImg.onload = () => {
                if (bgImgLoadingUrl !== bgUrl) return;
                bgImgLoadingUrl = "";
                bgImgCache = bgImg;
                bgImgCacheUrl = bgUrl;
                updatePreview();
            };
            bgImg.onerror = () => {
                if (bgImgLoadingUrl !== bgUrl) return;
                bgImgLoadingUrl = "";
                bgImgFailedUrl = bgUrl;
                updatePreview();
            };
            bgImg.src = bgUrl;
            setPhoto();
        } else {
            setPhoto();
        }
    } else {
        let grd: CanvasGradient;
        const angle = (gAngle * Math.PI) / 180;
        const x = gx * finalWidth;
        const y = gy * finalHeight;
        if (bgType === "linear-gradient") {
            const r =
                Math.sin(angle + Math.atan(finalHeight / finalWidth)) *
                Math.sqrt(finalWidth ** 2 + finalHeight ** 2);
            grd = ctx.createLinearGradient(
                0,
                finalHeight,
                r * Math.sin(angle),
                finalHeight - r * Math.cos(angle),
            );
        } else if (bgType === "radial-gradient") {
            grd = ctx.createRadialGradient(
                x,
                y,
                0,
                x,
                y,
                Math.max(finalWidth, finalHeight) / 2,
            );
        } else {
            grd = ctx.createConicGradient(angle, x, y);
        }
        try {
            for (const item of gradient) {
                grd.addColorStop(item.offset, item.color);
            }
        } catch (error) {}
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, finalWidth, finalHeight);
    }

    function setPhoto() {
        if (!ctx) throw new Error("canvas context is null");
        if (!photo) return;
        const layer = getPhotoLayer(photo, raduis);

        if (affineDraw) {
            ctx.globalCompositeOperation = "source-over";
            ctx.shadowOffsetX = x;
            ctx.shadowOffsetY = y;
            ctx.shadowBlur = blur;
            ctx.shadowColor = color;
            ctx.save();
            ctx.setTransform(affineDraw);
            ctx.drawImage(layer, 0, 0);
            ctx.restore();
        } else {
            drawPerspective(
                ctx,
                canvasQuad,
                layer,
                photoWidth,
                photoHeight,
                finalWidth,
                finalHeight,
                1,
            );
        }

        canvas.style({ borderRadius: `${outerRadius}px` });
        canvasBoard.style({ borderRadius: `${Math.max(10, outerRadius)}px` });
    }

    setPhoto();
}

function syncOverlayPositions() {
    if (!photo) return;
    const canvasRect = canvas.el.getBoundingClientRect();
    const boardRect = canvasBoard.el.getBoundingClientRect();
    magicPenPreview.style({
        position: "absolute",
        left: `${canvasRect.left - boardRect.left}px`,
        top: `${canvasRect.top - boardRect.top}px`,
        width: `${canvasRect.width}px`,
        height: `${canvasRect.height}px`,
        maxWidth: "none",
        maxHeight: "none",
        transition: "none",
        boxShadow: "none",
    });
    updateHandles();
}

function updateHandles() {
    if (!photo || !transformMode || els.magicPen.gv || boxMarkMode) {
        for (const el of handleEls) el.style({ display: "none" });
        return;
    }
    const photoWidth = photo.naturalWidth;
    const photoHeight = photo.naturalHeight;
    const off = getPad();
    const canvasQuad = getPhotoLayout(
        photoWidth,
        photoHeight,
        off.x,
        off.y,
    ).canvasQuad;

    const canvasRect = canvas.el.getBoundingClientRect();
    const overlayRect = handlesEl.el.getBoundingClientRect();
    const scaleX = canvasRect.width / canvas.el.width;
    const scaleY = canvasRect.height / canvas.el.height;

    const points = [...canvasQuad];
    for (let i = 0; i < 4; i++) {
        const a = canvasQuad[i];
        const b = canvasQuad[(i + 1) % 4];
        points.push(new DOMPoint((a.x + b.x) / 2, (a.y + b.y) / 2));
    }

    points.forEach((q, i) => {
        handleEls[i].style({
            display: "",
            left: `${canvasRect.left - overlayRect.left + q.x * scaleX}px`,
            top: `${canvasRect.top - overlayRect.top + q.y * scaleY}px`,
        });
    });
}

async function magicPen() {
    if (!maskOrt) {
        const modelPath = join(
            renderSendSync("userDataPath", []),
            "models",
            "inpaint",
            "migan_pipeline_v2.onnx",
        );
        if (!existsSync(modelPath)) {
            alert("未下载魔法橡皮模型，请在设置的“人工智能”页面下载");
            return;
        }
        maskOrt = await getOrt().InferenceSession.create(
            modelPath,
            getOrtSessionOptions(store.get("AI.运行后端")),
        );
    }
    if (!photo || !photoSrc) return;
    const w = photo.naturalWidth;
    const h = photo.naturalHeight;

    const padX = styleData.autoPadding ? 0 : styleData["padding.x"];
    const padY = styleData.autoPadding ? 0 : styleData["padding.y"];
    const layout = getPhotoLayout(w, h, padX, padY);
    const outW = magicPenPreview.el.width;
    const outH = magicPenPreview.el.height;
    const maskImg = new OffscreenCanvas(w, h);
    const maskCtx = maskImg.getContext("2d")!;
    maskCtx.clearRect(0, 0, w, h);
    maskCtx.fillStyle = "#fff";
    maskCtx.fillRect(0, 0, w, h);
    maskCtx.lineCap = "round";
    maskCtx.lineJoin = "round";
    maskCtx.strokeStyle = "#000";

    let mask: ImageData;
    if (layout.affineDraw) {
        maskCtx.setTransform(layout.affineDraw.inverse());
        for (const x of maskPens.values()) {
            maskCtx.lineWidth = x.w;
            maskCtx.moveTo(x.ps[0].x, x.ps[0].y);
            for (const p of x.ps) {
                maskCtx.lineTo(p.x, p.y);
            }
            maskCtx.stroke();
        }
        mask = maskCtx.getImageData(0, 0, w, h);
    } else {
        const penCanvas = new OffscreenCanvas(outW, outH);
        const penCtx = penCanvas.getContext("2d")!;
        penCtx.fillStyle = "#fff";
        penCtx.fillRect(0, 0, outW, outH);
        penCtx.lineCap = "round";
        penCtx.lineJoin = "round";
        penCtx.strokeStyle = "#000";
        for (const x of maskPens.values()) {
            penCtx.lineWidth = x.w;
            penCtx.moveTo(x.ps[0].x, x.ps[0].y);
            for (const p of x.ps) {
                penCtx.lineTo(p.x, p.y);
            }
            penCtx.stroke();
        }
        maskCtx.fillStyle = "#fff";
        maskCtx.fillRect(0, 0, w, h);
        meshWarp(
            maskCtx,
            penCanvas,
            getQuadHomography(layout.canvasQuad),
            [w, 0, 0, 0, h, 0, 0, 0],
            32,
        );
        mask = maskCtx.getImageData(0, 0, w, h);
    }
    const outputData = await removeobj({
        ort: getOrt(),
        session: maskOrt,
        img: photoSrc,
        mask: mask,
    });
    const outputImg = new Image();
    outputImg.onload = () => {
        photo = outputImg;
        updatePreview();
    };
    const outputCanvas = ele("canvas").attr({
        width: w,
        height: h,
    });
    const outputCtx = outputCanvas.el.getContext("2d")!;
    outputCtx.putImageData(outputData, 0, 0);
    outputImg.src = outputCanvas.el.toDataURL("image/png", 1);
}

function previewPen(id: string) {
    const ctx = magicPenPreviewCtx;
    ctx.clearRect(0, 0, magicPenPreview.el.width, magicPenPreview.el.height);
    if (!id) return;
    const x = maskPens.get(id);
    if (!x) return;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = x.w;
    ctx.strokeStyle = "#0005";
    ctx.beginPath();
    ctx.moveTo(x.ps[0].x, x.ps[0].y);
    for (const p of x.ps) {
        ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
}

controls.el.addInto();
previewStage.addInto();

for (const key in configMap) {
    const k = key as keyof typeof configMap;
    const el = els[k];
    el.on("input", () => {
        const v = el.gv as string;
        if (configMap[k])
            if (configMap[k].parse) {
                // @ts-expect-error
                styleData[configMap[k].path as string] = configMap[k].parse(v);
            } else {
                // @ts-expect-error
                styleData[configMap[k].path as string] = v;
            }
        updatePreview();
    });
}

syncTransformModeUI();
setConfig();
syncModePills();

trackPoint(magicPenPreview, {
    start: (e) => {
        if (boxMarkMode) {
            const cw =
                (e.offsetX / Math.max(1, magicPenPreview.el.offsetWidth)) *
                magicPenPreview.el.width;
            const ch =
                (e.offsetY / Math.max(1, magicPenPreview.el.offsetHeight)) *
                magicPenPreview.el.height;
            boxDragOrigin = { x: cw, y: ch };
            activeBoxDraft = {
                x: cw,
                y: ch,
                w: 0,
                h: 0,
                color: boxColor,
                sw: boxStrokeWidth,
                radius: boxRadius,
            };
            return { x: cw, y: ch, data: "__box__" };
        }
        if (!els.magicPen.gv) return null;
        const id = crypto.randomUUID();
        maskPens.set(id, {
            ps: [],
            w: 10,
        });
        const ctx = magicPenPreviewCtx;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.lineWidth = 10;
        ctx.strokeStyle = "#0005";
        const x =
            (e.offsetX / magicPenPreview.el.offsetWidth) *
            magicPenPreview.el.width;
        const y =
            (e.offsetY / magicPenPreview.el.offsetHeight) *
            magicPenPreview.el.height;
        ctx.moveTo(x, y);
        return {
            x: x,
            y: y,
            data: id,
        };
    },
    ing: (_, e, { startData: id }) => {
        const x =
            (e.offsetX / Math.max(1, magicPenPreview.el.offsetWidth)) *
            magicPenPreview.el.width;
        const y =
            (e.offsetY / Math.max(1, magicPenPreview.el.offsetHeight)) *
            magicPenPreview.el.height;
        if (id === "__box__" && activeBoxDraft) {
            const rx = Math.min(boxDragOrigin.x, x);
            const ry = Math.min(boxDragOrigin.y, y);
            const rw = Math.abs(x - boxDragOrigin.x);
            const rh = Math.abs(y - boxDragOrigin.y);
            activeBoxDraft.x = rx;
            activeBoxDraft.y = ry;
            activeBoxDraft.w = rw;
            activeBoxDraft.h = rh;
            const ctx = magicPenPreviewCtx;
            ctx.clearRect(
                0,
                0,
                magicPenPreview.el.width,
                magicPenPreview.el.height,
            );
            ctx.save();
            ctx.strokeStyle = activeBoxDraft.color;
            ctx.lineWidth = activeBoxDraft.sw;
            ctx.beginPath();
            if (activeBoxDraft.radius > 0) {
                ctx.roundRect(rx, ry, rw, rh, activeBoxDraft.radius);
            } else {
                ctx.rect(rx, ry, rw, rh);
            }
            ctx.stroke();
            ctx.restore();
            return;
        }
        // @ts-ignore
        maskPens.get(id).ps.push({ x, y });
        magicPenPreviewCtx.lineTo(x, y);
        magicPenPreviewCtx.stroke();
    },
    end: (_, { startData: id }) => {
        magicPenPreviewCtx.clearRect(
            0,
            0,
            magicPenPreview.el.width,
            magicPenPreview.el.height,
        );
        if (id === "__box__") {
            const draft = activeBoxDraft;
            activeBoxDraft = null;
            if (!draft || draft.w < 4 || draft.h < 4) return;
            const p0 = canvasPointToPhotoPoint(draft.x, draft.y);
            const p1 = canvasPointToPhotoPoint(
                draft.x + draft.w,
                draft.y + draft.h,
            );
            if (p0 && p1) {
                const bx = Math.min(p0.x, p1.x);
                const by = Math.min(p0.y, p1.y);
                const bw = Math.abs(p1.x - p0.x);
                const bh = Math.abs(p1.y - p0.y);
                if (bw >= 3 && bh >= 3) {
                    boxAnnotations.push({
                        x: bx,
                        y: by,
                        w: bw,
                        h: bh,
                        color: draft.color,
                        sw: draft.sw,
                        radius: draft.radius,
                    });
                    updateBoxCountLabel();
                    updatePreview();
                }
            }
            return;
        }
        const items = button(icon("close", 12))
            .class("pun-no-icon-box")
            .on("click", () => {
                maskPens.delete(id);
                items.remove();
                magicPen();
            })
            .on("pointerenter", () => previewPen(id))
            .on("pointerleave", () => previewPen(""));
        els.magicPenList.add(items);
        magicPen();
    },
});

renderOn("superPhotoEditorInit", ([data]) => {
    const img = new Image();
    img.onload = () => {
        photo = img;
        photoSrc = img;
        boxAnnotations.length = 0;
        updateBoxCountLabel();
        updatePreview();
    };
    img.src = data;
});

updatePreview();
