export type ImageSearchEngine =
    | "bing"
    | "baidu"
    | "google"
    | "yandex"
    | "so360"
    | "saucenao"
    | "ai";

export type ImageSearchEngineMeta = {
    id: ImageSearchEngine;
    name: string;
    desc: string;
    tag: string;
    color: string;
};

export const IMAGE_SEARCH_ENGINES: ImageSearchEngineMeta[] = [
    {
        id: "bing",
        name: "必应识图",
        desc: "综合识物、商品与来源页，速度快且稳定",
        tag: "推荐",
        color: "#0ea5e9",
    },
    {
        id: "yandex",
        name: "Yandex",
        desc: "高清原图、壁纸、人像与冷门出处极强",
        tag: "原图强",
        color: "#ef4444",
    },
    {
        id: "google",
        name: "Google Lens",
        desc: "全球智能视觉检索，支持文字与商品识别",
        tag: "全球",
        color: "#3b82f6",
    },
    {
        id: "so360",
        name: "360 识图",
        desc: "国内直连免代理，相似图与中文来源",
        tag: "国内直连",
        color: "#10b981",
    },
    {
        id: "baidu",
        name: "百度识图",
        desc: "中文百科、人物与资讯图片智能自动上传",
        tag: "中文",
        color: "#2563eb",
    },
    {
        id: "saucenao",
        name: "SauceNAO",
        desc: "二次元插画、漫画、番剧与画师出处",
        tag: "二次元",
        color: "#f59e0b",
    },
    {
        id: "ai",
        name: "AI 识图",
        desc: "调用多模态视觉模型深度解读画面内容",
        tag: "智能",
        color: "#8b5cf6",
    },
];

export type ImageSearchBrowserUpload = {
    fileInputSelector: string;
    mimeType: string;
    fileName: string;
};

export type ImageSearchRequest = {
    imageDataUrl: string;
    engine: ImageSearchEngine | (string & {});
    autoFallback?: boolean;
    cachedPublicUrl?: string;
};

export type ImageSearchResult =
    | {
          ok: true;
          engine: ImageSearchEngine;
          requestedEngine: ImageSearchEngine;
          fallbackFrom?: ImageSearchEngine;
          mode: "url" | "browser_upload";
          url: string;
          publicImageUrl?: string;
          elapsedMs: number;
          browserUpload?: ImageSearchBrowserUpload;
      }
    | {
          ok: false;
          engine: ImageSearchEngine;
          error: string;
          elapsedMs: number;
          publicImageUrl?: string;
      };

const DESKTOP_UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const GOOGLE_CONSENT_COOKIE =
    "SOCS=CAESHAgBEhJnd3NfMjAyNDA4MTUtMF9SQzIaAnpoIAEaBgiA9vO1Bg";

type FetchLike = (
    input: string,
    init?: RequestInit,
) => Promise<{
    ok: boolean;
    status: number;
    url?: string;
    headers: { get(name: string): string | null };
    text(): Promise<string>;
    json(): Promise<unknown>;
}>;

export type ReverseSearchDeps = {
    fetchImpl?: FetchLike;
    optimizeImage?: (
        raw: Buffer,
        mime: string,
    ) => { buffer: Buffer; mime: string; ext: string };
};

const publicUrlCache = new Map<string, { url: string; expiresAt: number }>();
const CACHE_TTL_MS = 25 * 60 * 1000;

export function normalizeImageSearchEngine(raw?: string): ImageSearchEngine {
    const v = (raw || "").trim().toLowerCase();
    switch (v) {
        case "bing":
        case "baidu":
        case "google":
        case "yandex":
        case "so360":
        case "saucenao":
        case "ai":
            return v;
        default:
            return "bing";
    }
}

function parseDataUrl(dataUrl: string): { buffer: Buffer; mime: string } {
    const match = /^data:(image\/[\w.+-]+);base64,(.+)$/i.exec(dataUrl.trim());
    if (match) {
        return {
            mime: match[1].toLowerCase(),
            buffer: Buffer.from(match[2], "base64"),
        };
    }
    return {
        mime: "image/png",
        buffer: Buffer.from(dataUrl.trim(), "base64"),
    };
}

function hashBuffer(buf: Uint8Array): string {
    let h1 = 0x811c9dc5;
    let h2 = 0x01000193;
    const step = Math.max(1, Math.floor(buf.length / 4096));
    for (let i = 0; i < buf.length; i += step) {
        const b = buf[i];
        h1 = Math.imul(h1 ^ b, 0x01000193);
        h2 = Math.imul(h2 ^ ((b + i) & 0xff), 0x85ebca6b);
    }
    return `${buf.length.toString(16)}-${(h1 >>> 0).toString(16)}-${(h2 >>> 0).toString(16)}`;
}

function getCachedPublicUrl(hash: string): string | undefined {
    const entry = publicUrlCache.get(hash);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
        publicUrlCache.delete(hash);
        return undefined;
    }
    return entry.url;
}

function setCachedPublicUrl(hash: string, url: string) {
    if (!url || !/^https?:\/\//i.test(url)) return;
    if (publicUrlCache.size > 40) {
        const firstKey = publicUrlCache.keys().next().value;
        if (firstKey) publicUrlCache.delete(firstKey);
    }
    publicUrlCache.set(hash, { url, expiresAt: Date.now() + CACHE_TTL_MS });
}

function formatError(err: unknown): string {
    if (err instanceof Error) {
        if (err.name === "TimeoutError" || err.name === "AbortError") {
            return "请求超时，请检查网络连接或代理设置";
        }
        return err.message || String(err);
    }
    return String(err);
}

async function uploadToYandexCbir(
    fetchImpl: FetchLike,
    buf: Buffer,
    mime: string,
): Promise<{ cbirId: string; imageUrl: string; searchUrl: string }> {
    const endpoint =
        "https://yandex.com/images-apphost/image-download?cbird=111&images_avatars_size=preview&images_avatars_namespace=images-cbir";
    const res = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
            "User-Agent": DESKTOP_UA,
            "Content-Type": mime,
            Referer: "https://yandex.com/images/",
        },
        body: new Uint8Array(buf),
        signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) {
        throw new Error(`Yandex 上传失败 (HTTP ${res.status})`);
    }
    const data = (await res.json()) as {
        url?: string;
        cbir_id?: string;
        sizes?: {
            orig?: { path?: string };
            preview?: { path?: string };
        };
    };
    const origUrl =
        data.sizes?.orig?.path || data.url || data.sizes?.preview?.path || "";
    const cbirId = data.cbir_id || "";
    if (!origUrl && !cbirId) {
        throw new Error("Yandex 未返回有效图片地址");
    }
    const params = new URLSearchParams({ rpt: "imageview" });
    if (cbirId) params.set("cbir_id", cbirId);
    if (origUrl) params.set("url", origUrl);
    return {
        cbirId,
        imageUrl: origUrl,
        searchUrl: `https://yandex.com/images/search?${params.toString()}`,
    };
}

async function uploadToCatbox(
    fetchImpl: FetchLike,
    buf: Buffer,
    mime: string,
    ext: string,
): Promise<string> {
    const fd = new FormData();
    fd.append("reqtype", "fileupload");
    fd.append(
        "fileToUpload",
        new Blob([new Uint8Array(buf)], { type: mime }),
        `punpun.${ext}`,
    );
    const res = await fetchImpl("https://catbox.moe/user/api.php", {
        method: "POST",
        headers: { "User-Agent": DESKTOP_UA },
        body: fd,
        signal: AbortSignal.timeout(12000),
    });
    const text = (await res.text()).trim();
    if (!res.ok || !/^https?:\/\//i.test(text)) {
        throw new Error(`公共图床上传失败 (HTTP ${res.status})`);
    }
    return text;
}

async function ensurePublicImageUrl(
    fetchImpl: FetchLike,
    hash: string,
    buf: Buffer,
    mime: string,
    ext: string,
    hint?: string,
): Promise<string> {
    if (hint && /^https?:\/\//i.test(hint)) {
        setCachedPublicUrl(hash, hint);
        return hint;
    }
    const cached = getCachedPublicUrl(hash);
    if (cached) return cached;

    const errors: string[] = [];
    try {
        const y = await uploadToYandexCbir(fetchImpl, buf, mime);
        if (y.imageUrl) {
            setCachedPublicUrl(hash, y.imageUrl);
            return y.imageUrl;
        }
    } catch (e) {
        errors.push(`Yandex: ${formatError(e)}`);
    }

    try {
        const catUrl = await uploadToCatbox(fetchImpl, buf, mime, ext);
        setCachedPublicUrl(hash, catUrl);
        return catUrl;
    } catch (e) {
        errors.push(`Catbox: ${formatError(e)}`);
    }

    throw new Error(`图片中转上传失败（${errors.join("；")}）`);
}

async function searchGoogleLens(
    fetchImpl: FetchLike,
    hash: string,
    buf: Buffer,
    mime: string,
    ext: string,
    cachedPublicUrl?: string,
): Promise<{ url: string; publicImageUrl?: string }> {
    try {
        const fd = new FormData();
        fd.append(
            "encoded_image",
            new Blob([new Uint8Array(buf)], { type: mime }),
            `punpun.${ext}`,
        );
        fd.append("image_content", "");
        const endpoint = `https://lens.google.com/v3/upload?hl=zh-CN&re=df&st=${Date.now()}&vpw=1280&vph=800`;
        const res = await fetchImpl(endpoint, {
            method: "POST",
            headers: {
                "User-Agent": DESKTOP_UA,
                Referer: "https://lens.google.com/",
                Cookie: GOOGLE_CONSENT_COOKIE,
            },
            body: fd,
            redirect: "follow",
            signal: AbortSignal.timeout(12000),
        });
        const loc = res.headers.get("location") || res.url || "";
        if (
            /^https:\/\/(?:www\.google\.com|lens\.google\.com)\/search\?/i.test(
                loc,
            )
        ) {
            return { url: loc };
        }
        const html = await res.text();
        const urlMatch = html.match(
            /https:\/\/(?:www\.google\.com|lens\.google\.com)\/search\?[^"'\\<\s]+/i,
        );
        if (urlMatch?.[0]) {
            return { url: urlMatch[0].replaceAll("\\u0026", "&") };
        }
    } catch {
        // 直传失败时回退为公开图链检索
    }

    const publicUrl = await ensurePublicImageUrl(
        fetchImpl,
        hash,
        buf,
        mime,
        ext,
        cachedPublicUrl,
    );
    return {
        url: `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(publicUrl)}&hl=zh-CN`,
        publicImageUrl: publicUrl,
    };
}

async function searchSo360(
    fetchImpl: FetchLike,
    buf: Buffer,
    mime: string,
    ext: string,
): Promise<{
    mode: "url" | "browser_upload";
    url: string;
    browserUpload?: ImageSearchBrowserUpload;
}> {
    try {
        const fd = new FormData();
        fd.append(
            "upload",
            new Blob([new Uint8Array(buf)], { type: mime }),
            `punpun.${ext}`,
        );
        const res = await fetchImpl("https://st.so.com/stu", {
            method: "POST",
            headers: {
                "User-Agent": DESKTOP_UA,
                Referer: "https://st.so.com/",
            },
            body: fd,
            redirect: "follow",
            signal: AbortSignal.timeout(10000),
        });
        const loc = res.headers.get("location");
        if (loc) {
            const fullUrl = loc.startsWith("http")
                ? loc
                : `https://st.so.com${loc.startsWith("/") ? "" : "/"}${loc}`;
            return { mode: "url", url: fullUrl };
        }
        if (res.url?.includes("imgkey=")) {
            return { mode: "url", url: res.url };
        }
    } catch {
        // 直传受限时回退到内置页自动表单提交
    }
    return {
        mode: "browser_upload",
        url: "https://st.so.com/",
        browserUpload: {
            fileInputSelector: 'input[type="file"]',
            mimeType: mime,
            fileName: `punpun.${ext}`,
        },
    };
}

async function searchBing(
    fetchImpl: FetchLike,
    hash: string,
    buf: Buffer,
    mime: string,
    ext: string,
    cachedPublicUrl?: string,
): Promise<{ url: string; publicImageUrl: string }> {
    const publicUrl = await ensurePublicImageUrl(
        fetchImpl,
        hash,
        buf,
        mime,
        ext,
        cachedPublicUrl,
    );
    const searchUrl = `https://www.bing.com/images/search?view=detailv2&iss=sbi&form=SBIVSP&sbisrc=UrlPaste&q=imgurl:${encodeURIComponent(publicUrl)}`;
    return { url: searchUrl, publicImageUrl: publicUrl };
}

async function searchBaidu(
    fetchImpl: FetchLike,
    buf: Buffer,
    mime: string,
    ext: string,
): Promise<{
    mode: "url" | "browser_upload";
    url: string;
    browserUpload?: ImageSearchBrowserUpload;
}> {
    try {
        const fd = new FormData();
        fd.append(
            "image",
            new Blob([new Uint8Array(buf)], { type: mime }),
            `punpun.${ext}`,
        );
        fd.append("tn", "pc");
        fd.append("from", "pc");
        fd.append("image_source", "PC_UPLOAD_SEARCH_FILE");
        const res = await fetchImpl(
            `https://graph.baidu.com/upload?uptime=${Date.now()}`,
            {
                method: "POST",
                headers: {
                    "User-Agent": DESKTOP_UA,
                    Referer: "https://graph.baidu.com/pcpage/index?tpl_from=pc",
                    Origin: "https://graph.baidu.com",
                },
                body: fd,
                signal: AbortSignal.timeout(5500),
            },
        );
        if (res.ok) {
            const json = (await res.json()) as {
                status?: number;
                msg?: string;
                data?: { url?: string };
            };
            if (json.status === 0 && json.data?.url) {
                return { mode: "url", url: json.data.url };
            }
        }
    } catch {
        // 百度直传接口对无 Cookie 请求常返回 Reject，回退到内置浏览器页原生表单自动提交
    }
    return {
        mode: "browser_upload",
        url: "https://graph.baidu.com/pcpage/index?tpl_from=pc",
        browserUpload: {
            fileInputSelector: 'input[type="file"]',
            mimeType: mime,
            fileName: `punpun.${ext}`,
        },
    };
}

async function executeSingleEngine(
    engine: ImageSearchEngine,
    fetchImpl: FetchLike,
    hash: string,
    buf: Buffer,
    mime: string,
    ext: string,
    cachedPublicUrl?: string,
): Promise<{
    mode: "url" | "browser_upload";
    url: string;
    publicImageUrl?: string;
    browserUpload?: ImageSearchBrowserUpload;
}> {
    switch (engine) {
        case "bing": {
            const r = await searchBing(
                fetchImpl,
                hash,
                buf,
                mime,
                ext,
                cachedPublicUrl,
            );
            return {
                mode: "url",
                url: r.url,
                publicImageUrl: r.publicImageUrl,
            };
        }
        case "yandex": {
            const r = await uploadToYandexCbir(fetchImpl, buf, mime);
            if (r.imageUrl) setCachedPublicUrl(hash, r.imageUrl);
            return {
                mode: "url",
                url: r.searchUrl,
                publicImageUrl: r.imageUrl || cachedPublicUrl,
            };
        }
        case "google": {
            const r = await searchGoogleLens(
                fetchImpl,
                hash,
                buf,
                mime,
                ext,
                cachedPublicUrl,
            );
            return {
                mode: "url",
                url: r.url,
                publicImageUrl: r.publicImageUrl || cachedPublicUrl,
            };
        }
        case "so360": {
            const r = await searchSo360(fetchImpl, buf, mime, ext);
            return {
                mode: r.mode,
                url: r.url,
                publicImageUrl: cachedPublicUrl,
                browserUpload: r.browserUpload,
            };
        }
        case "baidu": {
            const r = await searchBaidu(fetchImpl, buf, mime, ext);
            return {
                mode: r.mode,
                url: r.url,
                publicImageUrl: cachedPublicUrl,
                browserUpload: r.browserUpload,
            };
        }
        case "saucenao": {
            const publicUrl = await ensurePublicImageUrl(
                fetchImpl,
                hash,
                buf,
                mime,
                ext,
                cachedPublicUrl,
            );
            return {
                mode: "url",
                url: `https://saucenao.com/search.php?url=${encodeURIComponent(publicUrl)}`,
                publicImageUrl: publicUrl,
            };
        }
        case "ai":
            return {
                mode: "url",
                url: "./aiVision.html",
                publicImageUrl: cachedPublicUrl,
            };
    }
}

const FALLBACK_ORDER: ImageSearchEngine[] = [
    "bing",
    "yandex",
    "so360",
    "google",
    "baidu",
];

export async function runReverseImageSearch(
    req: ImageSearchRequest,
    deps: ReverseSearchDeps = {},
): Promise<ImageSearchResult> {
    const startedAt = Date.now();
    const fetchImpl: FetchLike =
        deps.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
    const requestedEngine = normalizeImageSearchEngine(req.engine);

    if (requestedEngine === "ai") {
        return {
            ok: true,
            engine: "ai",
            requestedEngine: "ai",
            mode: "url",
            url: "./aiVision.html",
            elapsedMs: Date.now() - startedAt,
        };
    }

    const parsed = parseDataUrl(req.imageDataUrl);
    if (parsed.buffer.length === 0) {
        return {
            ok: false,
            engine: requestedEngine,
            error: "图片数据为空，无法发起搜图",
            elapsedMs: Date.now() - startedAt,
        };
    }

    const optimized = deps.optimizeImage
        ? deps.optimizeImage(parsed.buffer, parsed.mime)
        : {
              buffer: parsed.buffer,
              mime: parsed.mime,
              ext: parsed.mime.includes("jpeg") ? "jpg" : "png",
          };
    const hash = hashBuffer(optimized.buffer);
    let knownPublicUrl = req.cachedPublicUrl || getCachedPublicUrl(hash);

    const candidates: ImageSearchEngine[] = req.autoFallback
        ? [
              requestedEngine,
              ...FALLBACK_ORDER.filter((e) => e !== requestedEngine),
          ]
        : [requestedEngine];

    let lastError = "";
    for (const candidate of candidates) {
        try {
            const res = await executeSingleEngine(
                candidate,
                fetchImpl,
                hash,
                optimized.buffer,
                optimized.mime,
                optimized.ext,
                knownPublicUrl,
            );
            if (res.publicImageUrl) knownPublicUrl = res.publicImageUrl;
            return {
                ok: true,
                engine: candidate,
                requestedEngine,
                fallbackFrom:
                    candidate !== requestedEngine ? requestedEngine : undefined,
                mode: res.mode,
                url: res.url,
                publicImageUrl: knownPublicUrl,
                elapsedMs: Date.now() - startedAt,
                browserUpload: res.browserUpload,
            };
        } catch (err) {
            lastError = formatError(err);
        }
    }

    return {
        ok: false,
        engine: requestedEngine,
        error: lastError || "搜图请求失败",
        elapsedMs: Date.now() - startedAt,
        publicImageUrl: knownPublicUrl,
    };
}
