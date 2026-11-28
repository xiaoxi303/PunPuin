import { describe, expect, it } from "vitest";
import {
    normalizeImageSearchEngine,
    runReverseImageSearch,
} from "./imageSearch";

const samplePngDataUrl =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

describe("reverse image search", () => {
    it("normalizes unknown engines to bing", () => {
        expect(normalizeImageSearchEngine("baidu")).toBe("baidu");
        expect(normalizeImageSearchEngine("so360")).toBe("so360");
        expect(normalizeImageSearchEngine("unknown")).toBe("bing");
    });

    it("resolves Google Lens 303 redirect cleanly", async () => {
        const res = await runReverseImageSearch(
            { imageDataUrl: samplePngDataUrl, engine: "google" },
            {
                fetchImpl: async () => ({
                    ok: false,
                    status: 303,
                    headers: {
                        get: (k: string) =>
                            k.toLowerCase() === "location"
                                ? "https://www.google.com/search?vsrid=abc&udm=26"
                                : null,
                    },
                    text: async () => "",
                    json: async () => ({}),
                }),
            },
        );
        expect(res.ok).toBe(true);
        if (res.ok) {
            expect(res.engine).toBe("google");
            expect(res.url).toBe(
                "https://www.google.com/search?vsrid=abc&udm=26",
            );
        }
    });

    it("resolves Yandex cbir_id + orig URL and caches for instant Bing switch", async () => {
        let uploadCalls = 0;
        const mockFetch = async (url: string) => {
            if (url.includes("yandex.com/images-apphost")) {
                uploadCalls++;
                return {
                    ok: true,
                    status: 200,
                    headers: { get: () => null },
                    text: async () => "",
                    json: async () => ({
                        cbir_id: "123/xyz",
                        sizes: {
                            orig: {
                                path: "https://avatars.mds.yandex.net/get-images-cbir/123/xyz/orig",
                            },
                        },
                    }),
                };
            }
            throw new Error(`unexpected url: ${url}`);
        };

        const yRes = await runReverseImageSearch(
            { imageDataUrl: samplePngDataUrl, engine: "yandex" },
            { fetchImpl: mockFetch },
        );
        expect(yRes.ok).toBe(true);
        if (yRes.ok) {
            expect(yRes.url).toContain("cbir_id=123%2Fxyz");
            expect(yRes.publicImageUrl).toBe(
                "https://avatars.mds.yandex.net/get-images-cbir/123/xyz/orig",
            );
        }

        const bRes = await runReverseImageSearch(
            { imageDataUrl: samplePngDataUrl, engine: "bing" },
            { fetchImpl: mockFetch },
        );
        expect(bRes.ok).toBe(true);
        expect(uploadCalls).toBe(1);
        if (bRes.ok) {
            expect(bRes.url).toContain("www.bing.com/images/search");
            expect(bRes.url).toContain("avatars.mds.yandex.net");
        }
    });

    it("falls back to browser_upload when Baidu direct API returns Reject", async () => {
        const res = await runReverseImageSearch(
            { imageDataUrl: samplePngDataUrl, engine: "baidu" },
            {
                fetchImpl: async () => ({
                    ok: true,
                    status: 200,
                    headers: { get: () => null },
                    text: async () => "",
                    json: async () => ({
                        status: 1,
                        msg: "Reject",
                        data: null,
                    }),
                }),
            },
        );
        expect(res.ok).toBe(true);
        if (res.ok) {
            expect(res.mode).toBe("browser_upload");
            expect(res.url).toContain("graph.baidu.com/pcpage/index");
            expect(res.browserUpload?.fileInputSelector).toBe(
                'input[type="file"]',
            );
        }
    });

    it("resolves 360 st.so.com 302 Location cleanly", async () => {
        const res = await runReverseImageSearch(
            { imageDataUrl: samplePngDataUrl, engine: "so360" },
            {
                fetchImpl: async () => ({
                    ok: false,
                    status: 302,
                    headers: {
                        get: (k: string) =>
                            k.toLowerCase() === "location"
                                ? "/stu?a=list&imgkey=test123.jpg"
                                : null,
                    },
                    text: async () => "",
                    json: async () => ({}),
                }),
            },
        );
        expect(res.ok).toBe(true);
        if (res.ok) {
            expect(res.url).toBe(
                "https://st.so.com/stu?a=list&imgkey=test123.jpg",
            );
        }
    });
});
