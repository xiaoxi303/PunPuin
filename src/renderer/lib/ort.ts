const fs = require("node:fs") as typeof import("node:fs");

let cachedOrt: typeof import("onnxruntime-node") | null = null;

export function getOrt(): typeof import("onnxruntime-node") {
    if (!cachedOrt) {
        require("node:process").env.ORT_DISABLE_TELEMETRY = "1";
        cachedOrt =
            require("onnxruntime-node") as typeof import("onnxruntime-node");
    }
    return cachedOrt;
}

export function resolveUnpackedPath(p: string): string {
    const unpacked = p.replace(
        /([\\/])app\.asar([\\/])/,
        "$1app.asar.unpacked$2",
    );
    if (unpacked !== p && fs.existsSync(unpacked)) {
        return unpacked;
    }
    return p;
}

export function getOrtExecutionProviders(backend?: string) {
    const mapped = backend === "directml" ? "dml" : backend || "cpu";
    if (mapped === "cpu") return [{ name: "cpu" }];
    return [{ name: mapped }, { name: "cpu" }];
}

export function getOrtSessionOptions(backend?: string) {
    const executionProviders = getOrtExecutionProviders(backend);
    const isDml = backend === "directml" || backend === "dml";
    return {
        executionProviders,
        ...(isDml
            ? {
                  enableMemPattern: false,
                  executionMode: "sequential" as const,
              }
            : {}),
    };
}
