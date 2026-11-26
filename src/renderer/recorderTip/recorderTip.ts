import {
    addClass,
    button,
    dynamicSelect,
    ele,
    image,
    pack,
    trackPoint,
    txt,
    view,
} from "dkh-ui";
import { renderOn, renderSend, renderSendSync } from "../../../lib/ipc";
import { jsKeyCodeDisplay } from "../../../lib/key";
import store from "../../../lib/store/renderStore";
import { t } from "../../../lib/translate/translate";
import { typedEntries } from "../../../lib/utils";
import type { IconType } from "../../iconTypes";
import { getOrt, getOrtSessionOptions, resolveUnpackedPath } from "../lib/ort";
import { Class, getImgUrl, initStyle } from "../root/root";

const params = new URLSearchParams(window.location.search);
const isSuperHud = params.get("mode") === "super";
const hudPlace =
    (params.get("hud") as "bottom" | "top" | "inside" | null) ?? "bottom";
const frameLeft = Number(params.get("fl") ?? 0);
const frameTop = Number(params.get("ft") ?? 0);
const frameWidth = Number(params.get("fw") ?? window.innerWidth);
const frameHeight = Number(
    params.get("fh") ?? Math.max(40, window.innerHeight - 46),
);
const pixelW = Number(params.get("pw") ?? 0);
const pixelH = Number(params.get("ph") ?? 0);

const cursorHighlightOn =
    !isSuperHud && Boolean(store.get("录屏.提示.光标.开启"));

function initRecord() {
    if (isSuperHud) return;
    if (store.get("录屏.提示.键盘.开启") || store.get("录屏.提示.鼠标.开启"))
        // biome-ignore lint: 部分引入
        var { uIOhook, UiohookKey } =
            require("uiohook-napi") as typeof import("uiohook-napi");

    function rKey() {
        const posi = store.get("录屏.提示.键盘.位置") ?? {
            x: "+",
            y: "+",
            offsetX: 4,
            offsetY: 4,
        };
        const px = posi.x === "+" ? "right" : "left";
        const py = posi.y === "+" ? "bottom" : "top";
        const pel = keysEl.parentElement as HTMLElement;
        pel.style[px] = `${posi.offsetX ?? 4}px`;
        pel.style[py] = `${posi.offsetY ?? 4}px`;

        const keyScale = Number(store.get("录屏.提示.键盘.大小")) || 1;
        keysEl.style.fontSize = `${keyScale * 16}px`;

        const keycode2key: Record<number, string | number> = {};
        for (const [i, v] of typedEntries(UiohookKey)) {
            keycode2key[v] = i;
        }

        const map: { [k: string]: string } = {
            Ctrl: "Control",
            CtrlRight: "ControlRight",
        };
        for (let i = 0; i < 26; i++) {
            const k = String.fromCharCode(65 + i);
            map[k] = `Key${k}`;
        }

        function getKey(keycode: number) {
            const key = keycode2key[keycode] as string;
            const keyDisplay = jsKeyCodeDisplay(map[key] || key);
            const mainKey = keyDisplay.primary ?? key;
            let topKey = keyDisplay?.secondary ?? keyDisplay?.symble ?? "";
            if (keyDisplay.isNumpad) topKey = "";
            return {
                main: mainKey,
                top: topKey,
                numpad: keyDisplay.isNumpad,
                right: keyDisplay.isRight,
            };
        }

        let keyO: number[] = [];
        let lastKey = null as ReturnType<typeof view> | null;

        uIOhook.on("keydown", (e) => {
            if (!keyO.includes(e.keycode)) keyO.push(e.keycode);
            if (!lastKey) {
                lastKey = view();
                if (posi.x === "+") keysEl.append(lastKey.el);
                else keysEl.insertAdjacentElement("afterbegin", lastKey.el);
            }
            const key = getKey(e.keycode);
            if (["Ctrl", "Alt", "Shift", "Meta"].includes(key.main))
                lastKey.data({ modi: "true" });
            const kbdEl = ele("kbd").add(
                txt(key.main)
                    .class("main_key")
                    .data({ k: e.keycode.toString() }),
            );

            if (key.top) kbdEl.add(txt(key.top).class("top_key"));
            else {
                kbdEl.el.querySelector("span")?.classList.remove("main_key");
                kbdEl.el.classList.add("only_key");
            }
            lastKey.add(kbdEl);
            if (key.numpad) kbdEl.el.classList.add("numpad_key");
            if (key.right) kbdEl.el.classList.add("right_key");
            const l = Array.from(keysEl.children);
            if (posi.x === "+") {
                for (const v of l.slice(0, -10)) v.remove();
            } else {
                for (const v of l.slice(10)) v.remove();
            }
        });
        uIOhook.on("keyup", (e) => {
            keyO = keyO.filter((i) => i !== e.keycode);
            for (const el of (lastKey?.el
                .querySelectorAll(`[data-k="${e.keycode}"]`)
                ?.values() as Iterable<HTMLElement>) || []) {
                el.classList.add("key_hidden");
            }
            if (keyO.length === 0) {
                const e = lastKey;
                setTimeout(() => {
                    e?.style({ opacity: "0" });
                }, 4000);
                lastKey = null;
            }
        });
    }

    function rMouse() {
        const m2m = { 1: mouseKey.left, 3: mouseKey.center, 2: mouseKey.right };
        uIOhook.on("mousedown", (e) => {
            const b = e.button as 1 | 2 | 3;
            if (m2m[b]) m2m[b].el.style.backgroundColor = "#3b82f6";
        });
        uIOhook.on("mouseup", (e) => {
            const b = e.button as 1 | 2 | 3;
            if (m2m[b]) m2m[b].el.style.backgroundColor = "";
        });

        let time_out: NodeJS.Timeout;
        uIOhook.on("wheel", (e) => {
            const x = {
                3: { 1: "wheel_u", "-1": "wheel_d" },
                4: { 1: "wheel_l", "-1": "wheel_r" },
            } as const;
            if (e.rotation === 1 || e.rotation === -1)
                recorderMouseEl.className = x[e.direction][e.rotation];
            else recorderMouseEl.className = "";
            clearTimeout(time_out);
            time_out = setTimeout(() => {
                recorderMouseEl.className = "";
            }, 200);
        });
    }

    if (store.get("录屏.提示.键盘.开启")) rKey();
    if (store.get("录屏.提示.鼠标.开启")) rMouse();

    if (store.get("录屏.提示.键盘.开启") || store.get("录屏.提示.鼠标.开启"))
        // @ts-ignore
        uIOhook.start();

    if (cursorHighlightOn) recorderMouseEl.style.display = "flex";

    const mouseStyle = document.createElement("style");
    mouseStyle.innerHTML = `.mouse{${(store.get("录屏.提示.光标.样式") || "").replaceAll(";", " !important;")}}`;
    document.body.appendChild(mouseStyle);
}

let cameraEnabled = false;

async function cameraStreamF(id: string | null) {
    if (id) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: { deviceId: id },
            });
            videoEl.srcObject = stream;
            await videoEl.play();
            videoEl.style.transform = store.get("录屏.摄像头.镜像")
                ? "rotateY(180deg)"
                : "";

            videoEl.oncanplay = () => {
                cEl.style({ display: "block" });
                initSeg();
            };
            cEl.style({ display: "block" });
            cameraEnabled = true;
            cameraBtn.el.classList.add("active");
        } catch (err) {
            console.error(err);
            cameraEnabled = false;
            cameraBtn.el.classList.remove("active");
        }
    } else {
        const src = videoEl.srcObject;
        if (src instanceof MediaStream) {
            for (const track of src.getVideoTracks()) {
                try {
                    track.stop();
                } catch {}
            }
        }
        videoEl.srcObject = null;
        cEl.style({ display: "none" });
        cameraEnabled = false;
        cameraBtn.el.classList.remove("active");
    }
}

async function getAndSetStream() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoL = devices.filter((i) => i.kind === "videoinput");
    cameraSelect.setList(
        videoL.map((i) => ({
            name: i.label || "Camera",
            value: i.deviceId,
        })),
    );
    if (videoL.length > 1) {
        cameraSelect.el.style({ display: "" });
    } else {
        cameraSelect.el.style({ display: "none" });
    }
    if (videoL.length > 0) {
        const id =
            videoL.find((i) => i.deviceId === store.get("录屏.摄像头.设备"))
                ?.deviceId ?? videoL[0].deviceId;
        cameraSelect.el.sv(id);
        return id;
    }
    return null;
}

let seg: typeof import("esearch-seg");

async function initSeg() {
    const bgSetting = store.get("录屏.摄像头.背景") ?? {
        模式: "none",
        模糊: 40,
        imgUrl: "",
        videoUrl: "",
        fit: "cover",
    };
    if (bgSetting.模式 === "none") {
        return;
    }
    const path = require("node:path") as typeof import("path");
    videoEl.style.display = "";
    segEl.clear();
    videoEl.style.display = "none";
    cameraCanvas = document.createElement("canvas");
    segCanvas = document.createElement("canvas");
    const bgEl = document.createElement("div");
    if (bgSetting.模式 === "img" || bgSetting.模式 === "video") {
        const bg =
            bgSetting.模式 === "img"
                ? document.createElement("img")
                : document.createElement("video");
        const url =
            bgSetting.模式 === "img" ? bgSetting.imgUrl : bgSetting.videoUrl;
        bg.src = url;
        bgEl.append(bg);
        bgEl.style.objectFit = bgSetting.fit;
        cameraCanvas.style.display = "none";
    }
    if (bgSetting.模式 === "blur") {
        cameraCanvas.style.filter = `blur(${bgSetting.模糊}px)`;
        cameraCanvas.style.display = "";
    }
    if (bgSetting.模式 === "hide") {
        cameraCanvas.style.display = "none";
    }
    segEl.add([cameraCanvas, bgEl, segCanvas]);
    seg = require("esearch-seg") as typeof import("esearch-seg");
    await seg.init({
        segPath: resolveUnpackedPath(
            path.join(__dirname, "../../assets/onnx/seg", "seg.onnx"),
        ),
        ort: getOrt(),
        ortOption: getOrtSessionOptions(store.get("AI.运行后端")),
        shape: [256, 144],
        invertOpacity: true,
        threshold: 0.7,
    });
    drawCamera();
    segEl.style({
        aspectRatio: `auto ${videoEl.videoWidth} / ${videoEl.videoHeight}`,
    });
}

function drawCamera() {
    const canvasCtx = cameraCanvas.getContext("2d")!;
    const segCtx = segCanvas.getContext("2d")!;
    cameraCanvas.width = videoEl.videoWidth;
    cameraCanvas.height = videoEl.videoHeight;
    canvasCtx.drawImage(videoEl, 0, 0, cameraCanvas.width, cameraCanvas.height);
    seg.seg(
        canvasCtx.getImageData(0, 0, cameraCanvas.width, cameraCanvas.height),
    ).then((data) => {
        segCanvas.width = data.width;
        segCanvas.height = data.height;
        segCtx.putImageData(data, 0, 0);
    });
    setTimeout(() => {
        if (videoEl.srcObject) drawCamera();
    }, 16);
}

function iconEl(src: IconType) {
    return image(getImgUrl(`${src}.svg`), "icon").class("icon");
}

initStyle(store);

pack(document.body).style({ overflow: "hidden" });

const rectEl = view()
    .addInto()
    .attr({ id: "recorder_rect" })
    .style({
        display: isSuperHud ? "none" : "",
        left: `${frameLeft}px`,
        top: `${frameTop}px`,
        width: `${frameWidth}px`,
        height: `${frameHeight}px`,
    })
    .add([
        view().class("rec_corner", "tl"),
        view().class("rec_corner", "tr"),
        view().class("rec_corner", "bl"),
        view().class("rec_corner", "br"),
    ]);

const rb = view().addInto(rectEl).attr({ id: "recorder_bar" });
const keysEl = view().addInto(rb).attr({ id: "recorder_key" }).el;
const mouseKey = {
    left: view(),
    center: view(),
    right: view(),
};
const recorderMouseEl = view()
    .addInto()
    .attr({ id: "mouse_c" })
    .class("mouse")
    .add([mouseKey.left, mouseKey.center, mouseKey.right]).el;

const defaultCamW = Math.min(180, Math.max(110, Math.round(frameWidth * 0.22)));
const cEl = view()
    .addInto()
    .attr({ id: "recorder_camera_pip" })
    .style({
        display: "none",
        left: `${Math.max(8, frameLeft + 14)}px`,
        top: `${Math.max(8, frameTop + frameHeight - Math.round(defaultCamW * 0.75) - 14)}px`,
        width: `${defaultCamW}px`,
    });

const videoEl = ele("video").addInto(cEl).el;
const segEl = view()
    .attr({ id: "seg" })
    .addInto(cEl)
    .class(
        addClass(
            { position: "relative", overflow: "hidden" },
            { "&>*": { position: "absolute", top: 0, width: "100%" } },
        ),
    );
const cameraSelect = dynamicSelect();
cEl.class(Class.smallSize).add(cameraSelect.el.style({ display: "none" }));
cameraSelect.el.on("change", async () => {
    const id = cameraSelect.el.gv;
    cameraStreamF(id);
    store.set("录屏.摄像头.设备", id);
});

let cameraCanvas: HTMLCanvasElement = document.createElement("canvas");
let segCanvas: HTMLCanvasElement = document.createElement("canvas");

let isPaused = false;
const pauseIconEl = iconEl("pause");
const timeEl = txt("00:00").class("rec_timer");
const resText = isSuperHud
    ? t("超级录屏")
    : pixelW > 0 && pixelH > 0
      ? `${pixelW}×${pixelH}`
      : "";
const resBadgeEl = resText ? txt(resText).class("rec_res_tag") : null;

function syncPauseUi(paused: boolean) {
    isPaused = paused;
    document.body.dataset.paused = paused ? "true" : "false";
    pauseIconEl.el.src = getImgUrl(`${paused ? "recume" : "pause"}.svg`);
    pauseBtn.attr({ title: paused ? t("继续录制") : t("暂停录制") });
}

const pauseBtn = button()
    .class("rec_icon_btn", "pun-no-icon-box")
    .attr({ title: t("暂停录制") })
    .add(pauseIconEl)
    .on("click", (e) => {
        e.stopPropagation();
        const nextPaused = !isPaused;
        syncPauseUi(nextPaused);
        renderSend("recordState", [nextPaused ? "pause" : "resume"]);
    });

const cameraBtn = button()
    .class("rec_icon_btn", "pun-no-icon-box")
    .attr({ title: t("摄像头") })
    .add(iconEl("camera"))
    .on("click", async (e) => {
        e.stopPropagation();
        const next = !cameraEnabled;
        store.set("录屏.摄像头.开启", next);
        if (next) {
            const id = await getAndSetStream();
            await cameraStreamF(id);
        } else {
            await cameraStreamF(null);
        }
    });

const cancelBtn = button()
    .class("rec_icon_btn", "danger_hover", "pun-no-icon-box")
    .attr({ title: t("取消录制") })
    .add(iconEl("close"))
    .on("click", (e) => {
        e.stopPropagation();
        renderSend("recordState", ["cancel"]);
    });

const finishBtn = button()
    .class("rec_finish_btn")
    .attr({ title: t("结束录制并编辑") })
    .add([view().class("rec_stop_sq"), txt(t("完成"))])
    .on("click", (e) => {
        e.stopPropagation();
        renderSend("recordState", ["stop"]);
    });

const initialHudStyle: Record<string, string> =
    hudPlace === "top"
        ? { top: "4px", right: "4px" }
        : hudPlace === "inside"
          ? { bottom: "14px", right: "14px" }
          : { bottom: "4px", right: "4px" };

const controlBar = view("x")
    .attr({ id: "recorder_hud" })
    .style(initialHudStyle)
    .add([
        view("x")
            .class("rec_status_group")
            .add([view().class("rec_dot"), timeEl]),
        resBadgeEl,
        view().class("rec_sep"),
        pauseBtn,
        isSuperHud ? null : cameraBtn,
        cancelBtn,
        finishBtn,
    ])
    .addInto();

initRecord();

navigator.mediaDevices.ondevicechange = async () => {
    if (!cameraEnabled) return;
    const id = await getAndSetStream();
    cameraStreamF(id);
};

trackPoint(controlBar, {
    start: (e) => {
        if ((e.target as HTMLElement)?.closest("button")) return null;
        const r = controlBar.el.getBoundingClientRect();
        controlBar.style({
            right: "auto",
            bottom: "auto",
            left: `${r.left}px`,
            top: `${r.top}px`,
        });
        return { x: r.left, y: r.top };
    },
    ing: (p) => {
        const w = controlBar.el.offsetWidth;
        const h = controlBar.el.offsetHeight;
        const nx = Math.max(2, Math.min(window.innerWidth - w - 2, p.x));
        const ny = Math.max(2, Math.min(window.innerHeight - h - 2, p.y));
        controlBar.style({ left: `${nx}px`, top: `${ny}px` });
    },
});

trackPoint(cEl, {
    start: () => {
        const r = cEl.el.getBoundingClientRect();
        return { x: r.left, y: r.top };
    },
    ing: (p) => {
        const w = cEl.el.offsetWidth;
        const h = cEl.el.offsetHeight;
        const nx = Math.max(0, Math.min(window.innerWidth - w, p.x));
        const ny = Math.max(0, Math.min(window.innerHeight - h, p.y));
        cEl.style({ left: `${nx}px`, top: `${ny}px` });
    },
});

cEl.on("wheel", (e) => {
    e.preventDefault();
    const r = cEl.el.getBoundingClientRect();
    const nextW = Math.max(88, Math.min(480, r.width * (1 - e.deltaY / 600)));
    cEl.style({ width: `${Math.round(nextW)}px` });
});

let lastIgnoreMouse: boolean | null = null;
setInterval(() => {
    const { x, y } = renderSendSync("getMousePos", []).po;
    if (cursorHighlightOn) {
        recorderMouseEl.style.left = `${x}px`;
        recorderMouseEl.style.top = `${y}px`;
    }
    const inViewport =
        x >= 0 && y >= 0 && x <= window.innerWidth && y <= window.innerHeight;
    let interactive = false;
    if (inViewport) {
        const l = document.elementsFromPoint(x, y);
        interactive = l.some(
            (el) =>
                el === controlBar.el ||
                controlBar.el.contains(el) ||
                (cEl.el.style.display !== "none" &&
                    (el === cEl.el || cEl.el.contains(el))),
        );
    }
    const ignore = !interactive;
    if (ignore !== lastIgnoreMouse) {
        lastIgnoreMouse = ignore;
        renderSend("windowIgnoreMouse", [ignore]);
    }
}, 24);

renderOn("recordTime", ([timeText, paused]) => {
    timeEl.sv(timeText);
    if (typeof paused === "boolean" && paused !== isPaused) {
        syncPauseUi(paused);
    }
});

renderOn("recordCamera", async ([b]) => {
    if (b) {
        const id = await getAndSetStream();
        cameraStreamF(id);
    } else {
        cameraStreamF(null);
    }
});
