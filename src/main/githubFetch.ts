import { createHash } from "node:crypto";
import { net } from "electron";

export const FALLBACK_GITHUB_BASES = [
    "https://gh-proxy.org/https://github.com/",
    "https://gh-proxy.com/https://github.com/",
    "https://ghfast.top/https://github.com/",
    "https://ghproxy.net/https://github.com/",
    "https://ghfile.geekertao.top/https://github.com/",
    "https://github.com/",
];

const FETCH_UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

let githubBaseResolver: (relPath: string) => string = (path) =>
    `https://github.com/${path.replace(/^\//, "")}`;
let preferredMirrorBase: string | undefined;

export function setGithubBaseResolver(fn: (relPath: string) => string) {
    githubBaseResolver = fn;
}

export function githubAssetCandidates(
    relPath: string,
): { base: string; url: string }[] {
    const cleanRel = relPath.replace(/^\//, "");
    const list: { base: string; url: string }[] = [];
    const seen = new Set<string>();
    const add = (base: string, url: string) => {
        if (!url || seen.has(url)) return;
        seen.add(url);
        list.push({ base, url });
    };

    const userUrl = githubBaseResolver(cleanRel);
    const isCustomUserMirror =
        userUrl && !userUrl.startsWith("https://github.com/");
    if (isCustomUserMirror) {
        add(userUrl.slice(0, userUrl.length - cleanRel.length), userUrl);
    }
    if (preferredMirrorBase) {
        add(preferredMirrorBase, `${preferredMirrorBase}${cleanRel}`);
    }
    for (const base of FALLBACK_GITHUB_BASES) {
        add(base, `${base}${cleanRel}`);
    }
    if (userUrl) {
        add(userUrl.slice(0, userUrl.length - cleanRel.length), userUrl);
    }
    return list;
}

export async function fetchWithConnectTimeout(
    url: string,
    connectTimeoutMs = 12_000,
): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), connectTimeoutMs);
    const doFetch = net?.fetch ? net.fetch.bind(net) : fetch;
    try {
        return await doFetch(url, {
            headers: { "User-Agent": FETCH_UA },
            signal: controller.signal,
        });
    } finally {
        clearTimeout(timer);
    }
}

export async function fetchGitHubJson<T>(
    relPath: string,
    validate?: (data: T) => boolean,
    connectTimeoutMs = 12_000,
): Promise<T> {
    const candidates = githubAssetCandidates(relPath);
    let lastError: unknown;
    for (const { base, url } of candidates) {
        try {
            const response = await fetchWithConnectTimeout(
                url,
                connectTimeoutMs,
            );
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const data = (await response.json()) as T;
            if (validate && !validate(data)) {
                throw new Error("清单内容格式无效");
            }
            preferredMirrorBase = base;
            return data;
        } catch (error) {
            lastError = error;
            console.warn(`GitHub 清单线路失败 (${base}):`, error);
        }
    }
    const reason =
        lastError instanceof Error ? lastError.message : String(lastError);
    throw new Error(
        `无法连接下载服务器（已自动尝试 ${candidates.length} 条镜像线路，最后错误：${reason}），请检查网络或代理设置后重试`,
    );
}

async function readResponseBytes(
    url: string,
    connectTimeoutMs: number,
    stallTimeoutMs: number,
    onProgress?: (progress: { received: number; total?: number }) => void,
): Promise<Buffer> {
    const response = await fetchWithConnectTimeout(url, connectTimeoutMs);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    const length = response.headers.get("content-length");
    const total = length ? Number(length) : undefined;

    if (!response.body) {
        return Buffer.from(await response.arrayBuffer());
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    let lastChunkAt = Date.now();
    let stalled = false;
    const stallCheck = setInterval(() => {
        if (Date.now() - lastChunkAt > stallTimeoutMs) {
            stalled = true;
            void reader.cancel("download stalled");
        }
    }, 5_000);

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            lastChunkAt = Date.now();
            chunks.push(value);
            received += value.length;
            onProgress?.({ received, total });
        }
    } finally {
        clearInterval(stallCheck);
    }
    if (stalled) {
        throw new Error("下载速度过慢或连接中断");
    }
    return Buffer.concat(chunks, received);
}

export async function fetchGitHubBytes(
    relPath: string,
    opts?: {
        expectedSha256?: string;
        connectTimeoutMs?: number;
        stallTimeoutMs?: number;
        onProgress?: (progress: { received: number; total?: number }) => void;
    },
): Promise<Buffer> {
    const candidates = githubAssetCandidates(relPath);
    const connectTimeoutMs = opts?.connectTimeoutMs ?? 15_000;
    const stallTimeoutMs = opts?.stallTimeoutMs ?? 25_000;
    let lastError: unknown;

    for (const { base, url } of candidates) {
        try {
            const downloaded = await readResponseBytes(
                url,
                connectTimeoutMs,
                stallTimeoutMs,
                opts?.onProgress,
            );
            if (opts?.expectedSha256) {
                const hash = createHash("sha256")
                    .update(downloaded)
                    .digest("hex");
                if (hash !== opts.expectedSha256) {
                    throw new Error("文件校验不匹配");
                }
            }
            preferredMirrorBase = base;
            return downloaded;
        } catch (error) {
            lastError = error;
            console.warn(`GitHub 资源下载失败 (${relPath} @ ${base}):`, error);
        }
    }

    const reason =
        lastError instanceof Error ? lastError.message : String(lastError);
    throw new Error(
        `资源下载失败（已尝试 ${candidates.length} 条镜像线路：${reason}）`,
    );
}
