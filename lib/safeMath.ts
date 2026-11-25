export function evalSafeMath(expr: string): number | null {
    const src = expr.trim();
    if (!src) return null;
    if (!/^[\d+\-*/.\s()]+$/.test(src)) return null;

    let pos = 0;

    function skipSpaces() {
        while (pos < src.length && /\s/.test(src[pos])) pos++;
    }

    function parseExpr(): number | null {
        let left = parseTerm();
        if (left === null) return null;
        while (true) {
            skipSpaces();
            const ch = src[pos];
            if (ch !== "+" && ch !== "-") break;
            pos++;
            const right = parseTerm();
            if (right === null) return null;
            left = ch === "+" ? left + right : left - right;
        }
        return left;
    }

    function parseTerm(): number | null {
        let left = parseFactor();
        if (left === null) return null;
        while (true) {
            skipSpaces();
            const ch = src[pos];
            if (ch !== "*" && ch !== "/") break;
            pos++;
            const right = parseFactor();
            if (right === null) return null;
            if (ch === "/") {
                if (right === 0) return null;
                left /= right;
            } else {
                left *= right;
            }
        }
        return left;
    }

    function parseFactor(): number | null {
        skipSpaces();
        const ch = src[pos];
        if (ch === "+") {
            pos++;
            return parseFactor();
        }
        if (ch === "-") {
            pos++;
            const v = parseFactor();
            return v === null ? null : -v;
        }
        if (ch === "(") {
            pos++;
            const v = parseExpr();
            if (v === null) return null;
            skipSpaces();
            if (src[pos] !== ")") return null;
            pos++;
            return v;
        }
        return parseNumber();
    }

    function parseNumber(): number | null {
        skipSpaces();
        const start = pos;
        let hasDigit = false;
        let hasDot = false;
        while (pos < src.length) {
            const c = src[pos];
            if (c >= "0" && c <= "9") {
                hasDigit = true;
                pos++;
            } else if (c === "." && !hasDot) {
                hasDot = true;
                pos++;
            } else {
                break;
            }
        }
        if (!hasDigit) return null;
        const val = Number(src.slice(start, pos));
        return Number.isFinite(val) ? val : null;
    }

    const result = parseExpr();
    if (result === null || !Number.isFinite(result)) return null;
    skipSpaces();
    if (pos !== src.length) return null;
    return result;
}
