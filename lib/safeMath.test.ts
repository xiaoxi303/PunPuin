import { describe, expect, it } from "vitest";
import { evalSafeMath } from "./safeMath";

describe("evalSafeMath", () => {
    it("evaluates basic arithmetic and operator precedence", () => {
        expect(evalSafeMath("100")).toBe(100);
        expect(evalSafeMath("10 + 20 * 3")).toBe(70);
        expect(evalSafeMath("(10 + 20) * 3")).toBe(90);
        expect(evalSafeMath("1920 / 2")).toBe(960);
        expect(evalSafeMath("100 - 25 - 15")).toBe(60);
    });

    it("handles unary signs, decimals, and nested parentheses", () => {
        expect(evalSafeMath("-42")).toBe(-42);
        expect(evalSafeMath("+12.5 * 2")).toBe(25);
        expect(evalSafeMath("((10 + 2) * (8 - 3)) / 4")).toBe(15);
        expect(evalSafeMath("-(10 + 5) + 20")).toBe(5);
        expect(evalSafeMath(".5 + 1.5")).toBe(2);
    });

    it("rejects division by zero and malformed expressions", () => {
        expect(evalSafeMath("")).toBeNull();
        expect(evalSafeMath("   ")).toBeNull();
        expect(evalSafeMath("10 / 0")).toBeNull();
        expect(evalSafeMath("(10 + 2")).toBeNull();
        expect(evalSafeMath("10 + 2)")).toBeNull();
        expect(evalSafeMath("10 + * 2")).toBeNull();
        expect(evalSafeMath("1.2.3")).toBeNull();
    });

    it("rejects non-math or injection strings", () => {
        expect(evalSafeMath("process.exit(1)")).toBeNull();
        expect(evalSafeMath("alert(1)")).toBeNull();
        expect(evalSafeMath("10; 20")).toBeNull();
        expect(evalSafeMath("Math.max(1, 2)")).toBeNull();
    });
});
