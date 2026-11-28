import { button, ele, image, input, txt, view } from "dkh-ui";
import {
    IMAGE_SEARCH_ENGINES,
    type ImageSearchEngine,
    type ImageSearchResult,
    normalizeImageSearchEngine,
} from "../../../lib/imageSearch";
import { renderInvoke, renderSend } from "../../../lib/ipc";
import store from "../../../lib/store/renderStore";
import { t } from "../../../lib/translate/translate";
import { writeText } from "../lib/clipboard";
import { attachSpotlight, Class, getImgUrl, showToast } from "../root/root";

export type ImageSearchStudioCallbacks = {
    getWindowName: () => number;
    openInExternalBrowser: () => boolean;
    onOpenUrl: (url: string) => void;
    onRunOcr: (imageDataUrl: string) => void;
    onCloseStudio: () => void;
};

type EngineState = "idle" | "loading" | "done" | "error";

export function createImageSearchStudio(
    parent: ReturnType<typeof view>,
    cb: ImageSearchStudioCallbacks,
) {
    let currentImageDataUrl = "";
    let currentEngine: ImageSearchEngine = normalizeImageSearchEngine(
        store.get("以图搜图.引擎"),
    );
    let cachedPublicUrl: string | undefined;
    let searchSeq = 0;
    let lastResult: ImageSearchResult | null = null;
    const engineResults = new Map<
        ImageSearchEngine,
        { state: EngineState; url?: string; elapsedMs?: number; error?: string }
    >();

    const root = view("y")
        .attr({ id: "img_search_studio" })
        .style({ display: "none" })
        .addInto(parent);

    // Header bar
    const titleEl = txt(t("以图搜图工作台")).class("ims_title");
    const subtitleEl = txt(
        t("多引擎真图检索 · 自动压缩提速 · 切换引擎零重复上传"),
    ).class("ims_subtitle");

    const multiSearchBtn = button([
        image(getImgUrl("search.svg"), "icon").class("icon"),
        txt(t("三引擎对比"), true),
    ])
        .class("pun-btn-primary", "ims_head_btn")
        .attr({ title: t("同时用必应、Yandex 和 360 识图打开对比") })
        .on("click", () => {
            void runMultiCompare();
        });

    const closeBtn = button(image(getImgUrl("close.svg"), "icon").class("icon"))
        .class(Class.click, "ims_icon_btn")
        .attr({ title: t("返回编辑器") })
        .on("click", () => {
            hide();
            cb.onCloseStudio();
        });

    const header = view("x")
        .class("ims_header")
        .add([
            view("y")
                .style({ gap: "2px", minWidth: 0 })
                .add([titleEl, subtitleEl]),
            view("x")
                .style({ gap: "8px", alignItems: "center", flexShrink: 0 })
                .add([multiSearchBtn, closeBtn]),
        ])
        .addInto(root);
    void header;

    const bodyGrid = view("x").class("ims_body").addInto(root);

    // Left: image preview & quick actions
    const previewCard = view("y")
        .class("pun-card", "ims_preview_card")
        .addInto(bodyGrid);
    attachSpotlight(previewCard.el);

    const previewImg = image("", "preview")
        .class("ims_preview_img")
        .style({ display: "none" });
    const emptyPrompt = view("y")
        .class("ims_empty_prompt")
        .add([
            view()
                .class("ims_empty_icon", "pun-no-icon-box")
                .add(image(getImgUrl("img.svg"), "icon").class("icon")),
            txt(t("拖入图片、点击选图或 Ctrl+V 粘贴")).style({
                fontSize: "12.5px",
                fontWeight: 600,
                textAlign: "center",
            }),
            txt(t("支持 PNG / JPG / WebP，自动压缩直达真图检索")).style({
                fontSize: "11px",
                color: "var(--font-color-l)",
                textAlign: "center",
            }),
        ]);
    const previewScan = view().class("ims_scan_beam");
    const previewStage = view()
        .class("ims_preview_stage")
        .add([previewImg, emptyPrompt, previewScan])
        .on("click", () => {
            if (!currentImageDataUrl) fileInput.el.click();
        })
        .addInto(previewCard);

    const metaDimEl = txt("—").class("pun-pill");
    const metaSizeEl = txt("—").class("pun-pill");
    const metaRow = view("x", "wrap")
        .style({ gap: "6px", alignItems: "center" })
        .add([metaDimEl, metaSizeEl])
        .addInto(previewCard);
    void metaRow;

    const fileInput = input("file")
        .attr({ accept: "image/*" })
        .style({ display: "none" })
        .addInto(previewCard);

    const replaceBtn = button([
        image(getImgUrl("img.svg"), "icon").class("icon"),
        txt(t("换一张图"), true),
    ])
        .class("ims_action_btn")
        .on("click", () => fileInput.el.click());

    const copyLinkBtn = button([
        image(getImgUrl("link.svg"), "icon").class("icon"),
        txt(t("复制图链"), true),
    ])
        .class("ims_action_btn")
        .style({ display: "none" })
        .on("click", () => {
            if (!cachedPublicUrl) return;
            void writeText(cachedPublicUrl);
            showToast(t("已复制公开图片链接"), "success");
        });

    const toOcrBtn = button([
        image(getImgUrl("ocr.svg"), "icon").class("icon"),
        txt(t("提取文字"), true),
    ])
        .class("ims_action_btn")
        .on("click", () => {
            if (!currentImageDataUrl) return;
            hide();
            cb.onRunOcr(currentImageDataUrl);
        });

    view("x", "wrap")
        .class("ims_preview_actions")
        .add([replaceBtn, toOcrBtn, copyLinkBtn])
        .addInto(previewCard);

    // Drag & drop + paste replacement
    previewStage.on("dragover", (e) => {
        e.preventDefault();
        previewStage.el.classList.add("drag-over");
    });
    previewStage.on("dragleave", () => {
        previewStage.el.classList.remove("drag-over");
    });
    previewStage.on("drop", (e) => {
        e.preventDefault();
        previewStage.el.classList.remove("drag-over");
        const file = e.dataTransfer?.files?.[0];
        if (file?.type.startsWith("image/")) {
            loadFileAsImage(file);
        }
    });
    fileInput.on("change", () => {
        const file = fileInput.el.files?.[0];
        if (file) loadFileAsImage(file);
        fileInput.el.value = "";
    });

    function loadFileAsImage(file: File) {
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === "string") {
                void startSearch(reader.result, currentEngine, true);
            }
        };
        reader.readAsDataURL(file);
    }

    window.addEventListener("paste", (e) => {
        if (!isVisible()) return;
        const items = e.clipboardData?.items;
        if (!items) return;
        for (const item of Array.from(items)) {
            if (item.type.startsWith("image/")) {
                const file = item.getAsFile();
                if (file) {
                    e.preventDefault();
                    loadFileAsImage(file);
                    return;
                }
            }
        }
    });

    // Right: status banner + engine cards grid
    const rightCol = view("y").class("ims_right_col").addInto(bodyGrid);

    const statusBanner = view("y")
        .class("pun-card", "ims_status_banner")
        .addInto(rightCol);
    attachSpotlight(statusBanner.el);
    const statusTopRow = view("x")
        .style({
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px",
        })
        .addInto(statusBanner);
    const statusDot = view().class("ims_status_dot");
    const statusTitle = txt(t("准备就绪")).class("ims_status_title");
    const statusActions = view("x").style({ gap: "6px", flexShrink: 0 });
    statusTopRow.add([
        view("x")
            .style({ alignItems: "center", gap: "8px", minWidth: 0 })
            .add([statusDot, statusTitle]),
        statusActions,
    ]);
    const statusDetail = txt("")
        .class("ims_status_detail")
        .addInto(statusBanner);
    const progressTrack = view()
        .class("pun-progress-track")
        .style({ height: "5px" });
    const progressFill = view()
        .class("pun-progress-fill")
        .addInto(progressTrack);
    statusBanner.add(progressTrack);

    const engineGrid = view().class("ims_engine_grid").addInto(rightCol);
    const engineCardMap = new Map<
        ImageSearchEngine,
        {
            card: ReturnType<typeof button>;
            badge: ReturnType<typeof txt>;
        }
    >();

    for (const [idx, meta] of IMAGE_SEARCH_ENGINES.entries()) {
        const badge = txt(t(meta.tag)).class("ims_engine_status");
        const dot = view()
            .class("ims_engine_dot")
            .style({
                background: meta.color,
                boxShadow: `0 0 8px ${meta.color}66`,
            });
        const card = button([
            view("x")
                .style({
                    width: "100%",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "6px",
                })
                .add([
                    view("x")
                        .style({ alignItems: "center", gap: "8px" })
                        .add([
                            dot,
                            txt(t(meta.name), true).class("ims_engine_name"),
                        ]),
                    badge,
                ]),
            txt(t(meta.desc), true).class("ims_engine_desc"),
        ])
            .class("ims_engine_card")
            .style({
                animation: `punCardIn 0.22s var(--ease-out-expo) ${idx * 28}ms both`,
            })
            .on("click", () => {
                if (!currentImageDataUrl) {
                    fileInput.el.click();
                    return;
                }
                store.set("以图搜图.引擎", meta.id);
                void runEngine(meta.id, false);
            });
        attachSpotlight(card.el);
        engineCardMap.set(meta.id, { card, badge });
        engineGrid.add(card);
    }

    function updateImageMeta(dataUrl: string) {
        if (!dataUrl) {
            previewImg.el.removeAttribute("src");
            previewImg.style({ display: "none" });
            emptyPrompt.style({ display: "flex" });
            previewStage.el.classList.add("empty");
            metaDimEl.sv(t("待选图"));
            metaSizeEl.sv(t("支持粘贴"));
            return;
        }
        previewImg.el.src = dataUrl;
        previewImg.style({ display: "block" });
        emptyPrompt.style({ display: "none" });
        previewStage.el.classList.remove("empty");
        const base64Len = dataUrl.includes(",")
            ? dataUrl.length - dataUrl.indexOf(",") - 1
            : dataUrl.length;
        const kb = Math.max(1, Math.round((base64Len * 0.75) / 1024));
        metaSizeEl.sv(kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`);
        const probe = new Image();
        probe.onload = () => {
            metaDimEl.sv(`${probe.naturalWidth} × ${probe.naturalHeight}`);
        };
        probe.src = dataUrl;
    }

    function syncEngineCards() {
        for (const meta of IMAGE_SEARCH_ENGINES) {
            const ui = engineCardMap.get(meta.id);
            if (!ui) continue;
            const st = engineResults.get(meta.id);
            const active = meta.id === currentEngine;
            ui.card.el.classList.toggle("active", active);
            ui.card.el.classList.toggle("loading", st?.state === "loading");
            ui.card.el.classList.toggle("done", st?.state === "done");
            ui.card.el.classList.toggle("error", st?.state === "error");

            if (st?.state === "loading") {
                ui.badge.sv(t("检索中..."));
            } else if (st?.state === "done") {
                ui.badge.sv(
                    st.elapsedMs
                        ? `${t("已打开")} ${st.elapsedMs}ms`
                        : t("已打开"),
                );
            } else if (st?.state === "error") {
                ui.badge.sv(t("重试"));
            } else {
                ui.badge.sv(t(meta.tag));
            }
        }
        copyLinkBtn.style({
            display: cachedPublicUrl ? "inline-flex" : "none",
        });
    }

    function setBanner(
        tone: "loading" | "success" | "error" | "idle",
        title: string,
        detail: string,
        progressPct: number,
        actions?: ReturnType<typeof button>[],
    ) {
        statusBanner.el.dataset.tone = tone;
        statusTitle.sv(title);
        statusDetail.sv(detail);
        progressFill.style({
            width: `${Math.max(0, Math.min(100, progressPct))}%`,
        });
        progressTrack.style({ display: tone === "idle" ? "none" : "" });
        previewStage.el.classList.toggle("scanning", tone === "loading");
        statusActions.clear();
        if (actions && actions.length > 0) statusActions.add(actions);
    }

    function openSearchOutcome(res: Extract<ImageSearchResult, { ok: true }>) {
        if (res.engine === "ai") {
            renderSend("openImageSearchTab", [
                {
                    windowName: cb.getWindowName(),
                    url: "./aiVision.html",
                    engine: "ai",
                    imageDataUrl: currentImageDataUrl,
                },
            ]);
            return;
        }
        if (res.mode === "browser_upload") {
            renderSend("openImageSearchTab", [
                {
                    windowName: cb.getWindowName(),
                    url: res.url,
                    engine: res.engine,
                    imageDataUrl: currentImageDataUrl,
                    browserUpload: res.browserUpload,
                },
            ]);
            return;
        }
        if (cb.openInExternalBrowser()) {
            renderSend("openUrl", [res.url]);
        } else {
            cb.onOpenUrl(res.url);
        }
    }

    async function runEngine(engine: ImageSearchEngine, autoFallback: boolean) {
        const mySeq = ++searchSeq;
        currentEngine = engine;
        const meta =
            IMAGE_SEARCH_ENGINES.find((e) => e.id === engine) ??
            IMAGE_SEARCH_ENGINES[0];

        if (engine === "ai") {
            engineResults.set("ai", { state: "done", elapsedMs: 0 });
            syncEngineCards();
            setBanner(
                "success",
                t("已打开 AI 识图"),
                t("可在 AI 视觉标签页中继续追问画面细节"),
                100,
            );
            renderSend("openImageSearchTab", [
                {
                    windowName: cb.getWindowName(),
                    url: "./aiVision.html",
                    engine: "ai",
                    imageDataUrl: currentImageDataUrl,
                },
            ]);
            return;
        }

        engineResults.set(engine, { state: "loading" });
        syncEngineCards();
        setBanner(
            "loading",
            `${t("正在通过")} ${t(meta.name)} ${t("检索...")}`,
            cachedPublicUrl
                ? t("已命中图片缓存，正在直达检索结果页...")
                : t("正在优化图像并安全上传，请稍候..."),
            48,
        );

        const res = await renderInvoke("reverseImageSearch", [
            {
                imageDataUrl: currentImageDataUrl,
                engine,
                autoFallback,
                cachedPublicUrl,
            },
        ]);
        if (mySeq !== searchSeq) return;

        lastResult = res;
        if (res.publicImageUrl) {
            cachedPublicUrl = res.publicImageUrl;
        }

        if (res.ok) {
            currentEngine = res.engine;
            const usedMeta =
                IMAGE_SEARCH_ENGINES.find((e) => e.id === res.engine) ?? meta;
            engineResults.set(res.engine, {
                state: "done",
                url: res.url,
                elapsedMs: res.elapsedMs,
            });
            if (res.fallbackFrom && res.fallbackFrom !== res.engine) {
                engineResults.set(res.fallbackFrom, { state: "error" });
            }
            syncEngineCards();

            const openExtBtn = button(t("外部浏览器打开"))
                .class("ims_mini_btn")
                .on("click", () => renderSend("openUrl", [res.url]));
            const reopenBtn = button(t("再次打开结果页"))
                .class("ims_mini_btn")
                .on("click", () => openSearchOutcome(res));

            const fallbackNotice = res.fallbackFrom
                ? `${t("原引擎暂不可用，已自动切换至")} ${t(usedMeta.name)} · `
                : "";
            const uploadNotice =
                res.mode === "browser_upload"
                    ? t("已在内置页面自动注入原图并提交检索")
                    : `${t("检索完成")} (${res.elapsedMs}ms)`;

            setBanner(
                "success",
                `${t(usedMeta.name)} ${t("已就绪")}`,
                `${fallbackNotice}${uploadNotice}`,
                100,
                [reopenBtn, openExtBtn],
            );
            openSearchOutcome(res);
        } else {
            engineResults.set(engine, { state: "error", error: res.error });
            syncEngineCards();
            const retryBtn = button(t("重试"))
                .class("pun-btn-primary", "ims_mini_btn")
                .on("click", () => void runEngine(engine, false));
            const switchBtn = button(t("自动切换可用引擎"))
                .class("ims_mini_btn")
                .on("click", () => void runEngine("bing", true));
            setBanner(
                "error",
                `${t(meta.name)} ${t("连接失败")}`,
                res.error || t("请检查网络或切换其他引擎重试"),
                100,
                [retryBtn, switchBtn],
            );
        }
    }

    async function runMultiCompare() {
        if (!currentImageDataUrl) return;
        const targets: ImageSearchEngine[] = ["bing", "yandex", "so360"];
        showToast(t("正在同步启动必应、Yandex、360 识图..."), "info", 2200);
        for (const eng of targets) {
            const res = await renderInvoke("reverseImageSearch", [
                {
                    imageDataUrl: currentImageDataUrl,
                    engine: eng,
                    autoFallback: false,
                    cachedPublicUrl,
                },
            ]);
            if (res.publicImageUrl) cachedPublicUrl = res.publicImageUrl;
            if (res.ok) {
                engineResults.set(res.engine, {
                    state: "done",
                    url: res.url,
                    elapsedMs: res.elapsedMs,
                });
                openSearchOutcome(res);
            } else {
                engineResults.set(eng, { state: "error", error: res.error });
            }
            syncEngineCards();
        }
    }

    function show() {
        root.style({ display: "flex" });
    }

    function hide() {
        root.style({ display: "none" });
    }

    function isVisible() {
        return root.el.style.display !== "none";
    }

    async function startSearch(
        imageDataUrl: string,
        engineRaw?: string,
        autoFallback = true,
    ) {
        currentImageDataUrl = imageDataUrl;
        cachedPublicUrl = undefined;
        lastResult = null;
        engineResults.clear();
        const engine = normalizeImageSearchEngine(
            engineRaw || store.get("以图搜图.引擎"),
        );
        currentEngine = engine;
        updateImageMeta(imageDataUrl);
        syncEngineCards();
        show();
        await runEngine(engine, autoFallback);
    }

    function openEmpty(engineRaw?: string) {
        currentImageDataUrl = "";
        cachedPublicUrl = undefined;
        lastResult = null;
        engineResults.clear();
        currentEngine = normalizeImageSearchEngine(
            engineRaw || store.get("以图搜图.引擎"),
        );
        updateImageMeta("");
        syncEngineCards();
        setBanner(
            "idle",
            t("等待导入图片"),
            t(
                "拖入本地图片、点击左侧选图或直接按 Ctrl+V 粘贴剪贴板图片即可秒搜",
            ),
            0,
        );
        show();
    }

    return {
        el: root,
        startSearch,
        openEmpty,
        show,
        hide,
        isVisible,
        getLastResult: () => lastResult,
    };
}
