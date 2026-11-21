import { net } from "electron";
import { mainHandle } from "../../lib/ipc";
import { translateBergamot } from "./bergamot";

const UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

type BingToken = {
    host: string;
    key: string;
    token: string;
    ig: string;
    expiresAt: number;
};

let bingTokenCache: BingToken | null = null;

function mapBingLang(code: string): string {
    if (!code || code === "auto") return "auto-detect";
    const lower = code.toLowerCase();
    if (lower === "zh" || lower === "zh-cn" || lower === "zh-hans") {
        return "zh-Hans";
    }
    if (lower === "zh-tw" || lower === "zh-hk" || lower === "zh-hant") {
        return "zh-Hant";
    }
    return code;
}

function mapGoogleLang(code: string): string {
    if (!code || code === "auto") return "auto";
    const lower = code.toLowerCase();
    if (lower === "zh" || lower === "zh-hans") return "zh-CN";
    if (lower === "zh-hant") return "zh-TW";
    return code;
}

async function getBingToken(): Promise<BingToken> {
    if (bingTokenCache && Date.now() < bingTokenCache.expiresAt) {
        return bingTokenCache;
    }
    for (const host of ["https://cn.bing.com", "https://www.bing.com"]) {
        try {
            const res = await net.fetch(`${host}/translator`, {
                headers: { "User-Agent": UA },
                signal: AbortSignal.timeout(8000),
            });
            if (!res.ok) continue;
            const html = await res.text();
            const m = html.match(
                /params_AbusePreventionHelper\s*=\s*\[(\d+),\s*"([^"]+)"/,
            );
            const ig = html.match(/IG:"([^"]+)"/);
            if (m && ig) {
                bingTokenCache = {
                    host,
                    key: m[1],
                    token: m[2],
                    ig: ig[1],
                    expiresAt: Date.now() + 20 * 60 * 1000,
                };
                return bingTokenCache;
            }
        } catch {}
    }
    throw new Error("Bing token unavailable");
}

async function translateViaBing(
    texts: string[],
    from: string,
    to: string,
): Promise<string[]> {
    const tk = await getBingToken();
    const joined = texts.join("\n");
    const body = new URLSearchParams({
        fromLang: mapBingLang(from),
        to: mapBingLang(to),
        text: joined,
        token: tk.token,
        key: tk.key,
    });
    const res = await net.fetch(
        `${tk.host}/ttranslatev3?isVertical=1&IG=${encodeURIComponent(tk.ig)}&IID=translator.5028`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "User-Agent": UA,
            },
            body: body.toString(),
            signal: AbortSignal.timeout(10000),
        },
    );
    if (!res.ok) {
        bingTokenCache = null;
        throw new Error(`Bing HTTP ${res.status}`);
    }
    const data = (await res.json()) as {
        translations?: { text?: string }[];
    }[];
    const translated = data?.[0]?.translations?.[0]?.text;
    if (!translated) {
        bingTokenCache = null;
        throw new Error("Bing empty result");
    }
    if (texts.length === 1) return [translated];
    const split = translated.split("\n");
    return split.length === texts.length
        ? split
        : texts.map((_, i) => split[i] ?? translated);
}

async function translateViaGoogle(
    texts: string[],
    from: string,
    to: string,
): Promise<string[]> {
    const sl = mapGoogleLang(from);
    const tl = mapGoogleLang(to);
    const results: string[] = [];
    for (const text of texts) {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(sl)}&tl=${encodeURIComponent(tl)}&dt=t&q=${encodeURIComponent(text)}`;
        const res = await net.fetch(url, {
            headers: { "User-Agent": UA },
            signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) throw new Error(`Google HTTP ${res.status}`);
        const data = (await res.json()) as [Array<[string]>];
        const out = (data?.[0] ?? []).map((seg) => seg?.[0] ?? "").join("");
        if (!out) throw new Error("Google empty result");
        results.push(out);
    }
    return results;
}

async function translateViaMyMemory(
    texts: string[],
    from: string,
    to: string,
): Promise<string[]> {
    const sl = from === "auto" ? "autodetect" : mapGoogleLang(from);
    const tl = mapGoogleLang(to);
    const results: string[] = [];
    for (const text of texts) {
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(`${sl}|${tl}`)}`;
        const res = await net.fetch(url, {
            headers: { "User-Agent": UA },
            signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) throw new Error(`MyMemory HTTP ${res.status}`);
        const data = (await res.json()) as {
            responseData?: { translatedText?: string };
        };
        const out = data?.responseData?.translatedText;
        if (!out) throw new Error("MyMemory empty result");
        results.push(out);
    }
    return results;
}

export async function translateFree(
    texts: string[],
    from: string,
    to: string,
): Promise<string[]> {
    if (texts.length === 0) return [];
    const providers = [
        () => translateViaBing(texts, from, to),
        () => translateViaGoogle(texts, from, to),
        () => translateViaMyMemory(texts, from, to),
        () => translateBergamot(texts, from, to),
    ];
    let lastErr: unknown;
    for (const run of providers) {
        try {
            return await run();
        } catch (error) {
            lastErr = error;
        }
    }
    throw lastErr instanceof Error
        ? lastErr
        : new Error("内置免费翻译暂时不可用");
}

let freeInited = false;

export function initFreeTranslate() {
    if (freeInited) return;
    freeInited = true;
    mainHandle("free_translate", ([data]) =>
        translateFree(data.texts, data.from, data.to),
    );
}
