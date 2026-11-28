import { addClass, addStyle, initDKH, view } from "dkh-ui";
import { lan, t } from "../../../lib/translate/translate";
import type { RawIconType } from "../../iconTypes";

const fs = require("node:fs") as typeof import("node:fs");
const path = require("node:path") as typeof import("node:path");

function initStyle(
    store: typeof import("../../../lib/store/renderStore")["default"],
) {
    if (!store.get("dev")) addStyle({ "[data-dev]": { display: "none" } });
    function setCSSVar(name: string, value: string) {
        if (value) document.documentElement.style.setProperty(name, value);
    }
    const 模糊 = store.get("全局.模糊");
    if (模糊 !== 0) {
        setCSSVar("--blur", `blur(${模糊}px)`);
    } else {
        setCSSVar("--blur", "none");
    }

    setCSSVar("--alpha", `${store.get("全局.不透明度") * 100}%`);

    const theme = store.get("全局.主题");
    setCSSVar("--bar-bg0", theme.light.barbg);
    setCSSVar("--bg", theme.light.bg);
    setCSSVar("--emphasis-color", theme.light.emphasis);
    setCSSVar("--d-bar-bg0", theme.dark.barbg);
    setCSSVar("--d-bg", theme.dark.bg);
    setCSSVar("--d-emphasis-color", theme.dark.emphasis);
    setCSSVar("--font-color", theme.light.fontColor);
    setCSSVar("--d-font-color", theme.dark.fontColor);
    setCSSVar("--font-color-emphasis", theme.light.fontInEmphasis);
    setCSSVar("--d-font-color-emphasis", theme.dark.fontInEmphasis);
    setCSSVar("--icon-color", theme.light.iconColor);
    setCSSVar("--d-icon-color", theme.dark.iconColor);

    function checkIconColor(c: string) {
        return `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='${c}' stroke-width='4' stroke-linecap='round' stroke-linejoin='round'><polyline points='20 8 9 19 4 14'></polyline></svg>`)}")`;
    }

    setCSSVar("--check-icon", checkIconColor(theme.light.fontInEmphasis));
    setCSSVar("--d-check-icon", checkIconColor(theme.dark.fontInEmphasis));

    const 字体 = store.get("字体");
    initEmbeddedMonoFont();
    setCSSVar("--main-font", 字体.主要字体);
    setCSSVar("--monospace", 字体.等宽字体 || monoFont.join(","));

    lan(store.get("语言.语言"));

    initDKH({
        pureStyle: true,
        attrMap: {
            title: (s: string, el) => {
                const title = t(s);
                el.setAttribute("data-title", title);
                el.setAttribute("aria-label", title);
            },
        },
    });

    const topTipLabel = document.createElement("span");
    const topTipKbd = document.createElement("span");
    topTipKbd.className = "pun-tooltip-kbd";
    topTipKbd.style.display = "none";

    const topTip = view().class(Class.glassBar, "pun-tooltip").addInto();
    topTip.el.append(topTipLabel, topTipKbd);

    const tipDelay = 220;
    const warmWindowMs = 320;
    let tipEl: HTMLElement | null = null;
    let tipTimer: ReturnType<typeof setTimeout> | undefined;
    let tipVisible = false;
    let lastTipHideAt = 0;

    function hideTip() {
        clearTimeout(tipTimer);
        tipTimer = undefined;
        tipEl = null;
        if (tipVisible) {
            tipVisible = false;
            lastTipHideAt = performance.now();
        }
        topTip.el.classList.remove("show");
    }

    function showTip(el: HTMLElement) {
        const title = el.getAttribute("data-title");
        if (!title?.trim()) {
            hideTip();
            return;
        }
        const keyHint = el.getAttribute("data-key")?.trim();
        topTipLabel.textContent = title;
        if (keyHint) {
            topTipKbd.textContent = keyHint;
            topTipKbd.style.display = "inline-flex";
        } else {
            topTipKbd.style.display = "none";
        }
        const rect = el.getBoundingClientRect();
        const tw = topTip.el.offsetWidth;
        const th = topTip.el.offsetHeight;
        const ow = window.innerWidth;
        const oh = window.innerHeight;
        const left = Math.max(
            6,
            Math.min(rect.left + rect.width / 2 - tw / 2, ow - tw - 6),
        );
        let top = rect.bottom + 7;
        let placedAbove = false;
        if (top > oh - th - 6) {
            top = rect.top - th - 7;
            placedAbove = true;
        }
        topTip.style({
            left: `${Math.round(left)}px`,
            top: `${Math.round(Math.max(Math.min(top, oh - th - 6), 6))}px`,
            transformOrigin: placedAbove ? "bottom center" : "top center",
        });
        tipVisible = true;
        topTip.el.classList.add("show");
    }

    window.addEventListener("pointerover", (e) => {
        const el = e.target as HTMLElement;
        const tEl = el.closest<HTMLElement>("[data-title]");
        if (!tEl) {
            hideTip();
            return;
        }
        if (tEl === tipEl) return;
        const isWarm =
            tipVisible || performance.now() - lastTipHideAt < warmWindowMs;
        hideTip();
        tipEl = tEl;
        tipTimer = setTimeout(
            () => {
                tipTimer = undefined;
                if (tipEl === tEl) showTip(tEl);
            },
            isWarm ? 35 : tipDelay,
        );
    });

    window.addEventListener("pointerout", (e) => {
        if (!tipEl) return;
        const to = e.relatedTarget as Node | null;
        if (to && tipEl.contains(to)) return;
        hideTip();
    });

    window.addEventListener("pointerdown", hideTip, { passive: true });
    window.addEventListener("blur", hideTip);

    document.addEventListener("visibilitychange", () => {
        if (document.hidden) hideTip();
    });
}

let toastRoot: HTMLDivElement | null = null;
let toastTextEl: HTMLSpanElement | null = null;
let toastTimer: ReturnType<typeof setTimeout> | undefined;

type ToastTone = "info" | "success" | "warn" | "error";

function showToast(
    message: string,
    tone: ToastTone = "info",
    durationMs = 1800,
) {
    if (!message) return;
    if (!toastRoot) {
        toastRoot = document.createElement("div");
        toastRoot.className = `${Class.glassBar} pun-toast`;
        const dot = document.createElement("span");
        dot.className = "pun-toast-dot";
        toastTextEl = document.createElement("span");
        toastRoot.append(dot, toastTextEl);
        document.body.appendChild(toastRoot);
    }
    toastRoot.dataset.tone = tone;
    if (toastTextEl) toastTextEl.textContent = message;
    clearTimeout(toastTimer);
    toastRoot.classList.remove("show");
    void toastRoot.offsetWidth;
    toastRoot.classList.add("show");
    toastTimer = setTimeout(() => {
        toastRoot?.classList.remove("show");
    }, durationMs);
}

function getImgUrl(name: RawIconType) {
    return new URL(`../assets/icons/${name}`, import.meta.url).href;
}

function setTitle(t: string) {
    document.title = `PunPun ${t}`;
    // todo 国际化
}

const cssColor = {
    font: {
        f0: cssVarR("font-color"),
        light: cssVarR("font-color-l"),
        llight: cssVarR("font-color-ll"),
        main: cssVarR("font-color-emphasis"),
    },
    f: cssVarR("m-color-f"),
    ff: cssVarR("m-color-ff"),
    fff: cssVarR("m-color-fff"),
    b: cssVarR("m-color-b"),
    bb: cssVarR("m-color-bb"),
    bbb: cssVarR("m-color-bbb"),
    main: cssVarR("m-color"),
    bg: cssVarR("bg"),
};

const Class = {
    gap: addClass({ gap: cssVar("o-padding") }, {}),
    group: "group",
    smallSize: "small-size",
    mono: addClass({ fontFamily: cssVar("monospace") }, {}),
    click: addClass(
        { transition: cssVar("transition"), cursor: "pointer" },
        { "&:active": { transform: "var(--button-active)" } },
    ),
    click1: addClass(
        { transition: cssVar("transition"), cursor: "pointer" },
        {},
    ),
    hover: addClass(
        {},
        { "&:hover": { backgroundColor: "var(--hover-color)" } },
    ),
    button: "",
    transition: addClass({ transition: cssVar("transition") }, {}),
    deco: addClass(
        {
            borderRadius: cssVarR("border-radius"),
            outline: `1px solid ${cssVarR("border-color")}`,
            outlineOffset: "-1px",
        },
        {},
    ),
    noDeco: addClass(
        {
            outline: "none",
        },
        {},
    ),
    textItem: addClass(
        {
            paddingInline: "var(--o-padding)",
        },
        {},
    ),
    glassBar: "bar",
    /** 背景是屏幕 */
    screenBar: addClass(
        {
            borderRadius: cssVarR("border-radius"),
            backgroundColor: cssColor.bg,
        },
        {
            "& :is(button, *:has(> .icon), input, .deco)": {
                outline: "none",
            },
        },
    ),
    hide: addClass(
        {
            opacity: "0",
            pointerEvents: "none",
        },
        {},
    ),
};

Class.button = `${Class.click} ${Class.hover}`;

const embeddedMonoFont = "FiraCode";

function initEmbeddedMonoFont() {
    const dirs = [
        path.join(__dirname, "../../assets/fonts"),
        path.join(process.cwd(), "assets/fonts"),
    ];
    const fonts = [
        ["FiraCode-Regular.woff2", "400"],
        ["FiraCode-Bold.woff2", "700"],
    ] as const;
    for (const [file, weight] of fonts) {
        const fontPath = dirs
            .map((dir) => path.join(dir, file))
            .find((p) => fs.existsSync(p));
        if (!fontPath) continue;
        const data = fs.readFileSync(fontPath);
        document.fonts.add(
            new FontFace(
                embeddedMonoFont,
                data.buffer.slice(
                    data.byteOffset,
                    data.byteOffset + data.byteLength,
                ) as ArrayBuffer,
                { weight },
            ),
        );
    }
}

const monoFont = [
    embeddedMonoFont,
    "Cascadia Code Light",
    "Courier New",
    "Courier",
    "Lucida Console",
    "Monaco",
    "Liberation Mono",
    "Roboto Mono",
];

function cssVar(x: "transition" | "o-padding" | "monospace" | "b-button") {
    return cssVarR(x);
}
function cssVarR(x: string) {
    return `var(--${x})`;
}

export {
    Class,
    cssColor,
    cssVar,
    getImgUrl,
    initStyle,
    monoFont,
    setTitle,
    showToast,
};
